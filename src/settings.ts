import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {runtime} from './util.js';

export type Settings = {theme: string};

const DEFAULTS: Settings = {theme: 'default'};

export const SETTINGS_FILE = join(
	process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
	'github-tui',
	'settings.json',
);

export async function readSettings(): Promise<Settings> {
	if (runtime.demo) return DEFAULTS;
	try {
		return {...DEFAULTS, ...(JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) as Partial<Settings>)};
	} catch {
		return DEFAULTS;
	}
}

export async function writeSettings(settings: Settings) {
	if (runtime.demo) return;
	await mkdir(dirname(SETTINGS_FILE), {recursive: true});
	await writeFile(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`);
}
