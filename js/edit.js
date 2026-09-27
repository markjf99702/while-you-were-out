// Making the care sheet: the basics, who you're looking after, the day, the house and who to call.
// Typing saves as you go; adding and removing things redraws the page.
import * as M from './model.js';
import { store } from './store.js';
import { app, esc, on, go, toast, sheet as openSheet } from './ui.js';
import { trickDeckDogs, bringIn } from './trickdeck.js';
import { sendSheet } from './send.js';

let current = null, timer = 0, focusNext = '';

// Saves anything typed in the last moment, before the page moves on.
export function flush() {
  if (current && timer) { clearTimeout(timer); timer = 0; store.put(current); }
}
function saveSoon() {
  const s = current;
  clearTimeout(timer);
  timer = setTimeout(() => { timer = 0; store.put(s); }, 350);
}
function saveNow() { flush(); store.put(current); }

// "charges:ab12.notes:cd34.text" → the note object and "text". ":" finds by id, "#" by position.
function target(s, path) {
  const parts = path.split('.');
  let obj = s;
  for (const p of parts.slice(0, -1)) {
    const [k, id] = p.split(':');
    const [key, idx] = k.split('#');
    obj = id !== undefined ? obj[key]?.find(x => x.id === id) : idx !== undefined ? obj[key]?.[Number(idx)] : obj[key];
    if (!obj) return [];
  }
  return [obj, parts[parts.length - 1]];
}

const field = (label, path, value, { type = 'text', ph = '', list = '', area = false, cls = '' } = {}) => `
  <label class="field ${cls}"><span>${label}</span>${area
    ? `<textarea data-b="${path}" rows="2" placeholder="${esc(ph)}">${esc(value)}</textarea>`
    : `<input type="${type}" data-b="${path}" value="${esc(value)}" placeholder="${esc(ph)}"${list ? ` list="${list}"` : ''}${type === 'tel' ? ' autocomplete="tel"' : ''}>`}</label>`;

const x = (act, id, label) => `<button type="button" class="x" data-act="${act}" data-id="${id}" aria-label="${esc(label)}">✕</button>`;

function basics(s) {
  return `
    <section class="form-card" id="basics">
      <h2 class="form-h">The basics</h2>
      ${field('What’s it for', 'title', s.title, { ph: 'Biscuit and the house' })}
      <div class="row2">
        ${field('Leaving', 'from', s.from, { type: 'date' })}
        ${field('Back', 'to', s.to, { type: 'date' })}
      </div>
      ${field('Who’s looking after things', 'sitter', s.sitter, { ph: 'Their first name (optional)' })}
      <div class="row2">
        ${field('Your name', 'owner.name', s.owner.name, { ph: 'Alex' })}
        ${field('Your phone', 'owner.phone', s.owner.phone, { type: 'tel', ph: '(555) 010-0142' })}
      </div>
      ${field('Where you’ll be', 'away', s.away, { area: true, ph: 'At my sister’s in Tucson, two hours behind. Text first.' })}
    </section>`;
}

