import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEvents, loadPosts, renderPage } from '../src/build/content.js';
import { normalizeSiteUrl, renderHead, renderRobots, renderSitemap } from '../src/build/seo.js';
import { renderLlmsTxt, renderMarkdown } from '../src/build/agents.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_FAMILIES = ['space-grotesk', 'inter'];
const FONT_FILES = ['latin-wght-normal.woff2', 'latin-ext-wght-normal.woff2'];

export function localIsoDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The public address of the page. Set SITE_URL when the domain is known; the placeholder only
// serves local work, because canonical, link previews and the sitemap need the real address.
const PLACEHOLDER_SITE_URL = 'https://example.com/';

// A relative outDir resolves against the repository root, not the current folder.
export async function build(outDir = 'dist', today = localIsoDate(), siteUrl = process.env.SITE_URL || PLACEHOLDER_SITE_URL) {
  outDir = resolve(root, outDir);
  siteUrl = normalizeSiteUrl(siteUrl);
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
  const events = loadEvents(join(root, 'content/events'));
  const posts = loadPosts(join(root, 'content/posts'));
  for (const p of posts) {
    if (!p.image) continue;
    mkdirSync(join(outDir, 'posts'), { recursive: true });
    cpSync(join(root, 'content/posts', p.image), join(outDir, 'posts', p.image));
  }
  // Favicons, the link preview image and the 404 page are copied as they are.
  cpSync(join(root, 'src/static'), outDir, { recursive: true });
  const template = readFileSync(join(root, 'src/index.html'), 'utf8');
  const head = renderHead({ siteUrl, today });
  const page = renderPage(template, { events, posts, today, head });
  writeFileSync(join(outDir, 'index.html'), page);
  writeFileSync(join(outDir, 'index.html.md'), renderMarkdown(page, siteUrl, today));
  writeFileSync(join(outDir, 'llms.txt'), renderLlmsTxt(page, siteUrl));
  writeFileSync(join(outDir, 'robots.txt'), renderRobots(siteUrl));
  writeFileSync(join(outDir, 'sitemap.xml'), renderSitemap(siteUrl, today));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!process.env.SITE_URL) console.warn(`SITE_URL is not set, so the build uses ${PLACEHOLDER_SITE_URL} for canonical, link previews and the sitemap.`);
  await build();
}
