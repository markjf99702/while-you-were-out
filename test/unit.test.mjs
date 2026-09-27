// The parts with no page: days and jobs, links both ways, cleaning up what arrives, and Trick Deck.
//   node --test test/unit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { pack, unpack, sheetLink, slipLink, readSheet, readSlip, base, SITE } from '../js/share.js';
import { makeExample, exampleSlip } from '../js/example.js';
import { trickDeckDogs, bringIn } from '../js/trickdeck.js';
import { CUES } from '../js/cues.js';

const noon = (s) => new Date(`${s}T12:00:00`).getTime();

test('the stay runs from the first day to the last, inclusive', () => {
  const s = { ...M.blankSheet(), from: '2026-10-30', to: '2026-11-02' };
  assert.deepEqual(M.stayDays(s), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(M.stayDays({ ...s, to: '' }), ['2026-10-30']);
  assert.deepEqual(M.stayDays({ ...s, to: '2026-10-01' }), ['2026-10-30'], 'a return before leaving counts as one day');
  assert.deepEqual(M.stayDays({ ...s, from: '' }), []);
  assert.equal(M.stayDays({ ...s, to: '2027-12-31' }).length, M.MAX_DAYS);
  // Across the clocks going back (US, Nov 1 2026) there's still one entry per day.
  assert.equal(new Set(M.stayDays(s)).size, 4);
});

test('it opens on today during the stay, and the nearest end otherwise', () => {
  const s = { ...M.blankSheet(), from: '2026-10-03', to: '2026-10-06' };
  assert.equal(M.defaultDay(s, noon('2026-10-05')), '2026-10-05');
  assert.equal(M.defaultDay(s, noon('2026-09-20')), '2026-10-03');
  assert.equal(M.defaultDay(s, noon('2026-10-20')), '2026-10-06');
  assert.equal(M.defaultDay({ ...s, from: '' }, noon('2026-10-20')), '2026-10-20');
});

test('jobs fall on every day, on weekdays, or on dates, in the order of the day', () => {
  const s = M.blankSheet();
  const t = (slot, time, what, days = []) => ({ ...M.newTask(slot, time, what), days });
  s.tasks = [
    t('evening', '18:00', 'Dinner'),
    t('morning', '07:30', 'Walk'),
    t('morning', '07:00', 'Breakfast'),
    t('anytime', '', 'Mail', [1, 2, 3, 4, 5]),
    t('evening', '20:00', 'Bins out', ['2026-10-04']),
    t('morning', '', 'Plants', [0]),
    t('morning', '06:00', '   '),
  ];
  const on = d => M.tasksOn(s, d).map(x => x.what);
  // Oct 4 2026 is a Sunday.
  assert.deepEqual(on('2026-10-04'), ['Breakfast', 'Walk', 'Plants', 'Dinner', 'Bins out']);
  assert.deepEqual(on('2026-10-05'), ['Breakfast', 'Walk', 'Dinner', 'Mail']);
  assert.equal(M.daysText(s.tasks[0]), 'Every day');
  assert.equal(M.daysText(s.tasks[3]), 'Mon, Tue, Wed, Thu, Fri');
  assert.equal(M.daysText(s.tasks[4]), 'Sun, Oct 4 only');
  assert.equal(M.daysText({ days: [0, 6] }), 'Sat, Sun');
  assert.deepEqual(M.tasksBySlot(M.tasksOn(s, '2026-10-05')).map(g => g.id), ['morning', 'evening', 'anytime']);
});

test('times read like a clock', () => {
  assert.equal(M.clock('07:05'), '7:05 AM');
  assert.equal(M.clock('00:30'), '12:30 AM');
  assert.equal(M.clock('12:00'), '12:00 PM');
  assert.equal(M.clock('23:59'), '11:59 PM');
  assert.equal(M.clock(''), '');
  assert.equal(M.clock('7:05'), '');
  assert.equal(M.shortDay('2026-09-30'), 'Wed 30');
  assert.equal(M.stayText({ from: '2026-09-26', to: '2026-10-02' }), 'Sep 26 – Oct 2');
  assert.equal(M.stayText({ from: '2026-10-03', to: '2026-10-10' }), 'Oct 3–10');
});

test('Wi-Fi codes escape the characters that mean something to a camera', () => {
  assert.equal(M.wifiCode({ name: 'Maple House', pass: 'biscuit-2019' }), 'WIFI:T:WPA;S:Maple House;P:biscuit-2019;;');
  assert.equal(M.wifiCode({ name: 'a;b', pass: 'c:d,e"f\\g' }), 'WIFI:T:WPA;S:a\\;b;P:c\\:d\\,e\\"f\\\\g;;');
  assert.equal(M.wifiCode({ name: 'Cafe', pass: '' }), 'WIFI:T:nopass;S:Cafe;;');
  assert.equal(M.wifiCode({ name: '', pass: 'x' }), '');
});

test('what arrives is trimmed to the shapes the page expects', () => {
  const s = M.cleanSheet({
    id: 'abc123', title: 'x'.repeat(500), from: '2026-02-30', to: 'soon', mine: true,
    charges: [{ id: 'd1', kind: 'dragon', name: 'Puff', notes: [{ label: 'Food', text: 'Knights' }], cues: 'sit' }],
    tasks: [
      { id: 't1', slot: 'dawn', time: '7am', what: 'Feed', who: 'd1', days: [1, 7, '2026-10-04', 'Tuesday', -1] },
      { id: 't2', slot: 'morning', what: 'Mail', who: 'nobody' },
    ],
    house: [{ label: 'Alarm', text: '1234', secret: 'yes' }],
    evil: '<script>',
  });
  assert.equal(s.title.length, 120);
  assert.equal(s.from, '', 'Feb 30 is not a date');
  assert.equal(s.to, '');
  assert.equal(s.mine, true);
  assert.equal(s.charges[0].kind, 'pet');
  assert.deepEqual(s.charges[0].cues, []);
  assert.deepEqual(s.tasks[0], { id: 't1', slot: 'anytime', time: '', what: 'Feed', who: 'd1', detail: '', days: [1, '2026-10-04'] });
  assert.equal(s.tasks[1].who, '');
  assert.equal(s.house[0].secret, true);
  assert.equal(s.evil, undefined);
  assert.equal(M.cleanSheet({}).mine, undefined);
});

test('a sheet goes through a link and comes back the same, minus what only matters here', async () => {
  const s = makeExample(noon('2026-10-05'));
  s.got = { at: 1 };
  const link = await sheetLink(s);
  assert.ok(link.startsWith(SITE + '#/s/z'), 'squeezed, and pointing at the real site from Node');
  assert.ok(link.length < 4000, `the example's link is ${link.length} characters`);
  const back = await readSheet(link.split('#/s/')[1]);
  assert.equal(back.mine, undefined);
  assert.equal(back.got, undefined);
  for (const k of ['id', 'title', 'from', 'to', 'sitter', 'owner', 'away', 'charges', 'tasks', 'wifi', 'house', 'contacts', 'notes', 'updated']) {
    assert.deepEqual(back[k], s[k], k);
  }
});

test('links still open when they were made without squeezing, and broken ones say so', async () => {
  const plain = 'j' + Buffer.from(JSON.stringify({ id: 'abc', title: 'Hi' })).toString('base64url');
  assert.equal((await readSheet(plain)).title, 'Hi');
  const z = await pack({ id: 'abc', title: 'Ünïcode 🐶' });
  assert.equal(z[0], 'z');
  assert.equal((await unpack(z)).title, 'Ünïcode 🐶');
  await assert.rejects(readSheet(z.slice(0, 20)));
  await assert.rejects(readSheet('qwerty'));
  await assert.rejects(readSlip(await pack({ id: 'abc' })), /not a note/);
});

test('a note goes through a link and comes back the same', async () => {
  const s = makeExample(noon('2026-10-05'));
  const slip = exampleSlip(s, noon('2026-10-06'));
  assert.equal(slip.sheet, s.id);
  assert.equal(slip.to, 'Alex');
  const back = await readSlip((await slipLink(slip)).split('#/slip/')[1]);
  assert.deepEqual(back, slip);
  assert.deepEqual(M.cleanSlip({ sheet: 'x', marks: ['well', 'panic'], done: [['a', 'b', 'c', 'd'], 'x'] }).marks, ['well']);
});

test('links point at this page on the real site or a local copy, and at the real site anywhere else', () => {
  assert.equal(base({ protocol: 'https:', hostname: 'junkdrawer.works', origin: 'https://junkdrawer.works', pathname: '/while-you-were-out/' }), 'https://junkdrawer.works/while-you-were-out/');
  assert.equal(base({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8080', pathname: '/' }), 'http://localhost:8080/');
  assert.equal(base({ protocol: 'https:', hostname: 'claude.ai', origin: 'https://claude.ai', pathname: '/artifact/x' }), SITE);
  assert.equal(base({ protocol: 'file:', hostname: '', origin: 'null', pathname: '/x.html' }), SITE);
});

test('the day’s ticked jobs go on the note in order, with the time they were done', () => {
  const s = makeExample(noon('2026-10-05'));
  const day = s.from;
  const jobs = M.tasksOn(s, day);
  const ticks = { [jobs[2].id]: new Date(`${day}T07:20:00`).getTime(), [jobs[0].id]: new Date(`${day}T07:05:00`).getTime() };
  assert.deepEqual(M.doneList(s, day, ticks), [['Breakfast', 'Biscuit', '7:05 AM'], ['Walk', 'Biscuit', '7:20 AM']]);
});

test('the example has a Sunday for the bins, inside the stay, and every job is for someone on the sheet', () => {
  for (let i = 0; i < 7; i++) {
    const s = makeExample(noon(M.addDays('2026-10-05', i)));
    const days = M.stayDays(s);
    assert.equal(days.length, 7);
    const bins = s.tasks.find(t => t.what === 'Bins to the curb');
    assert.equal(M.weekday(bins.days[0]), 0);
    assert.ok(days.includes(bins.days[0]));
    const ids = new Set([...s.charges.map(c => c.id), 'house']);
    for (const t of s.tasks) assert.ok(ids.has(t.who), t.what);
    assert.deepEqual(M.cleanSheet(s).tasks, s.tasks, 'the example survives cleaning unchanged');
  }
});

test('dogs come in from Trick Deck with the words they know', () => {
  const store = new Map([['trickdeck.v1', JSON.stringify({
    dogs: [{ id: 'd1', name: 'Biscuit', emoji: '🐕', kg: 12.7 }, { id: 'd2', name: '  ' }, { id: 'd3', name: 'Moss' }],
    prog: { d1: { sit: { status: 'solid' }, down: { status: 'known' }, spin: { status: 'learning' }, nosuch: { status: 'known' } } },
    settings: { units: 'lb' },
  })]]);
  const dogs = trickDeckDogs({ getItem: k => store.get(k) ?? null });
  assert.deepEqual(dogs.map(d => d.name), ['Biscuit', 'Moss']);
  assert.equal(dogs[0].weight, '28 lb');
  assert.deepEqual(dogs[0].cues.map(q => q.word), ['Sit', 'Down']);
  assert.equal(dogs[0].cues[0].signal, CUES.sit[2]);
  assert.deepEqual(trickDeckDogs({ getItem: () => 'not json' }), []);
  assert.deepEqual(trickDeckDogs({ getItem: () => null }), []);

  const s = M.blankSheet();
  const first = bringIn(s, dogs[0]);
  assert.equal(first.added, 2);
  assert.equal(s.charges[0].about, '28 lb');
  // Again, or onto a dog of the same name already on the sheet: no repeats.
  s.charges[0].cues.push({ word: 'Wait', signal: '', name: '' });
  assert.equal(bringIn(s, { ...dogs[0], name: 'biscuit', cues: [...dogs[0].cues, { word: 'wait', signal: '', name: '' }] }).added, 0);
  assert.equal(s.charges.length, 1);
  assert.equal(s.charges[0].cues.length, 3);
});

test('what goes in a link leaves out empty fields', () => {
  const s = M.blankSheet();
  s.title = 'Hi';
  s.charges.push({ ...M.newCharge('dog'), name: 'Rex' });
  const l = M.forLink(s);
  assert.deepEqual(Object.keys(l).sort(), ['charges', 'created', 'id', 'title', 'updated', 'v']);
  assert.deepEqual(Object.keys(l.charges[0]).sort(), ['emoji', 'id', 'kind', 'name']);
  assert.equal(M.cleanSheet(l).wifi.name, '', 'and the defaults come back on arrival');
});
