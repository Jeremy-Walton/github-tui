import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DEFAULT_SETTINGS, movePage} from '../src/settings.js';

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
		expect(await readSettings()).toEqual({
			theme: 'default',
			showBotPullRequests: false,
			showWatchedRepos: true,
			sidebar: ['pull-requests', 'repositories', 'inbox'],
		});
	});

	it('writes and reads back the chosen theme', async () => {
		const {readSettings, writeSettings, SETTINGS_FILE} = await load();
		const settings = {...DEFAULT_SETTINGS, theme: 'cobalt2'};
		await writeSettings(settings);
		expect(SETTINGS_FILE).toBe(join(dir, 'github-tui', 'settings.json'));
		expect(JSON.parse(await readFile(SETTINGS_FILE, 'utf8'))).toEqual(settings);
		expect(await readSettings()).toEqual(settings);
	});

	it('falls back to defaults when the file is not valid JSON', async () => {
		const {readSettings, writeSettings, SETTINGS_FILE} = await load();
		await writeSettings({...DEFAULT_SETTINGS, theme: 'nord'});
		await writeFile(SETTINGS_FILE, '{oops');
		expect(await readSettings()).toEqual(DEFAULT_SETTINGS);
	});

	it('keeps an older file that only has a theme', async () => {
		const {readSettings, SETTINGS_FILE} = await load();
		await mkdir(dirname(SETTINGS_FILE), {recursive: true});
		await writeFile(SETTINGS_FILE, JSON.stringify({theme: 'nord'}));
		expect(await readSettings()).toEqual({...DEFAULT_SETTINGS, theme: 'nord'});
	});

	it('drops unknown sidebar pages and adds missing ones at the end', async () => {
		const {readSettings, SETTINGS_FILE} = await load();
		await mkdir(dirname(SETTINGS_FILE), {recursive: true});
		await writeFile(SETTINGS_FILE, JSON.stringify({sidebar: ['inbox', 'gists', 'inbox', 'repositories']}));
		expect((await readSettings()).sidebar).toEqual(['inbox', 'repositories', 'pull-requests']);
	});
});

describe('movePage', () => {
	const order = DEFAULT_SETTINGS.sidebar;

	it('moves a page up or down one place', () => {
		expect(movePage(order, 'inbox', -1)).toEqual(['pull-requests', 'inbox', 'repositories']);
		expect(movePage(order, 'pull-requests', 1)).toEqual(['repositories', 'pull-requests', 'inbox']);
	});

	it('stays put at either end', () => {
		expect(movePage(order, 'pull-requests', -1)).toBe(order);
		expect(movePage(order, 'inbox', 1)).toBe(order);
	});
});
