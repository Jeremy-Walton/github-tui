// Makes the README screenshots in docs/screenshots from --demo mode.
// Each shot runs the built app in a 164×40 pty, replays the output into a headless terminal,
// and draws it as a macOS window with headless Chrome at 2× scale.
// Needs python3 (for the pty) and Chrome. Set CHROME_PATH if Chrome is not in the default place.
import {execFileSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import xterm from '@xterm/headless';
import puppeteer from 'puppeteer-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROWS = 40;
const COLS = 164;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SHOTS = [
	{name: 'pull-requests', keys: ['j', 'j', 'j']},
	{name: 'inbox', keys: ['3', 'j', 'j']},
	{name: 'repositories', keys: ['2', '/', 'a', 'c', 'm', 'e']},
	{name: 'settings', keys: ['4', 'j', 'j']},
	{name: 'help', keys: ['?']},
];

// Tokyo Night terminal colors.
const FG = '#c0caf5';
const BG = '#1a1b26';
const ANSI = [
	'#15161e',
	'#f7768e',
	'#9ece6a',
	'#e0af68',
	'#7aa2f7',
	'#bb9af7',
	'#7dcfff',
	'#a9b1d6',
	'#565f89',
	'#f7768e',
	'#9ece6a',
	'#e0af68',
	'#7aa2f7',
	'#bb9af7',
	'#7dcfff',
	'#c0caf5',
];

// The window size is set on the pty before the app starts. Setting it after the fork races the
// app's first read of the size, and a wrong size makes the frame taller than the screen.
const CAPTURE = `
import os, sys, fcntl, termios, struct, subprocess, time, select
rows, cols, keys = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3:]
m, s = os.openpty()
fcntl.ioctl(s, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
def ctty():
    os.setsid()
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)
env = dict(os.environ, TERM='xterm-256color', COLORTERM='truecolor')
subprocess.Popen(['node', 'dist/cli.js', '--demo'], stdin=s, stdout=s, stderr=s, preexec_fn=ctty, env=env)
os.close(s)
out = bytearray()
def drain(seconds):
    end = time.time() + seconds
    while time.time() < end:
        if select.select([m], [], [], 0.05)[0]:
            try: out.extend(os.read(m, 65536))
            except OSError: return
drain(1.5)
for key in keys:
    os.write(m, key.encode())
    drain(0.15)
drain(0.5)
sys.stdout.buffer.write(out)
os.write(m, b'q')
drain(0.3)
`;

const capture = keys =>
	execFileSync('python3', ['-c', CAPTURE, String(ROWS), String(COLS), ...keys], {
		cwd: ROOT,
		maxBuffer: 16 * 1024 * 1024,
	});

async function screen(bytes) {
	const term = new xterm.Terminal({rows: ROWS, cols: COLS, allowProposedApi: true});
	await new Promise(resolve => term.write(bytes, resolve));
	const buffer = term.buffer.active;
	return Array.from({length: ROWS}, (_, y) => buffer.getLine(buffer.viewportY + y));
}

const hex = value => `#${value.toString(16).padStart(6, '0')}`;
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function cellColor(cell, background) {
	if (background ? cell.isBgDefault() : cell.isFgDefault()) return null;
	const value = background ? cell.getBgColor() : cell.getFgColor();
	if (background ? cell.isBgRGB() : cell.isFgRGB()) return hex(value);
	if (value < 16) return ANSI[value];
	if (value >= 232) {
		const v = 8 + (value - 232) * 10;
		return `rgb(${v},${v},${v})`;
	}
	const steps = [0, 95, 135, 175, 215, 255];
	const n = value - 16;
	return `rgb(${steps[Math.floor(n / 36)]},${steps[Math.floor(n / 6) % 6]},${steps[n % 6]})`;
}

// Every cell gets a fixed-width box so symbols from fallback fonts can't shift the columns.
function cellHtml(cell) {
	let fg = cellColor(cell, false) ?? FG;
	let bg = cellColor(cell, true);
	if (cell.isInverse()) [fg, bg] = [bg ?? BG, fg];
	const text = escapeHtml(cell.getChars() || ' ');
	const style = `color:${fg}${cell.isBold() ? ';font-weight:700' : ''}${cell.isDim() ? ';opacity:.55' : ''}`;
	// Opacity would fade the background too, so a dim cell draws its background on a wrapper.
	if (cell.isDim() && bg) return `<i style="background:${bg}"><b style="${style}">${text}</b></i>`;
	return `<b style="${style}${bg ? `;background:${bg}` : ''}">${text}</b>`;
}

function pageHtml(lines) {
	const rows = lines
		.map(line => `<div class="r">${Array.from({length: COLS}, (_, x) => cellHtml(line.getCell(x))).join('')}</div>`)
		.join('');
	return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
.page{padding:40px;width:1410px}
.win{background:${BG};border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35),0 0 0 .5px rgba(0,0,0,.4)}
.bar{height:36px;background:#16161e;position:relative;font:13px -apple-system,BlinkMacSystemFont,sans-serif;color:#787c99;text-align:center;line-height:36px}
.dots{position:absolute;left:14px;top:12px;display:flex;gap:8px}
.dots span{width:12px;height:12px;border-radius:50%}
.term{padding:14px 16px;font:14px/18.2px 'JetBrainsMonoNL Nerd Font','JetBrains Mono',Menlo,monospace}
.r{height:18.2px;white-space:pre;display:flex}
.r b,.r i{font-weight:400;font-style:normal;display:inline-block;width:8.4px;height:18.2px}
</style><div class="page"><div class="win"><div class="bar"><div class="dots">
<span style="background:#ff5f57"></span><span style="background:#febc2e"></span><span style="background:#28c840"></span>
</div>github</div><div class="term">${rows}</div></div></div>`;
}

execFileSync('npm', ['run', 'build'], {cwd: ROOT, stdio: 'inherit'});
const browser = await puppeteer.launch({executablePath: CHROME, headless: true});
try {
	const page = await browser.newPage();
	await page.setViewport({width: 1490, height: 900, deviceScaleFactor: 2});
	for (const shot of SHOTS) {
		const lines = await screen(capture(shot.keys));
		if (!lines[0].translateToString().includes('GitHub')) {
			throw new Error(`${shot.name}: the header is not on the first row, so the frame overflowed the screen.`);
		}
		await page.setContent(pageHtml(lines));
		await page.evaluate(() => document.fonts.ready);
		const path = join(ROOT, 'docs', 'screenshots', `${shot.name}.png`);
		await (await page.$('.page')).screenshot({path, omitBackground: true});
		console.log(`wrote ${path}`);
	}
} finally {
	await browser.close();
}
