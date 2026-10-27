import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextEvent, showNextEvent } from '../src/js/next-event.js';

test('no future event gives -1', () => {
  assert.equal(pickNextEvent(['2026-10-20'], '2026-10-27'), -1);
});

test('picks the earliest future event', () => {
  assert.equal(pickNextEvent(['2026-12-01', '2026-11-05', '2026-10-20'], '2026-10-27'), 1);
});

test('an event today is still next', () => {
  assert.equal(pickNextEvent(['2026-10-27'], '2026-10-27'), 0);
});

// A small fake DOM: elements with a tag, classes, attributes and children.
// querySelector supports "#id", ".class", "tag.class" and one descendant step ("#a li.event").
function el(tag, { id, cls = '', date } = {}, children = []) {
  const e = {
    tagName: tag, id, className: cls, attrs: {}, children: [], parent: null,
    dataset: date ? { date } : {},
    get hidden() { return 'hidden' in this.attrs; },
    set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    append(...nodes) {
      for (const n of nodes) {
        if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
        n.parent = this; this.children.push(n);
      }
    },
    cloneNode() {
      const copy = el(this.tagName, { id: this.id, cls: this.className, date: this.dataset.date }, this.children.map(c => c.cloneNode()));
      Object.assign(copy.attrs, this.attrs);
      return copy;
    },
    replaceChildren(...nodes) {
      for (const n of this.children) n.parent = null;
      this.children = [];
      this.append(...nodes);
    },
  };
  e.append(...children);
  return e;
}

const all = node => node.children.flatMap(c => [c, ...all(c)]);
function matches(node, part) {
  const [, tag, id, cls] = part.match(/^([a-z]*)(?:#([\w-]+))?(?:\.([\w-]+))?$/);
  return (!tag || node.tagName === tag) && (!id || node.id === id) && (!cls || node.className.split(' ').includes(cls));
}
function fakeDocument(root) {
  const select = sel => {
    const parts = sel.split(' ');
    let found = all(root).filter(n => matches(n, parts[0]));
    for (const part of parts.slice(1)) found = found.flatMap(all).filter(n => matches(n, part));
    return [...new Set(found)];
  };
  return {
    querySelectorAll: select,
    querySelector: sel => select(sel)[0] ?? null,
    createElement: tag => el(tag),
  };
}

test('showNextEvent moves the next meetup into the slot and hides later ones', () => {
  const past = el('li', { cls: 'event', date: '2026-10-20' });
  const next = el('li', { cls: 'event', date: '2026-11-05' });
  const later = el('li', { cls: 'event', date: '2026-12-01' });
  const slot = el('div', { cls: 'next-event' });
  slot.hidden = true;
  const list = el('ol', { cls: 'events' }, [later, next, past]);
  // A slot outside Community must stay untouched.
  const other = el('div', { cls: 'next-event' });
  other.hidden = true;
  const root = el('body', {}, [other, el('section', { id: 'community' }, [el('p'), slot, list])]);

  showNextEvent(fakeDocument(root), '2026-10-27');

  assert.equal(slot.hidden, false);
  assert.equal(other.hidden, true);
  assert.equal(other.children.length, 0);
  const inSlot = all(slot).filter(n => n.className === 'event');
  assert.deepEqual(inSlot, [next]);
  assert.equal(all(root).filter(n => n.dataset.date === '2026-11-05').length, 1, 'no duplicate');
  assert.equal(list.children.includes(next), false);
  assert.equal(later.hidden, true);
  assert.equal(past.hidden, false);
  assert.equal(next.hidden, false);
});

test('showNextEvent leaves the slot hidden without a future meetup', () => {
  const past = el('li', { cls: 'event', date: '2026-10-20' });
  const slot = el('div', { cls: 'next-event' });
  slot.hidden = true;
  const root = el('body', {}, [el('section', { id: 'community' }, [slot, el('ol', { cls: 'events' }, [past])])]);
  showNextEvent(fakeDocument(root), '2026-10-27');
  assert.equal(slot.hidden, true);
  assert.equal(past.hidden, false);
});
