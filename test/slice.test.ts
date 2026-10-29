import {chmod, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const URL = 'https://github.com/acme/api/pull/12';

describe('runSlice', () => {
	let dir: string;

	beforeEach(async () => {
		dir = await realpath(await mkdtemp(join(tmpdir(), 'github-tui-')));
		vi.stubEnv('XDG_CACHE_HOME', dir);
		// The cache path is read from the environment when the module loads.
		vi.resetModules();
	});

	afterEach(async () => {
		vi.unstubAllEnvs();
		await rm(dir, {recursive: true, force: true});
	});

	const load = () => import('../src/slice.js');

	const fakeSlice = async (body: string) => {
		const path = join(dir, 'fake-slice');
		await writeFile(path, `#!/bin/sh\n${body}\n`);
		await chmod(path, 0o755);
		return path;
	};

	it('opens the pull request URL from a git folder in the cache', async () => {
		const out = join(dir, 'out');
		vi.stubEnv('OUT', out);
		const {runSlice} = await load();
		const command = await fakeSlice('git rev-parse --show-toplevel > "$OUT"; echo "$@" >> "$OUT"');

		expect(await runSlice(URL, command)).toBeNull();
		expect(await readFile(out, 'utf8')).toBe(`${join(dir, 'github-tui', 'slice')}\n${URL}\n`);
	});

	it('runs again in the same folder', async () => {
		const {runSlice} = await load();
		const command = await fakeSlice('exit 0');
		expect(await runSlice(URL, command)).toBeNull();
		expect(await runSlice(URL, command)).toBeNull();
	});

	it('does not pass a token from the environment', async () => {
		const out = join(dir, 'out');
		vi.stubEnv('OUT', out);
		vi.stubEnv('GITHUB_TOKEN', 'secret');
		vi.stubEnv('GH_TOKEN', 'secret');
		const {runSlice} = await load();
		const command = await fakeSlice('echo "[$GITHUB_TOKEN$GH_TOKEN]" > "$OUT"');

		await runSlice(URL, command);
		expect(await readFile(out, 'utf8')).toBe('[]\n');
	});

	it('says how to install slice when it is missing', async () => {
		const {runSlice} = await load();
		const message = await runSlice(URL, join(dir, 'no-such-slice'));
		expect(message).toBe("slice isn't installed. Install it with: npm install -g @gavinomelia/slice");
	});

	it('treats a version manager shim with no slice behind it as missing', async () => {
		const {runSlice} = await load();
		const command = await fakeSlice('echo "nodenv: slice: command not found" >&2; exit 127');
		expect(await runSlice(URL, command)).toContain("slice isn't installed");
	});

	it('returns the last error line when slice fails', async () => {
		const {runSlice} = await load();
		const command = await fakeSlice('echo "  warning" >&2; echo "slice: could not find PR #12" >&2; exit 1');
		expect(await runSlice(URL, command)).toBe('slice: could not find PR #12');
	});
});
