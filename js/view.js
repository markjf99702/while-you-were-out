// The sheet as the sitter sees it: a checklist for each day, who's who, the house, and who to call.
// The person who made it sees the same thing, with Edit, Send and Print along the top.
import * as M from './model.js';
import { store } from './store.js';
import { app, esc, on, copy, tel, sms, lines, sheet as openSheet } from './ui.js';
import { sendSheet } from './send.js';
import { miniSlip } from './slip.js';
import { qrSVG } from './qr.js';

const TABS = [['today', 'Today'], ['care', 'Care'], ['house', 'House'], ['call', 'Call'], ['notes', 'Notes']];

export function view(s, tab = 'today', dayArg = '') {
  if (!TABS.some(([t]) => t === tab)) tab = 'today';
  const days = M.stayDays(s);
  const day = M.isISO(dayArg) ? dayArg : M.defaultDay(s);
  const unread = store.unread(s.id);
  const notes = store.slips(s.id).length;
  document.title = `${s.title || 'Care sheet'} · While You Were Out`;
  const owner = s.owner.name || 'them';
  app.innerHTML = `
    ${s.mine ? `
      <div class="owner-bar">
        <p>${s.example ? 'An example. ' : ''}This is what ${esc(s.sitter.trim() || 'your sitter')} sees.</p>
        <div><a class="btn small" href="#/e/${s.id}">Edit</a><a class="btn small" href="#/p/${s.id}">Print</a><button type="button" class="btn small primary" data-act="send">Send</button></div>
      </div>` : ''}
    <div class="page-head sheet-head">
      <p class="kicker">${s.mine ? 'Care sheet' : `From ${esc(owner)}`}${days.length ? ` · ${esc(M.stayText(s))}` : ''}</p>
      <h1>${esc(s.title || 'Care sheet')}</h1>
    </div>
    <nav class="tabs" aria-label="Sections">
      ${TABS.map(([t, n]) => `<a href="#/v/${s.id}/${t}"${t === tab ? ' aria-current="page"' : ''}>${n}${t === 'notes' && (unread || notes) ? ` <span class="count${unread ? ' new' : ''}">${unread || notes}</span>` : ''}</a>`).join('')}
    </nav>
    <div id="tab">${{ today, care, house, call, notes: notesTab }[tab](s, day, days)}</div>
    ${!s.mine || s.example ? `
      <div class="next-bar">
        <a class="btn slip-btn wide" href="#/w/${s.id}/${day}">${s.example ? 'Try the note the sitter sends back' : `Leave ${esc(owner)} a note`}</a>
      </div>` : ''}`;
  on({
    change(e) {
      const id = e.target.dataset.tick;
      if (!id) return;
      store.tick(s.id, day, id, e.target.checked);
      const row = e.target.closest('.job');
      row.classList.toggle('done', e.target.checked);
      row.querySelector('.job-when').textContent = e.target.checked ? `Done ${M.clockOf(Date.now())}` : '';
      progress(s, day);
    },
    click(e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'send') sendSheet(s);
      else if (act === 'reveal') { b.closest('.secret').classList.add('shown'); b.remove(); }
      else if (act === 'copy') copy(b.dataset.v, null, 'Copied');
      else if (act === 'wifi-code') openSheet(`
          <h2>Join ${esc(s.wifi.name)}</h2>
          <p>Point another phone’s camera at this to join the Wi-Fi.</p>
          <div class="qr-big">${qrSVG(M.wifiCode(s.wifi), { label: `Wi-Fi code for ${s.wifi.name}` })}</div>
          <p class="sheet-foot"><span></span><button type="button" class="link-btn" data-close>Close</button></p>`);
      else if (act === 'intro-ok') { b.closest('.intro').remove(); }
    },
  });
}

function progress(s, day) {
  const el = document.getElementById('progress');
  if (!el) return;
  const tasks = M.tasksOn(s, day), ticks = store.ticks(s.id, day);
  const n = tasks.filter(t => ticks[t.id]).length;
  el.innerHTML = tasks.length ? `<b>${n}</b> of ${tasks.length} done${n === tasks.length ? ' · all done' : ''}` : '';
  el.style.setProperty('--p', tasks.length ? n / tasks.length : 0);
}

