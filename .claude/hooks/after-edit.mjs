#!/usr/bin/env node
// PostToolUse hook: after Claude edits a file, format and lint it, and typecheck when it's TypeScript.
// Exit code 2 sends the problems back to Claude so it fixes them before moving on.
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import {editMarker} from './marker.mjs';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const file = input.tool_input?.file_path;
if (!file || relative(root, file).startsWith('..')) process.exit(0);

// Tells the Stop hook this turn changed code.
writeFileSync(editMarker(input.session_id), '');

const run = (cmd, args) =>
	new Promise(resolve => {
		const child = spawn(cmd, args, {cwd: root});
		let output = '';
		child.stdout.on('data', d => (output += d));
		child.stderr.on('data', d => (output += d));
		child.on('close', status => resolve({status, output}));
	});

// `--write` applies safe fixes first, so only problems Biome can't fix are reported.
const biome = join(root, 'node_modules', '.bin', 'biome');
const checks = [run(biome, ['check', '--write', '--colors=off', '--no-errors-on-unmatched', file])];
if (/\.tsx?$|tsconfig.*\.json$/.test(file))
	checks.push(run('npm', ['run', 'typecheck', '--silent', '--', '--pretty', 'false']));

const problems = (await Promise.all(checks)).filter(r => r.status !== 0).map(r => r.output.trim());
if (problems.length) {
	process.stderr.write(problems.join('\n\n').slice(0, 8000));
	process.exit(2);
}
