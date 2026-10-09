import { h, fmtTime, starsEl } from '../dom.js';
import type { App, Screen } from '../app.js';
import { MISSIONS } from '../../data/missions.js';
import { UNITS } from '../../data/units.js';
import { PILOTS } from '../../data/pilots.js';
import type { Difficulty, MissionDef } from '../../data/types.js';
import type { BattleResult, Side } from '../../sim/battle.js';
import type { RewardReport } from '../../meta/progression.js';
import { campaignScreen, briefingScreen } from './campaign.js';
import { hangarScreen } from './hangar.js';

export interface ResultsParams {
  mission: MissionDef; result: BattleResult; report: RewardReport; stats: Side['stats']; enemyStats: Side['stats']; difficulty: Difficulty; coreHpFrac: number;
}

const REASON: Record<string, [string, string]> = {
  score: ['Score target reached first.', 'Halcyon reached the score target first.'],
  core: ['The Halcyon spire is down.', 'Your spire was destroyed.'],
  boss: ['HALBERD PRIME is destroyed.', ''],
  survived: ['The evac trains are clear of the yard.', ''],
  timeout: ['Time expired with the advantage on your side.', 'Time expired without a decisive advantage.'],
};

export function resultsScreen(app: App, r: ResultsParams): Screen {
  const won = r.result.winner === 0;
  const next = won ? MISSIONS.find(m => m.index === r.mission.index + 1) : undefined;
  const rep = r.report;
  if (rep.unlockedUnits.length || rep.unlockedPilots.length || rep.levelUps.length) setTimeout(() => app.audio.play('unlock'), 900);

  const rewards = h('div', { class: 'panel' },
    h('div', { class: 'reward-line' }, h('span', null, rep.firstClear ? 'First-clear reward' : won ? 'Mission reward' : 'Service XP'), h('span', { class: 'num' }, `+${rep.credits} cr · +${rep.xp} XP`)),
    ...rep.levelUps.map(l => h('div', { class: 'reward-line' }, h('span', { class: 'unlock' }, `Promoted to level ${l}`), h('span', { class: 'num' }, '+50 cr'))),
    ...rep.unlockedUnits.map(u => h('div', { class: 'reward-line' }, h('span', { class: 'unlock' }, `Unlocked: ${UNITS[u].name}`), h('span', { class: 'small muted' }, UNITS[u].roleLabel))),
    ...rep.unlockedPilots.map(pl => h('div', { class: 'reward-line' }, h('span', { class: 'unlock' }, `New pilot: ${PILOTS[pl].name}`), h('span', { class: 'small muted' }, PILOTS[pl].callsign))),
    rep.newBest && !rep.firstClear ? h('div', { class: 'reward-line' }, h('span', { class: 'unlock' }, 'New best rating'), starsEl(rep.stars)) : null,
  );

  const el = h('section', { class: 'screen' },
    h('div', { class: 'screen-scroll' },
      h('div', { class: `result-hero ${won ? 'win' : 'loss'}` },
        h('p', { class: 'eyebrow' }, `${r.mission.name} · ${r.difficulty}`),
        h('p', { class: 'big' }, won ? 'Victory' : r.result.winner === null ? 'Stalemate' : 'Defeat'),
        h('p', { class: 'muted' }, REASON[r.result.reason]?.[won ? 0 : 1] ?? ''),
        won ? starsEl(rep.stars) : null,
      ),
      h('dl', { class: 'kv panel' },
        h('dt', null, 'Battle time'), h('dd', null, fmtTime(r.result.time)),
        h('dt', null, 'Your spire'), h('dd', null, `${Math.max(0, Math.round(r.coreHpFrac * 100))}%`),
        h('dt', null, 'Cards deployed'), h('dd', null, String(r.stats.deployed)),
        h('dt', null, 'Enemy units destroyed'), h('dd', null, String(r.stats.kills)),
        h('dt', null, 'Units lost'), h('dd', null, String(r.stats.lost)),
        h('dt', null, 'Abilities used'), h('dd', null, String(r.stats.abilities)),
      ),
      rewards,
      won && !rep.firstClear ? null : !won ? h('p', { class: 'small muted' }, 'Tip: check the enemy intelligence on the briefing and bring counters. Breaker Teams crack frames; rifles and Hounds shred infantry and drones.') : null,
      h('div', { class: 'stack' },
        next ? h('button', { class: 'btn block', 'data-autofocus': true, onclick: () => { app.click(); app.go(a => briefingScreen(a, next.id)); } }, `Next: ${next.name}`) : null,
        h('button', { class: `btn ${next ? 'ghost ' : ''}block`, 'data-autofocus': !next || undefined, onclick: () => { app.click(); app.go(a => briefingScreen(a, r.mission.id)); } }, won ? 'Replay mission' : 'Retry'),
        h('div', { class: 'grid2' },
          h('button', { class: 'btn ghost', onclick: () => { app.click(); app.go(hangarScreen); } }, 'Hangar'),
          h('button', { class: 'btn ghost', onclick: () => { app.click(); app.go(campaignScreen); } }, 'Campaign'),
        ),
      ),
    ),
  );
  return { el, back: () => app.go(campaignScreen) };
}
