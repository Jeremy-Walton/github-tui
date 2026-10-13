type Pending = {
	id: string;
	label: string;
	timer: NodeJS.Timeout;
	run: () => Promise<void>;
	restore: () => void;
	onFail: (error: Error) => void;
};

// GitHub can't un-mark a notification as done, so actions wait here for a grace
// period before they're sent. Undo just cancels the most recent pending action.
export class ActionQueue {
	private pending: Pending[] = [];

	constructor(private delayMs = 15_000) {}

	has(id: string): boolean {
		return this.pending.some(p => p.id === id);
	}

	add(action: Omit<Pending, 'timer'>) {
		const p: Pending = {...action, timer: setTimeout(() => this.commit(p), this.delayMs)};
		this.pending.push(p);
	}

	undo(): string | null {
		const p = this.pending.pop();
		if (!p) return null;
		clearTimeout(p.timer);
		p.restore();
		return p.label;
	}

	async flush() {
		const all = this.pending.splice(0);
		all.forEach(p => clearTimeout(p.timer));
		await Promise.allSettled(all.map(p => p.run()));
	}

	private commit(p: Pending) {
		this.pending = this.pending.filter(x => x !== p);
		p.run().catch((e: Error) => {
			p.restore();
			p.onFail(e);
		});
	}
}
