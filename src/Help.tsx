import {Box, Text} from 'ink';
import {Cell} from './ListView.js';
import {Muted, useTheme} from './theme.js';

export const HELP_HINTS = 'esc close · q quit';

type Section = {title: string; keys: [keys: string, action: string][]};

const sections = (pageCount: number): Section[][] => [
	[
		{
			title: 'Anywhere',
			keys: [
				['?', 'Show or hide this help'],
				['/', 'Search this page'],
				[`1-${pageCount}`, 'Jump to a page, in sidebar order'],
				['r', 'Refresh this page'],
				['tab', 'Switch between the sidebar and the list'],
				['q', 'Quit'],
			],
		},
		{
			title: 'List',
			keys: [
				['↑ ↓  j k', 'Move'],
				['g  home', 'Top of the list'],
				['G  end', 'Bottom of the list'],
				['pgup  pgdn', 'Up or down a page'],
				['enter', 'Open in the browser (or ask GitHub or slice)'],
				['← h', 'Focus the sidebar'],
				['esc', 'Clear the search'],
			],
		},
		{
			title: 'Sidebar',
			keys: [
				['↑ ↓  j k', 'Switch page'],
				['→ l  enter', 'Go to the list'],
			],
		},
	],
	[
		{
			title: 'Search',
			keys: [
				['type', 'Filter the list'],
				['↑ ↓', 'Move'],
				['enter', 'Open'],
				['esc', 'Stop typing (esc again clears)'],
				['ctrl+u', 'Clear the search'],
			],
		},
		{
			title: 'Inbox',
			keys: [
				['e', 'Mark done'],
				['t', 'Unsubscribe (also marks done)'],
				['u', 'Undo the last done or unsubscribe (15 seconds)'],
			],
		},
		{
			title: 'Settings',
			keys: [
				['enter', 'Use the theme or switch the option'],
				['shift+j  shift+k', 'Move the sidebar page down or up'],
			],
		},
	],
];

// Replaces the page in the main panel. The page stays mounted underneath, so it keeps its selection.
export function HelpPanel({height, pageCount}: {height: number; pageCount: number}) {
	const t = useTheme();
	return (
		<Box flexDirection="column" height={height} overflow="hidden" paddingX={1}>
			<Box marginBottom={1}>
				<Text bold color={t.accent}>
					Keyboard shortcuts
				</Text>
				<Muted> · esc or ? to close</Muted>
			</Box>
			<Box>
				{sections(pageCount).map(column => (
					<Box key={column[0]?.title} flexDirection="column" flexGrow={1} flexBasis={0} gap={1}>
						{column.map(section => (
							<Box key={section.title} flexDirection="column">
								<Text bold color={t.group}>
									{section.title}
								</Text>
								{section.keys.map(([keys, action]) => (
									<Box key={keys}>
										<Cell w={18}>
											<Text color={t.accent}>{keys}</Text>
										</Cell>
										<Cell grow>{action}</Cell>
									</Box>
								))}
							</Box>
						))}
					</Box>
				))}
			</Box>
		</Box>
	);
}
