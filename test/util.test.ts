import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {matches, timeAgo} from '../src/util.js';

describe('timeAgo', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it.each([
		['2026-06-15T11:59:30Z', 'just now'],
		['2026-06-15T11:55:00Z', '5m ago'],
		['2026-06-15T09:00:00Z', '3h ago'],
		['2026-06-13T12:00:00Z', '2d ago'],
		['2026-03-15T12:00:00Z', '3mo ago'],
		['2024-06-15T12:00:00Z', '2y ago'],
	])('formats %s as %s', (iso, expected) => {
		expect(timeAgo(iso)).toBe(expected);
	});

	it('returns an empty string for null', () => {
		expect(timeAgo(null)).toBe('');
	});

	it('treats future times as just now', () => {
		expect(timeAgo('2026-06-15T13:00:00Z')).toBe('just now');
	});
});

describe('matches', () => {
	it('matches every word in any order, ignoring case', () => {
		expect(matches('acme/storefront Add Apple Pay', 'apple ACME')).toBe(true);
	});

	it('fails when any word is missing', () => {
		expect(matches('acme/storefront Add Apple Pay', 'apple google')).toBe(false);
	});

	it('matches everything for a blank query', () => {
		expect(matches('anything', '   ')).toBe(true);
	});
});
