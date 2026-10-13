import type {PageId} from '../settings.js';

export type PageProps = {
	height: number;
	query: string;
	searching: boolean;
	active: boolean;
	onMessage: (message: string) => void;
};

export const PAGE_NAMES: Record<PageId, string> = {
	'pull-requests': 'Pull Requests',
	repositories: 'Repositories',
	inbox: 'Inbox',
};
