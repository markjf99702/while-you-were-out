// The sheet on paper, for the fridge: a checklist with a box for every job on every day,
// then who's who, the house, and who to call.
import * as M from './model.js';
import { app, esc, on, lines, framed } from './ui.js';
import { qrSVG } from './qr.js';

let hideCodes = false;

export function print(s) {
  document.title = `${s.title || 'Care sheet'} · While You Were Out`;
  draw(s);
  on({
    change(e) {
      if (e.target.id !== 'hideCodes') return;
      hideCodes = e.target.checked;
      draw(s);
    },
    click(e) {
      if (e.target.id === 'printBtn') window.print();
    },
  });
}

function columns(s) {
  const days = M.stayDays(s);
  if (days.length && days.length <= 10) {
    return days.map(d => ({ head: M.dayName(d, { weekday: 'short' }), sub: String(M.parse(d).getDate()), on: t => M.onDay(t, d) }));
  }
  // A long stay, or no dates: one column per weekday, to tick week after week.
  const WD = [1, 2, 3, 4, 5, 6, 0], names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return WD.map((n, i) => ({ head: names[i], sub: '', on: t => !t.days.length || t.days.includes(n) || t.days.some(d => typeof d === 'string' && M.weekday(d) === n) }));
}

function draw(s) {
  const cols = columns(s);
  const tasks = s.tasks.filter(t => t.what.trim());
  const groups = M.tasksBySlot([...tasks].sort((a, b) => (a.time || '99').localeCompare(b.time || '99')));
  const notes = s.house.filter(h => h.text.trim() && !(hideCodes && h.secret));
  const pass = hideCodes ? '' : s.wifi.pass;
  const wifi = s.wifi.name ? { name: s.wifi.name, pass } : null;
  const onDates = t => t.days.filter(d => typeof d === 'string').map(M.shortDay).join(', ');
  app.innerHTML = `
    <div class="print-tools">
      <a class="btn small" href="#/v/${s.id}/today">Back</a>
      <label class="check"><input type="checkbox" id="hideCodes"${hideCodes ? ' checked' : ''}> Leave off codes and the Wi-Fi password</label>
      ${framed() ? '<span class="hint">Open it on junkdrawer.works to print.</span>' : '<button type="button" class="btn small primary" id="printBtn">Print</button>'}
    </div>
    <div class="paper">
      <header class="p-mast">
        <div>
          <p class="p-kicker">While you were out</p>
          <h1>${esc(s.title || 'Care sheet')}</h1>
          <p class="p-sub">${[M.stayText(s), s.sitter.trim() && `For ${s.sitter.trim()}`].filter(Boolean).map(esc).join(' · ')}</p>
        </div>
        ${s.owner.phone ? `<div class="p-call"><span>Call ${esc(s.owner.name || 'me')}</span><b>${esc(s.owner.phone)}</b>${s.away ? `<small>${esc(s.away)}</small>` : ''}</div>` : ''}
      </header>

      ${tasks.length ? `
        <table class="p-grid">
          <thead><tr><th class="p-job">${cols[0]?.sub ? 'Tick as you go' : 'Tick week by week'}</th>${cols.map(c => `<th><span>${esc(c.head)}</span>${c.sub ? `<b>${esc(c.sub)}</b>` : ''}</th>`).join('')}</tr></thead>
          ${groups.map(g => `
            <tbody>
              <tr class="p-slot"><th colspan="${cols.length + 1}">${g.name}</th></tr>
              ${g.tasks.map(t => {
                const w = M.whoOf(s, t.who);
                const dates = onDates(t);
                return `<tr>
                  <td class="p-job"><span class="p-time">${t.time ? M.clock(t.time) : ''}</span><b>${esc(t.what)}</b>${w ? ` · ${esc(w.name)}` : t.who === 'house' ? ' · House' : ''}${t.detail ? `<small>${esc(t.detail)}</small>` : ''}${t.days.length ? `<small class="p-days">${esc(dates && !t.days.some(d => typeof d === 'number') ? `${dates} only` : M.daysText(t))}</small>` : ''}</td>
                  ${cols.map(c => `<td>${c.on(t) ? '<span class="p-box"></span>' : '<span class="p-no">–</span>'}</td>`).join('')}
                </tr>`;
              }).join('')}
            </tbody>`).join('')}
        </table>` : ''}

      <div class="p-cols">
        <div>
          ${s.charges.map(c => `
            <section class="p-card">
              <h2>${esc(c.emoji)} ${esc(c.name || M.KINDS[c.kind].name)}${c.about ? `<small>${esc(c.about)}</small>` : ''}</h2>
              ${c.notes.filter(n => n.text.trim()).map(n => `<p${M.isWarning(n.label) ? ' class="p-warn"' : ''}><b>${esc(n.label || 'Note')}.</b> ${lines(n.text)}</p>`).join('')}
              ${c.cues.filter(q => q.word.trim()).length ? `<p><b>Words ${esc(c.name || 'they')} know${c.name ? 's' : ''}.</b> ${c.cues.filter(q => q.word.trim()).map(q => `“${esc(q.word)}”${q.signal ? ` (${esc(q.signal.replace(/\.$/, ''))})` : ''}`).join(', ')}</p>` : ''}
            </section>`).join('')}
          ${s.notes.trim() ? `<section class="p-card"><h2>Anything else</h2><p>${lines(s.notes)}</p></section>` : ''}
        </div>
        <div>
          <section class="p-card p-contacts">
            <h2>Who to call</h2>
            <p class="p-sos">Emergency: <b>911</b></p>
            ${s.owner.phone ? `<p><b>${esc(s.owner.name || 'Me')}</b> ${esc(s.owner.phone)}</p>` : ''}
            ${s.contacts.filter(c => c.name || c.phone).map(c => `<p><b>${esc(c.role || 'Contact')}:</b> ${esc(c.name)} ${esc(c.phone)}${c.address ? `, ${esc(c.address)}` : ''}${c.note ? `<small>${esc(c.note)}</small>` : ''}</p>`).join('')}
            ${M.poisonLines(s).map(p => `<p><b>${esc(p.name)}:</b> ${esc(p.phone)}<small>${esc(p.note)}</small></p>`).join('')}
          </section>
          ${wifi || notes.length ? `
            <section class="p-card">
              <h2>The house</h2>
              ${wifi ? `
                <div class="p-wifi">
                  ${wifi.pass || !s.wifi.pass ? qrSVG(M.wifiCode(wifi), { label: 'Wi-Fi code' }) : ''}
                  <p><b>Wi-Fi:</b> ${esc(wifi.name)}${wifi.pass ? `<br><b>Password:</b> <span class="mono">${esc(wifi.pass)}</span>` : s.wifi.pass ? '<br>Ask for the password.' : ''}${wifi.pass || !s.wifi.pass ? '<small>Point a phone camera at the square to join.</small>' : ''}</p>
                </div>` : ''}
              ${notes.map(h => `<p><b>${esc(h.label || 'Note')}.</b> ${lines(h.text)}</p>`).join('')}
            </section>` : ''}
        </div>
      </div>
      <footer class="p-foot">Made with While You Were Out · junkdrawer.works/while-you-were-out</footer>
    </div>`;
}
