import {Text} from 'ink';
import {useMemo, useSyncExternalStore} from 'react';
import type {ActionQueue} from '../actions.js';
import type {GitHubClient, Notification} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import {Muted, useTheme} from '../theme.js';
import {openUrl, type Resource, timeAgo} from '../util.js';
import type {PageProps} from './types.js';

export const INBOX_HINTS = 'e done · t unsubscribe · u undo';

type Props = PageProps & {resource: Resource<Notification[]>; gh: GitHubClient; actions: ActionQueue};

export function InboxPage({resource, gh, actions, ...props}: Props) {
	const t = useTheme();
	const pending = useSyncExternalStore(actions.subscribe, actions.pendingIds);
	const items = useMemo(() => resource.data?.filter(n => !pending.has(n.id)) ?? [], [resource.data, pending]);

	const remove = (n: Notification, run: () => Promise<void>, verb: string) => {
		actions.add({
			id: n.id,
			label: `${verb}: ${n.title}`,
			run,
			onDone: () => resource.update(list => list.filter(x => x.id !== n.id)),
			onFail: e => props.onMessage(`Failed (${verb}): ${e.message}`),
		});
		props.onMessage(`${verb}: ${n.title} · u to undo`);
	};

	return (
		<ListView
			{...props}
			resource={resource}
			items={items}
			emptyText="Inbox zero."
			getKey={n => n.id}
			getSearchText={inboxSearchText}
			onOpen={n => {
				openUrl(n.url);
				if (n.unread) {
					resource.update(list => list.map(x => (x.id === n.id ? {...x, unread: false} : x)));
					gh.markRead(n.id).catch(() => {});
				}
			}}
			onAction={(input, n) => {
				const k = input.toLowerCase();
				if (k === 'e') remove(n, () => gh.markDone(n.id), 'Done');
				if (k === 't') remove(n, () => gh.unsubscribe(n.id), 'Unsubscribed');
				if (k === 'u') {
					const undone = actions.undo();
					props.onMessage(undone ? `Undid ${undone}` : 'Nothing to undo');
				}
			}}
			renderItem={(n, selected) => {
				const [label, tone] = subjectLabel(n);
				return (
					<>
						<Line selected={selected}>
							<Cell w={2}>
								<Text color={t.link}>{n.unread ? '●' : ''}</Text>
							</Cell>
							<Cell w={16}>
								<Text color={t[tone]}>{label}</Text>
							</Cell>
							<Cell grow>
								<Title selected={selected} unread={n.unread}>
									{n.title}
								</Title>
							</Cell>
							<Cell w={18}>
								<Muted>{n.reason.replace(/_/g, ' ')}</Muted>
							</Cell>
							<Cell w={10}>
								<Muted>{timeAgo(n.updatedAt)}</Muted>
							</Cell>
						</Line>
						<Line selected={selected}>
							<Cell w={18} />
							<Cell grow>
								<Text color={t.link}>{n.repo}</Text>
								{n.number ? <Muted> #{n.number}</Muted> : null}
							</Cell>
						</Line>
					</>
				);
			}}
		/>
	);
}

type Tone = 'success' | 'done' | 'danger' | 'neutral' | 'link';

// Colors follow github.com: green open, purple merged/completed, red closed, gray draft/not planned.
function subjectLabel(n: Notification): [string, Tone] {
	if (n.type === 'PullRequest') {
		if (n.state === 'merged') return ['◆ merged PR', 'done'];
		if (n.state === 'closed') return ['✕ closed PR', 'danger'];
		if (n.state === 'draft') return ['◌ draft PR', 'neutral'];
		return ['● open PR', 'success'];
	}
	if (n.type === 'Issue') {
		if (n.state === 'completed' || n.state === 'closed') return ['✓ closed issue', 'done'];
		if (n.state === 'not_planned') return ['⊘ not planned', 'neutral'];
		return ['● open issue', 'success'];
	}
	if (n.type === 'Release') return ['◇ release', 'link'];
	if (n.type === 'Discussion') return ['◇ discussion', 'done'];
	if (n.type === 'CheckSuite') return ['▲ CI run', 'danger'];
	if (n.type === 'Commit') return ['◦ commit', 'neutral'];
	return [n.type, 'neutral'];
}

const inboxSearchText = (n: Notification) =>
	`${n.repo} #${n.number ?? ''} ${n.title} ${n.reason} ${n.type} ${n.state ?? ''}`;
