import {EventEmitter} from 'node:events';
import {render} from 'ink';
import type {ReactElement} from 'react';

// A fake terminal for rendering the app in tests. Based on ink-testing-library,
// which has no `rows`, and the app sizes its layout to the terminal height.
class FakeStdout extends EventEmitter {
	readonly isTTY = true;
	lastFrame = '';
	constructor(
		readonly columns: number,
		readonly rows: number,
	) {
		super();
	}
	write = (frame: string) => {
		this.lastFrame = frame;
		return true;
	};
}

class FakeStdin extends EventEmitter {
	readonly isTTY = true;
	private data: string | null = null;
	write = (data: string) => {
		this.data = data;
		this.emit('readable');
		this.emit('data', data);
	};
	read = () => {
		const {data} = this;
		this.data = null;
		return data;
	};
	setEncoding() {}
	setRawMode() {}
	resume() {}
	pause() {}
	ref() {}
	unref() {}
}

export const COLUMNS = 160;
export const ROWS = 40;

export function renderApp(tree: ReactElement) {
	const stdout = new FakeStdout(COLUMNS, ROWS);
	const stdin = new FakeStdin();
	const instance = render(tree, {
		stdout: stdout as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		debug: true,
		exitOnCtrlC: false,
		patchConsole: false,
	});
	return {
		frame: () => stdout.lastFrame,
		// Each key is sent separately, like a person typing.
		press: async (...keys: string[]) => {
			for (const key of keys) {
				stdin.write(key);
				await tick();
			}
		},
		unmount: instance.unmount,
	};
}

// Ink holds a lone escape for 20ms (pendingInputFlushDelayMilliseconds) to tell it apart from
// arrow-key sequences. Shorter waits drop or merge escapes, so every key waits past that window.
export const tick = () => new Promise(resolve => setTimeout(resolve, 25));

export const keys = {down: '\u001B[B', left: '\u001B[D', escape: '\u001B'};
