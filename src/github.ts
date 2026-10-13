import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);
const API = 'https://api.github.com';

export async function getToken(): Promise<string> {
	try {
		// Strip token env vars so gh returns the keyring login, not a token a project's env happens to set.
		const {GITHUB_TOKEN, GH_TOKEN, ...env} = process.env;
		const {stdout} = await exec('gh', ['auth', 'token', '--hostname', 'github.com'], {env});
		return stdout.trim();
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new Error('The GitHub CLI is not installed. Install it from https://cli.github.com, then run `gh auth login`.');
		}
		throw new Error('Not logged in to GitHub. Run `gh auth login` first.');
	}
}

export type Viewer = {login: string; name: string | null};

export type Repo = {
	fullName: string;
	url: string;
	description: string | null;
	isPrivate: boolean;
	isFork: boolean;
	isArchived: boolean;
	language: string | null;
	stars: number;
	pushedAt: string;
	myLastActivity: string | null;
};

export type PullRequest = {
	id: string;
	number: number;
	title: string;
	url: string;
	repo: string;
	author: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
	mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
	checks: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null;
	additions: number;
	deletions: number;
	comments: number;
	labels: string[];
	headRef: string;
	baseRef: string;
	section: string;
};

export type SubjectState = 'open' | 'draft' | 'merged' | 'closed' | 'completed' | 'not_planned';

export type Notification = {
	id: string;
	title: string;
	type: string;
	number: number | null;
	state: SubjectState | null;
	reason: string;
	repo: string;
	url: string;
	unread: boolean;
	updatedAt: string;
};

export type GitHubClient = Pick<
	GitHub,
	'viewer' | 'repos' | 'pullRequests' | 'notifications' | 'markRead' | 'markDone' | 'unsubscribe'
>;

export class GitHub {
	constructor(private token: string) {}

