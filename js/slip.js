// The note that comes back, drawn like a page from a pink phone-message pad,
// and the screen where the sitter fills one in.
import * as M from './model.js';
import { store } from './store.js';
import { app, esc, on, go, toast, lines } from './ui.js';
import { sendSlip } from './send.js';

// A hand-drawn tick for the boxes.
const TICK = '<svg class="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 13.5c2.2 1.6 3.6 3.4 5 6.2C11.6 12 15.8 6.6 21 3.2" /></svg>';

const when = t => new Date(t).toLocaleString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
const time = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function slipHTML(slip, { editing = false, from = '' } = {}) {
  const box = ([id, label]) => editing
    ? `<label class="mark"><input type="checkbox" data-mark="${id}"${slip.marks.includes(id) ? ' checked' : ''}><span class="box">${TICK}</span><span class="lbl">${esc(label)}</span></label>`
    : `<span class="mark${slip.marks.includes(id) ? ' on' : ''}"><span class="box">${slip.marks.includes(id) ? TICK : ''}</span><span class="lbl">${esc(label)}</span></span>`;
  return `
    <article class="slip${editing ? ' editing' : ''}${slip.marks.includes('urgent') ? ' urgent' : ''}" aria-label="Note from ${esc(slip.from || 'the sitter')}">
      <header class="slip-head"><span>While you were out</span></header>
      <div class="slip-line"><span class="lbl">For</span><span class="hand">${esc(slip.to || '')}</span></div>
      <div class="slip-line two">
        <span class="lbl">Date</span><span class="hand">${esc(when(slip.at))}</span>
        <span class="lbl">Time</span><span class="hand">${esc(time(slip.at))}</span>
      </div>
      <div class="slip-line"><span class="lbl">From</span>${editing
        ? `<input class="hand" id="slipFrom" value="${esc(from)}" placeholder="Your name" aria-label="Your name" autocomplete="given-name">`
        : `<span class="hand">${esc(slip.from || '')}</span>`}</div>
      <div class="marks">${M.MARKS.map(box).join('')}</div>
      <div class="slip-done">
        <span class="lbl">Done${slip.day ? ` ${esc(M.dayName(slip.day, { weekday: 'long' }))}` : ''}</span>
        ${slip.done.length
          ? `<ul class="hand">${slip.done.map(([what, who, at]) => `<li>${TICK}<span>${esc(what)}${who ? `, ${esc(who)}` : ''}</span>${at ? `<i>${esc(at)}</i>` : ''}</li>`).join('')}</ul>`
          : `<p class="hand faint">${editing ? 'Nothing ticked off yet today.' : '—'}</p>`}
      </div>
      <div class="slip-msg">
        <span class="lbl">Message</span>
        ${editing
          ? `<textarea class="hand" id="slipMsg" rows="4" placeholder="How it went" aria-label="Message">${esc(slip.msg)}</textarea>`
          : `<p class="hand">${lines(slip.msg) || '&nbsp;'}</p>`}
      </div>
      <footer class="slip-foot"><span class="lbl">Signed</span><span class="hand sig">${esc(editing ? from : slip.from)}</span></footer>
    </article>`;
}

// A small one for lists.
export function miniSlip(slip) {
  const marks = M.MARKS.filter(([id]) => slip.marks.includes(id)).map(([, l]) => l);
  return `
    <a class="mini-slip${slip.dir === 'in' && !slip.read ? ' unread' : ''}${slip.marks.includes('urgent') ? ' urgent' : ''}" href="#/note/${slip.id}">
      <span class="ms-head"><b>${slip.dir === 'out' ? `To ${esc(slip.to || 'them')}` : `From ${esc(slip.from || 'your sitter')}`}</b><span>${esc(when(slip.at))}, ${esc(time(slip.at))}</span></span>
      ${marks.length ? `<span class="ms-marks">${marks.map(esc).join(' · ')}</span>` : ''}
      <span class="ms-msg hand">${esc(slip.msg || (slip.done.length ? `Done: ${slip.done.map(d => d[0]).join(', ')}` : ''))}</span>
    </a>`;
}

