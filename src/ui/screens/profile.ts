import { h, starsEl, fmtTime } from '../dom.js';
import type { App, Screen } from '../app.js';
import { topbar } from '../components.js';
import { MISSIONS } from '../../data/missions.js';
import { levelProgress, missionRecord, totalStars } from '../../meta/progression.js';
import { menuScreen } from './menu.js';

export function profileScreen(app: App): Screen {
  const p = app.profile;
  const lp = levelProgress(p);
  const input = h('input', { class: 'input', id: 'callsign', value: p.callsign, maxlength: '18', autocomplete: 'off' });
  const saveName = () => {
    const v = input.value.trim();
    if (!v) { input.value = p.callsign; return; }
    if (v !== p.callsign) { p.callsign = v.slice(0, 18); app.save(); app.toast('Callsign saved'); }
  };
  input.addEventListener('blur', saveName);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });

  const rows = MISSIONS.map(m => {
    const r = missionRecord(p, m.id);
    return h('div', { class: 'reward-line' },
      h('span', null, h('span', { style: { display: 'block', fontWeight: '600' } }, m.name), h('span', { class: 'small muted' }, r.cleared ? `Best ${fmtTime(r.bestTime)} · ${r.bestDifficulty ?? ''} · ${r.wins}/${r.plays} won` : r.plays ? `${r.plays} attempts` : 'Not played')),
      starsEl(r.stars),
    );
  });

  const el = h('section', { class: 'screen' },
    topbar(app, 'Profile', () => { saveName(); app.go(menuScreen); }),
    h('div', { class: 'screen-scroll' },
      h('div', { class: 'field' }, h('label', { for: 'callsign' }, 'Callsign'), input),
      h('div', { class: 'panel stack' },
        h('div', { class: 'row between' }, h('span', { class: 'display', style: { fontSize: '20px' } }, `Level ${lp.level}`), h('span', { class: 'small muted num' }, `${p.xp} XP total`)),
        h('div', { class: 'bar' }, h('i', { style: { width: `${lp.into / lp.need * 100}%` } })),
        h('dl', { class: 'kv' },
          h('dt', null, 'Credits'), h('dd', null, String(p.credits)),
          h('dt', null, 'Battles'), h('dd', null, String(p.stats.battles)),
          h('dt', null, 'Wins'), h('dd', null, String(p.stats.wins)),
          h('dt', null, 'Enemy units destroyed'), h('dd', null, String(p.stats.kills)),
          h('dt', null, 'Cards deployed'), h('dd', null, String(p.stats.deployed)),
          h('dt', null, 'Campaign stars'), h('dd', null, `${totalStars(p)} / ${MISSIONS.length * 3}`),
        ),
      ),
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Service record'), h('div', null, ...rows)),
    ),
  );
  return { el, back: () => { saveName(); app.go(menuScreen); } };
}
