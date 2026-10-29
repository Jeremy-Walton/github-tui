import {execFile, spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {ghEnv} from './github.js';
import {CACHE_DIR} from './util.js';

const exec = promisify(execFile);

export const SLICE_URL = 'https://github.com/gavinomelia/slice';
const NOT_INSTALLED = "slice isn't installed. Install it with: npm install -g @gavinomelia/slice";
// slice refuses to run outside a git repo, but it reads a PR URL's diff from GitHub, so an empty repo works for any PR.
const SLICE_DIR = join(CACHE_DIR, 'slice');

// Resolves to a message for the status line when slice can't run or exits with an error.
export async function runSlice(url: string, command = 'slice'): Promise<string | null> {
	await mkdir(SLICE_DIR, {recursive: true});
	await exec('git', ['init', '--quiet'], {cwd: SLICE_DIR});
	return new Promise(resolve => {
		// stderr is captured so slice's error can be shown after the app takes the screen back.
		const child = spawn(command, [url], {cwd: SLICE_DIR, env: ghEnv(), stdio: ['inherit', 'inherit', 'pipe']});
		let stderr = '';
		child.stderr.on('data', chunk => {
			stderr += chunk;
		});
		child.on('error', e => resolve((e as NodeJS.ErrnoException).code === 'ENOENT' ? NOT_INSTALLED : e.message));
		child.on('close', code => {
			// 127 is a version manager's shim (nodenv, asdf) finding no slice in the active Node version.
			if (code === 127) return resolve(NOT_INSTALLED);
			if (code === 0) return resolve(null);
			const lines = stderr.split('\n').map(line => line.trim());
			resolve(lines.filter(Boolean).at(-1) ?? `slice exited with code ${code}`);
		});
	});
}