function chargeCard(s, c) {
  const k = M.KINDS[c.kind];
  const used = new Set(c.notes.map(n => n.label.trim().toLowerCase()));
  const chips = k.labels.filter(l => !used.has(l.toLowerCase()));
  const name = c.name.trim() || `this ${k.name.toLowerCase()}`;
  const td = c.kind === 'dog' && tdDogs.find(d => d.name.toLowerCase() === c.name.trim().toLowerCase() && d.cues.some(q => !c.cues.some(h => h.word.toLowerCase() === q.word.toLowerCase())));
  return `
    <div class="charge" id="c-${c.id}">
      <div class="charge-top">
        <div class="emoji-pick" role="group" aria-label="Picture">
          ${k.emoji.map(e => `<button type="button" data-act="emoji" data-id="${c.id}" data-v="${e}" aria-pressed="${e === c.emoji}">${e}</button>`).join('')}
        </div>
        ${x('del-charge', c.id, `Take ${name} off the sheet`)}
      </div>
      ${field(`${k.name}’s name`, `charges:${c.id}.name`, c.name, { ph: c.kind === 'kid' ? 'Maya' : c.kind === 'cat' ? 'Olive' : c.kind === 'dog' ? 'Biscuit' : 'Pickles' })}
      ${field('About', `charges:${c.id}.about`, c.about, { ph: c.kind === 'kid' ? '7, loves dinosaurs, asleep by 8' : 'Age, breed, weight, temperament' })}
      <div class="notes">
        ${c.notes.map(n => `
          <div class="note-row">
            <input class="note-label" data-b="charges:${c.id}.notes:${n.id}.label" value="${esc(n.label)}" placeholder="Label" list="labels-${c.kind}" aria-label="Label">
            <textarea data-b="charges:${c.id}.notes:${n.id}.text" rows="2" placeholder="${esc(hint(n.label, c))}" aria-label="${esc(n.label || 'Note')}">${esc(n.text)}</textarea>
            ${x('del-note', `${c.id}.${n.id}`, `Remove ${n.label || 'this note'}`)}
          </div>`).join('')}
      </div>
      <div class="chips">
        ${chips.map(l => `<button type="button" class="chip" data-act="add-note" data-id="${c.id}" data-v="${esc(l)}">+ ${esc(l)}</button>`).join('')}
        <button type="button" class="chip" data-act="add-note" data-id="${c.id}" data-v="">+ Something else</button>
      </div>
      ${c.kind === 'dog' ? `
        <div class="cues">
          <h3 class="mini-h">Words ${esc(c.name.trim() || 'they')} know${c.name.trim() ? 's' : ''}</h3>
          ${c.cues.map((q, i) => `
            <div class="cue-row">
              <input data-b="charges:${c.id}.cues#${i}.word" value="${esc(q.word)}" placeholder="Sit" aria-label="Word">
              <input data-b="charges:${c.id}.cues#${i}.signal" value="${esc(q.signal)}" placeholder="Hand signal or what it means" aria-label="Hand signal">
              ${x('del-cue', `${c.id}.${i}`, `Remove ${q.word || 'this word'}`)}
            </div>`).join('')}
          <div class="chips">
            <button type="button" class="chip" data-act="add-cue" data-id="${c.id}">+ A word</button>
            ${td ? `<button type="button" class="chip td" data-act="td-words" data-id="${td.id}">Bring in ${esc(td.name)}’s words from Trick Deck</button>` : ''}
          </div>
        </div>` : ''}
    </div>`;
}

const HINTS = {
  food: 'What, how much and when. Where it’s kept.', treats: 'How many, and anything they mustn’t have.', meds: 'What, how much, when, and how to give it.',
  walks: 'How long, which leash or harness, anything to watch for.', potty: 'When and where.', litter: 'How often, and where the bags are.',
  'don’t': 'Anything they must not do or have.', allergies: 'What, and what to do if it happens.', bedtime: 'The routine, lights, and what helps.',
  screens: 'How much, and which shows or games.', comfort: 'The blanket, the song, the stuffed animal.', health: 'Anything to keep an eye on.',
};
const hint = (label, c) => HINTS[label.trim().toLowerCase()] || (c.kind === 'kid' ? 'What they need to know' : 'What to know');

function who(s) {
  const onSheet = new Set(s.charges.filter(c => c.kind === 'dog').map(c => c.name.trim().toLowerCase()));
  const fromTD = tdDogs.filter(d => !onSheet.has(d.name.toLowerCase()));
  return `
    <section class="form-card" id="who">
      <h2 class="form-h">Who you’re looking after</h2>
      ${s.charges.map(c => chargeCard(s, c)).join('')}
      <div class="add-row">
        ${Object.entries(M.KINDS).map(([k, v]) => `<button type="button" class="btn small" data-act="add-charge" data-v="${k}">${v.emoji[0]} Add a ${v.name.toLowerCase()}</button>`).join('')}
      </div>
      ${fromTD.length ? `<div class="chips td-row"><span>From Trick Deck:</span>${fromTD.map(d => `<button type="button" class="chip td" data-act="td-dog" data-id="${d.id}">${esc(d.emoji)} ${esc(d.name)}</button>`).join('')}</div>` : ''}
    </section>`;
}

function whoName(s, t) {
  if (t.who === 'house') return 'House';
  return M.whoOf(s, t.who)?.name || '';
}

