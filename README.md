# github-tui

A terminal UI for your GitHub repos, pull requests, and notifications. Run `github`.

Uses your `gh` login (`gh auth token`). Data is cached in `~/.cache/github-tui` so it opens instantly, then refreshes.

## Setup

```bash
npm install
npm run build
ln -sf "$PWD/bin/github" ~/.local/bin/github
```

`bin/github` runs with your global nodenv version, so it works in any project folder.

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
