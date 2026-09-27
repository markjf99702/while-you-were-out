// The care sheet and the notes that come back: what's in them, which jobs fall on which day,
// and tidying up anything that arrives in a link. No page code, so the tests run it in Node.

export const newId = () => Math.random().toString(36).slice(2, 10);

// Who you can be looking after. Each kind suggests the notes a sitter usually needs.
export const KINDS = {
  dog: { name: 'Dog', emoji: ['🐶', '🐕', '🦮', '🐩', '🐾'], labels: ['Food', 'Treats', 'Meds', 'Walks', 'Potty', 'Sleep', 'Health', 'Don’t'] },
  cat: { name: 'Cat', emoji: ['🐱', '🐈', '🐈‍⬛', '😼'], labels: ['Food', 'Litter', 'Meds', 'Hiding spots', 'Health', 'Don’t'] },
  pet: { name: 'Other pet', emoji: ['🐰', '🐹', '🐦', '🐠', '🦎', '🐢', '🐴'], labels: ['Food', 'Water', 'Cleaning', 'Meds', 'Handling', 'Don’t'] },
  kid: { name: 'Child', emoji: ['🧒', '👧', '👦', '👶'], labels: ['Food', 'Allergies', 'Meds', 'Bedtime', 'Screens', 'Comfort', 'Don’t'] },
};

export const SLOTS = [
  ['morning', 'Morning'],
  ['midday', 'Midday'],
  ['evening', 'Evening'],
  ['bedtime', 'Bedtime'],
  ['anytime', 'Any time'],
];
const SLOT_ORDER = Object.fromEntries(SLOTS.map(([id], i) => [id, i]));

// Jobs to offer when you add someone, as [slot, time, what].
export const SUGGESTED_TASKS = {
  dog: [['morning', '07:00', 'Breakfast'], ['morning', '07:30', 'Walk'], ['midday', '12:30', 'Out to the yard'], ['evening', '18:00', 'Dinner'], ['evening', '18:30', 'Walk'], ['bedtime', '22:00', 'Last trip out']],
  cat: [['morning', '07:00', 'Breakfast'], ['evening', '18:00', 'Dinner'], ['anytime', '', 'Scoop the litter box'], ['anytime', '', 'Fresh water']],
  pet: [['morning', '', 'Food and water'], ['anytime', '', 'Check on them']],
  kid: [['morning', '07:00', 'Breakfast'], ['evening', '17:30', 'Dinner'], ['bedtime', '19:30', 'Bath'], ['bedtime', '20:00', 'Bed']],
  house: [['anytime', '', 'Bring in the mail'], ['anytime', '', 'Water the plants'], ['evening', '', 'Trash out'], ['bedtime', '', 'Lock the doors']],
};

// House notes to offer. The ones marked true are codes and keys, hidden until tapped.
export const HOUSE_LABELS = [
  ['Getting in', true], ['Alarm', true], ['Thermostat'], ['Trash & recycling'], ['Mail & packages'], ['Plants'],
  ['Water shut-off'], ['Breaker panel'], ['TV'], ['Parking'], ['Where things are'],
];

export const CONTACT_ROLES = ['Backup', 'Neighbor', 'Vet', 'Emergency vet', 'Doctor', 'Dog walker', 'Handyman'];

// Shown on the Call tab when there are pets or children on the sheet.
export const POISON = {
  pet: { role: 'Animal poison help', name: 'ASPCA Animal Poison Control', phone: '(888) 426-4435', note: 'US, 24 hours. A consultation fee may apply.' },
  kid: { role: 'Poison help', name: 'Poison Control', phone: '1-800-222-1222', note: 'US, 24 hours, free.' },
};

// The boxes on the note that comes back, like the ones on a phone-message pad.
export const MARKS = [
  ['well', 'All’s well'],
  ['call', 'Please call'],
  ['urgent', 'Urgent'],
  ['low', 'Running low'],
  ['package', 'Package came'],
  ['photos', 'Sent photos'],
];

export function blankSheet(now = Date.now()) {
  return {
    id: newId(), v: 1, created: now, updated: now, mine: true,
    title: '', from: '', to: '', sitter: '',
    owner: { name: '', phone: '' }, away: '',
    charges: [], tasks: [], wifi: { name: '', pass: '' }, house: [], contacts: [], notes: '',
  };
}

export function newCharge(kind) {
  const k = KINDS[kind] || KINDS.pet;
  return { id: newId(), kind: KINDS[kind] ? kind : 'pet', name: '', emoji: k.emoji[0], about: '', notes: [], cues: [] };
}

export const newTask = (slot = 'morning', time = '', what = '', who = '') => ({ id: newId(), slot, time, what, who, detail: '', days: [] });