function taskLine(s, t) {
  const w = M.whoOf(s, t.who);
  return `
    <button type="button" class="task-line" data-act="task" data-id="${t.id}">
      <span class="tl-time">${t.time ? M.clock(t.time) : ''}</span>
      <span class="tl-what"><b>${esc(t.what || 'Untitled job')}</b>${t.who ? ` <span class="tl-who">${w ? esc(w.emoji) + ' ' : '🏠 '}${esc(whoName(s, t))}</span>` : ''}
        <small>${esc(M.daysText(t))}${t.detail ? ` · ${esc(t.detail)}` : ''}</small></span>
      <span class="tl-edit" aria-hidden="true">Edit</span>
    </button>`;
}

function suggestions(s) {
  const have = new Set(s.tasks.map(t => `${t.who}|${t.what.trim().toLowerCase()}`));
  const out = [];
  for (const c of s.charges) {
    for (const [slot, time, what] of M.SUGGESTED_TASKS[c.kind]) {
      if (!have.has(`${c.id}|${what.toLowerCase()}`)) out.push({ slot, time, what, who: c.id, label: `${c.emoji} ${c.name.trim() || M.KINDS[c.kind].name}: ${what}` });
    }
  }
  for (const [slot, time, what] of M.SUGGESTED_TASKS.house) {
    if (!have.has(`house|${what.toLowerCase()}`)) out.push({ slot, time, what, who: 'house', label: `🏠 ${what}` });
  }
  return out;
}

function day(s) {
  const sug = suggestions(s);
  const groups = M.tasksBySlot(s.tasks.filter(t => t.what.trim()));
  return `
    <section class="form-card" id="day">
      <h2 class="form-h">The day</h2>
      <p class="hint">What needs doing and when. Your sitter gets a checklist for each day of the stay.</p>
      ${groups.length ? groups.map(g => `<h3 class="mini-h">${g.name}</h3><div class="task-lines">${g.tasks.map(t => taskLine(s, t)).join('')}</div>`).join('') : '<p class="empty-line">Nothing yet. Tap a suggestion or add a job.</p>'}
      ${sug.length ? `<div class="chips sug">${sug.slice(0, 12).map((g, i) => `<button type="button" class="chip" data-act="sug" data-v="${i}">+ ${esc(g.label)}</button>`).join('')}</div>` : ''}
      <button type="button" class="btn small" data-act="task" data-id="">Add a job</button>
    </section>`;
}

function house(s) {
  const used = new Set(s.house.map(h => h.label.trim().toLowerCase()));
  return `
    <section class="form-card" id="house">
      <h2 class="form-h">The house</h2>
      <div class="row2">
        ${field('Wi-Fi network', 'wifi.name', s.wifi.name, { ph: 'Maple House' })}
        ${field('Wi-Fi password', 'wifi.pass', s.wifi.pass, { ph: 'Leave blank if there isn’t one' })}
      </div>
      <div class="notes">
        ${s.house.map(h => `
          <div class="note-row">
            <input class="note-label" data-b="house:${h.id}.label" value="${esc(h.label)}" placeholder="Label" list="labels-house" aria-label="Label">
            <textarea data-b="house:${h.id}.text" rows="2" placeholder="What to know" aria-label="${esc(h.label || 'Note')}">${esc(h.text)}</textarea>
            ${x('del-house', h.id, `Remove ${h.label || 'this note'}`)}
            <label class="check"><input type="checkbox" data-b="house:${h.id}.secret"${h.secret ? ' checked' : ''}> Hide until tapped</label>
          </div>`).join('')}
      </div>
      <div class="chips">
        ${M.HOUSE_LABELS.filter(([l]) => !used.has(l.toLowerCase())).map(([l]) => `<button type="button" class="chip" data-act="add-house" data-v="${esc(l)}">+ ${esc(l)}</button>`).join('')}
        <button type="button" class="chip" data-act="add-house" data-v="">+ Something else</button>
      </div>
    </section>`;
}

