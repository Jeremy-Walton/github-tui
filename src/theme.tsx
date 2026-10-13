import {Text} from 'ink';
import {createContext, type ReactNode, useContext} from 'react';

export type Theme = {
	id: string;
	name: string;
	// Unset means the terminal's own background and text color.
	background?: string;
	text?: string;
	// Unset means dimmed text.
	muted?: string;
	accent: string;
	border: string;
	divider: string;
	selection: string;
	group: string;
	link: string;
	success: string;
	warning: string;
	danger: string;
	done: string;
	neutral: string;
};

const DEFAULT_THEME: Theme = {
	id: 'default',
	name: 'Terminal',
	accent: 'cyan',
	border: 'gray',
	divider: 'gray',
	selection: '#2b3d5a',
	group: 'magenta',
	link: 'blue',
	success: 'green',
	warning: 'yellow',
	danger: 'red',
	done: 'magenta',
	neutral: 'gray',
};

export const THEMES: Theme[] = [
	DEFAULT_THEME,
	{
		id: 'cobalt2',
		name: 'Cobalt2',
		background: '#193549',
		text: '#ffffff',
		muted: '#8fa9c2',
		accent: '#ffc600',
		border: '#2f6188',
		divider: '#234e6d',
		selection: '#0050a4',
		group: '#ff9d00',
		link: '#9effff',
		success: '#3ad900',
		warning: '#ffee80',
		danger: '#ff628c',
		done: '#fb94ff',
		neutral: '#6e8aa3',
	},
	{
		id: 'dracula',
		name: 'Dracula',
		background: '#282a36',
		text: '#f8f8f2',
		muted: '#7f8bb8',
		accent: '#bd93f9',
		border: '#6272a4',
		divider: '#44475a',
		selection: '#44475a',
		group: '#ff79c6',
		link: '#8be9fd',
		success: '#50fa7b',
		warning: '#f1fa8c',
		danger: '#ff5555',
		done: '#bd93f9',
		neutral: '#6272a4',
	},
	{
		id: 'nord',
		name: 'Nord',
		background: '#2e3440',
		text: '#d8dee9',
		muted: '#7b88a1',
		accent: '#88c0d0',
		border: '#4c566a',
		divider: '#3b4252',
		selection: '#434c5e',
		group: '#b48ead',
		link: '#81a1c1',
		success: '#a3be8c',
		warning: '#ebcb8b',
		danger: '#bf616a',
		done: '#b48ead',
		neutral: '#616e88',
	},
	{
		id: 'solarized-dark',
		name: 'Solarized Dark',
		background: '#002b36',
		text: '#93a1a1',
		muted: '#657b83',
		accent: '#2aa198',
		border: '#586e75',
		divider: '#073642',
		selection: '#0a4a5c',
		group: '#d33682',
		link: '#268bd2',
		success: '#859900',
		warning: '#b58900',
		danger: '#dc322f',
		done: '#6c71c4',
		neutral: '#586e75',
	},
	{
		id: 'gruvbox-dark',
		name: 'Gruvbox Dark',
		background: '#282828',
		text: '#ebdbb2',
		muted: '#a89984',
		accent: '#fabd2f',
		border: '#665c54',
		divider: '#3c3836',
		selection: '#504945',
		group: '#d3869b',
		link: '#83a598',
		success: '#b8bb26',
		warning: '#fe8019',
		danger: '#fb4934',
		done: '#d3869b',
		neutral: '#928374',
	},
	{
		id: 'tokyo-night',
		name: 'Tokyo Night',
		background: '#1a1b26',
		text: '#c0caf5',
		muted: '#737aa2',
		accent: '#7aa2f7',
		border: '#3b4261',
		divider: '#292e42',
		selection: '#283457',
		group: '#bb9af7',
		link: '#7dcfff',
		success: '#9ece6a',
		warning: '#e0af68',
		danger: '#f7768e',
		done: '#bb9af7',
		neutral: '#565f89',
	},
	{
		id: 'github-light',
		name: 'GitHub Light',
		background: '#ffffff',
		text: '#1f2328',
		muted: '#656d76',
		accent: '#0969da',
		border: '#d0d7de',
		divider: '#eaeef2',
		selection: '#ddf4ff',
		group: '#8250df',
		link: '#0969da',
		success: '#1a7f37',
		warning: '#9a6700',
		danger: '#cf222e',
		done: '#8250df',
		neutral: '#6e7781',
	},
];

export const findTheme = (id: string): Theme => THEMES.find(t => t.id === id) ?? DEFAULT_THEME;

const ThemeContext = createContext<Theme>(DEFAULT_THEME);
export const ThemeProvider = ThemeContext.Provider;
export const useTheme = () => useContext(ThemeContext);

// Border characters are drawn over the parent's background fill, so they need the background too.
export function borderProps(t: Theme, focused = false) {
	return {borderColor: focused ? t.accent : t.border, borderBackgroundColor: t.background};
}

export function Muted({wrap, children}: {wrap?: 'truncate-end'; children: ReactNode}) {
	const t = useTheme();
	return (
		<Text wrap={wrap} color={t.muted} dimColor={!t.muted}>
			{children}
		</Text>
	);
}
