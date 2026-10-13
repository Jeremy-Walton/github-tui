import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Set by after-edit, cleared by on-stop, so the full check only runs on turns that edited files.
export const editMarker = sessionId => join(tmpdir(), `github-tui-edited-${sessionId ?? 'unknown'}`);
