import {Box, Text} from 'ink';
import {Cell, Line} from './ListView.js';
import {borderProps, Muted, useTheme} from './theme.js';

export type Choice = {key: string; label: string; detail: string; run: () => void};
export type Prompt = {title: string; choices: Choice[]};

export const PROMPT_HINTS = '↑↓ move · enter choose · esc cancel';

// The border takes two lines and the title one.
export const promptHeight = (prompt: Prompt) => prompt.choices.length + 3;

export function PromptBox({prompt, selected}: {prompt: Prompt; selected: number}) {
	const t = useTheme();
	return (
		<Box flexDirection="column" flexShrink={0} borderStyle="round" {...borderProps(t, true)}>
			<Box paddingX={1}>
				<Text bold color={t.text} wrap="truncate-end">
					{prompt.title}
				</Text>
			</Box>
			{prompt.choices.map((choice, i) => (
				<Box key={choice.key} flexDirection="column" backgroundColor={i === selected ? t.selection : undefined}>
					<Line selected={i === selected}>
						<Cell w={3}>
							<Text color={t.accent}>{choice.key}</Text>
						</Cell>
						<Cell w={10}>
							<Text bold={i === selected}>{choice.label}</Text>
						</Cell>
						<Cell grow>
							<Muted>{choice.detail}</Muted>
						</Cell>
					</Line>
				</Box>
			))}
		</Box>
	);
}
