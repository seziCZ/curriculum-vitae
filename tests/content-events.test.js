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
test('communityIntro counts past meetups and outside companies', () => {
  assert.equal(communityIntro(events, '2026-10-27'),
    'I help organize both groups and speak at them. Since February 2026, we have run 5 meetups, with speakers from AWS, SentinelOne, Sage, Kyndryl and E.ON.');
  assert.match(communityIntro(events, '2026-10-10'), /we have run 4 meetups/);
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
test('renderCommunity puts the next-event slot after the intro and before the list', () => {
  const html = renderCommunity(events, '2026-10-27');
  const intro = html.indexOf('<p>'), slot = html.indexOf('<div class="next-event" hidden></div>'), list = html.indexOf('<ol class="events">');
  assert.ok(intro === 0 && intro < slot && slot < list, `order ${intro}, ${slot}, ${list}`);
});
