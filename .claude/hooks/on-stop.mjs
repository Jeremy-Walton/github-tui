#!/usr/bin/env node
// Stop hook: when Claude finishes a turn that edited files, run the full `npm run check`.
// On failure, exit code 2 keeps Claude working. If a retry still fails, tell the user instead of looping.
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {editMarker} from './marker.mjs';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const marker = editMarker(input.session_id);
if (!existsSync(marker)) process.exit(0);

const check = spawnSync('npm', ['run', 'check', '--silent'], {cwd: root, encoding: 'utf8'});
if (check.status === 0 || input.stop_hook_active) rmSync(marker, {force: true});
if (check.status === 0) process.exit(0);

if (input.stop_hook_active) {
	console.log(JSON.stringify({systemMessage: 'npm run check is still failing. Run it to see the errors.'}));
	process.exit(0);
}
const output = `${check.stdout}${check.stderr}`.trim().split('\n').slice(-80).join('\n');
process.stderr.write(`npm run check failed. Fix these before finishing:\n${output}`);
process.exit(2);
