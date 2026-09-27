// Saves sheets, ticks and notes in this browser. Nothing leaves the device unless you send a link or save a backup.
import { cleanSheet, cleanSlip } from './model.js';

const KEY = 'while-you-were-out';

function blank() { return { sheets: [], ticks: {}, slips: [], name: '' }; }

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && Array.isArray(data.sheets)) {
      return {
        sheets: data.sheets.map(s => cleanSheet(s)),
        ticks: data.ticks && typeof data.ticks === 'object' ? data.ticks : {},
        slips: Array.isArray(data.slips) ? data.slips.map(s => ({ ...cleanSlip(s), dir: s.dir === 'out' ? 'out' : 'in', read: !!s.read })) : [],
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
  remove(id) {
    const sheet = store.get(id);
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
    sheet.got = { at: Date.now() };
    store.put(sheet, { touch: false });
    return { sheet, status: have ? 'updated' : 'new' };
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
  restore(text) {
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data?.app !== 'while-you-were-out' || !Array.isArray(data.sheets)) throw new Error('That file isn’t a While You Were Out backup.');
    let added = 0;
    for (const raw of data.sheets) {
      const s = cleanSheet(raw);
      const have = store.get(s.id);
      if (!have) { state.sheets.push(s); added++; } else if (s.updated > have.updated) { Object.assign(have, s); added++; }
    }
    for (const [id, days] of Object.entries(data.ticks || {})) {
      for (const [day, t] of Object.entries(days || {})) Object.assign(((state.ticks[id] ||= {})[day] ||= {}), t);
    }
    for (const raw of data.slips || []) {
      if (!state.slips.some(s => s.id === raw.id)) state.slips.push({ ...cleanSlip(raw), dir: raw.dir === 'out' ? 'out' : 'in', read: !!raw.read });
    }
    if (!state.name && data.name) state.name = String(data.name).slice(0, 60);
    write();
    return added;
  },
};