function contacts(s) {
  const used = new Set(s.contacts.map(c => c.role.trim().toLowerCase()));
  const poison = M.poisonLines(s);
  return `
    <section class="form-card" id="call">
      <h2 class="form-h">Who to call</h2>
      <p class="hint">You’re at the top of the list already. Add whoever else can help.</p>
      ${s.contacts.map(c => `
        <div class="contact-edit">
          ${field('Name', `contacts:${c.id}.name`, c.name, { ph: 'Dana next door', cls: 'first' })}
          <div class="row2">
            ${field('Who', `contacts:${c.id}.role`, c.role, { list: 'roles', ph: 'Neighbor' })}
            ${field('Phone', `contacts:${c.id}.phone`, c.phone, { type: 'tel', ph: '(555) 010-0163' })}
          </div>
          ${field('Address', `contacts:${c.id}.address`, c.address, { ph: 'For directions (optional)' })}
          ${field('Note', `contacts:${c.id}.note`, c.note, { ph: 'Has a spare key' })}
          ${x('del-contact', c.id, `Remove ${c.name || c.role || 'this contact'}`)}
        </div>`).join('')}
      <div class="chips">
        ${M.CONTACT_ROLES.filter(r => !used.has(r.toLowerCase())).map(r => `<button type="button" class="chip" data-act="add-contact" data-v="${esc(r)}">+ ${esc(r)}</button>`).join('')}
        <button type="button" class="chip" data-act="add-contact" data-v="">+ Someone else</button>
      </div>
      ${poison.length ? `<p class="hint">The sheet also lists ${poison.map(p => `${esc(p.name)} at ${esc(p.phone)}`).join(' and ')}, and says to call 911 in an emergency.</p>` : '<p class="hint">The sheet also says to call 911 in an emergency.</p>'}
    </section>`;
}

let tdDogs = [];

