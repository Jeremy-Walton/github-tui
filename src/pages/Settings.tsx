import {Text} from 'ink';
import type {Viewer} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import {SETTINGS_FILE, type Settings} from '../settings.js';
import {Muted, THEMES, type Theme, useTheme} from '../theme.js';
import {openUrl, type Resource, runtime} from '../util.js';
import type {PageProps} from './types.js';

export const SETTINGS_HINTS = 'enter use theme';

type Item = {kind: 'account'} | {kind: 'theme'; theme: Theme};

type Props = PageProps & {viewer: Viewer; settings: Settings; onChange: (settings: Settings) => void};

const ITEMS: Item[] = [{kind: 'account'}, ...THEMES.map(theme => ({kind: 'theme' as const, theme}))];
const RESOURCE: Resource<Item[]> = {data: ITEMS, loading: false, error: null, refresh: () => {}, update: () => {}};
const SWATCH = ['accent', 'group', 'link', 'success', 'warning', 'danger', 'done'] as const;

const shortPath = (path: string) => path.replace(process.env.HOME ?? '', '~');

export function SettingsPage({viewer, settings, onChange, ...props}: Props) {
	const t = useTheme();
	const source = runtime.demo ? 'demo data · nothing is saved' : `gh login · settings in ${shortPath(SETTINGS_FILE)}`;

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
			emptyText="No settings."
			hideGroupCounts
			getKey={itemKey}
			getGroup={itemGroup}
			getSearchText={itemSearchText}
			onOpen={item => {
				if (item.kind === 'account') return openUrl(`https://github.com/${viewer.login}`);
				onChange({...settings, theme: item.theme.id});
				props.onMessage(`Theme: ${item.theme.name}${runtime.demo ? ' (not saved in demo mode)' : ''}`);
			}}
			renderItem={renderItem}
		/>
	);
}

const itemKey = (item: Item) => (item.kind === 'account' ? 'account' : item.theme.id);
const itemGroup = (item: Item) => (item.kind === 'account' ? 'Signed in as' : 'Theme');
const itemSearchText = (item: Item) =>
	item.kind === 'account' ? 'account signed in login' : `theme ${item.theme.name}`;
