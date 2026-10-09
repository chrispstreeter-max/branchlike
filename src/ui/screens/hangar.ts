import { h, frag } from '../dom.js';
import { unitArt, pilotArt } from '../art.js';
import type { App, Screen } from '../app.js';
import { topbar, unitCard, statRows, counterTags, segmented, creditsChip } from '../components.js';
import { UNITS, ABILITIES, MAX_UNIT_LEVEL } from '../../data/units.js';
import { PILOTS, PLAYER_PILOTS } from '../../data/pilots.js';
import { MISSIONS } from '../../data/missions.js';
import { upgradeInfo, upgradeUnit } from '../../meta/progression.js';
import { menuScreen } from './menu.js';

let lastTab: 'units' | 'pilots' = 'units';

export function hangarScreen(app: App): Screen {
  const p = app.profile;
  const body = h('div', { class: 'stack' });
  const render = (tab: 'units' | 'pilots') => {
    lastTab = tab;
    if (tab === 'units') {
      const groups: [string, (k: string) => boolean][] = [['Hero frames', k => k === 'hero'], ['Frames and vehicles', k => k === 'mech' || k === 'vehicle'], ['Infantry, drones, structures and strikes', k => k === 'infantry' || k === 'drone' || k === 'structure' || k === 'strike']];
      body.replaceChildren(...groups.map(([title, f]) => h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, title),
        h('div', { class: 'roster' }, ...Object.values(UNITS).filter(u => u.deployable && f(u.kind)).map(u => {
          const locked = !p.unlockedUnits.includes(u.id);
          return unitCard(u.id, { level: locked ? undefined : p.unitLevels[u.id], locked, onClick: () => { app.click(); app.go(a => unitDetailScreen(a, u.id)); } });
        })),
      )));
    } else {
      body.replaceChildren(...PLAYER_PILOTS.map(id => {
        const pl = PILOTS[id];
        const locked = !p.unlockedPilots.includes(id);
        const src = MISSIONS.find(m => m.firstClear.unlockPilots?.includes(id));
        return h('div', { class: `pilot${locked ? ' locked' : ''}`, style: { alignItems: 'start' } },
          frag(pilotArt(id)),
          h('div', { class: 'stack', style: { gap: '4px' } },
            h('span', null, h('span', { class: 'nm' }, pl.name), h('span', { class: 'small muted' }, ` · ${pl.callsign}`)),
            h('p', { class: 'small muted' }, pl.bio),
            h('p', { class: 'small' }, h('b', null, 'Passive: '), pl.passive.label),
            h('p', { class: 'small' }, h('b', null, `${ABILITIES[pl.ability].name}: `), ABILITIES[pl.ability].desc, ` Cooldown ${ABILITIES[pl.ability].cooldown}s.`),
            locked ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, src ? `Unlocks by clearing ${src.name}.` : 'Locked') : null,
          ),
        );
      }));
    }
  };
  const el = h('section', { class: 'screen' },
    topbar(app, 'Hangar', () => app.go(menuScreen)),
    h('div', { class: 'screen-scroll' },
      segmented([{ value: 'units', label: 'Units' }, { value: 'pilots', label: 'Pilots' }], lastTab, v => render(v), 'Hangar section'),
      body,
    ),
  );
  render(lastTab);
  return { el, back: () => app.go(menuScreen) };
}

export function unitDetailScreen(app: App, id: string): Screen {
  const p = app.profile;
  const d = UNITS[id];
  const locked = !p.unlockedUnits.includes(id);
  const src = MISSIONS.find(m => m.firstClear.unlockUnits?.includes(id));
  const content = h('div', { class: 'screen-scroll' });
  const credits = creditsChip(app);
  const render = () => {
    const info = upgradeInfo(p, id);
    const tags = counterTags(d);
    content.replaceChildren(
      h('div', { class: 'detail-art' }, frag(unitArt(id))),
      h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, d.roleLabel), h('span', { class: 'chip' }, 'Cost ', h('span', { class: 'num', style: { color: 'var(--supply)' } }, String(d.cost)))),
        h('p', null, d.desc),
        h('div', { class: 'tags' }, ...tags.strong.map(t => h('span', { class: 'tag good' }, `Strong vs ${t.toLowerCase()}`)), ...tags.weak.map(t => h('span', { class: 'tag bad' }, t)), d.capture ? h('span', { class: 'tag' }, `Captures ×${d.capture}`) : h('span', { class: 'tag' }, 'Cannot capture'), d.heavy ? h('span', { class: 'tag' }, 'Needs frame clearance') : null),
      ),
      h('div', { class: 'panel stack' }, h('p', { class: 'eyebrow' }, locked ? 'Stats' : `Stats at level ${info.level}`), statRows(d, locked ? 1 : info.level)),
      locked
        ? h('p', { class: 'panel', style: { color: 'var(--warn)' } }, src ? `Unlocks by clearing ${src.name}.` : 'Not available yet.')
        : h('div', { class: 'panel stack' },
          h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, 'Upgrade'), h('span', { class: 'small muted' }, `Level ${info.level} of ${MAX_UNIT_LEVEL} · +8% health and damage per level`)),
          h('div', { class: 'bar' }, h('i', { style: { width: `${info.level / MAX_UNIT_LEVEL * 100}%` } })),
          info.error === 'max'
            ? h('p', { class: 'small muted' }, 'Fully upgraded.')
            : h('button', { class: 'btn block', disabled: info.error === 'credits', onclick: () => {
              const err = upgradeUnit(p, id);
              if (err) { app.toast(err === 'credits' ? 'Not enough credits' : 'Cannot upgrade', true); return; }
              app.save(); app.audio.play('unlock'); app.toast(`${d.name} upgraded to level ${p.unitLevels[id]}`);
              credits.replaceWith(creditsChip(app));
              render();
            } }, `Upgrade to level ${info.level + 1}`, h('small', null, ` · ${info.cost} credits`)),
          info.error === 'credits' ? h('p', { class: 'small muted' }, `You need ${info.cost - p.credits} more credits. Win missions to earn them.`) : null,
        ),
    );
  };
  render();
  const el = h('section', { class: 'screen' }, topbar(app, d.name, () => app.go(hangarScreen), credits), content);
  return { el, back: () => app.go(hangarScreen) };
}
