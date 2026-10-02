// Dogs from Trick Deck. A dog brought in arrives with its name, its weight and the words it knows on cue.
//
// Trick Deck lives at its own address now, trick-deck.junkdrawer.works, so its storage isn't this page's: what's
// here under 'trickdeck.v1' is a copy from before it moved. askTrickDeck() loads its dogs.html in a hidden frame and
// gets what it has saved now. That only happens on the real site; anywhere else (a local copy, the tests) this
// page's own storage is all there is.
import { CUES } from './cues.js';
import { newCharge } from './model.js';

const ORDER = Object.keys(CUES);
const TRICK_DECK = 'https://trick-deck.junkdrawer.works';
let fresh = null; // Trick Deck's own save, once it has answered
let asked = null;

// Resolves true once Trick Deck has answered with a save (so the dogs may have changed), false otherwise.
export function askTrickDeck(wait = 4000) {
  if (asked) return asked;
  if (globalThis.location?.origin !== 'https://junkdrawer.works') return (asked = Promise.resolve(false));
  asked = new Promise(resolve => {
    const frame = document.createElement('iframe');
    const done = got => { clearTimeout(timer); removeEventListener('message', on); frame.remove(); resolve(got); };
    const on = e => {
      if (e.origin !== TRICK_DECK || e.source !== frame.contentWindow || !e.data || !('trickdeck' in e.data)) return;
      if (typeof e.data.trickdeck === 'string') { fresh = e.data.trickdeck; done(true); } else done(false);
    };
    const timer = setTimeout(() => done(false), wait);
    addEventListener('message', on);
    frame.hidden = true;
    frame.onload = () => frame.contentWindow.postMessage({ trickdeck: 'please' }, TRICK_DECK);
    frame.src = TRICK_DECK + '/dogs.html';
    document.body.appendChild(frame);
  });
  return asked;
}

export function trickDeckDogs(storage = globalThis.localStorage) {
  let data;
  try { data = JSON.parse(fresh ?? storage.getItem('trickdeck.v1')); } catch { return []; }
  if (!data || !Array.isArray(data.dogs)) return [];
  const kg = data.settings?.units === 'kg';
  return data.dogs.filter(d => d && d.id && typeof d.name === 'string' && d.name.trim()).map(d => {
    const prog = data.prog?.[d.id] || {};
    const cues = ORDER
      .filter(id => prog[id]?.status === 'known' || prog[id]?.status === 'solid')
      .map(id => { const [name, word, signal] = CUES[id]; return { name, word, signal }; });
    const weight = d.kg > 0 ? (kg ? `${Math.round(d.kg * 10) / 10} kg` : `${Math.round(d.kg * 2.20462)} lb`) : '';
    return { id: d.id, name: d.name.trim().slice(0, 60), emoji: typeof d.emoji === 'string' ? d.emoji.slice(0, 16) : '🐶', weight, cues };
  });
}

// Adds a Trick Deck dog to the sheet, or adds its words to the dog of the same name already there.
export function bringIn(sheet, dog) {
  let c = sheet.charges.find(x => x.kind === 'dog' && x.name.trim().toLowerCase() === dog.name.toLowerCase());
  if (!c) {
    c = { ...newCharge('dog'), name: dog.name, emoji: dog.emoji || '🐶', about: dog.weight };
    sheet.charges.push(c);
  }
  const have = new Set(c.cues.map(q => q.word.toLowerCase()));
  let added = 0;
  for (const q of dog.cues) {
    if (have.has(q.word.toLowerCase())) continue;
    c.cues.push({ ...q });
    have.add(q.word.toLowerCase());
    added++;
  }
  return { charge: c, added };
}
