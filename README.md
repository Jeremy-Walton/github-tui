# github-tui

A terminal UI for your GitHub pull requests, repos, and notifications. Run `github`.

There is nothing to configure. The app uses your `gh` login and never stores a token: it asks `gh auth token` each time it starts. Data is cached in `~/.cache/github-tui` so the app opens instantly, then refreshes.

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
rm -r ~/.cache/github-tui
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
| `enter` | Open in browser |
| `/` | Focus search (`esc` to leave, `esc` again to clear) |
| `←` / `h`, `tab` | Focus sidebar |
| `1` `2` `3` | Jump to Pull Requests, Repositories, Inbox |
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

`npm run build` checks for GitHub tokens in the source before it compiles.
