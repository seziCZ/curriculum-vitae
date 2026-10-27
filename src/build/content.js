import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isText = v => typeof v === 'string' && v.trim() !== '';

// Checks the YYYY-MM-DD form and that the day exists in that month (2026-02-30 does not).
// Returns an error message, or null when the date is valid.
function dateError(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'date must be YYYY-MM-DD';
  const [y, m, d] = date.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const real = m >= 1 && m <= 12 && utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d;
  return real ? null : 'date must be a real calendar date';
}

export function validateEvent(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['event must be an object'];
  const dateErr = dateError(e.date);
  if (dateErr) errors.push(dateErr);
  if (!['AWS', 'Databricks'].includes(e.group)) errors.push('group must be AWS or Databricks');
  if (!Number.isInteger(e.number) || e.number < 1) errors.push('number must be a positive integer');
  if (!isText(e.title)) errors.push('title is required');
  if (!isText(e.url)) errors.push('url is required');
  if (e.venue !== undefined && !isText(e.venue)) errors.push('venue must be text when present');
  if (!Array.isArray(e.talks)) errors.push('talks must be an array');
  else e.talks.forEach((t, i) => {
    for (const k of ['title', 'speaker', 'company']) if (!isText(t?.[k])) errors.push(`talks[${i}].${k} is required`);
  });
  return errors;
}

export function loadEvents(dir) {
  if (!existsSync(dir)) return [];
  const events = readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(name => {
    let e;
    try { e = JSON.parse(readFileSync(join(dir, name), 'utf8')); }
    catch (err) { throw new Error(`${name}: ${err.message}`); }
    const errors = validateEvent(e);
    if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
    return e;
  });
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function communityIntro(events, today) {
  const past = events.filter(e => e.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const intro = 'I help organize both groups and speak at them.';
  if (!past.length) return intro;
  const [y, m] = past[0].date.split('-').map(Number);
  const companies = [...new Set(past.flatMap(e => e.talks.map(t => t.company)).filter(c => c !== 'Datamole'))];
  const list = companies.length > 1 ? `${companies.slice(0, -1).join(', ')} and ${companies.at(-1)}` : companies[0];
  const speakers = list ? `, with speakers from ${list}` : '';
  const noun = past.length === 1 ? 'meetup' : 'meetups';
  return `${intro} Since ${MONTH_NAMES[m - 1]} ${y}, we have run ${past.length} ${noun}${speakers}.`;
}

function renderTalk(t) {
  const who = t.mine ? '<span class="tag">Speaker</span>' : `${esc(t.speaker)}, ${esc(t.company)}`;
  const links = [];
  if (t.slides) links.push(`<a href="${esc(t.slides)}">Slides</a>`);
  if (t.recording) links.push(`<a href="${esc(t.recording)}">Recording</a>`);
  return `<li><span class="talk-title">${esc(t.title)}</span> <span class="talk-who">${who}</span>${links.length ? ` <span class="talk-links">${links.join(' ')}</span>` : ''}</li>`;
}

export function renderEvent(e) {
  const venue = e.venue ? `<p class="venue">${esc(e.venue)}</p>` : '';
  const talks = e.talks.length ? `<ul class="talks">${e.talks.map(renderTalk).join('')}</ul>` : '';
  return `<li class="event" data-date="${esc(e.date)}">
  <div class="when">${formatDate(e.date)} · ${esc(e.group)} Brno #${e.number}</div>
  <h3>${esc(e.title)}</h3>
  ${venue}${talks}
  <a class="event-link" href="${esc(e.url)}">Event page</a>
</li>`;
}

export function renderCommunity(events, today) {
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));
  return `<p>${esc(communityIntro(events, today))}</p>
<div class="next-event" hidden></div>
<ol class="events">
${sorted.map(renderEvent).join('\n')}
</ol>`;
}

export function validatePost(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return ['post must be an object'];
  const dateErr = dateError(p.date);
  if (dateErr) errors.push(dateErr);
  if (!isText(p.text)) errors.push('text is required');
  if (!isText(p.url) || !/^https:\/\/([a-z0-9-]+\.)*linkedin\.com(\/|$)/i.test(p.url)) errors.push('url must be a linkedin.com link');
  if (p.image !== undefined && !isText(p.image)) errors.push('image must be text when present');
  return errors;
}

export function loadPosts(dir) {
  if (!existsSync(dir)) return [];
  const posts = readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(name => {
    let p;
    try { p = JSON.parse(readFileSync(join(dir, name), 'utf8')); }
    catch (err) { throw new Error(`${name}: ${err.message}`); }
    const errors = validatePost(p);
    if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
    return p;
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export function renderPosts(posts) {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(p => {
    const image = p.image ? `<img src="posts/${esc(p.image)}" alt="" loading="lazy">` : '';
    return `<div class="card">
  <div class="when">${formatDate(p.date)}</div>
  <p>${esc(p.text)}</p>
  ${image}
  <a href="${esc(p.url)}">View on LinkedIn &rarr;</a>
</div>`;
  }).join('\n');
}

export function renderPage(template, { events = [], posts = [], today } = {}) {
  let html = template.replace('<!--@community-->', () => renderCommunity(events, today));
  if (posts.length === 0) {
    html = html.replace(/<!--@posts-section-->[\s\S]*?<!--\/@posts-section-->\n?/, '')
      .replace(/<!--@posts-nav-->[\s\S]*?<!--\/@posts-nav-->/, '');
  } else {
    html = html.replace('<!--@posts-->', () => renderPosts(posts));
  }
  return html.replace(/<!--\/?@posts-(section|nav)-->\n?/g, '');
}
