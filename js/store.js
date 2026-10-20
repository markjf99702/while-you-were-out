// Saves sheets, ticks and notes in this browser. Nothing leaves the device unless you send a link or save a backup.
import { cleanSheet, cleanSlip } from './model.js';

const KEY = 'while-you-were-out';

function blank() { return { sheets: [], ticks: {}, slips: [], name: '' }; }

// One damaged entry is left out rather than losing everything else with it (the next save would write the loss).
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const sheetsIn = list => (Array.isArray(list) ? list.filter(isObj).map(s => cleanSheet(s)) : []);
const slipsIn = list => (Array.isArray(list) ? list.filter(isObj).map(s => ({ ...cleanSlip(s), dir: s.dir === 'out' ? 'out' : 'in', read: !!s.read })) : []);

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.sheets)) {
      return {
        sheets: sheetsIn(data.sheets),
        ticks: isObj(data.ticks) ? data.ticks : {},
        slips: slipsIn(data.slips),
        name: typeof data.name === 'string' ? data.name.slice(0, 60) : '',
      };
    }
  } catch { /* private window, blocked storage or bad data: start empty */ }
  return blank();
}

let state = read();
let saving = false;

function write() {
  saving = true;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* can't save here; it still works for this visit */ }
  saving = false;
}

const newest = (a, b) => (b.updated || 0) - (a.updated || 0);

export const store = {
  key: KEY,
  // Another tab saved: pick up its copy.
  reload() { if (!saving) state = read(); },

  mine: () => state.sheets.filter(s => s.mine).sort(newest),
  minding: () => state.sheets.filter(s => !s.mine).sort(newest),
  get: id => state.sheets.find(s => s.id === id),
  put(sheet, { touch = true } = {}) {
    if (touch) sheet.updated = Date.now();
    const i = state.sheets.findIndex(s => s.id === sheet.id);
    if (i >= 0) state.sheets[i] = sheet; else state.sheets.push(sheet);
    write();
  },
  // Returns an undo, or null if the sheet wasn't here (another tab may have deleted it already).
  remove(id) {
    const sheet = store.get(id);
    if (!sheet) return null;
    const ticks = state.ticks[id];
    const slips = state.slips.filter(s => s.sheet === id);
    state.sheets = state.sheets.filter(s => s.id !== id);
    delete state.ticks[id];
    state.slips = state.slips.filter(s => s.sheet !== id);
    write();
    return () => { // undo
      state.sheets.push(sheet);
      if (ticks) state.ticks[id] = ticks;
      state.slips.push(...slips);
      write();
    };
  },

  // A sheet that came in a link. A copy already here is replaced only by a newer one.
  receive(sheet) {
    const have = store.get(sheet.id);
    if (have?.mine) return { sheet: have, status: 'mine' };
    if (have && (have.updated || 0) > (sheet.updated || 0)) return { sheet: have, status: 'older' };
    if (have && (have.updated || 0) === (sheet.updated || 0)) return { sheet: have, status: 'same' }; // the same link again
    sheet.got = { at: Date.now() };
    if (have?.got?.intro) sheet.got.intro = 1; // Got it, said to the earlier copy, still stands
    store.put(sheet, { touch: false });
    return { sheet, status: have ? 'updated' : 'new' };
  },

  // The sitter said Got it to the note at the top of their copy. It stays said on this device. It isn't an edit,
  // so the sheet keeps the time its owner sent it with, which is what says which of two links is newer.
  gotIt(id) {
    const s = store.get(id);
    if (!s) return;
    s.got = { ...s.got, intro: 1 };
    write();
  },

  // Ticks: sheet id → day → task id → when it was ticked.
  ticks: (id, day) => state.ticks[id]?.[day] || {},
  tick(id, day, taskId, on, at = Date.now()) {
    const days = (state.ticks[id] ||= {});
    const t = (days[day] ||= {});
    if (on) t[taskId] = at; else delete t[taskId];
    write();
  },

  slips: sheetId => state.slips.filter(s => !sheetId || s.sheet === sheetId).sort((a, b) => b.at - a.at),
  slip: id => state.slips.find(s => s.id === id),
  addSlip(slip, dir) {
    const have = state.slips.find(s => s.id === slip.id);
    if (have) return have;
    const s = { ...slip, dir, read: dir === 'out' };
    state.slips.push(s);
    write();
    return s;
  },
  markRead(id) {
    const s = store.slip(id);
    if (s && !s.read) { s.read = true; write(); }
  },
  unread: sheetId => state.slips.filter(s => s.dir === 'in' && !s.read && (!sheetId || s.sheet === sheetId)).length,

  get name() { return state.name; },
  set name(v) { state.name = String(v || '').slice(0, 60); write(); },

  backup: () => JSON.stringify({ app: 'while-you-were-out', version: 1, saved: new Date().toISOString(), ...state }, null, 1),
  // Adds what's in a backup; a sheet already here is replaced if the backup's copy is newer.
  // Returns how many sheets and notes it brought, and whether anything at all changed (ticks and your name count there).
  restore(text) {
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data?.app !== 'while-you-were-out' || !Array.isArray(data.sheets)) throw new Error('That file isn’t a While You Were Out backup.');
    // Tidy all of it before adding any, so a damaged entry is skipped instead of stopping halfway.
    const sheets = sheetsIn(data.sheets), slips = slipsIn(data.slips);
    const loaded = { sheets: 0, notes: 0, changed: false };
    for (const s of sheets) {
      const have = store.get(s.id);
      if (!have) { state.sheets.push(s); loaded.sheets++; } else if (s.updated > have.updated) {
        if (have.got?.intro) s.got = { ...s.got, intro: 1 }; // Got it, said here, still stands
        Object.assign(have, s);
        loaded.sheets++;
      }
    }
    for (const [id, days] of Object.entries(isObj(data.ticks) ? data.ticks : {})) {
      if (!isObj(days)) continue;
      for (const [day, t] of Object.entries(days)) {
        if (!isObj(t)) continue;
        const have = ((state.ticks[id] ||= {})[day] ||= {});
        for (const [task, at] of Object.entries(t)) if (have[task] !== at) { have[task] = at; loaded.changed = true; }
      }
    }
    for (const s of slips) {
      if (!state.slips.some(x => x.id === s.id)) { state.slips.push(s); loaded.notes++; }
    }
    if (!state.name && data.name) { state.name = String(data.name).slice(0, 60); loaded.changed = true; }
    if (loaded.sheets || loaded.notes) loaded.changed = true;
    write();
    return loaded;
  },
};
