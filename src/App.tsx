import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {Fragment, type ReactNode, useEffect, useMemo, useState} from 'react';
import type {ActionQueue} from './actions.js';
import type {GitHubClient, Viewer} from './github.js';
import {PROMPT_HINTS, type Prompt, PromptBox, promptHeight} from './Prompt.js';
import {INBOX_HINTS, InboxPage} from './pages/Inbox.js';
import {PullRequestsPage, visiblePullRequests} from './pages/PullRequests.js';
import {ReposPage} from './pages/Repos.js';
import {SETTINGS_HINTS, SettingsPage} from './pages/Settings.js';
import {PAGE_NAMES, type PageProps} from './pages/types.js';
import {DEFAULT_SETTINGS, type PageId, readSettings, type Settings, writeSettings} from './settings.js';
import {borderProps, findTheme, Muted, type Theme, ThemeProvider} from './theme.js';
import {type Resource, useResource} from './util.js';

const SIDEBAR_WIDTH = 24;
const NO_SEARCH: Search = {query: '', searching: false};
// Ink only adds its background context when a Box has a color, so going between a theme with a
// background and one without would change the tree and remount every page, losing its selection.
// Ink ignores color names it doesn't know, so this keeps the shape fixed and paints nothing.
const TERMINAL_BACKGROUND = 'terminal';

type Focus = 'sidebar' | 'main';
type Search = {query: string; searching: boolean};
type Page = {
	id: PageId | 'settings';
	name: string;
	resource: Pick<Resource<unknown>, 'loading' | 'refresh'>;
	count: number | undefined;
	hints?: string;
	atBottom?: boolean;
	render: (props: PageProps) => ReactNode;
};

type Props = {gh: GitHubClient; viewer: Viewer; actions: ActionQueue; settings?: Settings};

