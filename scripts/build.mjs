import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvents, renderPage } from '../src/build/content.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_FAMILIES = ['space-grotesk', 'inter'];
const FONT_FILES = ['latin-wght-normal.woff2', 'latin-ext-wght-normal.woff2'];

export function localIsoDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A missing folder counts as empty.
function listFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).sort().map(name => join(dir, name)) : [];
}

export async function build(outDir = 'dist', today = localIsoDate()) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'fonts'), { recursive: true });
  cpSync(join(root, 'src/css'), join(outDir, 'css'), { recursive: true });
  cpSync(join(root, 'src/js'), join(outDir, 'js'), { recursive: true });
  for (const family of FONT_FAMILIES) {
    for (const file of FONT_FILES) {
      const name = `${family}-${file}`;
      cpSync(join(root, 'node_modules/@fontsource-variable', family, 'files', name), join(outDir, 'fonts', name));
    }
  }
  // Task 3 parses the posts. For now only the file list is passed on.
  const events = loadEvents(join(root, 'content/events'));
  const posts = listFiles(join(root, 'content/posts'));
  const template = readFileSync(join(root, 'src/index.html'), 'utf8');
  writeFileSync(join(outDir, 'index.html'), renderPage(template, { events, posts, today }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await build();
}
