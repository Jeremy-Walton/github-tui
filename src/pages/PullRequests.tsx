import {Text, useApp} from 'ink';
import type {PullRequest} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import type {Settings} from '../settings.js';
import {runSlice} from '../slice.js';
import {Muted, useTheme} from '../theme.js';
import {openUrl, type Resource, runtime, timeAgo} from '../util.js';
import type {PageProps} from './types.js';

type Props = PageProps & {resource: Resource<PullRequest[]>; items: PullRequest[]; askToOpenInSlice: boolean};

export function PullRequestsPage({resource, items, askToOpenInSlice, ...props}: Props) {
	const t = useTheme();
	const {suspendTerminal} = useApp();

	const openInSlice = async (pr: PullRequest) => {
		if (runtime.demo) return props.onMessage("slice doesn't run in demo mode");
		let error: string | null = null;
		await suspendTerminal(async () => {
			error = await runSlice(pr.url);
		});
		if (error) props.onMessage(error);
	};

	const open = (pr: PullRequest) => {
		if (!askToOpenInSlice) return openUrl(pr.url);
		props.onPrompt({
			title: `Open ${pr.repo} #${pr.number}`,
			choices: [
				{key: 's', label: 'slice', detail: 'Review the diff in the terminal', run: () => void openInSlice(pr)},
				{key: 'g', label: 'GitHub', detail: 'Open in the browser', run: () => openUrl(pr.url)},
			],
		});
	};

	return (
		<ListView
			{...props}
			resource={resource}
			items={items}
			emptyText="No open pull requests."
			getKey={pr => pr.id}
			getGroup={bySection}
			getSearchText={prSearchText}
			onOpen={open}
			renderItem={(pr, selected) => (
				<>
					<Line selected={selected}>
						<Cell w={2}>{pr.isDraft ? <Text color={t.neutral}>◌</Text> : <Text color={t.success}>●</Text>}</Cell>
						<Cell grow>
							<Title selected={selected}>{pr.title}</Title>
							<Muted> #{pr.number}</Muted>
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell w={2} />
						<Cell w={32}>
							<Text color={t.link}>{pr.repo}</Text>
						</Cell>
						<Cell w={16}>
							<Muted>{pr.author}</Muted>
						</Cell>
						<Cell w={10}>
							<Muted>{timeAgo(pr.updatedAt)}</Muted>
						</Cell>
						<Cell w={15}>
							<Status pr={pr} />
						</Cell>
						<Cell w={10}>
							<Checks state={pr.checks} />
						</Cell>
						<Cell w={12}>{pr.mergeable === 'CONFLICTING' ? <Text color={t.danger}>⚠ conflicts</Text> : null}</Cell>
						<Cell w={14}>
							<Text color={t.success}>+{pr.additions}</Text>
							<Text color={t.danger}> −{pr.deletions}</Text>
						</Cell>
						<Cell w={13}>
							{pr.comments ? (
								<Muted>
									{pr.comments} comment{pr.comments === 1 ? '' : 's'}
								</Muted>
							) : null}
						</Cell>
						<Cell grow>{pr.labels.length ? <Text color={t.warning}>{pr.labels.join(', ')}</Text> : null}</Cell>
					</Line>
				</>
			)}
		/>
	);
}

export function visiblePullRequests(prs: PullRequest[], settings: Settings): PullRequest[] {
	return prs.filter(pr => (settings.showBotPullRequests || !pr.bot) && (settings.showWatchedRepos || !pr.watched));
}

const bySection = (pr: PullRequest) => pr.section;

function Status({pr}: {pr: PullRequest}) {
	const t = useTheme();
	if (pr.isDraft) return <Text color={t.neutral}>◌ draft</Text>;
	if (pr.reviewDecision === 'APPROVED') return <Text color={t.success}>✓ approved</Text>;
	if (pr.reviewDecision === 'CHANGES_REQUESTED') return <Text color={t.danger}>± changes</Text>;
	if (pr.reviewDecision === 'REVIEW_REQUIRED') return <Text color={t.warning}>○ needs review</Text>;
	return null;
}

function Checks({state}: {state: PullRequest['checks']}) {
	const t = useTheme();
	if (state === 'SUCCESS') return <Text color={t.success}>✓ checks</Text>;
	if (state === 'FAILURE' || state === 'ERROR') return <Text color={t.danger}>✗ checks</Text>;
	if (state === 'PENDING' || state === 'EXPECTED') return <Text color={t.warning}>● checks</Text>;
	return null;
}

const prSearchText = (pr: PullRequest) =>
	`${pr.repo} #${pr.number} ${pr.title} ${pr.author} ${pr.headRef} ${pr.labels.join(' ')}`;
