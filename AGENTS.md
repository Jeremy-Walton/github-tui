# AGENTS.md

A terminal UI for GitHub: pull requests, repositories, the notifications inbox, and settings. Run `github`. TypeScript + [Ink](https://github.com/vadimdemedes/ink) (React for terminals), Node 22+.

Install, keys, and the dev commands are in @README.md. Read it first.

## Verify every change

- **Tests first.** Before you change `src/`, write or update the tests in `test/` that describe the new behavior. Run them and see them fail. Then write the code until they pass. The failing tests define when the work is done. UI behavior is tested through `test/render.ts` with demo data.
- `npm run check` must pass. It runs the secret scan, typecheck, lint, and tests. CI runs the same steps (@.github/workflows/check.yml).
- Hooks in @.claude/settings.json run automatically. After each edit, the edited file is formatted and linted, and TypeScript edits are typechecked. At the end of a turn that edited files, `npm run check` runs and failures come back to you.
- Try UI changes with `npm run dev -- --demo`. It uses fake data, makes no GitHub calls, and opens no links.

## Where things live

- `src/github.ts`: the only module that talks to GitHub (REST + GraphQL). `GitHubClient` is its interface; `src/demo.ts` implements it with fake data.
- `src/App.tsx`: layout, focus, search state, global keys, and the page registry (one entry per sidebar page).
- `src/ListView.tsx`: the shared list. It has the search box, grouping, scrolling, and selection, plus the `Line`, `Cell`, and `Title` row helpers.
- `src/pages/*`: one file per page. A page renders rows and handles its own keys.
- `src/actions.ts`: the delayed-send undo queue for inbox actions.
- `src/theme.tsx`: the color themes and `useTheme`. Components take colors from the theme, not color names.
- `src/settings.ts`: reads and writes the settings file.
- `src/util.ts`: the cached data hook (`useResource`), the time and search helpers, and the `runtime.demo` flag.

## Product decisions (keep these unless the user changes them)

- **Auth:** always the `gh` keychain login (`gh auth token --hostname github.com`). `GITHUB_TOKEN` and `GH_TOKEN` are removed from the environment on purpose. Secrets never go in the code or the settings file; anyone with `gh` logged in can use the app.
- **Launch:** `bin/github` is linked into `~/.local/bin`. It runs on the global nodenv version when nodenv exists, because a project's `.node-version` once hid the command.
- **Startup:** the top sidebar page (Pull Requests by default) opens and loads first. The other pages wait for its first fetch. Settings always stays at the bottom of the sidebar. Cached data in `~/.cache/github-tui` shows right away on every page.
- **Pull Requests:** sections in this order: Assigned to you, Review requested, Your pull requests, then one group per watched repo (newest PR first). Each PR shows once. Bot PRs (Dependabot and Renovate only, not the Copilot agent) are hidden unless Settings turns them on. Settings can also hide the watched-repo groups.
- **Repositories:** sorted by the user's own activity (their event feed: the last 300 events or 90 days), then by push time.
- **Inbox:** mirrors github.com notifications (`all=true`). It shows each PR or issue's open, merged, closed, or draft state through a separate GraphQL lookup. Keys: `e` done, `t` unsubscribe (also marks done), `u` undo, Enter opens the item and marks it read.
- **Undo:** GitHub can't un-mark a notification as done, so actions wait 15 seconds in `ActionQueue` before they're sent. Pending actions are sent on quit, SIGHUP, and SIGTERM.
- **Keys:** the search box is focused only with `/`. This leaves letters free for shortcuts. `q` quits from any page.
- **Look:** details line up in fixed-width `Cell` columns. Items have divider lines, the selected item has a background (`#2b3d5a` in the Terminal theme), and a group header is hidden until its first item fits on screen.
- **Settings:** a sidebar page that shows the signed-in user and the theme list. The choice is saved to `~/.config/github-tui/settings.json`. Every theme keeps the same layout; only colors change. The Terminal theme uses the terminal's own background and text colors.

## Gotchas

- **Ink holds a lone Escape for 20 ms** (`pendingInputFlushDelayMilliseconds`). Faster key presses in tests drop or merge Escapes, so `test/render.ts` waits 25 ms per key.
- **Biome's React hook rules** (`useExhaustiveDependencies`, `useHookAtTopLevel`) are on only because `biome.json` sets `domains.react`. They are not on by default.
- **Unused code** is reported by Biome, not by tsc. This avoids duplicate reports, and Biome can fix it.
- **Functions passed to `ListView`** (`getSearchText`, `getGroup`) live at module scope so the list's memoized filtering works.
- **Watched-repo PR queries** go in GraphQL batches of 4 that run in parallel. Bigger batches were much slower (14 s vs 6 s). A failed batch is skipped, not fatal.
- **`mergeable` is often `UNKNOWN`** because GitHub computes it lazily. Only `CONFLICTING` is shown.
- **TypeScript is v7** (the native compiler). Dependencies are pinned to versions at least 2 weeks old when added.
- **README screenshots** (`docs/screenshots/`) come from `--demo` mode via `npm run screenshots` (@scripts/screenshots.mjs). Remake them when the layout changes.

## Known open items

- **Possible screen overflow in tall terminals:** at 164×40, the frame may scroll past the header at startup or when a search leaves one result. It might be a test-harness artifact. A separate fix was in progress.
- **Refactors considered and skipped:**
  - Replacing the global `runtime.demo` flag by passing the cache and link opener in.
  - Routing all key input through one owner. Today `App` and `ListView` both use `useInput` with matching guards.
  - Caching the viewer login to skip about 300 ms at startup.
