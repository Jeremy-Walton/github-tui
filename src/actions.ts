type Action = {
	id: string;
	label: string;
	run: () => Promise<void>;
	onDone: () => void;
	onFail: (error: Error) => void;
};

type Pending = Action & {timer: NodeJS.Timeout; sent: boolean};

// GitHub can't un-mark a notification as done, so actions wait here for a grace
// period before they're sent. Undo just cancels the most recent unsent action.
// Subscribable so the UI can hide pending items without changing the underlying data.
export class ActionQueue {
	private pending: Pending[] = [];
	private ids: ReadonlySet<string> = new Set();
	private listeners = new Set<() => void>();

	constructor(private delayMs = 15_000) {}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	pendingIds = (): ReadonlySet<string> => this.ids;

	add(action: Action) {
		const p: Pending = {...action, sent: false, timer: setTimeout(() => void this.commit(p), this.delayMs)};
		this.pending.push(p);
		this.changed();
	}

	undo(): string | null {
		const p = this.pending.findLast(x => !x.sent);
		if (!p) return null;
		clearTimeout(p.timer);
		this.remove(p);
		return p.label;
	}

	async flush() {
		await Promise.all(this.pending.filter(p => !p.sent).map(p => this.commit(p)));
	}

	private async commit(p: Pending) {
		clearTimeout(p.timer);
		p.sent = true;
		try {
			await p.run();
			p.onDone();
		} catch (e) {
			p.onFail(e as Error);
		} finally {
			this.remove(p);
		}
	}

	private remove(p: Pending) {
		this.pending = this.pending.filter(x => x !== p);
		this.changed();
	}

	private changed() {
		this.ids = new Set(this.pending.map(p => p.id));
		for (const listener of this.listeners) listener();
	}
}
