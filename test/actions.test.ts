import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ActionQueue} from '../src/actions.js';

function action(id: string, run: () => Promise<void> = async () => {}) {
	return {id, label: id, run: vi.fn(run), onDone: vi.fn(), onFail: vi.fn()};
}

describe('ActionQueue', () => {
	let queue: ActionQueue;
	beforeEach(() => {
		vi.useFakeTimers();
		queue = new ActionQueue(1000);
	});
	afterEach(() => vi.useRealTimers());

	it('holds an action as pending until the delay passes, then runs it', async () => {
		const a = action('a');
		queue.add(a);

		expect(queue.pendingIds().has('a')).toBe(true);
		expect(a.run).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);

		expect(a.run).toHaveBeenCalledOnce();
		expect(a.onDone).toHaveBeenCalledOnce();
		expect(queue.pendingIds().has('a')).toBe(false);
	});

	it('undoes the most recent unsent action without running it', async () => {
		const a = action('a');
		const b = action('b');
		queue.add(a);
		queue.add(b);

		expect(queue.undo()).toBe('b');
		expect([...queue.pendingIds()]).toEqual(['a']);

		await vi.advanceTimersByTimeAsync(1000);
		expect(b.run).not.toHaveBeenCalled();
		expect(a.run).toHaveBeenCalledOnce();
		expect(queue.undo()).toBeNull();
	});

	it('reports failures and stops hiding the item', async () => {
		const a = action('a', async () => {
			throw new Error('boom');
		});
		queue.add(a);

		await vi.advanceTimersByTimeAsync(1000);

		expect(a.onFail).toHaveBeenCalledWith(expect.objectContaining({message: 'boom'}));
		expect(a.onDone).not.toHaveBeenCalled();
		expect(queue.pendingIds().size).toBe(0);
	});

	it('sends everything still pending on flush', async () => {
		const a = action('a');
		const b = action('b');
		queue.add(a);
		queue.add(b);

		await queue.flush();

		expect(a.run).toHaveBeenCalledOnce();
		expect(b.run).toHaveBeenCalledOnce();
		expect(queue.pendingIds().size).toBe(0);
	});

	it('notifies subscribers and returns a new id set on each change', () => {
		const listener = vi.fn();
		const unsubscribe = queue.subscribe(listener);
		const before = queue.pendingIds();

		queue.add(action('a'));
		expect(listener).toHaveBeenCalledOnce();
		expect(queue.pendingIds()).not.toBe(before);

		unsubscribe();
		queue.undo();
		expect(listener).toHaveBeenCalledOnce();
	});
});
