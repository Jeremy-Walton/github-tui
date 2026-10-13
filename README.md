# github-tui

A terminal UI for your GitHub pull requests, repos, and notifications. Run `github`.

There is nothing to configure. The app uses your `gh` login and never stores a token: it asks `gh auth token` each time it starts. Data is cached in `~/.cache/github-tui` so the app opens instantly, then refreshes.

## Requirements

- Node 22 or newer
- [GitHub CLI](https://cli.github.com), logged in with `gh auth login`

## Install

```bash
git clone <this repo> github-tui
cd github-tui
bin/install
```

`bin/install` builds the app and links `github` into `~/.local/bin`. With nodenv, the command runs on your global Node version, so it works in any project folder.

## Keys

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | Move |
| `enter` | Open in browser |
| `/` | Focus search (`esc` to leave, `esc` again to clear) |
| `←` / `h`, `tab` | Focus sidebar |
| `1` `2` `3` | Jump to Pull Requests, Repositories, Inbox |
| `r` | Refresh current page |
| `e` | Inbox: mark done |
| `t` | Inbox: unsubscribe (also marks done) |
| `u` | Inbox: undo the last done/unsubscribe (within 15 seconds) |
| `q` | Quit |
