// Copies the earliest upcoming meetup from the Community list into the next-event slot.

// Returns the index of the earliest date that is today or later, or -1 when none is.
// Dates use the YYYY-MM-DD form, so string comparison gives the calendar order.
export function pickNextEvent(dates, today) {
  let best = -1;
  dates.forEach((date, i) => {
    if (date >= today && (best === -1 || date < dates[best])) best = i;
  });
  return best;
}

// Fills the .next-event slot with a heading and a copy of the next meetup.
// Without a future meetup, the slot stays hidden.
export function showNextEvent(doc, today) {
  const items = [...doc.querySelectorAll('#community li.event')];
  const index = pickNextEvent(items.map(li => li.dataset.date), today);
  const slot = doc.querySelector('.next-event');
  if (index === -1 || !slot) return;

  const heading = doc.createElement('div');
  heading.className = 'eyebrow';
  heading.textContent = 'Next meetup';

  const list = doc.createElement('ul');
  list.className = 'events';
  list.append(items[index].cloneNode(true));

  slot.replaceChildren(heading, list);
  slot.removeAttribute('hidden');
}
