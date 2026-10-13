import {Text} from 'ink';
import type {Repo} from '../github.js';
import {Cell, Line, ListView, Title} from '../ListView.js';
import {Muted, useTheme} from '../theme.js';
import {openUrl, type Resource, timeAgo} from '../util.js';
import type {PageProps} from './types.js';

export function ReposPage({resource, ...props}: PageProps & {resource: Resource<Repo[]>}) {
	const t = useTheme();
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
								<Text color={t.neutral}>archived</Text>
							) : r.isPrivate ? (
								<Text color={t.warning}>private</Text>
							) : (
								<Muted>public</Muted>
							)}
						</Cell>
						<Cell w={6}>{r.isFork ? <Muted>fork</Muted> : null}</Cell>
						<Cell w={13}>
							<Muted>{r.language ?? ''}</Muted>
						</Cell>
						<Cell w={8}>{r.stars ? <Muted>★ {r.stars}</Muted> : null}</Cell>
						<Cell w={18}>
							{r.myLastActivity ? (
								<Text color={t.success}>you {timeAgo(r.myLastActivity)}</Text>
							) : (
								<Muted>pushed {timeAgo(r.pushedAt)}</Muted>
							)}
						</Cell>
					</Line>
					<Line selected={selected}>
						<Cell grow>
							<Muted>{r.description ?? ''}</Muted>
						</Cell>
					</Line>
				</>
			)}
		/>
	);
}

const repoSearchText = (r: Repo) => `${r.fullName} ${r.description ?? ''}`;
