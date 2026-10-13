import type {GitHubClient, Notification, PullRequest, Repo, Viewer} from './github.js';

// Made-up data for `github --demo`, used for screenshots and trying the UI without a GitHub account.
// All people, orgs, and repos here are fictional.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const url = 'https://example.com';

type PRInput = Partial<PullRequest> & Pick<PullRequest, 'repo' | 'number' | 'title' | 'author' | 'section'>;

function pr(p: PRInput & {age: number}): PullRequest {
	return {
		id: `${p.repo}#${p.number}`,
		url,
		isDraft: false,
		updatedAt: ago(p.age),
		reviewDecision: 'REVIEW_REQUIRED',
		mergeable: 'MERGEABLE',
		checks: 'SUCCESS',
		additions: 0,
		deletions: 0,
		comments: 0,
		labels: [],
		headRef: 'feature',
		...p,
	};
}

const PULL_REQUESTS: PullRequest[] = [
	pr({section: 'Assigned to you', repo: 'acme/storefront', number: 482, title: 'Add Apple Pay to checkout', author: 'mira-chen', age: 25 * MIN, checks: 'PENDING', additions: 412, deletions: 38, comments: 3, labels: ['payments', 'high priority']}),
	pr({section: 'Assigned to you', repo: 'acme/api', number: 1290, title: 'Rate limit webhook retries per endpoint', author: 'alex-dev', age: 3 * HOUR, reviewDecision: 'APPROVED', additions: 156, deletions: 22, comments: 5, labels: ['backend']}),
	pr({section: 'Review requested', repo: 'acme/design-system', number: 233, title: 'Button: tertiary variant and focus ring tokens', author: 'jordan-k', age: 1 * HOUR, additions: 289, deletions: 61, comments: 2, labels: ['ui']}),
	pr({section: 'Review requested', repo: 'acme/api', number: 1287, title: 'Move invoice PDFs to background jobs', author: 'priya-n', age: 5 * HOUR, reviewDecision: 'CHANGES_REQUESTED', checks: 'FAILURE', additions: 734, deletions: 410, comments: 11, labels: ['backend', 'performance']}),
	pr({section: 'Review requested', repo: 'acme/mobile', number: 918, title: 'Offline mode for order history', author: 'sam-o', age: 1 * DAY, mergeable: 'CONFLICTING', additions: 1203, deletions: 87, comments: 7}),
	pr({section: 'Your pull requests', repo: 'acme/storefront', number: 479, title: 'Cache product images at the edge', author: 'alex-dev', age: 2 * DAY, reviewDecision: 'APPROVED', additions: 88, deletions: 14, comments: 4, labels: ['performance']}),
	pr({section: 'Your pull requests', repo: 'acme/infra', number: 77, title: 'Upgrade Postgres to 17', author: 'alex-dev', age: 4 * DAY, isDraft: true, checks: 'PENDING', additions: 46, deletions: 12}),
	pr({section: 'Your pull requests', repo: 'alex-dev/dotfiles', number: 12, title: 'Switch shell prompt to starship', author: 'alex-dev', age: 21 * DAY, reviewDecision: null, additions: 31, deletions: 58}),
	pr({section: 'acme/docs', repo: 'acme/docs', number: 88, title: 'Document the new webhooks API', author: 'taylor-r', age: 6 * HOUR, additions: 520, deletions: 0, comments: 1, labels: ['docs']}),
	pr({section: 'acme/docs', repo: 'acme/docs', number: 85, title: 'Fix broken links in Getting Started', author: 'sam-o', age: 2 * DAY, reviewDecision: 'APPROVED', additions: 12, deletions: 12}),
	pr({section: 'acme/analytics', repo: 'acme/analytics', number: 45, title: 'Daily revenue rollup job', author: 'mira-chen', age: 3 * DAY, isDraft: true, checks: 'FAILURE', additions: 377, deletions: 5, comments: 2, labels: ['data']}),
];

type RepoInput = Pick<Repo, 'fullName' | 'description' | 'language'> & Partial<Repo> & {mine?: number; pushed: number};

function repo(r: RepoInput): Repo {
	const {mine, pushed, ...rest} = r;
	return {
		url,
		isPrivate: true,
		isFork: false,
		isArchived: false,
		stars: 0,
		pushedAt: ago(pushed),
		myLastActivity: mine === undefined ? null : ago(mine),
		...rest,
	};
}

