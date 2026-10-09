import { h, frag } from '../dom.js';
import { ICONS } from '../art.js';
import type { App, Screen } from '../app.js';
import { creditsChip } from '../components.js';
import { levelProgress, nextMission, totalStars } from '../../meta/progression.js';
import { MISSIONS, CAMPAIGN_NAME } from '../../data/missions.js';
import { campaignScreen } from './campaign.js';
import { squadScreen } from './squad.js';
import { hangarScreen } from './hangar.js';
import { profileScreen } from './profile.js';
import { settingsScreen } from './settings.js';
import { titleScreen } from './title.js';

export function menuScreen(app: App): Screen {
  app.audio.intensity = 0;
  const p = app.profile;
  const lp = levelProgress(p);
  const next = nextMission(p);
  const item = (icon: keyof typeof ICONS, t: string, s: string, go: () => void, primary = false) => {
    const b = h('button', { class: `menu-item${primary ? ' primary' : ''}`, onclick: () => { app.click(); go(); } },
      frag(ICONS[icon]),
      h('span', null, h('span', { class: 't', style: { display: 'block' } }, t), h('span', { class: 's' }, s)),
      h('span', { class: 'chev' }, frag(ICONS.chev)),
    );
    return b;
  };
  const el = h('section', { class: 'screen' },
    h('header', { class: 'topbar' },
      h('div', { class: 'title' }, h('p', { class: 'eyebrow' }, 'Corsair Union'), h('h1', { class: 'h2' }, p.callsign)),
      creditsChip(app),
    ),
    h('div', { class: 'screen-scroll' },
      h('div', { class: 'menu-head panel' },
        h('div', { class: 'row between' }, h('span', { class: 'display', style: { fontSize: '18px' } }, `Level ${lp.level}`), h('span', { class: 'small muted num' }, `${lp.into} / ${lp.need} XP`)),
        h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, lp.into / lp.need * 100)}%` } })),
        h('div', { class: 'row between small muted' }, h('span', null, `${totalStars(p)} / ${MISSIONS.length * 3} stars`), h('span', null, `${p.stats.wins} wins · ${p.stats.battles} battles`)),
      ),
      h('nav', { class: 'menu-list', 'aria-label': 'Main menu' },
        item('campaign', 'Campaign', `${CAMPAIGN_NAME.split('·')[1]?.trim() ?? ''} · Next: ${next.name}`, () => app.go(campaignScreen), true),
        item('squad', 'Squad', 'Choose your 8 cards and pilot', () => app.go(a => squadScreen(a, menuScreen))),
        item('hangar', 'Hangar', 'Unit details, upgrades and pilots', () => app.go(hangarScreen)),
        item('profile', 'Profile', 'Service record and campaign stars', () => app.go(profileScreen)),
        item('settings', 'Settings', 'Audio, display and difficulty', () => app.go(a => settingsScreen(a, menuScreen))),
      ),
    ),
  );
  return { el, back: () => app.go(titleScreen) };
}