function draw(s) {
  document.title = `${s.title || 'New care sheet'} · While You Were Out`;
  tdDogs = trickDeckDogs();
  app.innerHTML = `
    <div class="page-head">
      <p class="kicker"><a href="#/">While You Were Out</a> · Care sheet</p>
      <h1 id="etitle">${esc(s.title || 'New care sheet')}</h1>
    </div>
    ${basics(s)}
    ${who(s)}
    ${day(s)}
    ${house(s)}
    ${contacts(s)}
    <section class="form-card" id="else">
      <h2 class="form-h">Anything else</h2>
      ${field('Anything else they should know', 'notes', s.notes, { area: true, ph: 'Help yourself to anything in the fridge.' })}
    </section>
    <p class="danger-line"><button type="button" class="link-btn danger" data-act="delete">Delete this sheet</button></p>
    <div class="next-bar">
      <a class="btn" href="#/v/${s.id}/today">Preview</a>
      <button type="button" class="btn primary" data-act="send">Send to ${esc(s.sitter.trim() || 'your sitter')}</button>
    </div>
    <datalist id="labels-house">${M.HOUSE_LABELS.map(([l]) => `<option value="${esc(l)}">`).join('')}</datalist>
    <datalist id="roles">${M.CONTACT_ROLES.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
    ${Object.entries(M.KINDS).map(([k, v]) => `<datalist id="labels-${k}">${v.labels.map(l => `<option value="${esc(l)}">`).join('')}</datalist>`).join('')}`;
  app.querySelectorAll('textarea').forEach(fit);
  if (focusNext) {
    const el = app.querySelector(focusNext);
    focusNext = '';
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
}

function redraw() { saveNow(); draw(current); }

// Text boxes grow to fit what's in them. Newer browsers do this from the CSS alone.
const grows = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');
function fit(el) {
  if (grows || el.tagName !== 'TEXTAREA') return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 3}px`;
}

export function edit(s) {
  current = s;
  draw(s);
  const input = e => {
    const path = e.target.dataset.b;
    if (!path) return;
    const [obj, key] = target(current, path);
    if (!obj) return;
    obj[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    fit(e.target);
    if (path === 'title') document.getElementById('etitle').textContent = e.target.value || 'New care sheet';
    saveSoon();
  };
  on({
    input,
    change(e) {
      const path = e.target.dataset.b;
      if (!path) return;
      input(e);
      // Names show up elsewhere on the page. Catch those parts up without redrawing the field you're in.
      if (path === 'sitter') app.querySelector('[data-act="send"]').textContent = `Send to ${current.sitter.trim() || 'your sitter'}`;
      const m = path.match(/^charges:(\w+)\.name$/);
      if (m) {
        const c = current.charges.find(c => c.id === m[1]);
        const h = app.querySelector(`#c-${c.id} .cues .mini-h`);
        if (h) h.textContent = `Words ${c.name.trim() || 'they'} know${c.name.trim() ? 's' : ''}`;
        app.querySelector('#day').outerHTML = day(current);
      }
    },
    click(e) {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const { act, id = '', v = '' } = b.dataset;
      const s = current;
      if (act === 'add-charge') {
        const c = M.newCharge(v);
        s.charges.push(c);
        focusNext = `#c-${c.id} input[data-b$=".name"]`;
        redraw();
      } else if (act === 'del-charge') {
        const c = s.charges.find(c => c.id === id);
        const i = s.charges.indexOf(c);
        const tasks = s.tasks.filter(t => t.who === id);
        s.charges.splice(i, 1);
        s.tasks = s.tasks.filter(t => t.who !== id);
        redraw();
        toast(`Took ${c.name || 'them'} off the sheet`, { label: 'Undo', run: () => { s.charges.splice(i, 0, c); s.tasks.push(...tasks); redraw(); } });
      } else if (act === 'emoji') {
        s.charges.find(c => c.id === id).emoji = v;
        redraw();
      } else if (act === 'add-note') {
        const c = s.charges.find(c => c.id === id);
        const n = { id: M.newId(), label: v, text: '' };
        c.notes.push(n);
        focusNext = `[data-b="charges:${c.id}.notes:${n.id}.${v ? 'text' : 'label'}"]`;
        redraw();
      } else if (act === 'del-note') {
        const [cid, nid] = id.split('.');
        const c = s.charges.find(c => c.id === cid);
        c.notes = c.notes.filter(n => n.id !== nid);
        redraw();
      } else if (act === 'add-cue') {
        const c = s.charges.find(c => c.id === id);
        c.cues.push({ word: '', signal: '', name: '' });
        focusNext = `[data-b="charges:${c.id}.cues#${c.cues.length - 1}.word"]`;
        redraw();
      } else if (act === 'del-cue') {
        const [cid, i] = id.split('.');
        s.charges.find(c => c.id === cid).cues.splice(Number(i), 1);
        redraw();
      } else if (act === 'td-dog' || act === 'td-words') {
        const dog = tdDogs.find(d => d.id === id);
        const { charge, added } = bringIn(s, dog);
        redraw();
        toast(act === 'td-dog' ? `Brought in ${charge.name} with ${added} word${added === 1 ? '' : 's'}` : `Added ${added} word${added === 1 ? '' : 's'} from Trick Deck`);
      } else if (act === 'sug') {
        const g = suggestions(s)[Number(v)];
        if (!g) return;
        s.tasks.push(M.newTask(g.slot, g.time, g.what, g.who));
        redraw();
        toast(`Added ${g.what}`);
      } else if (act === 'task') {
        editTask(s, id);
      } else if (act === 'add-house') {
        const h = { id: M.newId(), label: v, text: '', secret: !!M.HOUSE_LABELS.find(([l]) => l === v)?.[1] };
        s.house.push(h);
        focusNext = `[data-b="house:${h.id}.${v ? 'text' : 'label'}"]`;
        redraw();
      } else if (act === 'del-house') {
        s.house = s.house.filter(h => h.id !== id);
        redraw();
      } else if (act === 'add-contact') {
        const c = { id: M.newId(), role: v, name: '', phone: '', address: '', note: '' };
        s.contacts.push(c);
        focusNext = `[data-b="contacts:${c.id}.${v ? 'name' : 'role'}"]`;
        redraw();
      } else if (act === 'del-contact') {
        s.contacts = s.contacts.filter(c => c.id !== id);
        redraw();
      } else if (act === 'send') {
        saveNow();
        sendSheet(s);
      } else if (act === 'delete') {
        flush();
        const undo = store.remove(s.id);
        current = null;
        go('/');
        toast(`Deleted “${s.title || 'New care sheet'}”`, { label: 'Undo', run: () => { undo(); go(`/e/${s.id}`); } });
      }
    },
  });
}

