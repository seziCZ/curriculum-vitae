import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEvents, validateEvent, formatDate, communityIntro, renderEvent, renderCommunity } from '../src/build/content.js';

const events = loadEvents('content/events');
const databricks1 = events.find(e => e.group === 'Databricks');
const valid = events[0];

test('all event files are valid', () => { assert.equal(loadEvents('content/events').length, 5); });
test('events are sorted newest first', () => { assert.equal(events[0].date, '2026-10-20'); assert.equal(events[4].date, '2026-02-05'); });
test('validateEvent reports missing fields', () => {
  assert.deepEqual(validateEvent({}).length > 0, true);
  assert.deepEqual(validateEvent(valid), []);
  assert.ok(validateEvent({ ...valid, group: 'GCP' }).some(e => e.includes('group')));
  assert.ok(validateEvent({ ...valid, date: '20.10.2026' }).some(e => e.includes('date')));
});
test('formatDate', () => assert.equal(formatDate('2026-10-20'), '20 Oct 2026'));
test('communityIntro names the start and the outside companies, without a count', () => {
  assert.equal(communityIntro(events, '2026-10-27'),
    'I help organize both groups and speak at them. Since February 2026, our speakers have come from AWS, SentinelOne, Sage, Kyndryl and E.ON.');
  assert.equal(communityIntro(events, '2026-10-10'),
    'I help organize both groups and speak at them. Since February 2026, our speakers have come from AWS, SentinelOne, Sage and Kyndryl.');
  assert.doesNotMatch(communityIntro(events, '2026-10-27'), /\d+ meetups?/);
});
test('communityIntro without outside speakers is only the first sentence', () => {
  assert.equal(communityIntro([], '2026-10-27'), 'I help organize both groups and speak at them.');
});
test('renderEvent marks my talks and links the event', () => {
  const html = renderEvent(databricks1);
  assert.match(html, /data-date="2026-10-20"/);
  assert.match(html, /20 Oct 2026 · Databricks Brno #1/);
  assert.equal((html.match(/class="tag">Speaker</g) || []).length, 1);
});
test('renderEvent escapes text and skips missing optional fields', () => {
  const html = renderEvent({ ...databricks1, title: 'A & B <test>' });
  assert.match(html, /A &amp; B &lt;test&gt;/);
  assert.doesNotMatch(html, /undefined|null/);
});
test('validateEvent accepts only https links', () => {
  assert.ok(validateEvent({ ...valid, url: 'javascript:alert(1)' }).some(e => e.includes('url')));
  assert.ok(validateEvent({ ...valid, url: 'http://example.org' }).some(e => e.includes('url')));
  const talk = { title: 'T', speaker: 'S', company: 'C' };
  assert.ok(validateEvent({ ...valid, talks: [{ ...talk, slides: 'javascript:x' }] }).some(e => e.includes('slides')));
  assert.ok(validateEvent({ ...valid, talks: [{ ...talk, recording: 'ftp://x' }] }).some(e => e.includes('recording')));
  assert.deepEqual(validateEvent({ ...valid, talks: [{ ...talk, slides: 'https://example.org/s.pdf' }] }), []);
});
test('renderCommunity shows only the 5 newest meetups', () => {
  const more = [
    ...events,
    { ...valid, date: '2026-11-12', number: 5, title: 'Newer meetup A' },
    { ...valid, date: '2026-12-03', number: 6, title: 'Newer meetup B' },
  ];
  const dates = [...renderCommunity(more, '2026-10-27').matchAll(/data-date="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(dates, ['2026-12-03', '2026-11-12', '2026-10-20', '2026-10-08', '2026-07-29']);
});
test('renderCommunity puts the next-event slot after the intro and before the list', () => {
  const html = renderCommunity(events, '2026-10-27');
  const intro = html.indexOf('<p>'), slot = html.indexOf('<div class="next-event" hidden></div>'), list = html.indexOf('<ol class="events">');
  assert.ok(intro === 0 && intro < slot && slot < list, `order ${intro}, ${slot}, ${list}`);
});
test('validateEvent rejects dates that do not exist', () => {
  for (const date of ['2026-13-01', '2026-02-30', '2026-00-10', '2026-04-31']) {
    assert.ok(validateEvent({ ...valid, date }).some(e => e.includes('date')), date);
  }
  assert.deepEqual(validateEvent({ ...valid, date: '2028-02-29' }), []);
});
