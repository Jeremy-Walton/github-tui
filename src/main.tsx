import {render} from 'ink';
import {App} from './App.js';
import {ActionQueue} from './actions.js';
import {DemoGitHub} from './demo.js';
import {GitHub, type GitHubClient, getToken} from './github.js';
import {readSettings} from './settings.js';
import {runtime} from './util.js';

try {
	runtime.demo = process.argv.includes('--demo');
	const gh: GitHubClient = runtime.demo ? new DemoGitHub() : new GitHub(await getToken());
	const [viewer, settings] = await Promise.all([gh.viewer(), readSettings()]);
	const actions = new ActionQueue();
	const app = render(<App gh={gh} viewer={viewer} actions={actions} settings={settings} />, {alternateScreen: true});

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
