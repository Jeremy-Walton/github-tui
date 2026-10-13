import {Text} from 'ink';
import type {Repo} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import {openUrl, type Resource, timeAgo} from '../util.js';
import type {PageProps} from './types.js';

export function ReposPage({resource, ...props}: PageProps & {resource: Resource<Repo[]>}) {
	return (
		<ListView
			{...props}
			resource={resource}
			emptyText="No repositories."
			getKey={r => r.fullName}
			getSearchText={repoSearchText}
			onOpen={r => openUrl(r.url)}
			renderItem={(r, selected) => (
				<>
					<Line selected={selected}>
						<Cell grow>
							<Title selected={selected}>{r.fullName}</Title>
						</Cell>
						<Cell w={10}>
							{r.isArchived ? (
								<Text color="gray">archived</Text>
							) : r.isPrivate ? (
								<Text color="yellow">private</Text>
							) : (
								<Text dimColor>public</Text>
							)}
						</Cell>
						<Cell w={6}>{r.isFork ? <Text dimColor>fork</Text> : null}</Cell>
						<Cell w={13}>
							<Text dimColor>{r.language ?? ''}</Text>
						</Cell>
						<Cell w={8}>{r.stars ? <Text dimColor>★ {r.stars}</Text> : null}</Cell>
						<Cell w={18}>
							{r.myLastActivity ? (
								<Text color="green">you {timeAgo(r.myLastActivity)}</Text>
							) : (
								<Text dimColor>pushed {timeAgo(r.pushedAt)}</Text>
							)}
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell grow>
							<Text dimColor>{r.description ?? ''}</Text>
						</Cell>
					</Line>
				</>
			)}
		/>
	);
}

const repoSearchText = (r: Repo) => `${r.fullName} ${r.description ?? ''}`;
