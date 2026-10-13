import {execFile} from 'node:child_process';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GitHub, getToken} from '../src/github.js';

vi.mock('node:child_process', () => ({
	execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, r: unknown) => void) =>
		cb(null, {stdout: 'gho_test\n'}),
	),
}));

type Call = {url: string; method: string; body: string; headers: HeadersInit | undefined};

// Routes each request to `respond`, which returns the JSON body (or a Response for non-JSON cases).
function stubFetch(respond: (call: Call) => unknown) {
	const calls: Call[] = [];
	const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
		const call = {url, method: init.method ?? 'GET', body: String(init.body ?? ''), headers: init.headers};
		calls.push(call);
		const result = respond(call);
		return result instanceof Response ? result : Response.json(result);
	});
	vi.stubGlobal('fetch', fetch);
	return calls;
}

function rawPR(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		number: Number(id.replace(/\D/g, '')) || 1,
		title: `PR ${id}`,
		url: `https://github.com/acme/web/pull/${id}`,
		isDraft: false,
		updatedAt: '2026-06-01T00:00:00Z',
		author: {login: 'mira'},
		repository: {nameWithOwner: 'acme/web'},
		reviewDecision: 'APPROVED',
		mergeable: 'MERGEABLE',
		additions: 10,
		deletions: 2,
		comments: {totalCount: 3},
		labels: {nodes: [{name: 'ui'}]},
		headRefName: 'feature',
		commits: {nodes: [{commit: {statusCheckRollup: {state: 'FAILURE'}}}]},
		...overrides,
	};
}

describe('getToken', () => {
	it('asks gh for the keyring login, ignoring token env vars', async () => {
		vi.stubEnv('GITHUB_TOKEN', 'from-env');
		vi.stubEnv('GH_TOKEN', 'from-env');

		await expect(getToken()).resolves.toBe('gho_test');

		const call = (envVar: string) => [
			'gh',
			['auth', 'token', '--hostname', 'github.com'],
			{env: expect.not.objectContaining({[envVar]: expect.anything()})},
			expect.any(Function),
		];
		expect(execFile).toHaveBeenLastCalledWith(...call('GITHUB_TOKEN'));
		expect(execFile).toHaveBeenLastCalledWith(...call('GH_TOKEN'));
	});
});

