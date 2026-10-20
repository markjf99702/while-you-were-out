// Saving in the browser: a damaged save, deleting, and backups.
//   node --test test/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';

// A stand-in for the browser's localStorage, in place before the store first reads it.
const disk = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: k => disk.get(k) ?? null, setItem: (k, v) => disk.set(k, String(v)) },
});
const { store } = await import('../js/store.js');
const saved = () => JSON.parse(disk.get(store.key));
// What another tab (or an older copy of the page) left in storage, picked up the way a storage event does.
const left = data => { disk.set(store.key, JSON.stringify({ ticks: {}, slips: [], name: '', ...data })); store.reload(); };
const sheet = title => ({ ...M.blankSheet(), title });
const titles = list => list.map(s => s.title).sort();

test('one damaged entry in the save hides nothing else, and the next save keeps the rest', () => {
  const good = sheet('Biscuit and the house');
  left({ sheets: [null, good, 'junk', [1, 2]], slips: [null, { id: 'n1', sheet: good.id, from: 'Jess', msg: 'All good' }] });
  assert.deepEqual(titles(store.mine()), ['Biscuit and the house']);
  assert.equal(store.slips(good.id).length, 1);
  store.put(sheet('New one'));
  assert.deepEqual(titles(saved().sheets), ['Biscuit and the house', 'New one']);
});

test('deleting a sheet another tab already deleted leaves nothing to undo', () => {
  const a = sheet('A'), b = sheet('B');
  left({ sheets: [a, b] });
  left({ sheets: [b] }); // the other tab deleted A, and this one caught up
  assert.equal(store.remove(a.id), null);
  assert.deepEqual(titles(saved().sheets), ['B']);
  const undo = store.remove(b.id);
  assert.deepEqual(store.mine(), []);
  undo();
  assert.deepEqual(titles(store.mine()), ['B']);
});

test('a backup with a damaged entry loads the rest, and a file that isn’t one changes nothing', () => {
  left({ sheets: [sheet('Already here')] });
  const b1 = sheet('From backup 1'), b2 = sheet('From backup 2');
  const loaded = store.restore(JSON.stringify({
    app: 'while-you-were-out', version: 1,
    sheets: [b1, null, b2],
    ticks: { [b1.id]: { '2026-10-13': { t1: 1 }, '2026-10-14': null }, gone: 'junk' },
    slips: [null, { id: 'n2', sheet: b1.id, from: 'Jess', msg: 'Hi' }],
  }));
  assert.deepEqual(loaded, { sheets: 2, notes: 1, changed: true });
  assert.deepEqual(titles(saved().sheets), ['Already here', 'From backup 1', 'From backup 2']);
  assert.deepEqual(store.ticks(b1.id, '2026-10-13'), { t1: 1 });
  assert.equal(store.slips(b1.id).length, 1);
  assert.throws(() => store.restore(JSON.stringify({ app: 'something-else', sheets: [] })), /isn’t a While You Were Out backup/);
  assert.throws(() => store.restore('not a backup'), /isn’t a While You Were Out backup/);
  assert.deepEqual(titles(store.mine()), ['Already here', 'From backup 1', 'From backup 2']);
});

test('a sheet that arrives again unchanged isn’t an update', () => {
  left({ sheets: [] });
  const { mine, ...theirs } = { ...sheet('From Alex'), updated: 1000 };
  assert.equal(store.receive(structuredClone(theirs)).status, 'new');
  assert.equal(store.receive(structuredClone(theirs)).status, 'same');
  assert.equal(store.receive({ ...structuredClone(theirs), updated: 2000, title: 'Newer' }).status, 'updated');
  assert.equal(store.receive(structuredClone(theirs)).status, 'older');
  assert.equal(store.get(theirs.id).title, 'Newer');
});

test('a backup counts the notes it brings back as well as sheets, and ticks come in without being counted', () => {
  const a = sheet('Biscuit and the house');
  left({ sheets: [a], slips: [{ id: 'n1', sheet: a.id, from: 'Jess', msg: 'All good' }] });
  const backup = JSON.parse(store.backup());
  backup.slips.push({ id: 'n2', sheet: a.id, from: 'Jess', msg: 'Fed' }, { id: 'n3', sheet: a.id, from: 'Jess', msg: 'Walked' });
  assert.deepEqual(store.restore(JSON.stringify(backup)), { sheets: 0, notes: 2, changed: true });
  assert.equal(store.slips(a.id).length, 3);
  assert.deepEqual(store.restore(JSON.stringify(backup)), { sheets: 0, notes: 0, changed: false }, 'the same backup again brings nothing');
  backup.ticks = { [a.id]: { '2026-10-13': { t1: 5 } } };
  assert.deepEqual(store.restore(JSON.stringify(backup)), { sheets: 0, notes: 0, changed: true });
  assert.deepEqual(store.ticks(a.id, '2026-10-13'), { t1: 5 });
  assert.equal(store.restore(JSON.stringify(backup)).changed, false, 'ticks already here aren’t new');
});
