import {Text} from 'ink';
import {useMemo} from 'react';
import type {Viewer} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import {movePage, type PageId, SETTINGS_FILE, type Settings} from '../settings.js';
import {Muted, THEMES, type Theme, useTheme} from '../theme.js';
import {openUrl, type Resource, runtime} from '../util.js';
import {PAGE_NAMES, type PageProps} from './types.js';

export const SETTINGS_HINTS = 'enter choose · shift+j/k move page';

type Item =
	| {kind: 'account'}
	| {kind: 'toggle'; toggle: Toggle}
	| {kind: 'page'; page: PageId; position: number}
	| {kind: 'theme'; theme: Theme};

type Props = PageProps & {viewer: Viewer; settings: Settings; onChange: (settings: Settings) => void};

const TOGGLES = {
	showBotPullRequests: {
		name: 'Show bot pull requests',
		message: 'Bot pull requests',
		detail: 'Dependabot and Renovate',
	},
	showWatchedRepos: {
		name: 'Show watched repos',
		message: 'Watched repos',
		detail: 'Open pull requests in repos you watch, grouped by repo',
	},
} satisfies Partial<Record<keyof Settings, {name: string; message: string; detail: string}>>;

type Toggle = keyof typeof TOGGLES;

const RESOURCE: Resource<Item[]> = {data: null, loading: false, error: null, refresh: () => {}, update: () => {}};
const SWATCH = ['accent', 'group', 'link', 'success', 'warning', 'danger', 'done'] as const;

const shortPath = (path: string) => path.replace(process.env.HOME ?? '', '~');

export function SettingsPage({viewer, settings, onChange, ...props}: Props) {
	const t = useTheme();
	const source = runtime.demo ? 'demo data · nothing is saved' : `gh login · settings in ${shortPath(SETTINGS_FILE)}`;
	const items = useMemo<Item[]>(
		() => [
			{kind: 'account'},
			...(Object.keys(TOGGLES) as Toggle[]).map(toggle => ({kind: 'toggle' as const, toggle})),
			...settings.sidebar.map((page, i) => ({kind: 'page' as const, page, position: i + 1})),
			...THEMES.map(theme => ({kind: 'theme' as const, theme})),
		],
		[settings.sidebar],
	);
	const notSaved = runtime.demo ? ' (not saved in demo mode)' : '';

	const renderItem = (item: Item, selected: boolean) => {
		if (item.kind === 'account') {
			return (
				<>
					<Line selected={selected}>
						<Cell w={2}>
							<Text color={t.success}>●</Text>
						</Cell>
						<Cell grow>
							<Title selected={selected}>@{viewer.login}</Title>
							{viewer.name ? <Muted> {viewer.name}</Muted> : null}
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell w={2} />
						<Cell grow>
							<Text color={t.link}>github.com</Text>
							<Muted> · {source}</Muted>
						</Cell>
					</Line>
				</>
			);
		}
		if (item.kind === 'toggle') {
			const {name, detail} = TOGGLES[item.toggle];
			const on = settings[item.toggle];
			return (
				<>
					<Line selected={selected}>
						<Cell w={2}>{on ? <Text color={t.success}>✓</Text> : null}</Cell>
						<Cell w={28}>
							<Title selected={selected}>{name}</Title>
						</Cell>
						<Cell grow>{on ? <Text color={t.success}>on</Text> : <Muted>off</Muted>}</Cell>
					</Line>
					<Line selected={selected}>
						<Cell w={2} />
						<Cell grow>
							<Muted>{detail}</Muted>
						</Cell>
					</Line>
				</>
			);
		}
		if (item.kind === 'page') {
			return (
				<>
					<Line selected={selected}>
						<Cell w={2}>
							<Muted>{item.position}</Muted>
						</Cell>
						<Cell grow>
							<Title selected={selected}>{PAGE_NAMES[item.page]}</Title>
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell w={2} />
						<Cell grow>{selected ? <Muted>shift+j move down · shift+k move up</Muted> : null}</Cell>
					</Line>
				</>
			);
		}
		const {theme} = item;
		const current = theme.id === settings.theme;
		return (
			<>
				<Line selected={selected}>
					<Cell w={2}>{current ? <Text color={t.success}>✓</Text> : null}</Cell>
					<Cell w={20}>
						<Title selected={selected}>{theme.name}</Title>
					</Cell>
					<Cell grow>{current ? <Muted>current</Muted> : null}</Cell>
				</Line>
				<Line selected={selected}>
					<Cell w={2} />
					<Cell grow>
						<Text backgroundColor={theme.background}>
							<Text color={theme.text}> Aa </Text>
							{SWATCH.map(key => (
								<Text key={key} color={theme[key]}>
									●{' '}
								</Text>
							))}
							<Text backgroundColor={theme.selection} color={theme.text}>
								{' '}
								selected{' '}
							</Text>
						</Text>
					</Cell>
				</Line>
			</>
		);
	};

	return (
		<ListView
			{...props}
			resource={RESOURCE}
			items={items}
			emptyText="No settings."
			hideGroupCounts
			getKey={itemKey}
			getGroup={itemGroup}
			getSearchText={itemSearchText}
			onOpen={item => {
				if (item.kind === 'account') return openUrl(`https://github.com/${viewer.login}`);
				if (item.kind === 'page') return props.onMessage('Press shift+j or shift+k to move this page in the sidebar');
				if (item.kind === 'toggle') {
					const on = !settings[item.toggle];
					onChange({...settings, [item.toggle]: on});
					return props.onMessage(`${TOGGLES[item.toggle].message}: ${on ? 'shown' : 'hidden'}${notSaved}`);
				}
				onChange({...settings, theme: item.theme.id});
				props.onMessage(`Theme: ${item.theme.name}${notSaved}`);
			}}
			onAction={(input, item) => {
				if (item.kind !== 'page' || (input !== 'J' && input !== 'K')) return;
				const sidebar = movePage(settings.sidebar, item.page, input === 'J' ? 1 : -1);
				if (sidebar !== settings.sidebar) onChange({...settings, sidebar});
			}}
			renderItem={renderItem}
		/>
	);
}

function itemKey(item: Item): string {
	if (item.kind === 'account') return 'account';
	if (item.kind === 'toggle') return item.toggle;
	if (item.kind === 'page') return `page:${item.page}`;
	return `theme:${item.theme.id}`;
}

function itemGroup(item: Item): string {
	if (item.kind === 'account') return 'Signed in as';
	if (item.kind === 'toggle') return 'Pull requests';
	if (item.kind === 'page') return 'Sidebar order';
	return 'Theme';
}

function itemSearchText(item: Item): string {
	if (item.kind === 'account') return 'account signed in login';
	if (item.kind === 'toggle') return `pull requests ${TOGGLES[item.toggle].name} ${TOGGLES[item.toggle].detail}`;
	if (item.kind === 'page') return `sidebar order page ${PAGE_NAMES[item.page]}`;
	return `theme ${item.theme.name}`;
}
