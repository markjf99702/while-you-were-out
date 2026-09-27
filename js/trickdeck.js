// Dogs from Trick Deck, which lives on the same site and so shares this browser's storage.
// A dog brought in arrives with its name, its weight and the words it knows on cue.
import { CUES } from './cues.js';
import { newCharge } from './model.js';

const ORDER = Object.keys(CUES);

export function trickDeckDogs(storage = globalThis.localStorage) {
  let data;
  try { data = JSON.parse(storage.getItem('trickdeck.v1')); } catch { return []; }
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