function today(s, day, days) {
  const tasks = M.tasksOn(s, day), ticks = store.ticks(s.id, day);
  const n = tasks.filter(t => ticks[t.id]).length;
  const i = days.indexOf(day);
  const todayIso = M.todayISO();
  const fresh = !s.mine && !Object.keys(store.ticks(s.id, day)).length && !store.slips(s.id).some(x => x.dir === 'out');
  return `
    ${fresh ? `
      <div class="intro">
        <p><b>${esc(s.owner.name || 'They')} sent you this.</b> It’s saved on this phone now and works without signal. Tick things off as you go, and leave ${esc(s.owner.name || 'them')} a note when you like.</p>
        <button type="button" class="link-btn" data-act="intro-ok">Got it</button>
      </div>` : ''}
    ${days.length > 1 ? `
      <div class="day-strip" role="list">
        ${days.map(d => `<a role="listitem" href="#/v/${s.id}/today/${d}"${d === day ? ' aria-current="date"' : ''} class="${d === todayIso ? 'is-today' : ''}"><small>${esc(M.dayName(d, { weekday: 'short' }))}</small><b>${M.parse(d).getDate()}</b></a>`).join('')}
      </div>` : ''}
    <div class="day-head">
      <h2>${day === todayIso ? 'Today' : esc(M.dayName(day, { weekday: 'long' }))}<small>${esc(M.dayName(day, { month: 'long', day: 'numeric' }))}${i >= 0 && days.length > 1 ? ` · day ${i + 1} of ${days.length}` : ''}</small></h2>
      <p id="progress" class="progress" style="--p:${tasks.length ? n / tasks.length : 0}">${tasks.length ? `<b>${n}</b> of ${tasks.length} done${n === tasks.length ? ' · all done' : ''}` : ''}</p>
    </div>
    ${tasks.length ? M.tasksBySlot(tasks).map(g => `
      <section class="slot">
        <h3>${g.name}</h3>
        ${g.tasks.map(t => job(s, t, ticks[t.id])).join('')}
      </section>`).join('') : `<p class="empty-line">Nothing on the list for this day.${s.mine ? ` <a href="#/e/${s.id}">Add the jobs</a>.` : ''}</p>`}`;
}

function job(s, t, done) {
  const w = M.whoOf(s, t.who);
  const once = t.days.some(d => typeof d === 'string') && !t.days.some(d => typeof d === 'number');
  return `
    <label class="job${done ? ' done' : ''}">
      <input type="checkbox" data-tick="${t.id}"${done ? ' checked' : ''}>
      <span class="job-box" aria-hidden="true"></span>
      <span class="job-main">
        <span class="job-top"><b>${esc(t.what)}</b>${w ? `<span class="job-who">${esc(w.emoji)} ${esc(w.name)}</span>` : t.who === 'house' ? '<span class="job-who">🏠 House</span>' : ''}${once ? '<span class="tag">Today only</span>' : ''}</span>
        ${t.detail ? `<span class="job-detail">${esc(t.detail)}</span>` : ''}
        <span class="job-when">${done ? `Done ${M.clockOf(done)}` : ''}</span>
      </span>
      <span class="job-time">${t.time ? M.clock(t.time) : ''}</span>
    </label>`;
}

