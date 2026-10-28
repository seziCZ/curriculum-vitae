// Renders the link preview image, the PNG favicons and favicon.ico into src/static with headless Chrome.
// Run it only when the designs change: `node scripts/make-images.mjs`. The build just copies the results.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
// The sizes inside favicon.ico, for older tools that ask for /favicon.ico instead of reading the page.
const ICO_SIZES = [16, 32, 48];

// An .ico file that holds PNG images: a 6-byte header, a 16-byte entry per image, then the images.
function icoFile(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map(p => p.data)]);
}

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

// The scale renders a page smaller than the browser's minimum window: a 192-pixel window
// at scale 0.25 gives a 48-pixel image.
async function render(url, out, width, height, scale = 1) {
  rmSync(out, { force: true });
  execFileSync(CHROME, [
    '--headless=new', `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`,
    '--virtual-time-budget=5000', `--screenshot=${out}`, base + url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  // On Windows the browser can return before its child process has written the file.
  for (let i = 0; i < 100 && !(existsSync(out) && statSync(out).size > 0); i++) await new Promise(r => setTimeout(r, 200));
  if (!existsSync(out) || statSync(out).size === 0) throw new Error(`Chrome did not write ${out}`);
}

try {
  for (const img of IMAGES) {
    await render(img.url, join(root, 'src/static', img.out), img.width, img.height);
    console.log(`wrote src/static/${img.out}`);
  }
  const pngs = [];
  for (const size of ICO_SIZES) {
    const out = join(profile, `icon-${size}.png`);
    await render('/scripts/images/icon.html?size=192', out, 192, 192, size / 192);
    pngs.push({ size, data: readFileSync(out) });
  }
  writeFileSync(join(root, 'src/static/favicon.ico'), icoFile(pngs));
  console.log('wrote src/static/favicon.ico');
} finally {
  server.close();
  // The browser may still hold files in its profile for a moment after it exits.
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch {
    console.warn(`could not remove the temporary browser profile ${profile}`);
  }
}