describe('GitHub', () => {
	let gh: GitHub;
	beforeEach(() => {
		gh = new GitHub('gho_test');
	});

	it('sends the token as a bearer header', async () => {
		const calls = stubFetch(() => ({login: 'alex', name: 'Alex'}));
		await gh.viewer();
		expect(calls[0]?.headers).toMatchObject({Authorization: 'Bearer gho_test'});
	});

	it('throws a readable error for failed requests', async () => {
		stubFetch(() => new Response('Bad credentials', {status: 401}));
		await expect(gh.viewer()).rejects.toThrow('GitHub 401 on GET /user: Bad credentials');
	});

	describe('repos', () => {
		it('puts repos with your own recent activity first, then sorts by push time', async () => {
			stubFetch(({url}) => {
				if (url.includes('/users/alex/events')) {
					return [
						{repo: {name: 'acme/old'}, created_at: '2026-06-02T00:00:00Z'},
						{repo: {name: 'acme/api'}, created_at: '2026-06-05T00:00:00Z'},
						{repo: {name: 'acme/old'}, created_at: '2026-06-01T00:00:00Z'},
					];
				}
				const repo = (full_name: string, pushed_at: string) => ({
					full_name,
					html_url: `https://github.com/${full_name}`,
					description: null,
					private: true,
					fork: false,
					archived: false,
					language: 'Ruby',
					stargazers_count: 0,
					pushed_at,
				});
				return [
					repo('acme/busy', '2026-06-10T00:00:00Z'),
					repo('acme/old', '2020-01-01T00:00:00Z'),
					repo('acme/quiet', '2026-01-01T00:00:00Z'),
					repo('acme/api', '2026-06-04T00:00:00Z'),
				];
			});

			const repos = await gh.repos('alex');

			expect(repos.map(r => r.fullName)).toEqual(['acme/api', 'acme/old', 'acme/busy', 'acme/quiet']);
			expect(repos[1]!.myLastActivity).toBe('2026-06-02T00:00:00Z');
			expect(repos[2]!.myLastActivity).toBeNull();
		});

		it('fetches the remaining pages in parallel using the Link header', async () => {
			const calls = stubFetch(({url}) => {
				if (url.includes('/events')) return [];
				if (/[?&]page=/.test(url)) return [];
				return new Response('[]', {
					headers: {link: '<https://api.github.com/user/repos?per_page=100&page=3>; rel="last"'},
				});
			});

			await gh.repos('alex');

			const pages = calls.filter(c => c.url.includes('/user/repos')).map(c => c.url.match(/[?&]page=(\d)/)?.[1]);
			expect(pages).toEqual([undefined, '2', '3']);
		});
	});

	describe('pullRequests', () => {
		function stubPRs() {
			return stubFetch(({url, body}) => {
				if (url.includes('/user/subscriptions')) {
					return [
						{full_name: 'acme/web', archived: false},
						{full_name: 'acme/legacy', archived: true},
					];
				}
				if (body.includes('search(')) {
					return {
						data: {
							s0: {nodes: [rawPR('A1')]},
							s1: {nodes: [rawPR('A1'), rawPR('R2'), rawPR('D3', {author: {login: 'dependabot'}})]},
							s2: {nodes: []},
						},
					};
				}
				return {data: {r0: {pullRequests: {nodes: [rawPR('R2'), rawPR('W4')]}}}};
			});
		}

		it('groups PRs by section, showing each PR once', async () => {
			stubPRs();
			const prs = await gh.pullRequests();
			expect(prs.map(p => [p.section, p.id])).toEqual([
				['Assigned to you', 'A1'],
				['Review requested', 'R2'],
				['Review requested', 'D3'],
				['acme/web', 'W4'],
			]);
		});

		it('flags bot PRs and PRs that only show up through a watched repo', async () => {
			stubPRs();
			const prs = await gh.pullRequests();
			expect(prs.map(p => [p.id, p.bot, p.watched])).toEqual([
				['A1', false, false],
				['R2', false, false],
				['D3', true, false],
				['W4', false, true],
			]);
		});

		it('maps review, checks, and size fields', async () => {
			stubPRs();
			const [pr] = await gh.pullRequests();
			expect(pr).toMatchObject({
				reviewDecision: 'APPROVED',
				checks: 'FAILURE',
				additions: 10,
				deletions: 2,
				comments: 3,
				labels: ['ui'],
				author: 'mira',
			});
		});

		it('does not query archived watched repos', async () => {
			const calls = stubPRs();
			await gh.pullRequests();
			const repoQueries = calls.filter(c => c.body.includes('repository(')).map(c => c.body);
			expect(repoQueries.join()).toContain('\\"web\\"');
			expect(repoQueries.join()).not.toContain('legacy');
		});

		it('still returns search results when a repo batch fails', async () => {
			stubFetch(({url, body}) => {
				if (url.includes('/user/subscriptions')) return [{full_name: 'acme/web', archived: false}];
				if (body.includes('search(')) return {data: {s0: {nodes: [rawPR('A1')]}, s1: {nodes: []}, s2: {nodes: []}}};
				return new Response('boom', {status: 502});
			});
			const prs = await gh.pullRequests();
			expect(prs.map(p => p.id)).toEqual(['A1']);
		});
	});

	describe('notifications', () => {
		it('maps subjects to web URLs and fills in open/merged/closed state', async () => {
			stubFetch(({url}) => {
				if (url.includes('/notifications')) {
					const n = (id: string, type: string, subjectUrl: string | null) => ({
						id,
						unread: id === '1',
						reason: 'review_requested',
						updated_at: '2026-06-01T00:00:00Z',
						subject: {title: `T${id}`, url: subjectUrl, type},
						repository: {full_name: 'acme/web', html_url: 'https://github.com/acme/web'},
					});
					return [
						n('1', 'PullRequest', 'https://api.github.com/repos/acme/web/pulls/12'),
						n('2', 'Issue', 'https://api.github.com/repos/acme/web/issues/34'),
						n('3', 'CheckSuite', null),
						n('4', 'Release', 'https://api.github.com/repos/acme/web/releases/99'),
					];
				}
				return {
					data: {
						r0: {issueOrPullRequest: {state: 'MERGED'}},
						r1: {issueOrPullRequest: {state: 'CLOSED', stateReason: 'NOT_PLANNED'}},
					},
				};
			});

			const items = await gh.notifications();

			expect(items.map(n => [n.type, n.number, n.state, n.url])).toEqual([
				['PullRequest', 12, 'merged', 'https://github.com/acme/web/pull/12'],
				['Issue', 34, 'not_planned', 'https://github.com/acme/web/issues/34'],
				['CheckSuite', null, null, 'https://github.com/acme/web/actions'],
				['Release', null, null, 'https://github.com/acme/web/releases'],
			]);
		});
	});

	describe('thread actions', () => {
		it('marks done with DELETE on the thread', async () => {
			const calls = stubFetch(() => new Response(null, {status: 204}));
			await gh.markDone('7');
			expect(calls).toEqual([expect.objectContaining({method: 'DELETE', url: expect.stringMatching(/threads\/7$/)})]);
		});

		it('unsubscribes and marks done', async () => {
			const calls = stubFetch(() => new Response(null, {status: 204}));
			await gh.unsubscribe('7');
			expect(calls.map(c => `${c.method} ${c.url.replace('https://api.github.com', '')}`).sort()).toEqual([
				'DELETE /notifications/threads/7',
				'DELETE /notifications/threads/7/subscription',
			]);
		});
	});
});
