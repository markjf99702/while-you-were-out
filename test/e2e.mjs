// Uses it in Chromium through the real page, on two phones:  node test/e2e.mjs  (needs Playwright)
// Alex makes a sheet (bringing Biscuit in from Trick Deck) and sends it; Jess opens it, ticks jobs off and
// sends a note back; Alex opens the note, changes the sheet and sends it again; Jess's ticks survive.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await pw.chromium.launch();
const problems = [];
async function phone(who) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${who}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`${who}: ${m.text()}`); });
  page.on('requestfailed', r => problems.push(`${who} failed: ${r.url()}`));
  page.on('request', r => { if (!r.url().startsWith(base)) problems.push(`${who} left the site: ${r.url()}`); });
  return { ctx, page };
}
const fits = async (page, where) => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${where} scrolls sideways on a phone`);
const linkFromSheet = async page => {
  await page.waitForFunction(() => document.querySelector('#sheet #link')?.value.includes('#/'));
  return page.$eval('#sheet #link', el => el.value);
};
const closeSheet = page => page.evaluate(() => document.getElementById('sheet').close());
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date();
const later = new Date(Date.now() + 4 * 864e5);

// ---------- Alex makes the sheet ----------
const alex = await phone('Alex');
const A = alex.page;
await A.goto(base);
// Trick Deck lives on the same site, so it shares this browser's storage.
await A.evaluate(() => localStorage.setItem('trickdeck.v1', JSON.stringify({
  dogs: [{ id: 'td1', name: 'Biscuit', emoji: '🐶', kg: 12.7 }],
  prog: { td1: { sit: { status: 'solid' }, down: { status: 'known' }, stay: { status: 'known' }, spin: { status: 'learning' } } },
  settings: { units: 'lb' },
})));
await A.evaluate(() => document.fonts.ready);
await fits(A, 'home');
await A.click('text=Make a care sheet');
await A.waitForSelector('#basics');
await A.fill('[data-b="title"]', 'Biscuit and the house');
await A.fill('[data-b="from"]', iso(today));
await A.fill('[data-b="to"]', iso(later));
await A.fill('[data-b="sitter"]', 'Jess');
await A.locator('[data-b="sitter"]').dispatchEvent('change');
await A.fill('[data-b="owner.name"]', 'Alex');
await A.fill('[data-b="owner.phone"]', '(555) 010-0142');
assert.equal(await A.textContent('[data-act="send"]'), 'Send to Jess');

// Biscuit from Trick Deck, with the three words he knows on cue.
await A.click('[data-act="td-dog"]');
const biscuit = A.locator('.charge').first();
assert.equal(await biscuit.locator('input[data-b$=".name"]').inputValue(), 'Biscuit');
assert.equal(await biscuit.locator('input[data-b$=".about"]').inputValue(), '28 lb');
assert.deepEqual(await biscuit.locator('.cue-row input[data-b$=".word"]').evaluateAll(els => els.map(e => e.value)), ['Sit', 'Down', 'Stay']);
assert.equal(await A.locator('[data-act="td-dog"]').count(), 0, 'Trick Deck no longer offers a dog that’s on the sheet');

await biscuit.locator('[data-act="add-note"][data-v="Food"]').click();
await A.locator('textarea[data-b*=".notes:"]').last().fill('One cup, morning and evening.');
await biscuit.locator('[data-act="add-note"][data-v="Meds"]').click();
await A.locator('textarea[data-b*=".notes:"]').last().fill('Half a pill in cheese at breakfast.');

// Two suggested jobs, and one of our own for weekdays.
await A.click('[data-act="sug"]:has-text("Biscuit: Breakfast")');
await A.click('[data-act="sug"]:has-text("Biscuit: Dinner")');
await A.click('[data-act="task"][data-id=""]');
await A.fill('#tWhat', 'Water the ferns');
await A.selectOption('#tWho', 'house');
await A.click('#tDays [data-day="6"]');
await A.click('#tDays [data-day="0"]');
await A.click('#tDays [data-day="6"]');
await A.click('#tSave');
const lines = await A.locator('.task-line b').allTextContents();
assert.deepEqual(lines, ['Breakfast', 'Water the ferns', 'Dinner'], 'a new job starts in the morning');
assert.match(await A.textContent('.task-line:has-text("Water the ferns")'), /Sun\b/);

// The house and a vet.
await A.fill('[data-b="wifi.name"]', 'Maple House');
await A.fill('[data-b="wifi.pass"]', 'biscuit;2019');
await A.click('[data-act="add-house"][data-v="Getting in"]');
await A.locator('textarea[data-b^="house:"]').last().fill('Side door keypad: 1954.');
await A.click('[data-act="add-contact"][data-v="Vet"]');
await A.locator('input[data-b$=".name"][data-b^="contacts:"]').last().fill('Lakeshore Animal Clinic');
await A.locator('input[data-b$=".phone"][data-b^="contacts:"]').last().fill('(555) 010-0120');
await fits(A, 'the editor');

// Everything typed was saved.
const saved = await A.evaluate(() => wywo.store.mine()[0]);
assert.equal(saved.title, 'Biscuit and the house');
assert.equal(saved.charges[0].notes.length, 2);
assert.equal(saved.house[0].secret, true, 'door codes are hidden until tapped by default');
assert.equal(saved.contacts[0].phone, '(555) 010-0120');
const sheetId = saved.id;

await A.click('[data-act="send"]');
const sheetUrl = await linkFromSheet(A);
assert.match(await A.textContent('#sheet'), /Wi-Fi password and door or alarm codes/);
await closeSheet(A);

// ---------- Jess opens it ----------
const jess = await phone('Jess');
const J = jess.page;
await J.goto(sheetUrl);
await J.waitForSelector('.job');
await J.evaluate(() => document.fonts.ready);
assert.match(await J.textContent('.intro'), /Alex sent you this/);
assert.match(await J.textContent('.sheet-head'), /From Alex/);
assert.equal(await J.locator('.owner-bar').count(), 0, 'no Edit or Send for the sitter');
const todayJobs = await J.locator('.job .job-top b').allTextContents();
assert.ok(todayJobs.includes('Breakfast') && todayJobs.includes('Dinner'));
assert.equal(todayJobs.includes('Water the ferns'), [0, 6].includes(today.getDay()), 'the ferns are weekends only');
assert.equal(await J.locator('.day-strip a').count(), 5);
await fits(J, 'today');

await J.locator('.job:has-text("Breakfast")').click();
assert.match(await J.textContent('#progress'), /^1 of/);
assert.match(await J.textContent('.job:has-text("Breakfast") .job-when'), /^Done \d/);

await J.click('.tabs >> text=Care');
assert.match(await J.textContent('.who-card'), /Half a pill in cheese/);
assert.equal(await J.locator('.fact.warn').count(), 1, 'meds are flagged');
assert.match(await J.textContent('.cue-list'), /“Sit”.*“Down”.*“Stay”/s);
await J.click('.tabs >> text=House');
assert.match(await J.textContent('.wifi'), /biscuit;2019/);
assert.equal(await J.locator('.secret:not(.shown)').count(), 1);
await J.click('[data-act="reveal"]');
assert.equal(await J.locator('.secret.shown').count(), 1);
await J.click('[data-act="wifi-code"]');
assert.equal(await J.locator('#sheet svg.qr').count(), 1);
await closeSheet(J);
await J.click('.tabs >> text=Call');
assert.match(await J.textContent('.contact.main'), /Alex.*\(555\) 010-0142/s);
assert.equal(await J.getAttribute('.contact.main a.btn.primary', 'href'), 'tel:5550100142');
assert.match(await J.textContent('#tab'), /ASPCA Animal Poison Control/);
await fits(J, 'call');

// A note back.
await J.click('text=Leave Alex a note');
await J.waitForSelector('.slip.editing');
assert.deepEqual(await J.locator('.slip-done li span').allTextContents(), ['Breakfast, Biscuit']);
await J.fill('#slipFrom', 'Jess');
await J.check('[data-mark="well"]', { force: true });
await J.fill('#slipMsg', 'He did his sit for a treat. All good here.');
await fits(J, 'the note');
await J.click('#sendSlip');
const slipUrl = await linkFromSheet(J);
assert.match(slipUrl, /#\/slip\//);
assert.ok(await J.locator('#sheet a[href^="sms:"]').count(), 'a Text it button when Alex left a number');
await closeSheet(J);

// ---------- Alex opens the note ----------
await A.goto(slipUrl);
await A.waitForSelector('.slip');
assert.match(await A.textContent('.page-head h1'), /A note from Jess/);
assert.match(await A.textContent('.slip'), /He did his sit for a treat/);
assert.equal(await A.locator('.mark.on').count(), 1);
await A.goto(`${base}#/v/${sheetId}/notes`);
assert.equal(await A.locator('.mini-slip').count(), 1);
await A.goto(slipUrl);
await A.goto(`${base}#/v/${sheetId}/notes`);
assert.equal(await A.locator('.mini-slip').count(), 1, 'opening the same note twice keeps one copy');

