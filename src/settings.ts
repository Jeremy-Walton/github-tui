import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname, join} from 'node:path';
import {runtime} from './util.js';

export type PageId = 'pull-requests' | 'repositories' | 'inbox';

export type Settings = {
	theme: string;
	showBotPullRequests: boolean;
	showWatchedRepos: boolean;
	askToOpenInSlice: boolean;
	// Settings itself always sits at the bottom of the sidebar, so it isn't listed.
	sidebar: PageId[];
};

export const DEFAULT_SETTINGS: Settings = {
	theme: 'default',
	showBotPullRequests: false,
	showWatchedRepos: true,
	askToOpenInSlice: false,
	sidebar: ['pull-requests', 'repositories', 'inbox'],
};

export const SETTINGS_FILE = join(
	process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
	'github-tui',
	'settings.json',
);

export async function readSettings(): Promise<Settings> {
	if (runtime.demo) return DEFAULT_SETTINGS;
	try {
		const saved = JSON.parse(await readFile(SETTINGS_FILE, 'utf8')) as Partial<Settings>;
		return {...DEFAULT_SETTINGS, ...saved, sidebar: sidebarOrder(saved.sidebar)};
	} catch {
		return DEFAULT_SETTINGS;
	}
}

export async function writeSettings(settings: Settings) {
	if (runtime.demo) return;
	await mkdir(dirname(SETTINGS_FILE), {recursive: true});
	await writeFile(SETTINGS_FILE, `${JSON.stringify(settings, null, 2)}\n`);
}

// A hand-edited or older file may name pages that no longer exist or miss new ones.
function sidebarOrder(saved: unknown): PageId[] {
	const all = DEFAULT_SETTINGS.sidebar;
	const ids: unknown[] = Array.isArray(saved) ? saved : [];
	const known = [...new Set(ids)].filter((id): id is PageId => all.includes(id as PageId));
	return [...known, ...all.filter(id => !known.includes(id))];
}

export function movePage(order: PageId[], id: PageId, delta: -1 | 1): PageId[] {
	const from = order.indexOf(id);
	const to = from + delta;
	if (from === -1 || to < 0 || to >= order.length) return order;
	const next = [...order];
	[next[from], next[to]] = [order[to] as PageId, id];
	return next;
}
