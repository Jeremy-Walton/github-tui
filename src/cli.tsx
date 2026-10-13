#!/usr/bin/env node
// Check the Node version before loading Ink, which fails with a confusing error on older versions.
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
	console.error(`github-tui needs Node 22 or newer. You have ${process.versions.node}.`);
	process.exit(1);
}
await import('./main.js');