// Alex changes the sheet and sends it again; Jess's tick stays.
await A.goto(`${base}#/e/${sheetId}`);
await A.waitForSelector('#basics');
await A.fill('[data-b="notes"]', 'Pizza money is on the counter.');
await A.click('[data-act="send"]');
const sheetUrl2 = await linkFromSheet(A);
assert.notEqual(sheetUrl2, sheetUrl);
await closeSheet(A);
await J.goto(sheetUrl2);
await J.waitForSelector('.job');
assert.match(await J.textContent('#toast'), /Updated to Alex’s latest/);
assert.match(await J.textContent('#progress'), /^1 of/);
await J.goto(sheetUrl);
await J.waitForSelector('.job');
assert.match(await J.textContent('#toast'), /newer copy/, 'an old link doesn’t undo the new one');
await J.click('.tabs >> text=Care');
await J.waitForSelector('.who-card');
assert.match(await J.textContent('#tab'), /Pizza money/);

// Home screens.
await J.goto(base);
assert.match(await J.textContent('.slist'), /Biscuit and the house.*From Alex/s);
await A.goto(base);
assert.match(await A.textContent('.slist'), /Biscuit and the house/);

// The printed sheet: a box for every job on every day, and the Wi-Fi code.
await A.goto(`${base}#/p/${sheetId}`);
await A.waitForSelector('.paper');
assert.equal(await A.locator('.p-grid thead th').count(), 1 + 5);
assert.equal(await A.locator('.p-grid tr:has-text("Breakfast") .p-box').count(), 5);
assert.equal(await A.locator('.p-wifi svg.qr').count(), 1);
await A.check('#hideCodes');
assert.equal(await A.locator('.paper:has-text("1954")').count(), 0, 'codes left off when asked');
assert.equal(await A.locator('.paper:has-text("biscuit;2019")').count(), 0);

// The example opens with a note already there.
await A.goto(`${base}#/example`);
await A.waitForSelector('.job');
assert.match(await A.textContent('.tabs'), /Notes\s*1/);
await fits(A, 'the example');

// Works offline once it has been opened.
await J.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await jess.ctx.setOffline(true);
await J.goto(`${base}#/v/${sheetId}/today`);
await J.waitForSelector('.job');
assert.match(await J.textContent('.sheet-head'), /Biscuit and the house/);
await jess.ctx.setOffline(false);

assert.deepEqual(problems.filter(p => !/ failed: /.test(p)), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
