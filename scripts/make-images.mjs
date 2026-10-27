// Renders the link preview image and the PNG favicons into src/static with headless Chrome.
// Run it only when the designs change: `node scripts/make-images.mjs`. The build just copies the results.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => p && existsSync(p));
if (!CHROME) throw new Error('Chrome or Edge not found; set CHROME_PATH');

const IMAGES = [
  { url: '/scripts/images/og-image.html', out: 'og-image.png', width: 1200, height: 630 },
  { url: '/scripts/images/icon.html?size=192', out: 'favicon-192.png', width: 192, height: 192 },
  { url: '/scripts/images/icon.html?size=180', out: 'apple-touch-icon.png', width: 180, height: 180 },
];

// A tiny server, because module scripts do not load from file:// URLs. It serves only the folders
// that the designs need, never .git or other files of the repository.
const SERVED = ['scripts/images', 'src', 'node_modules/@fontsource-variable'].map(dir => join(root, dir) + sep);
const server = createServer(async (req, res) => {
  let file;
  try {
    // The query string (for example ?size=192) is for the page script only.
    file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!SERVED.some(dir => file.startsWith(dir))) { res.writeHead(403).end(); return; }
  let body;
  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// Its own profile makes Chrome start a new headless instance instead of handing the
// command to a Chrome window that is already open.
const profile = mkdtempSync(join(tmpdir(), 'chrome-images-'));
try {
  for (const img of IMAGES) {
    const out = join(root, 'src/static', img.out);
    rmSync(out, { force: true });
    execFileSync(CHROME, [
      '--headless=new', `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', `--window-size=${img.width},${img.height}`,
      '--virtual-time-budget=5000', `--screenshot=${out}`, base + img.url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    // On Windows the browser can return before its child process has written the file.
    for (let i = 0; i < 100 && !(existsSync(out) && statSync(out).size > 0); i++) await new Promise(r => setTimeout(r, 200));
    if (!existsSync(out) || statSync(out).size === 0) throw new Error(`Chrome did not write ${img.out}`);
    console.log(`wrote src/static/${img.out}`);
  }
} finally {
  server.close();
  // The browser may still hold files in its profile for a moment after it exits.
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    console.warn(`could not remove the temporary browser profile ${profile}`);
  }
}
