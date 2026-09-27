// The page: which screen goes with which address, the home screen, and opening links that arrive.
import * as M from './model.js';
import { store } from './store.js';
import { readSheet, readSlip } from './share.js';
import { makeExample, exampleSlip } from './example.js';
import { app, esc, on, go, toast, framed, download, plural } from './ui.js';
import { edit, flush } from './edit.js';
import { view } from './view.js';
import { compose, showSlip, miniSlip } from './slip.js';
import { print } from './print.js';

let lastPath = null;

async function route() {
  flush();
  const path = location.hash.replace(/^#\/?/, '');
  const [head, a, b, c] = path.split('/');
  document.body.dataset.screen = head || 'home';
  if (path !== lastPath) {
    window.scrollTo(0, 0);
    lastPath = path;
  }

  if (head === 'new') {
    const s = M.blankSheet();
    store.put(s);
    return go(`/e/${s.id}`, true);
  }
  if (head === 'example') {
    let s = store.mine().find(x => x.example);
    if (!s) {
      s = makeExample();
      store.put(s);
      store.addSlip(exampleSlip(s), 'in');
    }
    return go(`/v/${s.id}/today`, true);
  }
  if (head === 's' && a) return incomingSheet(a);
  if (head === 'slip' && a) return incomingSlip(a);
  if (head === 'note') {
    const slip = store.slip(a);
    return slip ? showSlip(slip) : message('That note isn’t here', 'It may have been deleted with its sheet.');
  }
  if (['e', 'v', 'w', 'p'].includes(head)) {
    const s = store.get(a);
    if (!s) return message('That sheet isn’t here', 'It may have been deleted, or it was made on another device.');
    if (head === 'e') return s.mine ? edit(s) : go(`/v/${s.id}/today`, true);
    if (head === 'v') return view(s, b, c);
    if (head === 'w') return compose(s, M.isISO(b) ? b : M.defaultDay(s));
    if (head === 'p') return print(s);
  }
  home();
}

function message(title, text) {
  document.title = 'While You Were Out';
  app.innerHTML = `
    <div class="card empty">
      <h2>${esc(title)}</h2>
      <p class="hint">${esc(text)}</p>
      <a class="btn" href="#/">Home</a>
    </div>`;
  on({});
}

const broken = () => message('That link didn’t come through whole', 'Ask for it again, or copy all of it into the address bar.');

// Someone sent you their care sheet.
async function incomingSheet(data) {
  let s;
  try { s = await readSheet(data); } catch (e) { return e.message.startsWith('This browser') ? message('This browser can’t open that link', e.message) : broken(); }
  const { sheet, status } = store.receive(s);
  go(`/v/${sheet.id}/today`, true);
  if (status === 'mine') toast('That’s your own sheet');
  else if (status === 'older') toast('You already have a newer copy of this sheet');
  else if (status === 'updated') toast(`Updated to ${sheet.owner.name || 'their'}’s latest`);
}

// The sitter sent a note back.
async function incomingSlip(data) {
  let slip;
  try { slip = await readSlip(data); } catch (e) { return e.message.startsWith('This browser') ? message('This browser can’t open that link', e.message) : broken(); }
  const have = store.slip(slip.id);
  const saved = have || store.addSlip(slip, store.get(slip.sheet)?.mine || !store.get(slip.sheet) ? 'in' : 'out');
  go(`/note/${saved.id}`, true);
}

function sheetRow(s) {
  const unread = store.unread(s.id);
  const days = M.stayDays(s);
  let status = '';
  if (s.mine) {
    status = [s.example && '<span class="tag">Example</span>', days.length && esc(M.stayText(s)), unread && `<span class="tag new">${plural(unread, 'new note')}</span>`].filter(Boolean).join(' ');
  } else {
    const day = M.defaultDay(s), tasks = M.tasksOn(s, day), ticks = store.ticks(s.id, day);
    const n = tasks.filter(t => ticks[t.id]).length;
    status = [`From ${esc(s.owner.name || 'someone')}`, days.length && esc(M.stayText(s)), tasks.length && `${day === M.todayISO() ? 'Today' : esc(M.dayName(day, { weekday: 'short' }))}: ${n} of ${tasks.length} done`].filter(Boolean).join(' · ');
  }
  const emojis = s.charges.map(c => c.emoji).slice(0, 4).join('') || '🏠';
  return `
    <li class="srow">
      <a href="${s.mine && !s.example && !s.title && !s.charges.length ? `#/e/${s.id}` : `#/v/${s.id}/today`}">
        <span class="srow-emoji" aria-hidden="true">${esc(emojis)}</span>
        <span class="srow-text"><b>${esc(s.title || 'New care sheet')}</b><small>${status}</small></span>
      </a>
      <button type="button" class="x" data-del="${s.id}" aria-label="Delete ${esc(s.title || 'this sheet')}">✕</button>
    </li>`;
}

function home() {
  document.title = 'While You Were Out';
  // A sheet started and left without a word typed isn't worth keeping.
  for (const s of store.mine()) {
    const { id, v, created, updated, ...typed } = M.forLink(s);
    if (!Object.keys(typed).length) store.remove(s.id);
  }
  const mine = store.mine(), minding = store.minding();
  const unread = store.slips().filter(x => x.dir === 'in' && !x.read);
  app.innerHTML = `
    <section class="hero">
      <div class="hero-slip" aria-hidden="true">
        <div class="hs-head">While you were out</div>
        <div class="hs-line"><span>For</span><i class="hand">Alex</i></div>
        <div class="hs-marks"><span class="on">All’s well</span><span>Please call</span><span class="on">Sent photos</span></div>
        <div class="hs-msg hand">Fed, walked, and Olive came out for dinner.</div>
      </div>
      <h1>Leave the sitter everything they need.</h1>
      <p>Feeding, meds, walks, the vet, the Wi-Fi and who to call, all on one sheet. Send it as a link or print it for the fridge. The sitter ticks jobs off as they go and sends you notes back.</p>
      <div class="hero-btns">
        <a class="btn primary" href="#/new">Make a care sheet</a>
        <a class="btn" href="#/example">See an example</a>
      </div>
    </section>
    ${unread.length ? `<h2 class="home-h">New notes</h2><div class="slip-list">${unread.map(miniSlip).join('')}</div>` : ''}
    ${minding.length ? `<h2 class="home-h">Looking after</h2><ul class="slist">${minding.map(sheetRow).join('')}</ul>` : ''}
    ${mine.length ? `<h2 class="home-h">Your care sheets</h2><ul class="slist">${mine.map(sheetRow).join('')}</ul>` : ''}
    <div class="keep">
      <p>Everything stays in this browser. Nothing is sent anywhere unless you send a link.</p>
      ${framed() ? '' : '<button type="button" class="link-btn" data-act="save">Save a backup</button>'}
      <label class="link-btn">Load a backup<input type="file" id="loadBackup" accept=".json,application/json"></label>
    </div>`;
  on({
    click(e) {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.del) {
        const s = store.get(t.dataset.del);
        const undo = store.remove(s.id);
        home();
        toast(`Deleted “${s.title || 'New care sheet'}”`, { label: 'Undo', run: () => { undo(); home(); } });
      } else if (t.dataset.act === 'save') {
        download(`while-you-were-out-${M.todayISO()}.json`, store.backup());
      }
    },
    async change(e) {
      if (e.target.id !== 'loadBackup' || !e.target.files[0]) return;
      try {
        const n = store.restore(await e.target.files[0].text());
        home();
        toast(n ? `Loaded ${plural(n, 'sheet')}` : 'Nothing new in that backup');
      } catch (err) {
        toast(err.message.startsWith('That file') ? err.message : 'That file isn’t a While You Were Out backup.');
      }
    },
  });
}

window.addEventListener('hashchange', route);
// Another tab changed something: catch up, unless you're typing on this one.
window.addEventListener('storage', e => {
  if (e.key !== store.key) return;
  store.reload();
  if (!location.hash.startsWith('#/e/')) route();
});
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
route();

if ('serviceWorker' in navigator && !('single' in document.documentElement.dataset) && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For the screenshot tool and tests: the store and the model, so they can set things up without tapping through.
window.wywo = { store, M, makeExample, exampleSlip };
