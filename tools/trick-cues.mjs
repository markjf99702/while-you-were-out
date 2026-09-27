// Rewrites js/cues.js from a Trick Deck checkout, so a dog brought in from Trick Deck arrives with its words:
//   node tools/trick-cues.mjs ../trick-deck
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const from = resolve(process.argv[2] || '../trick-deck');
const { TRICKS } = await import(pathToFileURL(`${from}/js/tricks.js`).href);
const rows = TRICKS.filter(t => t.cue?.word && t.id !== 'name').map(t => [t.id, t.name, t.cue.word, t.cue.signal || '']);
const out = `// The words and hand signals for Trick Deck's tricks, by trick id. Made by tools/trick-cues.mjs from Trick Deck's js/tricks.js.
// Trick Deck (junkdrawer.works/trick-deck) keeps each dog's progress in this browser under 'trickdeck.v1'.
export const CUES = {
${rows.map(([id, name, word, signal]) => `  ${JSON.stringify(id)}: [${JSON.stringify(name)}, ${JSON.stringify(word)}, ${JSON.stringify(signal)}],`).join('\n')}
};
`;
await writeFile(new URL('../js/cues.js', import.meta.url), out);
console.log(`${rows.length} tricks written to js/cues.js`);
