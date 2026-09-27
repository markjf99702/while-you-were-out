// The example: a dog, a cat and a house for a week, with a note that's already come back.
import { blankSheet, addDays, todayISO, weekday, newId, makeSlip } from './model.js';
import { CUES } from './cues.js';

const cue = id => { const [name, word, signal] = CUES[id]; return { name, word, signal }; };

export function makeExample(now = Date.now()) {
  const today = todayISO(now);
  const from = addDays(today, -1);
  const s = blankSheet(now);
  const biscuit = newId(), olive = newId();
  // Trash night is the first Sunday of the stay; the heartworm chew is due on its fifth day.
  let trash = from;
  while (weekday(trash) !== 0) trash = addDays(trash, 1);
  Object.assign(s, {
    example: true,
    title: 'Biscuit, Olive and the house',
    from, to: addDays(from, 6),
    sitter: 'Jess',
    owner: { name: 'Alex', phone: '(555) 010-0142' },
    away: 'At my sister’s in Tucson, two hours behind you. Text first; I’ll call back.',
    charges: [
      {
        id: biscuit, kind: 'dog', name: 'Biscuit', emoji: '🐶', about: 'Beagle mix, 5 years old, 28 lb. Friendly with everyone except the mail carrier.',
        notes: [
          { id: newId(), label: 'Food', text: 'One cup of kibble from the bin by the back door, morning and evening, with a splash of warm water.' },
          { id: newId(), label: 'Treats', text: 'Two or three a day from the jar on the counter. No people food: grapes, raisins, chocolate, onions and sugar-free gum are poisonous to dogs.' },
          { id: newId(), label: 'Meds', text: 'One heartworm chew on the date it’s listed. They’re in the cupboard above the fridge. He takes it like a treat.' },
          { id: newId(), label: 'Walks', text: 'Twenty minutes morning and evening. The harness is on the hook by the door. He pulls toward squirrels.' },
          { id: newId(), label: 'Don’t', text: 'Don’t open the front door without the leash on. He bolts.' },
        ],
        cues: ['sit', 'down', 'stay', 'wait', 'leave', 'place'].map(cue),
      },
      {
        id: olive, kind: 'cat', name: 'Olive', emoji: '🐈‍⬛', about: 'Black cat, 11. Shy for the first day or two.',
        notes: [
          { id: newId(), label: 'Food', text: 'Half a can of the chicken pâté at breakfast and dinner. Dry food is always out; top it up.' },
          { id: newId(), label: 'Litter', text: 'Scoop once a day. Bags are under the bathroom sink.' },
          { id: newId(), label: 'Hiding spots', text: 'Under the guest bed, or the sunny window upstairs. Don’t worry if you don’t see her the first night.' },
          { id: newId(), label: 'Don’t', text: 'Keep the garage door shut. She gets behind the freezer.' },
        ],
        cues: [],
      },
    ],
    tasks: [
      { id: newId(), slot: 'morning', time: '07:00', what: 'Breakfast', who: biscuit, detail: '1 cup kibble and warm water', days: [] },
      { id: newId(), slot: 'morning', time: '07:00', what: 'Breakfast', who: olive, detail: 'Half a can', days: [] },
      { id: newId(), slot: 'morning', time: '07:15', what: 'Walk', who: biscuit, detail: '20 minutes', days: [] },
      { id: newId(), slot: 'morning', time: '07:15', what: 'Heartworm chew', who: biscuit, detail: 'Cupboard above the fridge', days: [addDays(from, 4)] },
      { id: newId(), slot: 'midday', time: '12:30', what: 'Out to the yard', who: biscuit, detail: '', days: [1, 2, 3, 4, 5] },
      { id: newId(), slot: 'evening', time: '18:00', what: 'Dinner', who: biscuit, detail: '1 cup kibble and warm water', days: [] },
      { id: newId(), slot: 'evening', time: '18:00', what: 'Dinner', who: olive, detail: 'Half a can', days: [] },
      { id: newId(), slot: 'evening', time: '18:30', what: 'Walk', who: biscuit, detail: '20 minutes', days: [] },
      { id: newId(), slot: 'evening', time: '20:00', what: 'Bins to the curb', who: 'house', detail: 'Trash and recycling. Pickup is Monday morning.', days: [trash] },
      { id: newId(), slot: 'bedtime', time: '22:00', what: 'Last trip out', who: biscuit, detail: 'Then lock the back door', days: [] },
      { id: newId(), slot: 'anytime', time: '', what: 'Scoop the litter box', who: olive, detail: '', days: [] },
      { id: newId(), slot: 'anytime', time: '', what: 'Bring in the mail', who: 'house', detail: '', days: [1, 2, 3, 4, 5, 6] },
      { id: newId(), slot: 'anytime', time: '', what: 'Water the tomatoes', who: 'house', detail: 'Back steps. Skip it if it rained.', days: [1, 3, 5] },
    ],
    wifi: { name: 'Maple House', pass: 'biscuit-2019' },
    house: [
      { id: newId(), label: 'Getting in', text: 'Keypad on the side door. The code is 1954, the year the house was built.', secret: true },
      { id: newId(), label: 'Thermostat', text: 'Leave it on 68. It’s in the hall by the bathroom.', secret: false },
      { id: newId(), label: 'Trash & recycling', text: 'Bins are beside the garage. Pickup is Monday morning, so they go out Sunday night.', secret: false },
      { id: newId(), label: 'Water shut-off', text: 'Basement, left of the water heater. Red handle; turn it clockwise.', secret: false },
      { id: newId(), label: 'Breaker panel', text: 'Basement, at the foot of the stairs.', secret: false },
      { id: newId(), label: 'Where things are', text: 'Paper towels and cleaner under the kitchen sink. Spare leash in the coat closet. Flashlight in the drawer by the stove.', secret: false },
    ],
    contacts: [
      { id: newId(), role: 'Backup', name: 'Dana next door (blue house)', phone: '(555) 010-0163', address: '', note: 'Has a spare key and knows both animals.' },
      { id: newId(), role: 'Vet', name: 'Lakeshore Animal Clinic', phone: '(555) 010-0120', address: '410 Lakeshore Dr', note: 'Dr. Patel knows Biscuit. Open 8 to 6, Saturday mornings.' },
      { id: newId(), role: 'Emergency vet', name: 'Northside 24-Hour Animal Hospital', phone: '(555) 010-0188', address: '2200 N Main St', note: 'Nights, Sundays and anything that can’t wait.' },
    ],
    notes: 'Help yourself to anything in the fridge. Biscuit will tell you he hasn’t been fed. He has.',
  });
  return s;
}

// The note Jess sent back last night, so the example shows both directions.
export function exampleSlip(sheet, now = Date.now()) {
  const day = sheet.from;
  const at = new Date(`${day}T19:42:00`).getTime();
  return makeSlip({
    sheet, from: 'Jess', day, now: Math.min(at, now),
    marks: ['well', 'photos'],
    done: [['Breakfast', 'Biscuit', '7:05 AM'], ['Breakfast', 'Olive', '7:05 AM'], ['Walk', 'Biscuit', '7:20 AM'], ['Dinner', 'Biscuit', '6:10 PM'], ['Dinner', 'Olive', '6:10 PM'], ['Walk', 'Biscuit', '6:40 PM']],
    msg: 'Biscuit found a tennis ball under the deck and won’t give it up. Olive came out for dinner and let me pet her.',
  });
}
