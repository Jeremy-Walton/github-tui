import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {type ReactNode, useEffect, useState} from 'react';
import type {ActionQueue} from './actions.js';
import type {GitHubClient, Viewer} from './github.js';
import {INBOX_HINTS, InboxPage} from './pages/Inbox.js';
import {PullRequestsPage} from './pages/PullRequests.js';
import {ReposPage} from './pages/Repos.js';
import type {PageProps} from './pages/types.js';
import {type Resource, useResource} from './util.js';

const SIDEBAR_WIDTH = 24;
const NO_SEARCH: Search = {query: '', searching: false};

type Focus = 'sidebar' | 'main';
type Search = {query: string; searching: boolean};
type Page = {
	name: string;
	resource: Pick<Resource<unknown>, 'loading' | 'refresh'>;
	count: number | undefined;
	hints?: string;
	render: (props: PageProps) => ReactNode;
};

export function App({gh, viewer, actions}: {gh: GitHubClient; viewer: Viewer; actions: ActionQueue}) {
	const {exit} = useApp();
	const {columns, rows} = useWindowSize();
	const [page, setPage] = useState(0);
	const [focus, setFocus] = useState<Focus>('main');
	const [searches, setSearches] = useState<Record<number, Search>>({});
	const [message, setMessage] = useState('');

	const prs = useResource(`${viewer.login}-prs`, () => gh.pullRequests());
	// Pull requests are the landing page, so the other pages wait for its first fetch to finish.
	const [othersWait, setOthersWait] = useState(true);
	useEffect(() => {
		if (!prs.loading) setOthersWait(false);
	}, [prs.loading]);
	const repos = useResource(`${viewer.login}-repos`, () => gh.repos(viewer.login), {wait: othersWait});
	const inbox = useResource(`${viewer.login}-inbox`, () => gh.notifications(), {wait: othersWait});

	const pages: [Page, ...Page[]] = [
		{
			name: 'Pull Requests',
			resource: prs,
			count: prs.data?.length,
			render: p => <PullRequestsPage resource={prs} {...p} />,
		},
		{
			name: 'Repositories',
			resource: repos,
			count: repos.data?.length,
			render: p => <ReposPage resource={repos} {...p} />,
		},
		{
			name: 'Inbox',
			resource: inbox,
			count: inbox.data?.filter(n => n.unread).length,
			hints: INBOX_HINTS,
			render: p => <InboxPage resource={inbox} gh={gh} actions={actions} {...p} />,
		},
	];
	const current = pages[page] ?? pages[0];

	useEffect(() => {
		if (!message) return;
		const t = setTimeout(() => setMessage(''), 4000);
		return () => clearTimeout(t);
	}, [message]);

	const search = searches[page] ?? NO_SEARCH;
	const setSearch = (patch: Partial<Search>) => setSearches(all => ({...all, [page]: {...search, ...patch}}));

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
		const n = Number(input);
		if (n >= 1 && n <= pages.length) {
			setPage(n - 1);
			return setFocus('main');
		}
		if (input === 'r') {
			current.resource.refresh();
			return setMessage(`Refreshing ${current.name}…`);
		}
		if (key.escape && search.query) return setSearch({query: ''});
		if (key.tab) return setFocus(f => (f === 'sidebar' ? 'main' : 'sidebar'));
		if (key.leftArrow || input === 'h') return setFocus('sidebar');
		if (focus === 'sidebar') {
			if (key.rightArrow || input === 'l' || key.return) return setFocus('main');
			if (key.upArrow || input === 'k') return setPage(p => Math.max(0, p - 1));
			if (key.downArrow || input === 'j') return setPage(p => Math.min(pages.length - 1, p + 1));
		}
	});

	const bodyHeight = rows - 2;
	const mainHeight = bodyHeight - 2;
	const pageProps: PageProps = {
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
				{pages.some(p => p.resource.loading) ? <Text dimColor>syncing…</Text> : null}
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
					{pages.map(({name, count}, i) => (
						<Text
							key={name}
							wrap="truncate-end"
							inverse={i === page && focus === 'sidebar'}
							color={i === page ? 'cyan' : undefined}
						>
							{i === page ? '› ' : '  '}
							{name}
							{count !== undefined ? <Text dimColor> {count}</Text> : null}
						</Text>
					))}
				</Box>
				<Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={focus === 'main' ? 'cyan' : 'gray'}>
					{current.render(pageProps)}
				</Box>
			</Box>
			<Box paddingX={1}>
				{message ? (
					<Text color="yellow" wrap="truncate-end">
						{message}
					</Text>
				) : (
					<Text dimColor wrap="truncate-end">
						{hints(current, pages.length, focus, search.searching)}
					</Text>
				)}
			</Box>
		</Box>
	);
}

function hints(page: Page, pageCount: number, focus: Focus, searching: boolean): string {
	if (searching) return 'type to filter · ↑↓ move · enter open · esc done · ctrl+u clear';
	const jump = `1-${pageCount} jump`;
	if (focus === 'sidebar') return `↑↓ switch page · → / enter go to list · / search · ${jump} · q quit`;
	const base = `↑↓ move · enter open · / search · ← sidebar · ${jump} · r refresh · q quit`;
	return page.hints ? `${page.hints} · ${base}` : base;
}
