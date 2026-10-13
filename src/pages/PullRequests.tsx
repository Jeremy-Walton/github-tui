import {Text} from 'ink';
import {Cell, Line, ListView, Title} from '../ListView.js';
import type {PullRequest} from '../github.js';
import {openUrl, timeAgo, type Resource} from '../util.js';
import type {PageProps} from './types.js';

export function PullRequestsPage({resource, ...props}: PageProps & {resource: Resource<PullRequest[]>}) {
	return (
		<ListView
			{...props}
			resource={resource}
			emptyText="No open pull requests."
			getKey={pr => pr.id}
			getGroup={bySection}
			getSearchText={pr => `${pr.repo} #${pr.number} ${pr.title} ${pr.author} ${pr.headRef} ${pr.labels.join(' ')}`}
			onOpen={pr => openUrl(pr.url)}
			renderItem={(pr, selected) => (
				<>
					<Line selected={selected}>
						<Cell w={2}>{pr.isDraft ? <Text color="gray">◌</Text> : <Text color="green">●</Text>}</Cell>
						<Cell grow>
							<Title selected={selected}>{pr.title}</Title>
							<Text dimColor> #{pr.number}</Text>
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell w={2} />
						<Cell w={32}>
							<Text color="blue">{pr.repo}</Text>
						</Cell>
						<Cell w={16}>
							<Text dimColor>{pr.author}</Text>
						</Cell>
						<Cell w={10}>
							<Text dimColor>{timeAgo(pr.updatedAt)}</Text>
						</Cell>
						<Cell w={15}>
							<Status pr={pr} />
						</Cell>
						<Cell w={10}>
							<Checks state={pr.checks} />
						</Cell>
						<Cell w={12}>{pr.mergeable === 'CONFLICTING' ? <Text color="red">⚠ conflicts</Text> : null}</Cell>
						<Cell w={14}>
							<Text color="green">+{pr.additions}</Text>
							<Text color="red"> −{pr.deletions}</Text>
						</Cell>
						<Cell w={13}>{pr.comments ? <Text dimColor>{pr.comments} comment{pr.comments === 1 ? '' : 's'}</Text> : null}</Cell>
						<Cell grow>{pr.labels.length ? <Text color="yellow">{pr.labels.join(', ')}</Text> : null}</Cell>
					</Line>
				</>
			)}
		/>
	);
}

const bySection = (pr: PullRequest) => pr.section;

function Status({pr}: {pr: PullRequest}) {
	if (pr.isDraft) return <Text color="gray">◌ draft</Text>;
	if (pr.reviewDecision === 'APPROVED') return <Text color="green">✓ approved</Text>;
	if (pr.reviewDecision === 'CHANGES_REQUESTED') return <Text color="red">± changes</Text>;
	if (pr.reviewDecision === 'REVIEW_REQUIRED') return <Text color="yellow">○ needs review</Text>;
	return null;
}

function Checks({state}: {state: PullRequest['checks']}) {
	if (state === 'SUCCESS') return <Text color="green">✓ checks</Text>;
	if (state === 'FAILURE' || state === 'ERROR') return <Text color="red">✗ checks</Text>;
	if (state === 'PENDING' || state === 'EXPECTED') return <Text color="yellow">● checks</Text>;
	return null;
}