// A job, in the sheet that slides up: what, for whom, when, and which days.
function editTask(s, id) {
  const orig = s.tasks.find(t => t.id === id);
  const t = orig ? structuredClone(orig) : M.newTask('morning');
  const stay = M.stayDays(s);
  const WD = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']];
  const WDN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const drawDays = () => `
    <button type="button" class="day-chip every" data-day="every" aria-pressed="${!t.days.length}">Every day</button>
    ${WD.map(([n, l]) => `<button type="button" class="day-chip" data-day="${n}" aria-pressed="${t.days.includes(n)}" aria-label="${WDN[n]}">${l}</button>`).join('')}
    ${stay.length && stay.length <= 21 ? `<div class="date-chips">${stay.map(d => `<button type="button" class="day-chip date" data-day="${d}" aria-pressed="${t.days.includes(d)}">${esc(M.shortDay(d))}</button>`).join('')}</div>`
      : `<label class="field inline"><span>Or on a date</span><input type="date" id="tDate"></label>
         ${t.days.filter(d => typeof d === 'string').map(d => `<button type="button" class="day-chip date" data-day="${d}" aria-pressed="true">${esc(M.dayName(d))} ✕</button>`).join('')}`}`;
  openSheet(`
    <h2>${orig ? 'Edit the job' : 'Add a job'}</h2>
    <label class="field"><span>What</span><input id="tWhat" value="${esc(t.what)}" placeholder="Breakfast"></label>
    <div class="row2">
      <label class="field"><span>For</span><select id="tWho">
        <option value="">Everyone</option>
        ${s.charges.map(c => `<option value="${c.id}"${t.who === c.id ? ' selected' : ''}>${esc(c.emoji)} ${esc(c.name || M.KINDS[c.kind].name)}</option>`).join('')}
        <option value="house"${t.who === 'house' ? ' selected' : ''}>🏠 The house</option>
      </select></label>
      <label class="field"><span>Time (optional)</span><input type="time" id="tTime" value="${esc(t.time)}"></label>
    </div>
    <div class="field"><span>When in the day</span><div class="seg" id="tSlot">${M.SLOTS.map(([k, n]) => `<button type="button" data-slot="${k}" aria-pressed="${t.slot === k}">${n}</button>`).join('')}</div></div>
    <div class="field"><span>Which days</span><div class="days" id="tDays">${drawDays()}</div></div>
    <label class="field"><span>Details (optional)</span><textarea id="tDetail" rows="2" placeholder="1 cup kibble and warm water">${esc(t.detail)}</textarea></label>
    <div class="sheet-actions">
      <button type="button" class="btn primary" id="tSave">${orig ? 'Done' : 'Add it'}</button>
      ${orig ? '<button type="button" class="btn danger-btn" id="tDel">Remove</button>' : '<button type="button" class="btn" data-close>Cancel</button>'}
    </div>`,
  (body, close) => {
    const $ = sel => body.querySelector(sel);
    const days = $('#tDays');
    const bindDays = () => {
      days.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
        const d = b.dataset.day;
        if (d === 'every') t.days = [];
        else {
          const val = /^\d$/.test(d) ? Number(d) : d;
          t.days = t.days.includes(val) ? t.days.filter(x => x !== val) : [...t.days, val];
        }
        days.innerHTML = drawDays();
        bindDays();
      });
      const date = days.querySelector('#tDate');
      if (date) date.onchange = () => { if (M.isISO(date.value) && !t.days.includes(date.value)) { t.days.push(date.value); days.innerHTML = drawDays(); bindDays(); } };
    };
    bindDays();
    $('#tSlot').onclick = e => {
      const b = e.target.closest('[data-slot]');
      if (!b) return;
      t.slot = b.dataset.slot;
      $('#tSlot').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    };
    // A time picks its part of the day, unless you've said otherwise.
    $('#tTime').onchange = () => {
      const h = Number(($('#tTime').value || '').split(':')[0]);
      if (!$('#tTime').value) return;
      t.slot = h < 11 ? 'morning' : h < 15 ? 'midday' : h < 20 ? 'evening' : 'bedtime';
      $('#tSlot').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.slot === t.slot));
    };
    $('#tSave').onclick = () => {
      t.what = $('#tWhat').value.trim().slice(0, 80);
      t.who = $('#tWho').value;
      t.time = $('#tTime').value;
      t.detail = $('#tDetail').value.trim().slice(0, 400);
      if (!t.what) { $('#tWhat').focus(); return toast('Say what the job is'); }
      if (orig) Object.assign(orig, t); else s.tasks.push(t);
      close();
      redraw();
    };
    if (orig) $('#tDel').onclick = () => {
      const i = s.tasks.indexOf(orig);
      s.tasks.splice(i, 1);
      close();
      redraw();
      toast(`Removed ${orig.what}`, { label: 'Undo', run: () => { s.tasks.splice(i, 0, orig); redraw(); } });
    };
    if (!orig) setTimeout(() => $('#tWhat').focus(), 50);
  });
}
