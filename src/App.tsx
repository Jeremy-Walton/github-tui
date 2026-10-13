import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {useEffect, useState} from 'react';
import type {ActionQueue} from './actions.js';
import type {GitHub, Viewer} from './github.js';
import {InboxPage} from './pages/Inbox.js';
import {PullRequestsPage} from './pages/PullRequests.js';
import {ReposPage} from './pages/Repos.js';
import {useResource} from './util.js';

const PAGES = ['Pull Requests', 'Repositories', 'Inbox'] as const;
const INBOX = 2;
const SIDEBAR_WIDTH = 24;

type Focus = 'sidebar' | 'main';
type Search = {query: string; searching: boolean};

export function App({gh, viewer, actions}: {gh: GitHub; viewer: Viewer; actions: ActionQueue}) {
	const {exit} = useApp();
	const {columns, rows} = useWindowSize();
	const [page, setPage] = useState(0);
	const [focus, setFocus] = useState<Focus>('main');
	const [searches, setSearches] = useState<Search[]>(PAGES.map(() => ({query: '', searching: false})));
	const [message, setMessage] = useState('');

	const prs = useResource(`${viewer.login}-prs`, () => gh.pullRequests());
	// Pull requests are the landing page, so the other pages wait for its first fetch to finish.
	const [othersWait, setOthersWait] = useState(true);
	useEffect(() => {
		if (!prs.loading) setOthersWait(false);
	}, [prs.loading]);
	const repos = useResource(`${viewer.login}-repos`, () => gh.repos(viewer.login), {wait: othersWait});
	const inbox = useResource(`${viewer.login}-inbox`, () => gh.notifications(), {wait: othersWait});
	const resources = [prs, repos, inbox];

	useEffect(() => {
		if (!message) return;
		const t = setTimeout(() => setMessage(''), 4000);
		return () => clearTimeout(t);
	}, [message]);

	const search = searches[page]!;
	const setSearch = (patch: Partial<Search>) =>
		setSearches(all => all.map((s, i) => (i === page ? {...s, ...patch} : s)));

	useInput((input, key) => {
		if (search.searching) {
			if (key.escape || key.tab) return setSearch({searching: false});
			if (key.backspace || key.delete) return setSearch({query: search.query.slice(0, -1)});
			if (key.ctrl && input === 'u') return setSearch({query: ''});
			if (input && !key.ctrl && !key.meta && !key.return && !key.upArrow && !key.downArrow) {
				setSearch({query: search.query + input.replace(/[\r\n]/g, '')});
			}
			return;
		}

		if (input === 'q') return exit();
		if (input === '/') {
			setFocus('main');
			return setSearch({searching: true});
		}
		if (['1', '2', '3'].includes(input)) {
			setPage(Number(input) - 1);
			return setFocus('main');
		}
		if (input === 'r') {
			resources[page]!.refresh();
			return setMessage(`Refreshing ${PAGES[page]}…`);
		}
		if (key.escape && search.query) return setSearch({query: ''});
		if (key.tab) return setFocus(f => (f === 'sidebar' ? 'main' : 'sidebar'));
		if (key.leftArrow || input === 'h') return setFocus('sidebar');
		if (focus === 'sidebar') {
			if (key.rightArrow || input === 'l' || key.return) return setFocus('main');
			if (key.upArrow || input === 'k') return setPage(p => Math.max(0, p - 1));
			if (key.downArrow || input === 'j') return setPage(p => Math.min(PAGES.length - 1, p + 1));
		}
	});

	const counts = [
		prs.data?.length,
		repos.data?.length,
		inbox.data ? inbox.data.filter(n => n.unread).length : undefined,
	];
	const bodyHeight = rows - 2;
	const mainHeight = bodyHeight - 2;
	const pageProps = {
		height: mainHeight,
		query: search.query,
		searching: search.searching,
		active: focus === 'main',
		onMessage: setMessage,
	};

	return (
		<Box flexDirection="column" width={columns} height={rows}>
			<Box paddingX={1}>
				<Text bold color="cyan">
					GitHub
				</Text>
				<Text dimColor> · </Text>
				<Text bold>@{viewer.login}</Text>
				{viewer.name ? <Text dimColor> ({viewer.name})</Text> : null}
				<Box flexGrow={1} />
				{resources.some(r => r.loading) ? <Text dimColor>syncing…</Text> : null}
			</Box>
			<Box height={bodyHeight}>
				<Box
					flexDirection="column"
					width={SIDEBAR_WIDTH}
					flexShrink={0}
					borderStyle="round"
					borderColor={focus === 'sidebar' ? 'cyan' : 'gray'}
					paddingX={1}
				>
					{PAGES.map((name, i) => (
						<Text key={name} wrap="truncate-end" inverse={i === page && focus === 'sidebar'} color={i === page ? 'cyan' : undefined}>
							{i === page ? '› ' : '  '}
							{name}
							{counts[i] !== undefined ? <Text dimColor> {counts[i]}</Text> : null}
						</Text>
					))}
				</Box>
				<Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={focus === 'main' ? 'cyan' : 'gray'}>
					{page === 0 ? <PullRequestsPage resource={prs} {...pageProps} /> : null}
					{page === 1 ? <ReposPage resource={repos} {...pageProps} /> : null}
					{page === INBOX ? <InboxPage resource={inbox} gh={gh} actions={actions} {...pageProps} /> : null}
				</Box>
			</Box>
			<Box paddingX={1}>
				{message ? (
					<Text color="yellow" wrap="truncate-end">
						{message}
					</Text>
				) : (
					<Text dimColor wrap="truncate-end">{hints(page, focus, search.searching)}</Text>
				)}
			</Box>
		</Box>
	);
}

function hints(page: number, focus: Focus, searching: boolean): string {
	if (searching) return 'type to filter · ↑↓ move · enter open · esc done · ctrl+u clear';
	if (focus === 'sidebar') return '↑↓ switch page · → / enter go to list · / search · 1-3 jump · q quit';
	const base = '↑↓ move · enter open · / search · ← sidebar · 1-3 jump · r refresh · q quit';
	return page === INBOX ? `e done · t unsubscribe · u undo · ${base}` : base;
}
