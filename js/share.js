// Links that carry a care sheet to the sitter, and their notes back.
// Everything travels in the part of the link after #, which browsers never send to a server.
//
//   #/s/<data>     a care sheet
//   #/slip/<data>  a note from the sitter
//
// <data> is the JSON, squeezed with deflate where the browser can (a leading "z"),
// or as it is (a leading "j"), then written in URL-safe base64.
import { cleanSheet, cleanSlip, forLink } from './model.js';

export const SITE = 'https://junkdrawer.works/while-you-were-out/';

// Where links should point: this page when it's the real site or a local copy, the real site otherwise
// (for example the single-file copy, which lives somewhere a link can't reach).
export function base(loc = globalThis.location) {
  if (!loc || !/^https?:$/.test(loc.protocol)) return SITE;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(loc.hostname);
  if (local || loc.hostname.endsWith('junkdrawer.works')) return loc.origin + loc.pathname;
  return SITE;
}

const b64 = bytes => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));

async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    try { return 'z' + b64(await through(bytes, new CompressionStream('deflate-raw'))); } catch { /* fall back to plain */ }
  }
  return 'j' + b64(bytes);
}

export async function unpack(text) {
  const kind = text[0], body = text.slice(1);
  let bytes;
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser can’t open squeezed links. Try an up-to-date Chrome, Safari or Firefox.');
    bytes = await through(unb64(body), new DecompressionStream('deflate-raw'));
  } else if (kind === 'j') {
    bytes = unb64(body);
  } else {
    throw new Error('not a link from here');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const sheetLink = async sheet => `${base()}#/s/${await pack(forLink(sheet))}`;
export const slipLink = async slip => `${base()}#/slip/${await pack(slip)}`;

export async function readSheet(data) {
  const raw = await unpack(data);
  if (!raw || typeof raw !== 'object' || !raw.id) throw new Error('not a sheet');
  const s = cleanSheet(raw);
  delete s.mine;
  return s;
}

export async function readSlip(data) {
  const raw = await unpack(data);
  if (!raw || typeof raw !== 'object' || !raw.sheet) throw new Error('not a note');
  return cleanSlip(raw);
}
