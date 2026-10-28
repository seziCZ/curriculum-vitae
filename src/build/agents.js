// Text versions of the page for AI agents and other tools that read text: llms.txt (see llmstxt.org)
// and the whole page as Markdown in index.html.md. Both are made from the rendered page,
// so they always say what the page says.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', darr: '↓' };

const decode = s => s.replace(/&(#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m);

// A small parser for the page's own markup: elements with attributes, and text.
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [] }, stack = [root];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*)>|[^<]+/g)) {
    const top = stack.at(-1);
    if (m[0].startsWith('<!--')) continue;
    if (!m[2]) { top.children.push(decode(m[0])); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = stack.findLastIndex(n => n.tag === tag);
      if (i > 0) stack.length = i;
      continue;
    }
    const attrs = {};
    for (const [, k, v] of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[k] = v === undefined ? '' : decode(v);
    const node = { tag, attrs, children: [] };
    top.children.push(node);
    if (!VOID.has(tag)) stack.push(node);
  }
  return root;
}

const hasClass = (n, c) => typeof n !== 'string' && (n.attrs.class || '').split(/\s+/).includes(c);
const elements = n => n.children.filter(c => typeof c !== 'string');
function find(n, test) {
  if (typeof n === 'string') return null;
  if (test(n)) return n;
  for (const c of n.children) { const hit = find(c, test); if (hit) return hit; }
  return null;
}
const findAll = (n, test, out = []) => {
  if (typeof n === 'string') return out;
  if (test(n)) out.push(n);
  n.children.forEach(c => findAll(c, test, out));
  return out;
};
const text = n => typeof n === 'string' ? n : n.children.map(text).join('');
const clean = s => s.replace(/\s+/g, ' ').trim();

// Page links are relative to the site; the text versions are read outside it, so links are absolute.
const absolute = (href, siteUrl) => /^(https:|mailto:)/.test(href) ? href : siteUrl + href.replace(/^\.?\//, '');

function inline(n, siteUrl) {
  if (typeof n === 'string') return n;
  if (n.tag === 'a') return `[${clean(text(n))}](${absolute(n.attrs.href, siteUrl)})`;
  return n.children.map(c => inline(c, siteUrl)).join('');
}

// A talk: its title in quotes and who gave it. The page marks the owner's own talks with a tag instead of the name.
function talk(li, name, siteUrl) {
  const title = clean(text(find(li, n => hasClass(n, 'talk-title'))));
  const whoNode = find(li, n => hasClass(n, 'talk-who'));
  const who = find(whoNode, n => hasClass(n, 'tag')) ? name : clean(text(whoNode));
  const links = find(li, n => hasClass(n, 'talk-links'));
  return `- "${title}" by ${who}${links ? ` (${clean(inline(links, siteUrl))})` : ''}`;
}

// The Markdown blocks of one element of the page.
function blocks(n, ctx) {
  if (typeof n === 'string') return clean(n) ? [clean(n)] : [];
  // Hidden elements are filled by the page script (the next meetup); the meetups are listed anyway.
  if ('hidden' in n.attrs || ['eyebrow', 'bar', 'hint'].some(c => hasClass(n, c)) || n.tag === 'footer') return [];
  const line = () => clean(inline(n, ctx.siteUrl));
  if (n.tag === 'section') {
    const eyebrow = clean(text(find(n, c => hasClass(c, 'eyebrow')) ?? { children: [] }));
    return [`## ${eyebrow}`, ...n.children.flatMap(c => blocks(c, { ...ctx, section: eyebrow }))];
  }
  // Work items and meetups: the title first, then the date line.
  if (hasClass(n, 'item') || hasClass(n, 'event')) {
    const h3 = find(n, c => c.tag === 'h3');
    return [`### ${clean(text(h3))}`, ...n.children.filter(c => c !== h3).flatMap(c => blocks(c, ctx))];
  }
  if (hasClass(n, 'events')) return elements(n).flatMap(c => blocks(c, ctx));
  if (hasClass(n, 'when')) return [`*${line()}*`];
  if (hasClass(n, 'tags')) return [`Tags: ${elements(n).map(t => clean(text(t))).join(', ')}`];
  if (hasClass(n, 'talks')) return [elements(n).map(li => talk(li, ctx.name, ctx.siteUrl)).join('\n')];
  switch (n.tag) {
    case 'h1': return [`# ${line()}`];
    // A heading that only repeats the section name ("Selected work.") is left out.
    case 'h2': return clean(text(n)).replace(/\.$/, '') === ctx.section ? [] : [`**${line()}**`];
    case 'h3': return [`### ${line()}`];
    case 'p': return hasClass(n, 'claim') ? [`**${line()}**`] : [line()];
    case 'a': return [line()];
    case 'ul': case 'ol': return [elements(n).map(li => `- ${clean(inline(li, ctx.siteUrl))}`).join('\n')];
    case 'img': case 'script': return [];
    default: return n.children.flatMap(c => blocks(c, ctx));
  }
}

function pageParts(html) {
  const root = parse(html);
  const hero = find(root, n => hasClass(n, 'hero'));
  const main = find(root, n => n.tag === 'main');
  const name = clean(text(find(hero, n => n.tag === 'h1')));
  return { hero, main, name };
}

export function renderMarkdown(html, siteUrl, today) {
  const { hero, main, name } = pageParts(html);
  const ctx = { siteUrl, name };
  const out = [...blocks(hero, ctx), ...blocks(main, ctx), '---', `Markdown version of ${siteUrl}, built on ${today}.`];
  return out.join('\n\n') + '\n';
}

export function renderLlmsTxt(html, siteUrl) {
  const { hero, main, name } = pageParts(html);
  const claim = clean(text(find(hero, n => hasClass(n, 'claim'))));
  const intro = clean(text(findAll(hero, n => n.tag === 'p' && !hasClass(n, 'claim'))[0]));
  const contact = findAll(find(main, n => n.attrs.id === 'contact'), n => n.tag === 'a');
  return [
    `# ${name}`,
    `> ${claim}`,
    intro,
    '## Profile',
    [`- [Profile in Markdown](${siteUrl}index.html.md): about, selected work, community meetups and talks, contact`,
      `- [Profile page](${siteUrl}): the same content as a web page`].join('\n'),
    '## Contact',
    contact.map(a => `- ${inline(a, siteUrl)}`).join('\n'),
  ].join('\n\n') + '\n';
}
