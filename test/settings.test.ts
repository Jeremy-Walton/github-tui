import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('settings file', () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'github-tui-'));
		vi.stubEnv('XDG_CONFIG_HOME', dir);
		// The settings path is read from the environment when the module loads.
		vi.resetModules();
	});

	afterEach(() => rm(dir, {recursive: true, force: true}));

	const load = () => import('../src/settings.js');

	it('uses defaults when there is no file', async () => {
		const {readSettings} = await load();
		expect(await readSettings()).toEqual({theme: 'default'});
	});

	it('writes and reads back the chosen theme', async () => {
		const {readSettings, writeSettings, SETTINGS_FILE} = await load();
		await writeSettings({theme: 'cobalt2'});
		expect(SETTINGS_FILE).toBe(join(dir, 'github-tui', 'settings.json'));
		expect(JSON.parse(await readFile(SETTINGS_FILE, 'utf8'))).toEqual({theme: 'cobalt2'});
		expect(await readSettings()).toEqual({theme: 'cobalt2'});
	});

	it('falls back to defaults when the file is not valid JSON', async () => {
		const {readSettings, writeSettings, SETTINGS_FILE} = await load();
		await writeSettings({theme: 'nord'});
		await writeFile(SETTINGS_FILE, '{oops');
		expect(await readSettings()).toEqual({theme: 'default'});
	});
});