// ---------- dates ----------
// Stay dates are plain calendar days (YYYY-MM-DD) in whatever time zone the phone is in.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isISO = s => typeof s === 'string' && ISO.test(s) && iso(parse(s)) === s; // Feb 30 rolls over, so it fails
export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function iso(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const weekday = s => parse(s).getDay();
export const todayISO = (now = Date.now()) => iso(new Date(now));

export const MAX_DAYS = 62;

// Every day of the stay, or [] if the dates aren't set.
export function stayDays(sheet) {
  if (!isISO(sheet.from)) return [];
  const to = isISO(sheet.to) && sheet.to >= sheet.from ? sheet.to : sheet.from;
  const out = [];
  for (let d = sheet.from; d <= to && out.length < MAX_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

// The day to open on: today during the stay, the first day before it, the last day after it.
export function defaultDay(sheet, now = Date.now()) {
  const today = todayISO(now);
  const days = stayDays(sheet);
  if (!days.length) return today;
  if (today < days[0]) return days[0];
  if (today > days[days.length - 1]) return days[days.length - 1];
  return today;
}

const byTime = (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || (a.time || '99').localeCompare(b.time || '99');

// A task's days are empty (every day), weekday numbers (0 = Sunday), or particular dates.
export const onDay = (task, day) => !task.days.length || task.days.includes(day) || task.days.includes(weekday(day));

export function tasksOn(sheet, day) {
  return sheet.tasks.filter(t => t.what.trim() && onDay(t, day)).sort(byTime);
}

export function tasksBySlot(tasks) {
  return SLOTS.map(([id, name]) => ({ id, name, tasks: tasks.filter(t => t.slot === id) })).filter(g => g.tasks.length);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function daysText(task) {
  if (!task.days.length) return 'Every day';
  const dates = task.days.filter(d => typeof d === 'string').sort();
  const wds = task.days.filter(d => typeof d === 'number').sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const parts = [];
  if (wds.length) parts.push(wds.length === 7 ? 'Every day' : wds.map(n => WD[n]).join(', '));
  if (dates.length) parts.push(dates.map(d => dayName(d, { weekday: 'short', month: 'short', day: 'numeric' })).join(', '));
  return parts.join('; ') + (dates.length && !wds.length ? ' only' : '');
}

// "Wed 30"
export const shortDay = s => `${WD[weekday(s)]} ${parse(s).getDate()}`;
export const dayName = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parse(s).toLocaleDateString('en-US', opts);

export function stayText(sheet) {
  const days = stayDays(sheet);
  if (!days.length) return '';
  const a = parse(days[0]), b = parse(days[days.length - 1]);
  const md = { month: 'short', day: 'numeric' };
  if (days.length === 1) return a.toLocaleDateString('en-US', { weekday: 'short', ...md });
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.toLocaleDateString('en-US', md)}–${b.getDate()}`;
  return `${a.toLocaleDateString('en-US', md)} – ${b.toLocaleDateString('en-US', md)}`;
}

// "7:30 AM" from "07:30".
export function clock(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return '';
  let [h, m] = hhmm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}
export const clockOf = t => { const d = new Date(t); return clock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); };

export const whoOf = (sheet, id) => sheet.charges.find(c => c.id === id);

// Poison-help lines for whoever is on the sheet.
export function poisonLines(sheet) {
  const kinds = new Set(sheet.charges.map(c => c.kind));
  const out = [];
  if (kinds.has('dog') || kinds.has('cat') || kinds.has('pet')) out.push(POISON.pet);
  if (kinds.has('kid')) out.push(POISON.kid);
  return out;
}

// Labels that deserve a second look get flagged in the sitter's view.
export const isWarning = label => /^(meds?|medicine|medication|allerg|don[’']?t|health)/i.test(label.trim());

// ---------- Wi-Fi ----------
// The text a phone camera reads from a Wi-Fi code: WIFI:T:WPA;S:name;P:password;;
export function wifiCode(wifi) {
  const e = s => String(s).replace(/([\\;,:"])/g, '\\$1');
  if (!wifi?.name) return '';
  return wifi.pass ? `WIFI:T:WPA;S:${e(wifi.name)};P:${e(wifi.pass)};;` : `WIFI:T:nopass;S:${e(wifi.name)};;`;
}

// ---------- the note that comes back ----------

export function makeSlip({ sheet, from, marks = [], done = [], msg = '', day, now = Date.now() }) {
  return cleanSlip({
    id: newId(), sheet: sheet.id, title: sheet.title, to: sheet.owner.name, from, at: now, day,
    marks, done, msg,
  });
}

// The jobs ticked on a day, as [what, who, time] for the note.
export function doneList(sheet, day, ticks) {
  return tasksOn(sheet, day).filter(t => ticks?.[t.id]).map(t => [t.what, whoOf(sheet, t.who)?.name || '', clockOf(ticks[t.id])]);
}

// ---------- cleaning up what arrives ----------
// Anything from a link or a backup goes through these, so the page only ever sees the shapes above.

const str = (x, max = 200) => (typeof x === 'string' ? x : x == null ? '' : String(x)).slice(0, max);
const idOf = x => (typeof x === 'string' && /^[a-z0-9]{1,16}$/i.test(x) ? x : newId());
const arr = (x, max) => (Array.isArray(x) ? x.slice(0, max) : []);
const time = x => (/^\d{2}:\d{2}$/.test(x || '') ? x : '');

export function cleanSheet(raw = {}) {
  const s = blankSheet();
  s.id = idOf(raw.id);
  s.created = Number(raw.created) || Date.now();
  s.updated = Number(raw.updated) || s.created;
  if (!raw.mine) delete s.mine;
  if (raw.got) s.got = { at: Number(raw.got.at) || Date.now() };
  s.title = str(raw.title, 120);
  s.from = isISO(raw.from) ? raw.from : '';
  s.to = isISO(raw.to) ? raw.to : '';
  s.sitter = str(raw.sitter, 60);
  s.owner = { name: str(raw.owner?.name, 60), phone: str(raw.owner?.phone, 40) };
  s.away = str(raw.away, 400);
  s.charges = arr(raw.charges, 12).map(c => ({
    id: idOf(c?.id),
    kind: KINDS[c?.kind] ? c.kind : 'pet',
    name: str(c?.name, 60),
    emoji: str(c?.emoji, 16),
    about: str(c?.about, 200),
    notes: arr(c?.notes, 20).map(n => ({ id: idOf(n?.id), label: str(n?.label, 40), text: str(n?.text, 1000) })),
    cues: arr(c?.cues, 60).map(q => ({ word: str(q?.word, 40), signal: str(q?.signal, 120), name: str(q?.name, 40) })),
  }));
  const ids = new Set(s.charges.map(c => c.id));
  s.tasks = arr(raw.tasks, 80).map(t => ({
    id: idOf(t?.id),
    slot: SLOT_ORDER[t?.slot] !== undefined ? t.slot : 'anytime',
    time: time(t?.time),
    what: str(t?.what, 80),
    who: ids.has(t?.who) || t?.who === 'house' ? t.who : '',
    detail: str(t?.detail, 400),
    days: arr(t?.days, 70).filter(d => (Number.isInteger(d) && d >= 0 && d <= 6) || isISO(d)),
  }));
  s.wifi = { name: str(raw.wifi?.name, 64), pass: str(raw.wifi?.pass, 64) };
  s.house = arr(raw.house, 30).map(h => ({ id: idOf(h?.id), label: str(h?.label, 40), text: str(h?.text, 1000), secret: !!h?.secret }));
  s.contacts = arr(raw.contacts, 20).map(c => ({ id: idOf(c?.id), role: str(c?.role, 40), name: str(c?.name, 80), phone: str(c?.phone, 40), address: str(c?.address, 200), note: str(c?.note, 300) }));
  s.notes = str(raw.notes, 2000);
  return s;
}

export function cleanSlip(raw = {}) {
  const marks = new Set(MARKS.map(([id]) => id));
  return {
    id: idOf(raw.id),
    sheet: typeof raw.sheet === 'string' ? raw.sheet.slice(0, 16) : '',
    title: str(raw.title, 120),
    to: str(raw.to, 60),
    from: str(raw.from, 60),
    at: Number(raw.at) || Date.now(),
    day: isISO(raw.day) ? raw.day : '',
    marks: arr(raw.marks, MARKS.length).filter(m => marks.has(m)),
    done: arr(raw.done, 40).filter(Array.isArray).map(([what, who, when]) => [str(what, 80), str(who, 60), str(when, 12)]),
    msg: str(raw.msg, 1200),
  };
}

// What goes in a link: no empty fields, and nothing that only matters on this device.
export function forLink(sheet) {
  const { mine, got, ...rest } = sheet;
  return prune(rest);
}
function prune(x) {
  if (Array.isArray(x)) return x.map(prune);
  if (x && typeof x === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(x)) {
      const p = prune(v);
      if (p === '' || p === false || (Array.isArray(p) && !p.length) || (p && typeof p === 'object' && !Array.isArray(p) && !Object.keys(p).length)) continue;
      out[k] = p;
    }
    return out;
  }
  return x;
}

// Is there enough on the sheet to send?
export function readiness(sheet) {
  const missing = [];
  if (!sheet.owner.phone.trim()) missing.push('your phone number');
  if (!sheet.charges.length && !sheet.house.length && !sheet.tasks.length) missing.push('who or what they’re looking after');
  return missing;
}

export const hasSecrets = sheet => !!sheet.wifi.pass || sheet.house.some(h => h.secret && h.text.trim());
