// Small pieces every screen uses: escaping, the toast, the sheet that slides up, copying and sharing,
// and one set of event handlers for whichever screen is showing.

export const app = document.getElementById('app');

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function go(path, replace = false) {
  const hash = '#' + path;
  if (replace) location.replace(hash); else location.hash = hash;
}

// One set of listeners on the page; each screen says what they do.
let handlers = {};
export function on(h) { handlers = h; }
for (const type of ['click', 'input', 'change', 'keydown', 'focusout']) {
  app.addEventListener(type, e => handlers[type]?.(e));
}

let toastTimer;
export function toast(message, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) el.querySelector('button').onclick = () => { el.hidden = true; action.run(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2600);
}

// The sheet that slides up. bind() wires up what's inside once it's drawn.
export function sheet(html, bind) {
  const dlg = document.getElementById('sheet');
  const body = dlg.querySelector('.sheet-body');
  body.innerHTML = html;
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  const close = () => (dlg.close ? dlg.close() : dlg.removeAttribute('open'));
  body.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  bind?.(body, close);
}

// The one-file copy shown inside another page can't start a download or print on its own.
export const framed = () => {
  if (!('single' in document.documentElement.dataset)) return false;
  try { return window.top !== window.self; } catch { return true; }
};

export async function copy(text, field, done = 'Link copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    // Some browsers and embedded views refuse the clipboard: select the text so it can be copied by hand.
    field?.focus();
    field?.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* not allowed here either */ }
    toast(ok ? done : 'It’s selected. Copy it from there.');
  }
}

// The phone's own share sheet where there is one (Messages, WhatsApp, email), otherwise copy.
export async function share({ title, text, url }, field) {
  if (navigator.share && !framed()) {
    try { await navigator.share({ title, text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  copy(url, field);
}

export const tel = phone => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
export const sms = phone => `sms:${String(phone).replace(/[^\d+]/g, '')}`;
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Multi-line text as paragraphs, keeping the sitter's line breaks.
export const lines = s => esc(s).replace(/\n/g, '<br>');