const REPOS: Repo[] = [
	repo({fullName: 'acme/storefront', description: 'Customer-facing store: catalog, cart, and checkout', language: 'Ruby', stars: 14, mine: 20 * MIN, pushed: 20 * MIN}),
	repo({fullName: 'acme/api', description: 'Public REST and webhooks API', language: 'Ruby', stars: 9, mine: 3 * HOUR, pushed: 2 * HOUR}),
	repo({fullName: 'acme/design-system', description: 'Tokens, components, and docs for every Acme UI', language: 'TypeScript', stars: 31, mine: 1 * DAY, pushed: 1 * HOUR}),
	repo({fullName: 'alex-dev/dotfiles', description: 'zsh, git, and editor config', language: 'Shell', isPrivate: false, stars: 6, mine: 3 * DAY, pushed: 3 * DAY}),
	repo({fullName: 'acme/infra', description: 'Terraform and deploy pipelines', language: 'HCL', mine: 4 * DAY, pushed: 4 * DAY}),
	repo({fullName: 'acme/mobile', description: 'iOS and Android apps', language: 'TypeScript', stars: 4, mine: 7 * DAY, pushed: 1 * DAY}),
	repo({fullName: 'acme/sdk-js', description: 'Official JavaScript SDK for the Acme API', language: 'TypeScript', isPrivate: false, stars: 1240, mine: 12 * DAY, pushed: 8 * HOUR}),
	repo({fullName: 'acme/docs', description: 'developer.acme.example', language: 'MDX', isPrivate: false, stars: 22, pushed: 6 * HOUR}),
	repo({fullName: 'acme/analytics', description: 'Warehouse models and scheduled reports', language: 'Python', pushed: 3 * DAY}),
	repo({fullName: 'acme/support-bot', description: 'Answers common support questions in chat', language: 'Python', pushed: 9 * DAY}),
	repo({fullName: 'acme/marketing-site', description: 'acme.example landing pages', language: 'Astro', isPrivate: false, stars: 3, pushed: 16 * DAY}),
	repo({fullName: 'acme/sdk-ruby', description: 'Official Ruby SDK for the Acme API', language: 'Ruby', isPrivate: false, stars: 418, pushed: 40 * DAY}),
	repo({fullName: 'alex-dev/rails', description: 'Ruby on Rails (fork)', language: 'Ruby', isPrivate: false, isFork: true, stars: 2, pushed: 70 * DAY}),
	repo({fullName: 'alex-dev/advent-of-code', description: 'Puzzle solutions, one language per year', language: 'Elixir', isPrivate: false, stars: 11, pushed: 300 * DAY}),
	repo({fullName: 'acme/legacy-admin', description: 'Old back office. Replaced by storefront admin.', language: 'JavaScript', isArchived: true, pushed: 800 * DAY}),
];

type NotificationInput = Omit<Notification, 'id' | 'url' | 'updatedAt' | 'number' | 'state'> &
	Partial<Pick<Notification, 'number' | 'state'>> & {age: number};

const NOTIFICATIONS: Notification[] = (
	[
		{type: 'PullRequest', repo: 'acme/api', number: 1287, state: 'open', title: 'Move invoice PDFs to background jobs', reason: 'review_requested', unread: true, age: 10 * MIN},
		{type: 'CheckSuite', repo: 'acme/api', title: 'CI workflow run failed for main', reason: 'ci_activity', unread: true, age: 22 * MIN},
		{type: 'PullRequest', repo: 'acme/storefront', number: 482, state: 'open', title: 'Add Apple Pay to checkout', reason: 'mention', unread: true, age: 25 * MIN},
		{type: 'Issue', repo: 'acme/storefront', number: 491, state: 'open', title: 'Checkout button stays disabled on Safari 18', reason: 'assign', unread: true, age: 1 * HOUR},
		{type: 'PullRequest', repo: 'acme/storefront', number: 476, state: 'merged', title: 'Lazy-load the reviews widget', reason: 'author', unread: false, age: 2 * HOUR},
		{type: 'Discussion', repo: 'acme/design-system', title: 'RFC: dark mode color tokens', reason: 'comment', unread: true, age: 3 * HOUR},
		{type: 'PullRequest', repo: 'acme/mobile', number: 902, state: 'closed', title: 'Experiment: React Native new architecture', reason: 'subscribed', unread: false, age: 5 * HOUR},
		{type: 'PullRequest', repo: 'acme/docs', number: 88, state: 'open', title: 'Document the new webhooks API', reason: 'comment', unread: true, age: 6 * HOUR},
		{type: 'Release', repo: 'acme/sdk-js', title: 'v4.2.0', reason: 'subscribed', unread: false, age: 8 * HOUR},
		{type: 'Issue', repo: 'acme/api', number: 1271, state: 'completed', title: 'Webhook signatures fail on unicode bodies', reason: 'author', unread: false, age: 1 * DAY},
		{type: 'Issue', repo: 'acme/docs', number: 64, state: 'not_planned', title: 'Add a dark theme to the docs site', reason: 'subscribed', unread: false, age: 2 * DAY},
		{type: 'PullRequest', repo: 'acme/analytics', number: 45, state: 'draft', title: 'Daily revenue rollup job', reason: 'team_mention', unread: false, age: 3 * DAY},
		{type: 'PullRequest', repo: 'acme/design-system', number: 229, state: 'merged', title: 'Tokens: spacing scale v2', reason: 'review_requested', unread: false, age: 4 * DAY},
		{type: 'Issue', repo: 'acme/mobile', number: 910, state: 'open', title: 'Push notifications arrive twice on Android', reason: 'state_change', unread: false, age: 5 * DAY},
	] satisfies NotificationInput[]
).map(({age, ...n}, i) => ({id: `demo-${i}`, url, number: null, state: null, ...n, updatedAt: ago(age)}));

export class DemoGitHub implements GitHubClient {
	async viewer(): Promise<Viewer> {
		return {login: 'alex-dev', name: 'Alex Morgan'};
	}

	async repos(): Promise<Repo[]> {
		return REPOS;
	}

	async pullRequests(): Promise<PullRequest[]> {
		return PULL_REQUESTS;
	}

	async notifications(): Promise<Notification[]> {
		return NOTIFICATIONS;
	}

	async markRead() {}
	async markDone() {}
	async unsubscribe() {}
}
