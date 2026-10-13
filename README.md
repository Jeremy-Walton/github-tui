# github-tui

A terminal UI for your GitHub pull requests, repos, and notifications. Run `github`.

The app uses your `gh` login and never stores a token: it asks `gh auth token` each time it starts. Data is cached in `~/.cache/github-tui` so the app opens instantly, then refreshes.

**Pull requests** you're assigned, asked to review, or wrote, then open PRs in repos you watch. Status, checks, conflicts, and size line up in columns.

![Pull requests page](docs/screenshots/pull-requests.png)

**Inbox** mirrors your GitHub notifications, with whether each PR or issue is open, merged, or closed. Mark done (`e`), unsubscribe (`t`), or undo (`u`) from the keyboard.

![Inbox page](docs/screenshots/inbox.png)

**Repositories** you can access, sorted by your own recent activity. Press `/` to search on any page.

![Repositories page with a search](docs/screenshots/repositories.png)

**Settings** shows who you're signed in as and lets you pick a color theme: Terminal (your terminal's own colors), Cobalt2, Dracula, Nord, Solarized Dark, Gruvbox Dark, Tokyo Night, Lumon, or GitHub Light. It also lets you show bot pull requests (Dependabot and Renovate, hidden by default), hide the watched-repo groups on the Pull requests page, and reorder the sidebar with `shift+j` and `shift+k`. The top sidebar page opens first. Your choices are saved to `~/.config/github-tui/settings.json` (or `$XDG_CONFIG_HOME/github-tui`). Themes look best in a terminal with 24-bit color.

![Settings page with the theme list](docs/screenshots/settings.png)

> Screenshots use made-up data. Run `github --demo` to try the UI without touching your account.

## Install

### 1. Install the requirements

You need **Node 22 or newer** and the **GitHub CLI** (`gh`).

On macOS with Homebrew:

```bash
brew install node gh
```

Check the versions:

```bash
node --version
gh --version
```

Using nodenv, nvm, or asdf for Node is fine. Make sure your default version is 22 or newer.

### 2. Log in to GitHub

```bash
gh auth login
```

Pick **GitHub.com**, then follow the prompts. If `gh auth status` already shows you as logged in, skip this step.

### 3. Clone and install

```bash
git clone https://github.com/Jeremy-Walton/github-tui.git
cd github-tui
bin/install
```

`bin/install` installs dependencies, builds the app, and links a `github` command into `~/.local/bin`. With nodenv, the command runs on your global Node version, so it works in any project folder.

If it prints a line to add to your shell profile, add it to `~/.zshrc` (or `~/.bashrc`), then open a new terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 4. Run it

```bash
github
```

## Update

```bash
cd github-tui
git pull
bin/install
```

## Uninstall

```bash
rm ~/.local/bin/github
rm -r ~/.cache/github-tui ~/.config/github-tui
```

Then delete the cloned `github-tui` folder.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `github: command not found` | `~/.local/bin` is not on your PATH. See step 3. |
| `The GitHub CLI is not installed` | Install `gh` (step 1). |
| `Not logged in to GitHub` | Run `gh auth login` (step 2). |
| `github-tui needs Node 22 or newer` | Upgrade Node, or set a newer default in your version manager. |
| Inbox or org repos are empty | Your `gh` login needs the `repo` and `read:org` scopes. Run `gh auth refresh -s repo,read:org`. |

## Keys

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | Move |
| `enter` | Open in browser (Settings: use the selected theme or switch the selected option) |
| `/` | Focus search (`esc` to leave, `esc` again to clear) |
| `←` / `h`, `tab` | Focus sidebar |
| `1` `2` `3` `4` | Jump to a page, in sidebar order |
| `shift+j` `shift+k` | Settings: move the selected sidebar page down or up |
| `r` | Refresh current page |
| `e` | Inbox: mark done |
| `t` | Inbox: unsubscribe (also marks done) |
| `u` | Inbox: undo the last done/unsubscribe (within 15 seconds) |
| `q` | Quit |

## Development

```bash
npm install
npm run dev
```

`npm run dev -- --demo` runs on made-up data from `src/demo.ts`. Demo mode makes no GitHub calls, doesn't open links, and doesn't read or write the cache or settings.

| Command | What it does |
| --- | --- |
| `npm run check` | Everything below, plus a scan for GitHub tokens. CI runs this on every push. |
| `npm run typecheck` | Strict TypeScript over `src/` and `test/` |
| `npm run lint` | Biome lint and format check |
| `npm run format` | Biome safe fixes and formatting |
| `npm test` | Vitest: unit tests, the GitHub client with stubbed responses, and the app rendered on demo data |

`npm run screenshots` builds the app and remakes the images in `docs/screenshots/` from demo mode. It needs `python3` and Google Chrome. Set `CHROME_PATH` if Chrome is somewhere else.

Claude Code hooks in `.claude/settings.json` run these for you. After each edit, the changed file is formatted and linted and the project is typechecked. When Claude finishes with uncommitted changes, `npm run check` runs, and failures go back to Claude.
