import { h, frag, starsEl, fmtTime } from '../dom.js';
import { pilotArt } from '../art.js';
import type { App, Screen } from '../app.js';
import { topbar, unitCard, segmented } from '../components.js';
import { MISSIONS, CAMPAIGN_NAME, missionById } from '../../data/missions.js';
import { MAPS } from '../../data/maps.js';
import { UNITS } from '../../data/units.js';
import { PILOTS } from '../../data/pilots.js';
import { isMissionUnlocked, missionRecord, nextMission, setPilot, validateDeck } from '../../meta/progression.js';
import type { Difficulty, MissionDef } from '../../data/types.js';
import { menuScreen } from './menu.js';
import { squadScreen } from './squad.js';
import { battleScreen } from './battle.js';

const MODE_LABEL: Record<MissionDef['mode'], string> = { hardpoint: 'Hardpoint', assault: 'Assault', defend: 'Defend', boss: 'Boss' };

export function campaignScreen(app: App): Screen {
  const p = app.profile;
  const current = nextMission(p);
  const list = h('div', { class: 'mission-list' });
  for (const m of MISSIONS) {
    const rec = missionRecord(p, m.id);
    const unlocked = isMissionUnlocked(p, m);
    const cls = ['mission', rec.cleared ? 'cleared' : '', m.id === current.id && !rec.cleared ? 'current' : '', unlocked ? '' : 'locked'].filter(Boolean).join(' ');
    list.append(h('button', {
      class: cls, disabled: !unlocked,
      'aria-label': `${m.name}${unlocked ? '' : ', locked'}${rec.cleared ? `, ${rec.stars} stars` : ''}`,
      onclick: () => { app.click(); app.go(a => briefingScreen(a, m.id)); },
    },
      h('span', { class: 'node' }, m.tutorial ? 'T' : String(m.index)),
      h('span', null,
        h('span', { class: 'name', style: { display: 'block' } }, m.name),
        h('span', { class: 'meta' }, h('span', { class: `mode-tag${m.mode === 'boss' ? ' boss' : ''}` }, m.tutorial ? 'Training' : MODE_LABEL[m.mode]), ' ', m.location),
      ),
      unlocked ? (rec.cleared ? starsEl(rec.stars) : h('span', { class: 'small muted' }, 'New')) : h('span', { class: 'small muted' }, 'Locked'),
    ));
  }
  const el = h('section', { class: 'screen' },
    topbar(app, 'Campaign', () => app.go(menuScreen)),
    h('div', { class: 'screen-scroll' },
      h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, CAMPAIGN_NAME),
        h('p', { class: 'muted small' }, 'Halcyon has locked the Branch gate behind a chain of command spires. Break the chain one sector at a time.'),
      ),
      list,
    ),
  );
  return { el, back: () => app.go(menuScreen) };
}

export function briefingScreen(app: App, missionId: string): Screen {
  const m = missionById(missionId)!;
  const p = app.profile;
  const rec = missionRecord(p, m.id);
  const map = MAPS[m.map];
  let difficulty: Difficulty = p.settings.difficulty;

  const pilots = h('div', { class: 'stack' });
  const renderPilots = () => {
    pilots.replaceChildren(...p.unlockedPilots.map(id => {
      const pl = PILOTS[id];
      const b = h('button', { class: 'pilot', 'aria-pressed': String(p.pilot === id), onclick: () => { app.click(); setPilot(p, id); app.save(); renderPilots(); } },
        frag(pilotArt(id)),
        h('span', null, h('span', { class: 'nm', style: { display: 'block' } }, pl.name), h('span', { class: 'small muted' }, `${pl.passive.label} · ${pl.ability === 'overclock' ? 'Overclock' : pl.ability === 'barrage' ? 'Barrage' : 'EMP Lance'}`)),
      );
      return b;
    }));
  };
  renderPilots();

  const deckOk = !validateDeck(p, p.deck);
  const deckRow = h('div', { class: 'roster' }, ...p.deck.map(id => unitCard(id, { level: p.unitLevels[id], onClick: () => app.go(a => squadScreen(a, b => briefingScreen(b, m.id))) })));
  const intel = Array.from(new Set(m.enemyDeck));
  const reward = rec.cleared ? m.repeat : m.firstClear;

  const launch = () => {
    app.audio.unlock();
    app.click();
    p.settings.difficulty = difficulty;
    app.save();
    app.go(a => battleScreen(a, { missionId: m.id, difficulty }));
  };

  const el = h('section', { class: 'screen' },
    topbar(app, m.name, () => app.go(campaignScreen)),
    h('div', { class: 'screen-scroll' },
      h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('span', { class: `mode-tag${m.mode === 'boss' ? ' boss' : ''}` }, m.tutorial ? 'Training' : MODE_LABEL[m.mode]), rec.cleared ? starsEl(rec.stars) : null),
        h('p', null, m.brief),
        h('div', { class: 'panel stack' },
          h('p', { class: 'eyebrow' }, 'Objective'),
          h('p', { style: { fontWeight: '600' } }, m.objective),
          h('p', { class: 'small muted' }, `${map.name}: ${map.desc}`),
          h('p', { class: 'small muted' }, `Time limit ${fmtTime(m.timeLimit)} · Frames cleared at ${fmtTime(m.heavyUnlock)} · Three stars: spire above 75% and finish within ${fmtTime(m.parTime)}`),
        ),
      ),
      h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, 'Enemy intelligence'),
        h('div', { class: 'tags' }, ...intel.map(u => h('span', { class: 'tag' }, UNITS[u].name)), m.boss ? h('span', { class: 'tag bad' }, UNITS[m.boss].name) : null),
        h('p', { class: 'small muted' }, m.enemyPilot ? `Commander: ${PILOTS[m.enemyPilot].name}. Enemy units at level ${m.enemyLevel}.` : `Enemy units at level ${m.enemyLevel}.`),
      ),
      h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, 'Difficulty'),
        segmented([{ value: 'recruit', label: 'Recruit' }, { value: 'veteran', label: 'Veteran' }, { value: 'elite', label: 'Elite' }], difficulty, v => { difficulty = v; }, 'Difficulty'),
        h('p', { class: 'small muted' }, 'Difficulty changes how the enemy commander thinks, not the strength of its units. Elite pays 1.5× replay rewards.'),
      ),
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Pilot'), pilots),
      h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Squad'), h('button', { class: 'btn ghost', style: { minHeight: '36px', fontSize: '14px', padding: '4px 12px' }, onclick: () => { app.click(); app.go(a => squadScreen(a, b => briefingScreen(b, m.id))); } }, 'Edit squad')),
        deckRow,
      ),
      h('div', { class: 'panel row between' },
        h('span', null, h('span', { class: 'eyebrow', style: { display: 'block' } }, rec.cleared ? 'Replay reward' : 'First-clear reward'), h('span', null, `${reward.credits} credits · ${reward.xp} XP`)),
        h('span', { class: 'small unlock', style: { textAlign: 'right' } }, ...(rec.cleared ? [] : [...(m.firstClear.unlockUnits ?? []).map(u => UNITS[u].name), ...(m.firstClear.unlockPilots ?? []).map(x => PILOTS[x].name)].map((t, i) => (i ? `, ${t}` : `Unlocks ${t}`)))),
      ),
      h('button', { class: 'btn block', onclick: launch, disabled: !deckOk, 'data-autofocus': true }, 'Launch'),
    ),
  );
  return { el, back: () => app.go(campaignScreen) };
}
