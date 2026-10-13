#!/usr/bin/env node
import {render} from 'ink';
import {App} from './App.js';
import {ActionQueue} from './actions.js';
import {GitHub, getToken} from './github.js';

try {
	const gh = new GitHub(await getToken());
	const viewer = await gh.viewer();
	const actions = new ActionQueue();
	const app = render(<App gh={gh} viewer={viewer} actions={actions} />, {alternateScreen: true});

	// Send any pending inbox actions before the process ends.
	const flushAndExit = () => void actions.flush().finally(() => process.exit(0));
	process.on('SIGHUP', flushAndExit);
	process.on('SIGTERM', flushAndExit);
	await app.waitUntilExit();
	await actions.flush();
	process.exit(0);
} catch (e) {
	console.error((e as Error).message);
	process.exit(1);
}
