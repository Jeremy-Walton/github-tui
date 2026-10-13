import {describe, expect, it} from 'vitest';
import {findTheme, THEMES} from '../src/theme.js';

const COLOR = /^(#[0-9a-f]{6}|black|red|green|yellow|blue|magenta|cyan|white|gray)$/;

describe('themes', () => {
	it('have unique ids', () => {
		expect(new Set(THEMES.map(t => t.id)).size).toBe(THEMES.length);
	});

	it.each(THEMES.map(t => [t.name, t] as const))('%s uses only valid colors', (_, theme) => {
		for (const [key, value] of Object.entries(theme)) {
			if (key === 'id' || key === 'name') continue;
			expect(value, key).toMatch(COLOR);
		}
	});

	it('includes Lumon, based on the omarchy-lumon-theme palette', () => {
		const lumon = findTheme('lumon');
		expect(lumon.name).toBe('Lumon');
		expect(lumon.background).toBe('#1b2d40');
		expect(lumon.text).toBe('#d6e2ee');
	});

	it('falls back to the Terminal theme for an unknown id', () => {
		expect(findTheme('nope').id).toBe('default');
	});
});
