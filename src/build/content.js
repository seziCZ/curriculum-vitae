import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isText = v => typeof v === 'string' && v.trim() !== '';

export function validateEvent(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['event must be an object'];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) errors.push('date must be YYYY-MM-DD');
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
<ol class="events">
${sorted.map(renderEvent).join('\n')}
</ol>`;
}

export function renderPage(template, { events = [], today } = {}) {
  return template.replace('<!--@community-->', () => renderCommunity(events, today));
}
