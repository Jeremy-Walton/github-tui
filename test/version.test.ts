import {readFile} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';
import {packageVersion} from '../src/version.js';

describe('packageVersion', () => {
	it('reads the version from package.json', async () => {
		const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {version: string};
		expect(packageVersion()).toBe(pkg.version);
	});
});
