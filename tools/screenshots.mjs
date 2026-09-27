// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// The clock is fixed to a Sunday morning in October, so the same pictures come out every time.
// Needs Playwright, and upng-js from `npm install`.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
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
const NOW = new Date('2026-10-04T08:12:00');
const browser = await pw.chromium.launch();
await mkdir(join(root, 'docs'), { recursive: true });

// A 256-colour palette keeps the PNGs small.
async function save(shot, path) {
  const img = UPNG.decode(shot);
  await writeFile(join(root, path), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
}

async function open(viewport, deviceScaleFactor) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// The example, as Jess has it on her phone: a copy Alex sent, with breakfast and the walk ticked off.
async function jessCopy(page) {
  return page.evaluate(() => {
    const { store, M, makeExample, exampleSlip } = window.wywo;
    const s = makeExample();
    delete s.mine;
    delete s.example;
    s.got = { at: Date.now() };
    store.put(s, { touch: false });
    const day = M.todayISO();
    const at = hm => new Date(`${day}T${hm}:00`).getTime();
    const jobs = M.tasksOn(s, day);
    store.tick(s.id, day, jobs[0].id, true, at('07:04'));
    store.tick(s.id, day, jobs[1].id, true, at('07:05'));
    store.tick(s.id, day, jobs[2].id, true, at('07:31'));
    const slip = exampleSlip(s);
    store.addSlip({ ...slip, from: 'Jess' }, 'out');
    return { id: s.id, slip: slip.id };
  });
}

const scrollTo = (page, sel, pad = 64) => page.evaluate(([s, p]) => window.scrollTo(0, document.querySelector(s).getBoundingClientRect().top + scrollY - p), [sel, pad]);

// Phone screenshots for the README.
{
  const page = await open({ width: 390, height: 844 }, 2);
  const { id, slip } = await jessCopy(page);
  await page.goto(base + `#/v/${id}/today`);
  await page.waitForSelector('.job');
  await page.evaluate(() => document.querySelector('.intro')?.remove());
  await save(await page.screenshot(), 'docs/phone-today.png');

  await page.goto(base + `#/v/${id}/care`);
  await page.waitForSelector('.who-card');
  await save(await page.screenshot(), 'docs/phone-care.png');

  await page.goto(base + `#/note/${slip}`);
  await page.waitForSelector('.slip');
  await page.evaluate(() => { document.querySelector('.page-head h1').textContent = 'A note from Jess'; });
  await scrollTo(page, '.slip', 20);
  await save(await page.screenshot(), 'docs/phone-note.png');

  await page.context().close();
}

// The printed sheet, top of the first page.
{
  const page = await open({ width: 1000, height: 1000 }, 1);
  const id = await page.evaluate(() => {
    const s = window.wywo.makeExample();
    window.wywo.store.put(s);
    return s.id;
  });
  await page.goto(base + `#/p/${id}`);
  await page.waitForSelector('.paper');
  const box = await page.locator('.paper').boundingBox();
  await save(await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: 760 } }), 'docs/print.png');
  await page.context().close();
}

// Link preview, 1200 x 630: the name and one line on the left, a note from the sitter on the right.
{
  const page = await open({ width: 1200, height: 630 }, 1);
  const { slip } = await jessCopy(page);
  await page.goto(base + `#/note/${slip}`);
  await page.waitForSelector('.slip');
  await page.evaluate(async () => {
    const note = document.querySelector('.slip').outerHTML;
    document.body.innerHTML = `<div class="ogcard">
      <div class="ogtext">
        <img src="icon.svg" alt="" width="76" height="76">
        <h1>While You Were Out</h1>
        <p>A care sheet for the sitter, and notes back while you’re away.</p>
        <ul><li>Feeding, meds, walks and the vet</li><li>A checklist for every day</li><li>A link or a sheet for the fridge</li></ul>
      </div>
      <div class="ognote">${note}</div>
    </div>`;
    const style = document.createElement('style');
    style.textContent = `
      body { width: 1200px; height: 630px; overflow: hidden; }
      .ogcard { display: grid; grid-template-columns: 610px 1fr; align-items: center; height: 630px; padding: 0 40px 0 64px; gap: 30px; }
      .ogtext img { border-radius: 16px; display: block; }
      .ogtext h1 { font-size: 84px; line-height: .95; margin: 22px 0 16px; text-transform: uppercase; letter-spacing: .02em; color: var(--accent); }
      .ogtext p { font-size: 30px; line-height: 1.28; color: var(--ink-2); margin: 0 0 24px; font-weight: 500; }
      .ogtext ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
      .ogtext li { font-size: 23px; font-weight: 600; color: var(--muted); display: flex; align-items: center; gap: 12px; }
      .ogtext li::before { content: ''; width: 16px; height: 16px; border: 2.5px solid var(--accent); border-radius: 3px; }
      .ognote { height: 630px; position: relative; }
      .ognote .slip { position: absolute; top: 34px; left: 10px; width: 440px; transform: rotate(2.5deg); }
      .ognote .slip-done ul { font-size: 1.3rem; }`;
    document.head.append(style);
    await document.fonts.ready;
  });
  await page.waitForTimeout(200);
  await save(await page.screenshot(), 'og.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
