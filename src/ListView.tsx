import {Box, Text, useInput} from 'ink';
import {useMemo, useRef, useState, type ReactNode} from 'react';
import {matches, type Resource} from './util.js';

type Props<T> = {
	resource: Resource<T[]>;
	// Overrides `resource.data`, e.g. to hide items with a pending action.
	items?: T[];
	getKey: (item: T) => string;
	getSearchText: (item: T) => string;
	getGroup?: (item: T) => string;
	renderItem: (item: T, selected: boolean) => ReactNode;
	height: number;
	query: string;
	searching: boolean;
	active: boolean;
	emptyText: string;
	onOpen: (item: T) => void;
	onAction?: (input: string, item: T) => void;
};

type Row<T> = {kind: 'header'; label: string; count: number; spaced: boolean} | {kind: 'item'; item: T; index: number};

const SEARCH_BOX_HEIGHT = 3;
const ITEM_HEIGHT = 2;
const SELECTED_BG = '#2b3d5a';

export function ListView<T>(props: Props<T>) {
	const {resource, getGroup, height, query, searching, active} = props;
	const items = props.items ?? resource.data ?? [];
	const [selected, setSelected] = useState(0);
	const [selectedQuery, setSelectedQuery] = useState(query);
	const scrollTop = useRef(0);

	// A new query starts at the top. Adjusting during render avoids a second render per keystroke.
	if (query !== selectedQuery) {
		setSelectedQuery(query);
		setSelected(0);
	}

	const filtered = useMemo(
		() => (query ? items.filter(item => matches(props.getSearchText(item), query)) : items),
		[items, query],
	);

	const sel = Math.min(selected, Math.max(0, filtered.length - 1));

	const rows = useMemo(() => {
		const counts = new Map<string, number>();
		if (getGroup) for (const item of filtered) counts.set(getGroup(item), (counts.get(getGroup(item)) ?? 0) + 1);
		const out: Row<T>[] = [];
		let group: string | undefined;
		filtered.forEach((item, index) => {
			const g = getGroup?.(item);
			if (g !== undefined && g !== group) {
				group = g;
				out.push({kind: 'header', label: g, count: counts.get(g) ?? 0, spaced: out.length > 0});
			}
			out.push({kind: 'item', item, index});
		});
		return out;
	}, [filtered, getGroup]);

	// Each item gets one extra line for its divider. Headers get a blank line below them,
	// plus one above when they follow another group.
	const slotHeight = ITEM_HEIGHT + 1;
	const rowHeight = (row: Row<T>) => (row.kind === 'header' ? (row.spaced ? 3 : 2) : slotHeight);
	const listHeight = Math.max(1, height - SEARCH_BOX_HEIGHT - 1);

	// Keep the selected item (and its group header, when it's first in the group) in view.
	const selRowIdx = rows.findIndex(r => r.kind === 'item' && r.index === sel);
	let selTop = 0;
	for (let i = 0; i < selRowIdx; i++) selTop += rowHeight(rows[i]!);
	const prev = rows[selRowIdx - 1];
	const wantTop = prev?.kind === 'header' ? selTop - rowHeight(prev) : selTop;
	if (wantTop < scrollTop.current) scrollTop.current = Math.max(0, wantTop);
	if (selTop + slotHeight > scrollTop.current + listHeight) scrollTop.current = selTop + slotHeight - listHeight;
	if (selRowIdx === -1) scrollTop.current = 0;

	const visible: Row<T>[] = [];
	let y = 0;
	const fits = (top: number, h: number) => top >= scrollTop.current && top + h <= scrollTop.current + listHeight;
	rows.forEach(row => {
		const h = rowHeight(row);
		// Skip a header at the bottom edge whose first item is cut off.
		const orphan = row.kind === 'header' && !fits(y + h, slotHeight);
		if (fits(y, h) && !orphan) visible.push(row);
		y += h;
	});
	const totalHeight = y;

	useInput(
		(input, key) => {
			const move = (delta: number) => setSelected(Math.max(0, Math.min(filtered.length - 1, sel + delta)));
			const page = Math.max(1, Math.floor(listHeight / slotHeight) - 1);
			const current = filtered[sel];

			if (key.upArrow || (!searching && input === 'k')) return move(-1);
			if (key.downArrow || (!searching && input === 'j')) return move(1);
			if (key.pageUp) return move(-page);
			if (key.pageDown) return move(page);
			if (key.home || (!searching && input === 'g')) return setSelected(0);
			if (key.end || (!searching && input === 'G')) return setSelected(filtered.length - 1);
			if (key.return && current) return props.onOpen(current);
			if (!searching && current && input && !key.ctrl && !key.meta) props.onAction?.(input, current);
		},
		{isActive: active},
	);

	return (
		<Box flexDirection="column" height={height}>
			<Box borderStyle="round" borderColor={searching ? 'cyan' : 'gray'} paddingX={1} height={SEARCH_BOX_HEIGHT}>
				{searching ? (
					<Text>
						<Text color="cyan">/ </Text>
						{query}
						<Text inverse> </Text>
					</Text>
				) : query ? (
					<Text>
						<Text dimColor>/ </Text>
						{query}
						<Text dimColor>  (esc to clear)</Text>
					</Text>
				) : (
					<Text dimColor>/ Search…</Text>
				)}
				<Box flexGrow={1} />
				<Text dimColor>
					{resource.loading ? 'loading… ' : ''}
					{filtered.length === items.length ? items.length : `${filtered.length}/${items.length}`}
				</Text>
			</Box>
			{resource.error ? (
				<Text color="red" wrap="truncate-end">
					{resource.error}
				</Text>
			) : null}
			<Box flexDirection="column" paddingX={1} flexGrow={1}>
				{filtered.length === 0 ? (
					<Text dimColor>{resource.loading && items.length === 0 ? 'Loading…' : query ? 'No matches.' : props.emptyText}</Text>
				) : (
					visible.map(row =>
						row.kind === 'header' ? (
							<Box key={`h:${row.label}`} marginTop={row.spaced ? 1 : 0} marginBottom={1}>
								<Text bold color="magenta" wrap="truncate-end">
									{row.label} <Text dimColor>({row.count})</Text>
								</Text>
							</Box>
						) : (
							<Box key={props.getKey(row.item)} flexDirection="column" height={slotHeight}>
								<Box
									flexDirection="column"
									height={ITEM_HEIGHT}
									backgroundColor={row.index === sel ? SELECTED_BG : undefined}
								>
									{props.renderItem(row.item, row.index === sel)}
								</Box>
								<Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" borderDimColor />
							</Box>
						),
					)
				)}
			</Box>
			{totalHeight > listHeight ? (
				<Text dimColor>
					{' '}
					{sel + 1} of {filtered.length}
				</Text>
			) : (
				<Text> </Text>
			)}
		</Box>
	);
}

export function Line({selected, children}: {selected: boolean; children: ReactNode}) {
	return (
		<Box height={1} overflow="hidden">
			<Box width={1} flexShrink={0}>
				<Text color="cyan">{selected ? '▌' : ' '}</Text>
			</Box>
			{children}
		</Box>
	);
}

// A fixed-width column so values line up across rows. `grow` takes the leftover space.
export function Cell({w, grow, children}: {w?: number; grow?: boolean; children?: ReactNode}) {
	return (
		<Box
			width={grow ? undefined : w}
			flexGrow={grow ? 1 : 0}
			flexShrink={grow ? 1 : 0}
			flexBasis={grow ? 0 : undefined}
			minWidth={0}
			paddingRight={1}
		>
			<Text wrap="truncate-end">{children}</Text>
		</Box>
	);
}

// An item's main text: bold when selected or unread, dimmed once read.
export function Title({selected, unread, children}: {selected: boolean; unread?: boolean; children: ReactNode}) {
	return (
		<Text bold={selected || unread} color={selected ? 'cyan' : undefined} dimColor={unread === false && !selected}>
			{children}
		</Text>
	);
}
