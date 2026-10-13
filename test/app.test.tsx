import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from '../src/App.js';
import {ActionQueue} from '../src/actions.js';
import {DemoGitHub} from '../src/demo.js';
import {runtime} from '../src/util.js';
import {keys, ROWS, renderApp, tick} from './render.js';

const viewer = {login: 'alex-dev', name: 'Alex Morgan'};

describe('App (demo data)', () => {
	let app: ReturnType<typeof renderApp>;
	let actions: ActionQueue;
	let gh: DemoGitHub;

	beforeEach(async () => {
		runtime.demo = true;
		gh = new DemoGitHub();
		actions = new ActionQueue(60_000);
		app = renderApp(<App gh={gh} viewer={viewer} actions={actions} />);
		await tick();
	});

	afterEach(() => {
		app.unmount();
		runtime.demo = false;
	});

	it('opens on pull requests, grouped by section', () => {
		const frame = app.frame();
		expect(frame).toContain('@alex-dev');
		expect(frame).toMatch(/› Pull Requests +11 /);
		expect(frame).toContain('Assigned to you (2)');
		expect(frame).toContain('Add Apple Pay to checkout');
		expect(frame).toContain('± changes');
	});

	it('never renders more lines than the terminal has', () => {
		expect(app.frame().split('\n').length).toBeLessThanOrEqual(ROWS);
	});

	it('switches pages with number keys', async () => {
		await app.press('2');
		expect(app.frame()).toMatch(/› Repositories +15 /);
		expect(app.frame()).toContain('acme/sdk-js');

		await app.press('3');
		expect(app.frame()).toMatch(/› Inbox +6 /);
		expect(app.frame()).toContain('merged PR');
	});

	it('filters with the search box and restores on escape', async () => {
		await app.press('/', 'a', 'p', 'p', 'l', 'e');
		expect(app.frame()).toContain('/ apple');
		expect(app.frame()).toContain('Add Apple Pay to checkout');
		expect(app.frame()).not.toContain('Rate limit webhook retries');

		await app.press(keys.escape, keys.escape);
		expect(app.frame()).toContain('Rate limit webhook retries');
	});

	it('keeps shortcut keys out of the list while searching', async () => {
		await app.press('/', 'q', '3');
		expect(app.frame()).toContain('/ q3');
		expect(app.frame()).toContain('› Pull Requests');
	});

	it('marks an inbox item done and brings it back with undo', async () => {
		await app.press('3');
		// The status message repeats the title, so look for the item's repo line instead.
		const itemLine = 'acme/api #1287';
		expect(app.frame()).toContain(itemLine);

		await app.press('e');
		expect(app.frame()).not.toContain(itemLine);
		expect(app.frame()).toContain('u to undo');
		expect(actions.pendingIds().size).toBe(1);

		await app.press('u');
		expect(app.frame()).toContain(itemLine);
		expect(actions.pendingIds().size).toBe(0);
	});

	it('sends unsubscribe for the selected item', async () => {
		const unsubscribe = vi.spyOn(gh, 'unsubscribe');
		await app.press('3', 't');
		await actions.flush();
		expect(unsubscribe).toHaveBeenCalledWith('demo-0');
	});

	it('shows who is signed in and the themes on the settings page', async () => {
		await app.press('4');
		const frame = app.frame();
		expect(frame).toContain('› Settings');
		expect(frame).toContain('Signed in as');
		expect(frame).toContain('demo data');
		expect(frame).toContain('Cobalt2');
		expect(frame.split('\n').length).toBeLessThanOrEqual(ROWS);
	});

	it('switches theme with enter', async () => {
		await app.press('4', 'j', 'j', '\r');
		expect(app.frame()).toContain('Theme: Cobalt2');
		expect(app.frame()).toMatch(/▌✓ Cobalt2 +current/);

		// Back to a theme without a background keeps the cursor in place.
		await app.press('k', '\r');
		expect(app.frame()).toMatch(/▌✓ Terminal +current/);
	});

	it('moves focus to the sidebar and switches pages with arrows', async () => {
		await app.press(keys.left, keys.down);
		expect(app.frame()).toContain('› Repositories');
		expect(app.frame()).toContain('switch page');
	});
});