// The sitter fills in a note for the day.
export function compose(s, day) {
  const ticks = store.ticks(s.id, day);
  let draft = M.makeSlip({ sheet: s, from: store.name || s.sitter, day, done: M.doneList(s, day, ticks), marks: [] });
  document.title = `A note for ${s.owner.name || 'them'} · While You Were Out`;
  app.innerHTML = `
    <div class="page-head">
      <p class="kicker"><a href="#/v/${s.id}/today/${day}">${esc(s.title || 'Care sheet')}</a></p>
      <h1>Leave ${esc(s.owner.name || 'them')} a note</h1>
      <p class="hint">Tick what applies and write how it went. What you ticked off ${day === M.todayISO() ? 'today' : `on ${esc(M.dayName(day, { weekday: 'long' }))}`} is already on it.</p>
    </div>
    <div class="slip-wrap">${slipHTML(draft, { editing: true, from: draft.from })}</div>
    <div class="next-bar">
      <a class="btn" href="#/v/${s.id}/today/${day}">Back</a>
      <button type="button" class="btn primary" id="sendSlip">${s.example ? 'Send it (example)' : `Send to ${esc(s.owner.name || 'them')}`}</button>
    </div>`;
  const signed = app.querySelector('.sig');
  on({
    input(e) {
      if (e.target.id === 'slipFrom') signed.textContent = e.target.value;
    },
    async click(e) {
      if (e.target.id !== 'sendSlip') return;
      const from = app.querySelector('#slipFrom').value.trim();
      if (!from) { app.querySelector('#slipFrom').focus(); return toast('Sign it with your name'); }
      const marks = [...app.querySelectorAll('[data-mark]:checked')].map(b => b.dataset.mark);
      const msg = app.querySelector('#slipMsg').value.trim();
      if (!marks.length && !msg && !draft.done.length) return toast('Tick a box or write something first');
      store.name = from;
      draft = M.makeSlip({ sheet: s, from, day, done: draft.done, marks, msg });
      if (s.example) {
        // The example has nobody to send to, so the note lands where Alex would see it.
        store.addSlip(draft, 'in');
        go(`/note/${draft.id}`);
        toast('For real, this goes to them as a link');
        return;
      }
      store.addSlip(draft, 'out');
      go(`/note/${draft.id}`);
      await sendSlip(draft, s);
    },
  });
}

// One note, on its own.
export function showSlip(slip) {
  const s = store.get(slip.sheet);
  if (slip.dir === 'in') store.markRead(slip.id);
  document.title = `${slip.dir === 'in' ? `From ${slip.from}` : `To ${slip.to}`} · While You Were Out`;
  app.innerHTML = `
    <div class="page-head">
      <p class="kicker">${s ? `<a href="#/v/${s.id}/notes">${esc(s.title || 'Care sheet')}</a>` : '<a href="#/">While You Were Out</a>'}</p>
      <h1>${slip.dir === 'in' ? `A note from ${esc(slip.from || 'your sitter')}` : `Your note to ${esc(slip.to || 'them')}`}</h1>
      ${!s ? '<p class="hint">It’s about a care sheet that isn’t on this device.</p>' : ''}
    </div>
    <div class="slip-wrap">${slipHTML(slip)}</div>
    <div class="next-bar">
      <a class="btn" href="${s ? `#/v/${s.id}/notes` : '#/'}">${s ? 'All notes' : 'Home'}</a>
      ${slip.dir === 'out' && s ? '<button type="button" class="btn primary" id="again">Send it again</button>' : ''}
    </div>`;
  on({
    click(e) {
      if (e.target.id === 'again') sendSlip(slip, s);
    },
  });
}
