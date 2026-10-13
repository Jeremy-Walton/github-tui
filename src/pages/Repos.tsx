import {Text} from 'ink';
import {Cell, Line, ListView} from '../ListView.js';
import type {Repo} from '../github.js';
import {openUrl, timeAgo, type Resource} from '../util.js';
import type {PageProps} from './types.js';

export function ReposPage({resource, ...props}: PageProps & {resource: Resource<Repo[]>}) {
	return (
		<ListView
			{...props}
			items={resource.data ?? []}
			loading={resource.loading}
			error={resource.error}
			itemHeight={2}
			emptyText="No repositories."
			getKey={r => r.fullName}
			getSearchText={r => `${r.fullName} ${r.description ?? ''}`}
			onOpen={r => openUrl(r.url)}
			renderItem={(r, selected) => (
				<>
					<Line selected={selected}>
						<Cell grow>
							<Text bold={selected} color={selected ? 'cyan' : undefined}>
								{r.fullName}
							</Text>
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
						<Cell w={7}>{r.stars ? <Text dimColor>★ {r.stars}</Text> : null}</Cell>
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
