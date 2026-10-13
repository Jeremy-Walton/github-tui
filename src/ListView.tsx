import {Box, Text, useInput} from 'ink';
import {type ReactNode, useMemo, useRef, useState} from 'react';
import {borderProps, Muted, useTheme} from './theme.js';
import {matches, type Resource} from './util.js';

type Props<T> = {
	resource: Resource<T[]>;
	// Overrides `resource.data`, e.g. to hide items with a pending action.
	items?: T[];
	getKey: (item: T) => string;
	getSearchText: (item: T) => string;
	getGroup?: (item: T) => string;
	hideGroupCounts?: boolean;
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

export function ListView<T>(props: Props<T>) {
	const {resource, getSearchText, getGroup, height, query, searching, active} = props;
	const items = props.items ?? resource.data ?? [];
	const [selection, setSelection] = useState<{key: string | undefined; index: number}>({key: undefined, index: 0});
	const [selectedQuery, setSelectedQuery] = useState(query);
	const scrollTop = useRef(0);
	const t = useTheme();

	// A new query starts at the top. Adjusting during render avoids a second render per keystroke.
	if (query !== selectedQuery) {
		setSelectedQuery(query);
		setSelection({key: undefined, index: 0});
	}

	const filtered = useMemo(
		() => (query ? items.filter(item => matches(getSearchText(item), query)) : items),
		[items, query, getSearchText],
	);

	// The cursor follows its item when the list reorders or refreshes. Once the item is gone (e.g. marked
	// done), the cursor keeps its place, which puts it on the next item.
	const found = selection.key === undefined ? -1 : filtered.findIndex(item => props.getKey(item) === selection.key);
	const sel = found === -1 ? Math.min(selection.index, Math.max(0, filtered.length - 1)) : found;
	const select = (index: number) => {
		const i = Math.max(0, Math.min(filtered.length - 1, index));
		const item = filtered[i];
		setSelection({key: item && props.getKey(item), index: i});
	};

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
	for (const row of rows.slice(0, Math.max(0, selRowIdx))) selTop += rowHeight(row);
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
			const move = (delta: number) => select(sel + delta);
			const page = Math.max(1, Math.floor(listHeight / slotHeight) - 1);
			const current = filtered[sel];

			if (key.upArrow || (!searching && input === 'k')) return move(-1);
			if (key.downArrow || (!searching && input === 'j')) return move(1);
			if (key.pageUp) return move(-page);
			if (key.pageDown) return move(page);
			if (key.home || (!searching && input === 'g')) return select(0);
			if (key.end || (!searching && input === 'G')) return select(filtered.length - 1);
			if (key.return && current) return props.onOpen(current);
			if (!searching && current && input && !key.ctrl && !key.meta) props.onAction?.(input, current);
		},
		{isActive: active},
	);

	return (
		<Box flexDirection="column" height={height}>
			<Box borderStyle="round" {...borderProps(t, searching)} paddingX={1} height={SEARCH_BOX_HEIGHT}>
				{searching ? (
					<Text color={t.text}>
						<Text color={t.accent}>/ </Text>
						{query}
						<Text inverse> </Text>
					</Text>
				) : query ? (
					<Text color={t.text}>
						<Muted>/ </Muted>
						{query}
						<Muted> (esc to clear)</Muted>
					</Text>
				) : (
					<Muted>/ Search…</Muted>
				)}
				<Box flexGrow={1} />
				<Muted>
					{resource.loading ? 'loading… ' : ''}
					{filtered.length === items.length ? items.length : `${filtered.length}/${items.length}`}
				</Muted>
			</Box>
			{resource.error ? (
				<Text color={t.danger} wrap="truncate-end">
					{resource.error}
				</Text>
			) : null}
			<Box flexDirection="column" paddingX={1} flexGrow={1}>
				{filtered.length === 0 ? (
					<Muted>{resource.loading && items.length === 0 ? 'Loading…' : query ? 'No matches.' : props.emptyText}</Muted>
				) : (
					visible.map(row =>
						row.kind === 'header' ? (
							<Box key={`h:${row.label}`} marginTop={row.spaced ? 1 : 0} marginBottom={1}>
								<Text bold color={t.group} wrap="truncate-end">
									{row.label}
									{props.hideGroupCounts ? null : <Muted> ({row.count})</Muted>}
								</Text>
							</Box>
						) : (
							<Box key={props.getKey(row.item)} flexDirection="column" height={slotHeight}>
								<Box
									flexDirection="column"
									height={ITEM_HEIGHT}
									backgroundColor={row.index === sel ? t.selection : undefined}
								>
									{props.renderItem(row.item, row.index === sel)}
								</Box>
								<Box
									borderStyle="single"
									borderTop={false}
									borderLeft={false}
									borderRight={false}
									borderColor={t.divider}
									borderBackgroundColor={t.background}
									// The terminal's own background has no known shade to pick against, so dim instead.
									borderDimColor={!t.background}
								/>
							</Box>
						),
					)
				)}
			</Box>
			{totalHeight > listHeight ? (
				<Muted>
					{' '}
					{sel + 1} of {filtered.length}
				</Muted>
			) : (
				<Text> </Text>
			)}
		</Box>
	);
}

export function Line({selected, children}: {selected: boolean; children: ReactNode}) {
	const t = useTheme();
	return (
		<Box height={1} overflow="hidden">
			<Box width={1} flexShrink={0}>
				<Text color={t.accent}>{selected ? '▌' : ' '}</Text>
			</Box>
			{children}
		</Box>
	);
}

// A fixed-width column so values line up across rows. `grow` takes the leftover space.
export function Cell({w, grow, children}: {w?: number; grow?: boolean; children?: ReactNode}) {
	const t = useTheme();
	return (
		<Box
			width={grow ? undefined : w}
			flexGrow={grow ? 1 : 0}
			flexShrink={grow ? 1 : 0}
			flexBasis={grow ? 0 : undefined}
			minWidth={0}
			paddingRight={1}
		>
			<Text wrap="truncate-end" color={t.text}>
				{children}
			</Text>
		</Box>
	);
}

// An item's main text: bold when selected or unread, dimmed once read.
export function Title({selected, unread, children}: {selected: boolean; unread?: boolean; children: ReactNode}) {
	const t = useTheme();
	const read = unread === false && !selected;
	return (
		<Text
			bold={selected || unread}
			color={selected ? t.accent : read && t.muted ? t.muted : t.text}
			dimColor={read && !t.muted}
		>
			{children}
		</Text>
	);
}
