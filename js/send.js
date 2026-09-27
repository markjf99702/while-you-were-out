// Sending: the care sheet to the sitter, and a note back to whoever left.
import * as M from './model.js';
import { sheetLink, slipLink } from './share.js';
import { esc, sheet as openSheet, share, copy, sms, framed } from './ui.js';

export async function sendSheet(s) {
  const who = s.sitter.trim() || 'your sitter';
  const missing = M.readiness(s);
  openSheet(`
    <h2>Send it to ${esc(who)}</h2>
    <p>The whole sheet travels in the link and isn’t kept anywhere else, so send it straight to them. It opens on their phone and works without signal after that.</p>
    ${missing.length ? `<p class="warn">You haven’t added ${esc(missing.join(' or '))} yet.</p>` : ''}
    ${M.hasSecrets(s) ? '<p class="warn">It has your Wi-Fi password and door or alarm codes in it. Anyone with the link can read them.</p>' : ''}
    <input class="linkbox" id="link" readonly value="Making the link…" aria-label="The link">
    <div class="sheet-actions">
      <button type="button" class="btn primary" id="shareBtn" disabled>Share…</button>
      <button type="button" class="btn" id="copyBtn" disabled>Copy link</button>
    </div>
    <p class="hint">Change something later? Send the link again. Whatever they’ve ticked stays ticked.</p>
    <p class="sheet-foot"><a href="#/p/${s.id}" data-close>Print it instead</a><button type="button" class="link-btn" data-close>Close</button></p>`,
  async body => {
    const url = await sheetLink(s);
    const field = body.querySelector('#link');
    field.value = url;
    const title = s.title || 'Care sheet';
    body.querySelector('#shareBtn').disabled = false;
    body.querySelector('#copyBtn').disabled = false;
    body.querySelector('#shareBtn').onclick = () => share({ title, text: `${title}: everything you need while I’m away.`, url }, field);
    body.querySelector('#copyBtn').onclick = () => copy(url, field);
    if (framed()) body.querySelector('#shareBtn').hidden = true;
  });
}

export async function sendSlip(slip, s) {
  const to = slip.to || 'them';
  const url = await slipLink(slip);
  const text = `A note from ${slip.from || 'your sitter'}`;
  const phone = s?.owner.phone;
  openSheet(`
    <h2>Send it to ${esc(to)}</h2>
    <p>The note is in the link. When ${esc(to)} opens it, it lands on their copy of the sheet.</p>
    <input class="linkbox" id="link" readonly value="${esc(url)}" aria-label="The link">
    <div class="sheet-actions">
      ${phone ? `<a class="btn primary" href="${esc(sms(phone))}?&body=${encodeURIComponent(`${text}: ${url}`)}">Text it to ${esc(to)}</a>` : ''}
      <button type="button" class="btn${phone ? '' : ' primary'}" id="shareBtn">Share…</button>
      <button type="button" class="btn" id="copyBtn">Copy link</button>
    </div>
    <p class="sheet-foot"><span></span><button type="button" class="link-btn" data-close>Close</button></p>`,
  body => {
    const field = body.querySelector('#link');
    body.querySelector('#shareBtn').onclick = () => share({ title: text, text: `${text}:`, url }, field);
    body.querySelector('#copyBtn').onclick = () => copy(url, field);
    if (framed()) body.querySelector('#shareBtn').hidden = true;
  });
  return url;
}