	private async request(path: string, init: RequestInit = {}): Promise<Response> {
		const res = await fetch(path.startsWith('http') ? path : API + path, {
			...init,
			headers: {
				Authorization: `Bearer ${this.token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				...init.headers,
			},
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`GitHub ${res.status} on ${init.method ?? 'GET'} ${path}: ${body.slice(0, 200)}`);
		}
		return res;
	}

	private async getJson<T>(path: string): Promise<T> {
		return (await this.request(path)).json() as Promise<T>;
	}

	// Fetches page 1, reads the last page number from the Link header, then fetches the rest in parallel.
	private async paginate<T>(path: string, maxPages: number): Promise<T[]> {
		const first = await this.request(path);
		const items = (await first.json()) as T[];
		const last = first.headers.get('link')?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
		const lastPage = Math.min(last ? Number(last[1]) : 1, maxPages);
		const sep = path.includes('?') ? '&' : '?';
		const rest = await Promise.all(
			Array.from({length: lastPage - 1}, (_, i) => this.getJson<T[]>(`${path}${sep}page=${i + 2}`)),
		);
		return items.concat(...rest);
	}

	async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const res = await this.request('/graphql', {
			method: 'POST',
			body: JSON.stringify({query, variables}),
			headers: {'Content-Type': 'application/json'},
		});
		const json = (await res.json()) as {data: T; errors?: {message: string}[]};
		if (json.errors?.length && !json.data) throw new Error(json.errors[0]!.message);
		return json.data;
	}

	async viewer(): Promise<Viewer> {
		const user = await this.getJson<{login: string; name: string | null}>('/user');
		return {login: user.login, name: user.name};
	}

	// GitHub has no "my last activity" sort, so we rank by the user's own event feed
	// (last 300 events / 90 days) and fall back to push time for everything else.
	async repos(login: string): Promise<Repo[]> {
		type RawRepo = {
			full_name: string;
			html_url: string;
			description: string | null;
			private: boolean;
			fork: boolean;
			archived: boolean;
			language: string | null;
			stargazers_count: number;
			pushed_at: string;
		};
		const [raw, events] = await Promise.all([
			this.paginate<RawRepo>('/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member', 20),
			this.paginate<{repo: {name: string}; created_at: string}>(`/users/${login}/events?per_page=100`, 3).catch(() => []),
		]);

		const lastActivity = new Map<string, string>();
		for (const e of events) {
			const prev = lastActivity.get(e.repo.name);
			if (!prev || e.created_at > prev) lastActivity.set(e.repo.name, e.created_at);
		}

		const repos = raw.map(r => ({
			fullName: r.full_name,
			url: r.html_url,
			description: r.description,
			isPrivate: r.private,
			isFork: r.fork,
			isArchived: r.archived,
			language: r.language,
			stars: r.stargazers_count,
			pushedAt: r.pushed_at,
			myLastActivity: lastActivity.get(r.full_name) ?? null,
		}));

		return repos.sort((a, b) => {
			if (a.myLastActivity && b.myLastActivity) return b.myLastActivity.localeCompare(a.myLastActivity);
			if (a.myLastActivity) return -1;
			if (b.myLastActivity) return 1;
			return (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '');
		});
	}

	async pullRequests(): Promise<PullRequest[]> {
		const searches: [string, string][] = [
			['Assigned to you', 'is:pr is:open archived:false assignee:@me'],
			['Review requested', 'is:pr is:open archived:false review-requested:@me'],
			['Your pull requests', 'is:pr is:open archived:false author:@me'],
		];
		const searchQuery = `query {
			${searches.map(([, q], i) => `s${i}: search(type: ISSUE, query: ${JSON.stringify(q)}, first: 50) { nodes { ...pr } }`).join('\n')}
		}
		${PR_FRAGMENT}`;

		const [searchData, watched] = await Promise.all([
			this.graphql<Record<string, {nodes: RawPR[]}>>(searchQuery),
			this.paginate<{full_name: string; archived: boolean}>('/user/subscriptions?per_page=100', 10),
		]);

		const seen = new Set<string>();
		const result: PullRequest[] = [];
		const add = (raw: RawPR, section: string) => {
			if (!raw?.id || seen.has(raw.id) || isBot(raw)) return;
			seen.add(raw.id);
			result.push(toPullRequest(raw, section));
		};

		searches.forEach(([section], i) => {
			const nodes = [...(searchData[`s${i}`]?.nodes ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
			nodes.forEach(n => add(n, section));
		});

		const watchedRepos = watched.filter(r => !r.archived).map(r => r.full_name);
		const chunks: string[][] = [];
		for (let i = 0; i < watchedRepos.length; i += 4) chunks.push(watchedRepos.slice(i, i + 4));

		const repoResults = await Promise.all(
			chunks.map(chunk => {
				const q = `query {
					${chunk
						.map((full, i) => {
							const [owner, name] = full.split('/');
							return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
								pullRequests(states: OPEN, first: 25, orderBy: {field: UPDATED_AT, direction: DESC}) { nodes { ...pr } }
							}`;
						})
						.join('\n')}
				}
				${PR_FRAGMENT}`;
				return this.graphql<Record<string, {pullRequests: {nodes: RawPR[]}} | null>>(q).catch(() => ({}));
			}),
		);

		const byRepo = repoResults
			.flatMap(data => Object.values(data))
			.map(r => r?.pullRequests.nodes ?? [])
			.filter(nodes => nodes.length > 0)
			.sort((a, b) => b[0]!.updatedAt.localeCompare(a[0]!.updatedAt));

		for (const nodes of byRepo) nodes.forEach(n => add(n, n.repository.nameWithOwner));
		return result;
	}

	async notifications(): Promise<Notification[]> {
		type RawNotification = {
			id: string;
			unread: boolean;
			reason: string;
			updated_at: string;
			subject: {title: string; url: string | null; type: string};
			repository: {full_name: string; html_url: string};
		};
		const raw = await this.paginate<RawNotification>('/notifications?all=true&per_page=50', 6);
		const items = raw.map(n => ({
			id: n.id,
			title: n.subject.title,
			type: n.subject.type,
			number: Number(n.subject.url?.match(/\/(?:pulls|issues)\/(\d+)$/)?.[1]) || null,
			state: null as SubjectState | null,
			reason: n.reason,
			repo: n.repository.full_name,
			url: notificationUrl(n.subject, n.repository.html_url),
			unread: n.unread,
			updatedAt: n.updated_at,
		}));
		await this.fillSubjectStates(items);
		return items;
	}

	// The notifications API doesn't say whether the PR/issue is open, merged, or closed, so look it up.
	private async fillSubjectStates(items: Notification[]) {
		const targets = items.filter(n => n.number !== null);
		const chunks: Notification[][] = [];
		for (let i = 0; i < targets.length; i += 25) chunks.push(targets.slice(i, i + 25));

		await Promise.all(
			chunks.map(async chunk => {
				const q = `query {
					${chunk
						.map((n, i) => {
							const [owner, name] = n.repo.split('/');
							return `n${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
								issueOrPullRequest(number: ${n.number}) {
									... on PullRequest { state isDraft }
									... on Issue { state stateReason }
								}
							}`;
						})
						.join('\n')}
				}`;
				type Subject = {state: string; isDraft?: boolean; stateReason?: string | null} | null;
				const data = await this.graphql<Record<string, {issueOrPullRequest: Subject} | null>>(q).catch(() => ({}));
				chunk.forEach((n, i) => {
					const s = (data as Record<string, {issueOrPullRequest: Subject} | null>)[`n${i}`]?.issueOrPullRequest;
					if (s) n.state = subjectState(s);
				});
			}),
		);
	}

	async markRead(threadId: string) {
		await this.request(`/notifications/threads/${threadId}`, {method: 'PATCH'});
	}

	async markDone(threadId: string) {
		await this.request(`/notifications/threads/${threadId}`, {method: 'DELETE'});
	}

	async unsubscribe(threadId: string) {
		await this.request(`/notifications/threads/${threadId}/subscription`, {method: 'DELETE'});
		await this.markDone(threadId);
	}
}

function subjectState(s: {state: string; isDraft?: boolean; stateReason?: string | null}): SubjectState {
	if (s.state === 'MERGED') return 'merged';
	if (s.state === 'OPEN') return s.isDraft ? 'draft' : 'open';
	if (s.stateReason === 'NOT_PLANNED') return 'not_planned';
	if (s.stateReason === 'COMPLETED') return 'completed';
	return 'closed';
}

const IGNORED_AUTHORS = new Set(['dependabot', 'dependabot-preview']);

function isBot(raw: RawPR): boolean {
	return IGNORED_AUTHORS.has(raw.author?.login ?? '');
}

const PR_FRAGMENT = `fragment pr on PullRequest {
	id number title url isDraft createdAt updatedAt
	author { login }
	repository { nameWithOwner }
	reviewDecision mergeable
	additions deletions
	comments { totalCount }
	labels(first: 5) { nodes { name } }
	headRefName baseRefName
	commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
}`;

type RawPR = {
	id: string;
	number: number;
	title: string;
	url: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	author: {login: string} | null;
	repository: {nameWithOwner: string};
	reviewDecision: PullRequest['reviewDecision'];
	mergeable: PullRequest['mergeable'];
	additions: number;
	deletions: number;
	comments: {totalCount: number};
	labels: {nodes: {name: string}[]};
	headRefName: string;
	baseRefName: string;
	commits: {nodes: {commit: {statusCheckRollup: {state: PullRequest['checks']} | null}}[]};
};

function toPullRequest(raw: RawPR, section: string): PullRequest {
	return {
		id: raw.id,
		number: raw.number,
		title: raw.title,
		url: raw.url,
		repo: raw.repository.nameWithOwner,
		author: raw.author?.login ?? 'ghost',
		isDraft: raw.isDraft,
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt,
		reviewDecision: raw.reviewDecision,
		mergeable: raw.mergeable,
		checks: raw.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
		additions: raw.additions,
		deletions: raw.deletions,
		comments: raw.comments.totalCount,
		labels: raw.labels.nodes.map(l => l.name),
		headRef: raw.headRefName,
		baseRef: raw.baseRefName,
		section,
	};
}

function notificationUrl(subject: {url: string | null; type: string}, repoUrl: string): string {
	if (subject.type === 'Discussion') return `${repoUrl}/discussions`;
	if (subject.type === 'CheckSuite') return `${repoUrl}/actions`;
	if (subject.type === 'Release') return `${repoUrl}/releases`;
	if (!subject.url) return repoUrl;
	return subject.url
		.replace('https://api.github.com/repos/', 'https://github.com/')
		.replace(/\/pulls\/(\d+)$/, '/pull/$1')
		.replace(/\/commits\/(\w+)$/, '/commit/$1');
}
