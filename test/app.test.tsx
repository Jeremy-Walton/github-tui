import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from '../src/App.js';
import {ActionQueue} from '../src/actions.js';
import {DemoGitHub} from '../src/demo.js';
import {DEFAULT_SETTINGS, type Settings} from '../src/settings.js';
import {runtime} from '../src/util.js';
import {keys, ROWS, renderApp, tick} from './render.js';

const viewer = {login: 'alex-dev', name: 'Alex Morgan'};

describe('App (demo data)', () => {
	let app: ReturnType<typeof renderApp>;
	let actions: ActionQueue;
	let gh: DemoGitHub;

	beforeEach(async () => {
		({app, actions, gh} = await start());
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
		expect(app.frame()).toMatch(/› Inbox +14 /);
		expect(app.frame()).toMatch(/Search… +14 /);
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

	it('shows who is signed in, the options, and the themes on the settings page', async () => {
		await app.press('4');
		const frame = app.frame();
		expect(frame).toContain('› Settings');
		expect(frame).toContain('Signed in as');
		expect(frame).toContain('demo data');
		expect(frame).toMatch(/Show bot pull requests +off/);
		expect(frame).toMatch(/✓ Show watched repos +on/);
		expect(frame).toMatch(/Ask to open in slice +off/);
		expect(frame).toContain('Sidebar order');
		expect(frame.split('\n').length).toBeLessThanOrEqual(ROWS);

		await app.press('/', 'l', 'u', 'm', 'o', 'n');
		expect(app.frame()).toContain('Lumon');
	});

	it('switches theme with enter', async () => {
		await app.press('4', ...down(8), '\r');
		expect(app.frame()).toContain('Theme: Cobalt2');
		expect(app.frame()).toMatch(/▌✓ Cobalt2 +current/);

		// Back to a theme without a background keeps the cursor in place.
		await app.press('k', '\r');
		expect(app.frame()).toMatch(/▌✓ Terminal +current/);
	});

	it('hides bot pull requests until they are turned on', async () => {
		await app.press('/', 'b', 'u', 'm', 'p');
		expect(app.frame()).not.toContain('Bump nokogiri');

		await app.press(keys.escape, keys.escape, '4', 'j', '\r');
		expect(app.frame()).toContain('Bot pull requests: shown');
		expect(app.frame()).toMatch(/Pull Requests +12 /);

		await app.press('1', '/', 'b', 'u', 'm', 'p');
		expect(app.frame()).toContain('Bump nokogiri');
	});

	it('hides watched-repo pull requests when they are turned off', async () => {
		await app.press('4', 'j', 'j', '\r');
		expect(app.frame()).toContain('Watched repos: hidden');
		expect(app.frame()).toMatch(/Pull Requests +8 /);
	});

	it('moves sidebar pages with J and K and keeps the cursor on the moved page', async () => {
		await app.press('4', ...down(6), 'K', 'K');
		expect(app.frame()).toMatch(/▌1 +Inbox/);

		await app.press('1');
		expect(app.frame()).toMatch(/› Inbox +14 /);
		await app.press('2');
		expect(app.frame()).toMatch(/› Pull Requests +11 /);

		await app.press('4', ...down(5), 'J');
		expect(app.frame()).toMatch(/▌3 +Pull Requests/);
	});

	it('turns on asking to open pull requests in slice', async () => {
		await app.press('4', ...down(3));
		expect(app.frame()).toMatch(/Ask to open in slice +off/);
		expect(app.frame()).toContain('https://github.com/gavinomelia/slice');

		await app.press('\r');
		expect(app.frame()).toContain('Enter on a pull request: asks GitHub or slice');

		await app.press('1', '\r');
		expect(app.frame()).toContain('Open acme/storefront #482');
	});

	it('shows ? help in the key hints', () => {
		expect(app.frame()).toContain('? help');
	});

	it('lists every keyboard shortcut on ?', async () => {
		await app.press('?');
		const frame = app.frame();
		expect(frame).toContain('Keyboard shortcuts');
		expect(frame).toMatch(/g +home +Top of the list/);
		expect(frame).toMatch(/pgup +pgdn +Up or down a page/);
		expect(frame).toMatch(/e +Mark done/);
		expect(frame).toMatch(/shift\+j +shift\+k +Move the sidebar page/);
		expect(frame).toContain('esc close');
		expect(frame).not.toContain('Add Apple Pay to checkout');
		expect(frame.split('\n').length).toBeLessThanOrEqual(ROWS);
	});

	it('closes help on escape or ? and keeps the selection', async () => {
		await app.press('j', '?', 'j', 'j');
		expect(app.frame()).toContain('Keyboard shortcuts');

		await app.press(keys.escape);
		expect(app.frame()).not.toContain('Keyboard shortcuts');
		expect(app.frame()).toMatch(/▌.*Rate limit webhook retries/);

		await app.press('?', '?');
		expect(app.frame()).not.toContain('Keyboard shortcuts');
	});

	it('types ? into the search box instead of opening help', async () => {
		await app.press('/', '?');
		expect(app.frame()).toContain('/ ?');
		expect(app.frame()).not.toContain('Keyboard shortcuts');
	});

	it('moves focus to the sidebar and switches pages with arrows', async () => {
		await app.press(keys.left, keys.down);
		expect(app.frame()).toContain('› Repositories');
		expect(app.frame()).toContain('switch page');
	});
});

describe('App with a saved sidebar order', () => {
	afterEach(() => {
		runtime.demo = false;
	});

	it('opens on the top page of the sidebar', async () => {
		const {app} = await start({...DEFAULT_SETTINGS, sidebar: ['inbox', 'pull-requests', 'repositories']});
		expect(app.frame()).toMatch(/› Inbox +14 /);
		app.unmount();
	});
});

describe('App asking how to open a pull request', () => {
	let app: ReturnType<typeof renderApp>;

	beforeEach(async () => {
		({app} = await start({...DEFAULT_SETTINGS, askToOpenInSlice: true}));
		await app.press('\r');
	});

	afterEach(() => {
		app.unmount();
		runtime.demo = false;
	});

	it('shows the choices for the selected pull request', () => {
		const frame = app.frame();
		expect(frame).toContain('Open acme/storefront #482');
		expect(frame).toMatch(/s +slice +Review the diff in the terminal/);
		expect(frame).toMatch(/g +GitHub +Open in the browser/);
		expect(frame).toContain('esc cancel');
		expect(frame.split('\n').length).toBeLessThanOrEqual(ROWS);
	});

	it('closes on escape', async () => {
		await app.press(keys.escape);
		expect(app.frame()).not.toContain('Open acme/storefront #482');
	});

	it('keeps page and quit keys out of the list while open', async () => {
		await app.press('2', 'j');
		expect(app.frame()).toContain('› Pull Requests');
		expect(app.frame()).toMatch(/▌.*Add Apple Pay to checkout/);
		expect(app.frame()).toContain('Open acme/storefront #482');
	});

	it('picks a choice by its key', async () => {
		await app.press('s');
		expect(app.frame()).not.toContain('Open acme/storefront #482');
		expect(app.frame()).toContain("slice doesn't run in demo mode");
	});

	it('picks the highlighted choice with enter', async () => {
		await app.press('j', '\r');
		expect(app.frame()).not.toContain('Open acme/storefront #482');
		expect(app.frame()).not.toContain('demo mode');
	});
});

async function start(settings?: Settings) {
	runtime.demo = true;
	const gh = new DemoGitHub();
	const actions = new ActionQueue(60_000);
	const app = renderApp(<App gh={gh} viewer={viewer} actions={actions} settings={settings} />);
	await tick();
	return {app, actions, gh};
}

const down = (n: number) => Array<string>(n).fill('j');
