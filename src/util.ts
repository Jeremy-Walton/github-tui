import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {useCallback, useEffect, useRef, useState} from 'react';

export function openUrl(url: string) {
	const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
	spawn(cmd, [url], {detached: true, stdio: 'ignore'}).unref();
}

export function timeAgo(iso: string | null): string {
	if (!iso) return '';
	const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
	if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo ago`;
	return `${Math.floor(s / (86400 * 365))}y ago`;
}

// Every search word must appear somewhere in the item's text.
export function matches(text: string, query: string): boolean {
	const hay = text.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every(word => hay.includes(word));
}

const CACHE_DIR = join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'github-tui');

async function readCache<T>(key: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), 'utf8')) as T;
	} catch {
		return null;
	}
}

async function writeCache(key: string, data: unknown) {
	try {
		await mkdir(CACHE_DIR, {recursive: true});
		await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(data));
	} catch {
		// Cache is best-effort; a failed write only costs a slower next startup.
	}
}

export type Resource<T> = {
	data: T | null;
	loading: boolean;
	error: string | null;
	refresh: () => void;
	update: (fn: (data: T) => T) => void;
};

// Shows the last cached result instantly, then replaces it with fresh data once `wait` is false.
export function useResource<T>(key: string | null, load: () => Promise<T>, {wait = false} = {}): Resource<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const loadRef = useRef(load);
	loadRef.current = load;
	const run = useRef(0);

	const refresh = useCallback(() => {
		if (!key) return;
		const id = ++run.current;
		setLoading(true);
		setError(null);
		loadRef
			.current()
			.then(fresh => {
				if (id !== run.current) return;
				setData(fresh);
				void writeCache(key, fresh);
			})
			.catch((e: Error) => id === run.current && setError(e.message))
			.finally(() => id === run.current && setLoading(false));
	}, [key]);

	useEffect(() => {
		if (!key) return;
		void readCache<T>(key).then(cached => {
			if (cached) setData(prev => prev ?? cached);
		});
	}, [key]);

	useEffect(() => {
		if (!wait) refresh();
	}, [wait, refresh]);

	const update = useCallback(
		(fn: (data: T) => T) => {
			setData(prev => {
				if (prev === null) return prev;
				const next = fn(prev);
				if (key) void writeCache(key, next);
				return next;
			});
		},
		[key],
	);

	return {data, loading, error, refresh, update};
}