function care(s) {
  if (!s.charges.length && !s.notes.trim()) return `<p class="empty-line">Nobody’s on this sheet yet.${s.mine ? ` <a href="#/e/${s.id}">Add them</a>.` : ''}</p>`;
  return `
    ${s.charges.map(c => {
      const routine = s.tasks.filter(t => t.who === c.id && t.what.trim()).sort((a, b) => M.SLOTS.findIndex(x => x[0] === a.slot) - M.SLOTS.findIndex(x => x[0] === b.slot) || (a.time || '99').localeCompare(b.time || '99'));
      return `
      <article class="who-card">
        <header><span class="who-emoji" aria-hidden="true">${esc(c.emoji)}</span><div><h2>${esc(c.name || M.KINDS[c.kind].name)}</h2>${c.about ? `<p>${esc(c.about)}</p>` : ''}</div></header>
        ${c.notes.filter(n => n.text.trim()).map(n => `
          <div class="fact${M.isWarning(n.label) ? ' warn' : ''}"><h3>${esc(n.label || 'Note')}</h3><p>${lines(n.text)}</p></div>`).join('')}
        ${c.cues.filter(q => q.word.trim()).length ? `
          <div class="fact"><h3>Words ${esc(c.name || 'they')} know${c.name ? 's' : ''}</h3>
            <ul class="cue-list">${c.cues.filter(q => q.word.trim()).map(q => `<li><b>“${esc(q.word)}”</b>${q.signal ? `<span>${esc(q.signal)}</span>` : q.name && q.name !== q.word ? `<span>${esc(q.name)}</span>` : ''}</li>`).join('')}</ul>
          </div>` : ''}
        ${routine.length ? `
          <div class="fact"><h3>${esc(c.name || 'Their')}’s day</h3>
            <ul class="routine">${routine.map(t => `<li><span>${t.time ? M.clock(t.time) : esc(M.SLOTS.find(x => x[0] === t.slot)[1])}</span><b>${esc(t.what)}</b>${t.days.length ? `<small>${esc(M.daysText(t))}</small>` : ''}</li>`).join('')}</ul>
          </div>` : ''}
      </article>`;
    }).join('')}
    ${s.notes.trim() ? `<article class="who-card plain"><div class="fact"><h3>Anything else</h3><p>${lines(s.notes)}</p></div></article>` : ''}`;
}

function house(s) {
  const notes = s.house.filter(h => h.text.trim());
  if (!s.wifi.name && !notes.length) return `<p class="empty-line">Nothing about the house yet.${s.mine ? ` <a href="#/e/${s.id}">Add it</a>.` : ''}</p>`;
  return `
    ${s.wifi.name ? `
      <article class="wifi">
        <h2>Wi-Fi</h2>
        <dl>
          <div><dt>Network</dt><dd>${esc(s.wifi.name)}</dd></div>
          ${s.wifi.pass ? `<div><dt>Password</dt><dd class="mono">${esc(s.wifi.pass)}</dd><button type="button" class="btn small" data-act="copy" data-v="${esc(s.wifi.pass)}">Copy</button></div>` : '<div><dt>Password</dt><dd>None</dd></div>'}
        </dl>
        <button type="button" class="link-btn" data-act="wifi-code">Show a code another phone can scan</button>
      </article>` : ''}
    ${notes.map(h => `
      <div class="fact house-fact${h.secret ? ' secret' : ''}">
        <h3>${esc(h.label || 'Note')}</h3>
        <p>${lines(h.text)}</p>
        ${h.secret ? '<button type="button" class="reveal" data-act="reveal">Tap to show</button>' : ''}
      </div>`).join('')}`;
}

function call(s) {
  const person = (role, name, phone, note, address = '', main = false) => `
    <article class="contact${main ? ' main' : ''}">
      <div class="contact-text">
        <p class="role">${esc(role)}</p>
        <h3>${esc(name || role)}</h3>
        ${phone ? `<p class="phone">${esc(phone)}</p>` : ''}
        ${note ? `<p class="note">${lines(note)}</p>` : ''}
        ${address ? `<p class="note"><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}" target="_blank" rel="noopener">${esc(address)}</a></p>` : ''}
      </div>
      ${phone ? `<div class="contact-btns"><a class="btn small primary" href="${tel(phone)}">Call</a>${main || /mobile|cell|next door|neighbor|backup/i.test(role + name) ? `<a class="btn small" href="${sms(phone)}">Text</a>` : ''}</div>` : ''}
    </article>`;
  return `
    <p class="sos">In an emergency, call <a href="tel:911"><b>911</b></a> first.</p>
    ${person(s.mine ? 'You' : 'Whose place this is', s.owner.name, s.owner.phone, s.away, '', true)}
    ${s.contacts.filter(c => c.name || c.phone).map(c => person(c.role || 'Contact', c.name, c.phone, c.note, c.address)).join('')}
    ${M.poisonLines(s).map(p => person(p.role, p.name, p.phone, p.note)).join('')}`;
}

function notesTab(s) {
  const slips = store.slips(s.id);
  return slips.length
    ? `<div class="slip-list">${slips.map(miniSlip).join('')}</div>`
    : `<p class="empty-line">${s.mine ? `Notes from ${esc(s.sitter.trim() || 'your sitter')} show up here when you open the links they send.` : `Notes you leave ${esc(s.owner.name || 'them')} are kept here too.`}</p>`;
}

