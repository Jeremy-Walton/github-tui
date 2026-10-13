import {Text} from 'ink';
import {Cell, Line, ListView} from '../ListView.js';
import type {ActionQueue} from '../actions.js';
import type {GitHubClient, Notification} from '../github.js';
import {openUrl, timeAgo, type Resource} from '../util.js';
import type {PageProps} from './types.js';

type Props = PageProps & {resource: Resource<Notification[]>; gh: GitHubClient; actions: ActionQueue};

export function InboxPage({resource, gh, actions, ...props}: Props) {
	const remove = (n: Notification, run: () => Promise<void>, verb: string) => {
		const index = resource.data?.findIndex(x => x.id === n.id) ?? 0;
		resource.update(list => list.filter(x => x.id !== n.id));
		actions.add({
			id: n.id,
			label: `${verb}: ${n.title}`,
			run,
			restore: () =>
				resource.update(list => (list.some(x => x.id === n.id) ? list : list.toSpliced(index, 0, n))),
			onFail: e => props.onMessage(`Failed (${verb}): ${e.message}`),
		});
		props.onMessage(`${verb}: ${n.title} · u to undo`);
	};

	return (
		<ListView
			{...props}
			items={(resource.data ?? []).filter(n => !actions.has(n.id))}
			loading={resource.loading}
			error={resource.error}
			itemHeight={2}
			emptyText="Inbox zero."
			getKey={n => n.id}
			getSearchText={n => `${n.repo} #${n.number ?? ''} ${n.title} ${n.reason} ${n.type} ${n.state ?? ''}`}
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
				const [label, color] = subjectLabel(n);
				return (
					<>
						<Line selected={selected}>
							<Cell w={2}>
								<Text color="blue">{n.unread ? '●' : ''}</Text>
							</Cell>
							<Cell w={16}>
								<Text color={color}>{label}</Text>
							</Cell>
							<Cell grow>
								<Text bold={n.unread || selected} color={selected ? 'cyan' : undefined} dimColor={!n.unread && !selected}>
									{n.title}
								</Text>
							</Cell>
							<Cell w={18}>
								<Text dimColor>{n.reason.replace(/_/g, ' ')}</Text>
							</Cell>
							<Cell w={10}>
								<Text dimColor>{timeAgo(n.updatedAt)}</Text>
							</Cell>
						</Line>
						<Line selected={selected}>
							<Cell w={18} />
							<Cell grow>
								<Text color="blue">{n.repo}</Text>
								{n.number ? <Text dimColor> #{n.number}</Text> : null}
							</Cell>
						</Line>
					</>
				);
			}}
		/>
	);
}

// Colors follow github.com: green open, purple merged/completed, red closed, gray draft/not planned.
function subjectLabel(n: Notification): [string, string] {
	if (n.type === 'PullRequest') {
		if (n.state === 'merged') return ['◆ merged PR', 'magenta'];
		if (n.state === 'closed') return ['✕ closed PR', 'red'];
		if (n.state === 'draft') return ['◌ draft PR', 'gray'];
		return ['● open PR', 'green'];
	}
	if (n.type === 'Issue') {
		if (n.state === 'completed' || n.state === 'closed') return ['✓ closed issue', 'magenta'];
		if (n.state === 'not_planned') return ['⊘ not planned', 'gray'];
		return ['● open issue', 'green'];
	}
	if (n.type === 'Release') return ['◇ release', 'blue'];
	if (n.type === 'Discussion') return ['◇ discussion', 'magenta'];
	if (n.type === 'CheckSuite') return ['▲ CI run', 'red'];
	if (n.type === 'Commit') return ['◦ commit', 'gray'];
	return [n.type, 'gray'];
}
