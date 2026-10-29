import {createRequire} from 'node:module';

// src/ and dist/ both sit one level below package.json, so the same path works in tests and when installed.
export function packageVersion(): string {
	return (createRequire(import.meta.url)('../package.json') as {version: string}).version;
}