export function App({gh, viewer, actions, settings: initialSettings = DEFAULT_SETTINGS}: Props) {
	const {exit} = useApp();
	const {columns, rows} = useWindowSize();
	const [pageId, setPageId] = useState<Page['id']>(initialSettings.sidebar[0] ?? 'pull-requests');
	const [focus, setFocus] = useState<Focus>('main');
	const [searches, setSearches] = useState<Partial<Record<Page['id'], Search>>>({});
	const [message, setMessage] = useState('');
	const [prompt, setPrompt] = useState<{prompt: Prompt; selected: number} | null>(null);
	const [settings, setSettings] = useState(initialSettings);
	const theme = findTheme(settings.theme);

	const saveSettings = (next: Settings) => {
		setSettings(next);
		writeSettings(next).catch((e: Error) => setMessage(`Couldn't save settings: ${e.message}`));
	};

	// The top sidebar page is the landing page, so the other pages wait for its first fetch to finish.
	const [othersWait, setOthersWait] = useState(true);
	const top = settings.sidebar[0];
	const waitUnlessTop = (id: PageId) => ({wait: othersWait && id !== top});
	const prs = useResource(`${viewer.login}-prs`, () => gh.pullRequests(), waitUnlessTop('pull-requests'));
	const repos = useResource(`${viewer.login}-repos`, () => gh.repos(viewer.login), waitUnlessTop('repositories'));
	const inbox = useResource(`${viewer.login}-inbox`, () => gh.notifications(), waitUnlessTop('inbox'));

	const shownPRs = useMemo(() => visiblePullRequests(prs.data ?? [], settings), [prs.data, settings]);

	const sidebarPages: Record<PageId, Page> = {
		'pull-requests': {
			id: 'pull-requests',
			name: PAGE_NAMES['pull-requests'],
			resource: prs,
			count: prs.data ? shownPRs.length : undefined,
			render: p => (
				<PullRequestsPage resource={prs} items={shownPRs} askToOpenInSlice={settings.askToOpenInSlice} {...p} />
			),
		},
		repositories: {
			id: 'repositories',
			name: PAGE_NAMES.repositories,
			resource: repos,
			count: repos.data?.length,
			render: p => <ReposPage resource={repos} {...p} />,
		},
		inbox: {
			id: 'inbox',
			name: PAGE_NAMES.inbox,
			resource: inbox,
			count: inbox.data?.filter(n => n.unread).length,
			hints: INBOX_HINTS,
			render: p => <InboxPage resource={inbox} gh={gh} actions={actions} {...p} />,
		},
	};
	const settingsPage: Page = {
		id: 'settings',
		name: 'Settings',
		resource: {loading: false, refresh: () => void readSettings().then(setSettings)},
		count: undefined,
		hints: SETTINGS_HINTS,
		atBottom: true,
		render: p => <SettingsPage viewer={viewer} settings={settings} onChange={saveSettings} {...p} />,
	};
	const pages = [...settings.sidebar.map(id => sidebarPages[id]), settingsPage];
	const topLoading = pages[0]?.resource.loading;
	useEffect(() => {
		if (!topLoading) setOthersWait(false);
	}, [topLoading]);
	const current = pages.find(p => p.id === pageId) ?? settingsPage;
	const index = pages.indexOf(current);
	const goTo = (i: number) => setPageId((pages[Math.max(0, Math.min(pages.length - 1, i))] ?? current).id);

	useEffect(() => {
		if (!message) return;
		const t = setTimeout(() => setMessage(''), 4000);
		return () => clearTimeout(t);
	}, [message]);

	const search = searches[current.id] ?? NO_SEARCH;
	const setSearch = (patch: Partial<Search>) => setSearches(all => ({...all, [current.id]: {...search, ...patch}}));

	useInput((input, key) => {
		if (prompt) {
			const {choices} = prompt.prompt;
			if (key.escape) return setPrompt(null);
			if (key.upArrow || input === 'k') return setPrompt({...prompt, selected: Math.max(0, prompt.selected - 1)});
			if (key.downArrow || input === 'j') {
				return setPrompt({...prompt, selected: Math.min(choices.length - 1, prompt.selected + 1)});
			}
			const choice = key.return ? choices[prompt.selected] : choices.find(c => c.key === input);
			if (choice) {
				setPrompt(null);
				choice.run();
			}
			return;
		}
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
			goTo(n - 1);
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
			if (key.upArrow || input === 'k') return goTo(index - 1);
			if (key.downArrow || input === 'j') return goTo(index + 1);
		}
	});

	const bodyHeight = rows - 2 - (prompt ? promptHeight(prompt.prompt) : 0);
	const mainHeight = bodyHeight - 2;
	const pageProps: PageProps = {
		height: mainHeight,
		query: search.query,
		searching: search.searching,
		active: focus === 'main' && !prompt,
		onMessage: setMessage,
		onPrompt: next => setPrompt({prompt: next, selected: 0}),
	};

	return (
		<ThemeProvider value={theme}>
			<Box
				flexDirection="column"
				width={columns}
				height={rows}
				backgroundColor={theme.background ?? TERMINAL_BACKGROUND}
			>
				<Box paddingX={1}>
					<Text bold color={theme.accent}>
						GitHub
					</Text>
					<Muted> · </Muted>
					<Text bold color={theme.text}>
						@{viewer.login}
					</Text>
					{viewer.name ? <Muted> ({viewer.name})</Muted> : null}
					<Box flexGrow={1} />
					{pages.some(p => p.resource.loading) ? <Muted>syncing…</Muted> : null}
				</Box>
				<Box height={bodyHeight}>
					<Box
						flexDirection="column"
						width={SIDEBAR_WIDTH}
						flexShrink={0}
						borderStyle="round"
						{...borderProps(theme, focus === 'sidebar')}
					>
						{pages.map(p => (
							<Fragment key={p.id}>
								{p.atBottom ? <Box flexGrow={1} /> : null}
								<SidebarItem
									page={p}
									current={p === current}
									highlighted={p === current && focus === 'sidebar'}
									theme={theme}
								/>
							</Fragment>
						))}
					</Box>
					<Box flexDirection="column" flexGrow={1} borderStyle="round" {...borderProps(theme, focus === 'main')}>
						{current.render(pageProps)}
					</Box>
				</Box>
				{prompt ? <PromptBox prompt={prompt.prompt} selected={prompt.selected} /> : null}
				<Box paddingX={1}>
					{message ? (
						<Text color={theme.warning} wrap="truncate-end">
							{message}
						</Text>
					) : (
						<Muted wrap="truncate-end">
							{prompt ? PROMPT_HINTS : hints(current, pages.length, focus, search.searching)}
						</Muted>
					)}
				</Box>
			</Box>
		</ThemeProvider>
	);
}

// The highlight spans the sidebar's full width, with the count pushed to the right edge
// so the padding on both ends matches.
function SidebarItem({
	page,
	current,
	highlighted,
	theme,
}: {
	page: Page;
	current: boolean;
	highlighted: boolean;
	theme: Theme;
}) {
	const color = highlighted ? (theme.background ?? 'black') : current ? theme.accent : theme.text;
	return (
		<Box paddingX={1} backgroundColor={highlighted ? theme.accent : undefined}>
			<Text wrap="truncate-end" color={color}>
				{current ? '› ' : '  '}
				{page.name}
			</Text>
			<Box flexGrow={1} />
			{page.count === undefined ? null : (
				<Box flexShrink={0} paddingLeft={1}>
					{highlighted ? <Text color={color}>{page.count}</Text> : <Muted>{page.count}</Muted>}
				</Box>
			)}
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
