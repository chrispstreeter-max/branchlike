import { h, frag, fmtTime } from '../dom.js';
import { unitArt, ICONS } from '../art.js';
import type { App, Screen } from '../app.js';
import { settingsControls } from './settings.js';
import { resultsScreen } from './results.js';
import { campaignScreen } from './campaign.js';
import { missionById } from '../../data/missions.js';
import { UNITS, ABILITIES } from '../../data/units.js';
import type { Difficulty, Team, AbilityId } from '../../data/types.js';
import { createBattle, step, deploy, checkDeploy, useAbility, checkAbility, coreOf, entityById, handCards, nextCard, heavyUnlocked, DT, SUPPLY_MAX, type Battle, type DeployError, type AbilityError } from '../../sim/battle.js';
import { createAi, aiStep, type AiState } from '../../sim/ai.js';
import { createBattleView, type BattleView } from '../../render/view.js';
import { deckCards, enemyDeckFor, applyBattleResult } from '../../meta/progression.js';

export interface BattleParams { missionId: string; difficulty: Difficulty }

const DEPLOY_MSG: Record<DeployError, string> = {
  over: 'The battle is over', no_card: 'Pick a card first', locked: 'Frames are not cleared yet', hero_active: 'That hero frame is already deployed',
  supply: 'Not enough supply', zone: 'Drop below the dashed line, or next to a hardpoint you hold', blocked: 'Blocked by terrain',
};
const ABILITY_MSG: Record<AbilityError, string> = {
  over: 'The battle is over', no_pilot: 'No pilot selected', cooldown: 'Still recharging', no_unit: 'Hero not on the field', needs_target: 'Tap the battlefield to aim', out_of_range: 'Target is out of range',
};

interface Coach { text: string; done: (b: Battle, ui: UiState) => boolean; minTime?: number; maxTime?: number }
interface UiState { selected: number | null; deploys: number; captures: number; abilityUsed: boolean; inspected: boolean }

export function battleScreen(app: App, params: BattleParams): Screen {
  const mission = missionById(params.missionId)!;
  const p = app.profile;
  const query = new URLSearchParams(location.search);
  const debug = query.get('debug') === '1';
  const speed = debug ? Number(query.get('speed')) || 1 : 1;
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const battleId = `${mission.id}:${seed.toString(16)}:${Date.now().toString(36)}`;
  const b: Battle = createBattle({ mission, seed, player: { deck: deckCards(p), pilot: p.pilot }, enemy: { deck: enemyDeckFor(mission), pilot: mission.enemyPilot } });
  const ai: AiState = createAi(b, 1, params.difficulty);
  app.audio.intensity = 1;
  app.root.classList.add('wide'); // battles use the full screen width, including landscape

  // ---------------------------------------------------------------- DOM
  // The view (3D, or 2D fallback) loads asynchronously; until then these calls are no-ops.
  let view: BattleView | null = null;
  const renderer = {
    toWorld: (x: number, y: number) => view ? view.toWorld(x, y) : { x: -1, y: -1, inside: false },
    overCanvas: (x: number, y: number) => view ? view.overCanvas(x, y) : false,
    pick: (bb: Battle, x: number, y: number) => view ? view.pick(bb, x, y) : null,
    ingest: (ev: Battle['events'], rm: boolean) => view?.ingest(ev, rm),
    draw: (bb: Battle, o: Parameters<BattleView['draw']>[1], dt: number) => view?.draw(bb, o, dt),
  };
  const stage = h('div', { class: 'stage', role: 'application', 'aria-label': `Battlefield: ${mission.name}` });
  const scoreL = h('span', { class: 'val' }), scoreR = h('span', { class: 'val' });
  const barL = h('i'), barR = h('i');
  const lblL = h('span', { class: 'lbl' }), lblR = h('span', { class: 'lbl' });
  const pts = h('div', { class: 'pts' }, ...b.points.map(pt => h('span', { class: 'pt', 'data-id': pt.id }, pt.id)));
  const clock = h('span', { class: 'clock' });
  const pauseBtn = h('button', { class: 'icon-btn', 'aria-label': 'Pause', title: 'Pause (Esc)', onclick: () => pause() });
  pauseBtn.append(frag(ICONS.pause));
  const hud = h('div', { class: 'hud-top' },
    h('div', { class: 'side-score you' }, lblL, scoreL, h('div', { class: 'bar' }, barL)),
    h('div', { class: 'hud-mid' }, pts, clock),
    h('div', { class: 'side-score foe' }, lblR, scoreR, h('div', { class: 'bar' }, barR)),
    pauseBtn,
  );
  const supplyVal = h('span', { class: 'val' }), supplyBar = h('i'), nextLbl = h('span', { class: 'next' });
  const abilities = h('div', { class: 'abilities' });
  const hand = h('div', { class: 'hand', role: 'toolbar', 'aria-label': 'Cards in hand' });
  const tray = h('div', { class: 'tray' }, h('div', { class: 'supply' }, supplyVal, h('div', { class: 'sbar', role: 'progressbar', 'aria-label': 'Supply', 'aria-valuemin': '0', 'aria-valuemax': String(SUPPLY_MAX) }, supplyBar), nextLbl), abilities, hand);
  const el = h('section', { class: 'battle' }, hud, stage, tray);

  // ---------------------------------------------------------------- state
  const ui: UiState = { selected: null, deploys: 0, captures: 0, abilityUsed: false, inspected: false };
  let selectedCard: number | null = null;
  let ghost: { unit: string; x: number; y: number; valid: boolean } | null = null;
  let targeting: { source: number | 'pilot'; ability: AbilityId } | null = null;
  let aim: { x: number; y: number } | null = null;
  let disposed = false;
  let paused = false, finished = false, raf = 0, last = performance.now(), acc = 0;
  let drag: { index: number; startX: number; startY: number; moved: boolean; ghostEl: HTMLElement } | null = null;
  let infoEl: HTMLElement | null = null;
  let toastEl: HTMLElement | null = null, toastT = 0;
  const pointOwners = b.points.map(() => null as Team | null);

  const toast = (msg: string, bad = false) => {
    toastEl?.remove();
    toastEl = h('div', { class: `toast${bad ? ' bad' : ''}`, role: 'status' }, msg);
    stage.append(toastEl);
    toastT = 2;
    if (bad) app.audio.play('error');
  };

  // ---------------------------------------------------------------- hand
  let handKey = '';
  const renderHand = () => {
    const cards = handCards(b, 0);
    const key = cards.map(c => c.unit).join() + '|' + selectedCard;
    if (key === handKey) return;
    handKey = key;
    hand.replaceChildren(...cards.map((c, i) => {
      const d = UNITS[c.unit];
      const kindLabel: Record<string, string> = { infantry: 'Inf', drone: 'Drone', vehicle: 'Vehicle', mech: 'Frame', hero: 'Hero', structure: 'Struct' };
      const btn = h('button', { class: 'card', 'data-i': String(i), 'data-kind': d.kind, 'aria-label': `${d.name}, ${d.cost} supply. Key ${i + 1}` },
        h('span', { class: 'fill' }),
        h('span', { class: 'cost' }, String(d.cost)),
        h('span', { class: 'kind' }, (kindLabel[d.kind] ?? '') + (c.level > 1 ? ` · L${c.level}` : '')),
        h('span', { class: 'nm' }, d.name),
        d.heavy ? h('span', { class: 'lock', hidden: true }, h('span', null, h('span', { class: 'lt' }), h('small', null, 'Clearance'))) : null,
      );
      btn.prepend(frag(unitArt(c.unit)));
      btn.addEventListener('pointerdown', ev => onCardDown(ev, i));
      return btn;
    }));
    const n = nextCard(b, 0);
    nextLbl.textContent = `Next: ${UNITS[n.unit].name}`;
  };
  const updateHandState = () => {
    const cards = handCards(b, 0), s = b.sides[0];
    hand.querySelectorAll<HTMLElement>('.card').forEach((cardEl, i) => {
      const d = UNITS[cards[i].unit];
      cardEl.classList.toggle('sel', selectedCard === i);
      cardEl.classList.toggle('poor', d.cost > s.supply);
      const fill = cardEl.querySelector<HTMLElement>('.fill')!;
      fill.style.height = `${Math.min(100, s.supply / d.cost * 100)}%`;
      fill.style.opacity = d.cost > s.supply ? '1' : '0';
      const lock = cardEl.querySelector<HTMLElement>('.lock');
      if (lock) {
        const locked = d.heavy && !heavyUnlocked(b);
        lock.hidden = !locked;
        if (locked) lock.querySelector('.lt')!.textContent = fmtTime(b.mission.heavyUnlock - b.t);
        else if (d.hero && b.ents.some(e => e.team === 0 && e.def.id === d.id)) { lock.hidden = false; lock.querySelector('.lt')!.textContent = 'Active'; lock.querySelector('small')!.textContent = 'On field'; }
      }
    });
  };

  // ---------------------------------------------------------------- abilities
  let abilityKey = '';
  const abilitySources = () => {
    const out: { id: number | 'pilot'; ab: AbilityId; who: string }[] = [];
    const s = b.sides[0];
    if (s.pilot) out.push({ id: 'pilot', ab: s.pilot.ability, who: s.pilot.name });
    for (const e of b.ents) if (e.team === 0 && e.def.ability && e.def.hero) out.push({ id: e.id, ab: e.def.ability, who: e.def.name });
    return out;
  };
  const renderAbilities = () => {
    const src = abilitySources();
    const key = src.map(x => x.id).join() + '|' + (targeting ? targeting.source : '');
    if (key !== abilityKey) {
      abilityKey = key;
      abilities.replaceChildren(...src.map(s => {
        const btn = h('button', { class: 'abtn', 'data-src': String(s.id), 'aria-label': `${ABILITIES[s.ab].name}, ${s.who}` },
          h('span', null, h('span', { class: 'who' }, s.who), h('span', { class: 'an' }, ABILITIES[s.ab].name)),
          h('span', { class: 'cd' }),
        );
        btn.addEventListener('click', () => onAbility(s.id, s.ab));
        return btn;
      }));
    }
    for (const btn of abilities.querySelectorAll<HTMLButtonElement>('.abtn')) {
      const id = btn.dataset.src === 'pilot' ? 'pilot' : Number(btn.dataset.src);
      const src2 = src.find(x => x.id === id); if (!src2) continue;
      const cd = id === 'pilot' ? b.sides[0].pilotCd : entityById(b, id as number)?.abilityCd ?? 0;
      const max = ABILITIES[src2.ab].cooldown;
      (btn.querySelector('.cd') as HTMLElement).style.width = `${Math.min(100, cd / max * 100)}%`;
      btn.classList.toggle('ready', cd <= 0);
      btn.classList.toggle('armed', !!targeting && targeting.source === id);
    }
  };
  const onAbility = (source: number | 'pilot', ab: AbilityId) => {
    if (finished || paused) return;
    if (targeting && targeting.source === source) { targeting = null; abilityKey = ''; return; }
    const def = ABILITIES[ab];
    const err = checkAbility(b, 0, source, def.targeted ? 180 : undefined, def.targeted ? 320 : undefined);
    if (err === 'cooldown' || err === 'no_unit' || err === 'over') { toast(ABILITY_MSG[err], true); return; }
    if (!def.targeted) {
      const e2 = useAbility(b, 0, source);
      if (e2) toast(ABILITY_MSG[e2], true); else { ui.abilityUsed = true; app.audio.play('ability'); }
      return;
    }
    selectedCard = null; ghost = null;
    targeting = { source, ability: ab };
    abilityKey = '';
    toast(`Tap the battlefield to aim ${def.name}`);
  };

  // ---------------------------------------------------------------- input
  const tryDeployAt = (index: number, cx: number, cy: number) => {
    const w = renderer.toWorld(cx, cy);
    const err = deploy(b, 0, index, w.x, w.y);
    if (err) { toast(DEPLOY_MSG[err], true); return false; }
    ui.deploys++;
    selectedCard = null; ghost = null; handKey = '';
    renderHand();
    return true;
  };
  const updateGhost = (cx: number, cy: number) => {
    if (selectedCard === null) { ghost = null; return; }
    const w = renderer.toWorld(cx, cy);
    const card = handCards(b, 0)[selectedCard];
    const err = checkDeploy(b, 0, selectedCard, w.x, w.y);
    ghost = { unit: card.unit, x: w.x, y: w.y, valid: !err || err === 'supply' };
  };
  const onCardDown = (ev: PointerEvent, index: number) => {
    if (finished || paused) return;
    ev.preventDefault();
    targeting = null; abilityKey = '';
    const card = handCards(b, 0)[index];
    const d = UNITS[card.unit];
    if (d.heavy && !heavyUnlocked(b)) { toast(`Frames are cleared at ${fmtTime(b.mission.heavyUnlock)}`, true); return; }
    const ghostEl = h('div', { class: 'drag-ghost', hidden: true });
    ghostEl.append(frag(unitArt(card.unit)));
    app.root.append(ghostEl);
    drag = { index, startX: ev.clientX, startY: ev.clientY, moved: false, ghostEl };
  };
  const onMove = (ev: PointerEvent) => {
    if (drag) {
      if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 12) { drag.moved = true; selectedCard = drag.index; ui.selected = null; closeInfo(); }
      if (drag.moved) {
        const over = renderer.overCanvas(ev.clientX, ev.clientY);
        drag.ghostEl.hidden = over;
        drag.ghostEl.style.left = `${ev.clientX}px`; drag.ghostEl.style.top = `${ev.clientY}px`;
        if (over) updateGhost(ev.clientX, ev.clientY); else ghost = null;
      }
      return;
    }
    if (targeting && renderer.overCanvas(ev.clientX, ev.clientY)) { const w = renderer.toWorld(ev.clientX, ev.clientY); aim = { x: w.x, y: w.y }; }
    else if (selectedCard !== null && ev.pointerType === 'mouse' && renderer.overCanvas(ev.clientX, ev.clientY)) updateGhost(ev.clientX, ev.clientY);
  };
  const onUp = (ev: PointerEvent) => {
    if (!drag) return;
    const d = drag; drag = null; d.ghostEl.remove();
    if (d.moved) {
      if (renderer.overCanvas(ev.clientX, ev.clientY)) tryDeployAt(d.index, ev.clientX, ev.clientY);
      selectedCard = null; ghost = null;
    } else {
      selectedCard = selectedCard === d.index ? null : d.index;
      ghost = null;
      if (selectedCard !== null) { app.click(); closeInfo(); }
    }
    handKey = ''; renderHand();
  };
  const onCanvasDown = (ev: PointerEvent) => {
    if (finished || paused || drag) return;
    const w = renderer.toWorld(ev.clientX, ev.clientY);
    if (targeting) {
      const t = targeting;
      const err = useAbility(b, 0, t.source, w.x, w.y);
      if (err) { toast(ABILITY_MSG[err], true); return; }
      ui.abilityUsed = true; app.audio.play('ability');
      targeting = null; aim = null; abilityKey = '';
      return;
    }
    if (selectedCard !== null) {
      if (ev.pointerType !== 'mouse') updateGhost(ev.clientX, ev.clientY);
      tryDeployAt(selectedCard, ev.clientX, ev.clientY);
      return;
    }
    const picked = renderer.pick(b, ev.clientX, ev.clientY);
    if (picked) { ui.selected = picked.id; ui.inspected = true; openInfo(); }
    else closeInfo();
  };
  stage.addEventListener('pointerdown', onCanvasDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  const onKey = (ev: KeyboardEvent) => {
    if (finished) return;
    if (ev.key === 'Escape') { if (targeting || selectedCard !== null) { targeting = null; selectedCard = null; ghost = null; handKey = ''; abilityKey = ''; } else if (paused) resume(); else pause(); return; }
    if (paused) return;
    const n = Number(ev.key);
    if (n >= 1 && n <= 4) { selectedCard = selectedCard === n - 1 ? null : n - 1; handKey = ''; }
    if (ev.key === ' ') { ev.preventDefault(); pause(); }
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- unit info
  const openInfo = () => {
    closeInfo();
    infoEl = h('div', { class: 'unit-info', role: 'status' });
    stage.append(infoEl);
    updateInfo();
  };
  const closeInfo = () => { infoEl?.remove(); infoEl = null; ui.selected = null; };
  const updateInfo = () => {
    if (!infoEl || ui.selected === null) return;
    const e = entityById(b, ui.selected);
    if (!e) { closeInfo(); return; }
    const t = e.targetId ? entityById(b, e.targetId) : undefined;
    const side = e.team === 0 ? 'Corsair Union' : 'Halcyon';
    infoEl.replaceChildren(
      h('span', { class: 'nm' }, e.def.name), h('span', { class: 'small muted' }, side + (e.level > 1 ? ` · L${e.level}` : '')),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.max(0, e.hp / e.maxHp * 100)}%`, background: e.team === 0 ? 'var(--union)' : 'var(--halcyon)' } })),
      h('span', { class: 'small muted' }, `${Math.ceil(e.hp)} / ${Math.round(e.maxHp)} health · ${e.def.roleLabel}`),
      h('span', { class: 'small muted' }, e.stun > 0 ? 'Stunned' : e.aegis > 0 ? 'Shielded' : t ? `Target: ${t.def.name}` : e.def.weapon ? 'No target' : ''),
    );
  };

  // ---------------------------------------------------------------- tutorial
  const coachSteps: Coach[] = mission.tutorial ? [
    { text: 'Drag a card onto the battlefield, or tap a card and then tap the ground. You can drop units below the dashed line.', done: (_b, u) => u.deploys > 0 },
    { text: 'Units move and fight on their own. Rifle Squads and Wasp Drones capture hardpoints A, B and C by standing on them. Each point you hold scores.', done: (_b, u) => u.captures > 0, minTime: 4 },
    { text: 'Supply refills over time, up to 10. Once you hold a point, you can also drop units right beside it.', done: () => false, maxTime: 9 },
    { text: 'Frames are cleared. Heavy cards like the Warden Frame and KESTREL-9 are now available. Rocket teams are the answer to enemy armour.', done: () => false, maxTime: 9 },
    { text: 'Your pilot ability is ready. Tap it above your cards to use it.', done: (_b, u) => u.abilityUsed, minTime: 2 },
    { text: 'Tap any unit to see its health, range and target. Win by reaching the score first.', done: (_b, u) => u.inspected, minTime: 3 },
  ] : [];
  let coachIdx = 0, coachShownAt = 0;
  const coachEl = h('div', { class: 'coach', role: 'note' });
  const showCoach = () => {
    if (coachIdx >= coachSteps.length) { coachEl.remove(); if (mission.tutorial && !p.tutorialSeen) { p.tutorialSeen = true; app.save(); } return; }
    // Step 3 waits for clearance, step 4 waits for the pilot cooldown.
    if (coachIdx === 3 && !heavyUnlocked(b)) { coachEl.remove(); return; }
    if (coachIdx === 4 && b.sides[0].pilotCd > 0) { coachEl.remove(); return; }
    if (!coachEl.isConnected) { stage.append(coachEl); coachShownAt = b.t; renderCoach(); }
  };
  const renderCoach = () => {
    const x = h('button', { class: 'icon-btn x', 'aria-label': 'Skip tutorial', title: 'Skip tutorial', style: { width: '32px', height: '32px' }, onclick: () => { coachIdx = coachSteps.length; coachEl.remove(); p.tutorialSeen = true; app.save(); } });
    x.append(frag(ICONS.close));
    coachEl.replaceChildren(h('div', null, h('b', null, `Training ${coachIdx + 1}/${coachSteps.length}`), h('p', null, coachSteps[coachIdx].text)), x);
  };
  const tickCoach = () => {
    if (!coachSteps.length || coachIdx >= coachSteps.length) return;
    showCoach();
    if (!coachEl.isConnected) return;
    const s = coachSteps[coachIdx];
    const elapsed = b.t - coachShownAt;
    if ((elapsed >= (s.minTime ?? 0) && s.done(b, ui)) || (s.maxTime !== undefined && elapsed >= s.maxTime)) {
      coachIdx++; coachEl.remove();
    }
  };

  // ---------------------------------------------------------------- HUD
  const pct = (e: { hp: number; maxHp: number } | undefined) => e ? Math.max(0, Math.ceil(e.hp / e.maxHp * 100)) : 0;
  const updateHud = () => {
    const m = b.mission;
    const s0 = b.sides[0], s1 = b.sides[1];
    if (m.mode === 'hardpoint') {
      lblL.textContent = 'Corsair Union'; lblR.textContent = 'Halcyon';
      scoreL.textContent = String(Math.floor(s0.score)); scoreR.textContent = String(Math.floor(s1.score));
      barL.style.width = `${Math.min(100, s0.score / m.scoreTarget! * 100)}%`; barR.style.width = `${Math.min(100, s1.score / m.scoreTarget! * 100)}%`;
    } else {
      const c0 = coreOf(b, 0), c1 = coreOf(b, 1);
      lblL.textContent = 'Your spire'; scoreL.textContent = `${pct(c0)}%`; barL.style.width = `${pct(c0)}%`;
      if (m.mode === 'boss') { const boss = entityById(b, b.bossId); lblR.textContent = boss?.def.name ?? 'Target'; scoreR.textContent = `${pct(boss)}%`; barR.style.width = `${pct(boss)}%`; }
      else if (m.mode === 'defend') { lblR.textContent = 'Evac trains'; const f = Math.min(1, b.t / m.timeLimit); scoreR.textContent = `${Math.floor(f * 100)}%`; barR.style.width = `${f * 100}%`; }
      else { lblR.textContent = 'Halcyon spire'; scoreR.textContent = `${pct(c1)}%`; barR.style.width = `${pct(c1)}%`; }
    }
    b.points.forEach((pt, i) => { (pts.children[i] as HTMLElement).className = `pt${pt.owner !== null ? ' o' + pt.owner : ''}`; });
    const remaining = m.timeLimit - b.t;
    clock.textContent = m.mode === 'defend' ? `Hold ${fmtTime(remaining)}` : fmtTime(remaining);
    clock.classList.toggle('urgent', remaining < 30);
    supplyVal.textContent = String(Math.floor(s0.supply));
    supplyBar.style.width = `${s0.supply / SUPPLY_MAX * 100}%`;
  };

  // ---------------------------------------------------------------- events → audio
  const onEvents = () => {
    for (const ev of b.events) {
      switch (ev.type) {
        case 'shot': app.audio.play(ev.heavy ? 'shotHeavy' : 'shot'); break;
        case 'shell': app.audio.play('shell'); break;
        case 'blast': app.audio.play('blast'); break;
        case 'death': if (ev.size >= 12) app.audio.play('bigBlast'); break;
        case 'deploy': app.audio.play(ev.heavy ? 'deployHeavy' : 'deploy'); break;
        case 'heal': app.audio.play('heal'); break;
        case 'ability': if (ev.team === 1) { app.audio.play('ability'); toast(`Enemy ${ABILITIES[ev.ability].name}!`); } break;
        case 'capture': {
          const i = b.points.findIndex(pt => pt.id === ev.point);
          const prev = pointOwners[i]; pointOwners[i] = ev.team;
          if (ev.team === 0) { ui.captures++; app.audio.play('capture'); toast(`Hardpoint ${ev.point} secured`); }
          else if (prev === 0) { app.audio.play('lost'); toast(`Hardpoint ${ev.point} lost`, false); }
          break;
        }
      }
    }
  };

  // ---------------------------------------------------------------- loop
  const fit = () => {
    const r = stage.getBoundingClientRect();
    const top = hud.offsetHeight, bottom = tray.offsetHeight;
    el.style.setProperty('--hud-h', `${top}px`);
    el.style.setProperty('--tray-h', `${bottom}px`);
    view?.fit(r.width, r.height, { top, bottom });
  };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  let lastUnlockAnnounced = false;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && !finished) {
      acc += real * speed;
      let n = 0;
      while (acc >= DT && n < 40) {
        aiStep(ai, b);
        step(b);
        renderer.ingest(b.events, p.settings.reduceMotion);
        onEvents();
        acc -= DT; n++;
        if (b.result) break;
      }
      if (!lastUnlockAnnounced && heavyUnlocked(b) && b.mission.heavyUnlock > 0) { lastUnlockAnnounced = true; toast('Frames cleared for deployment'); app.audio.play('unlock'); }
      if (toastT > 0) { toastT -= real; if (toastT <= 0) toastEl?.remove(); }
      renderHand(); updateHandState(); renderAbilities(); updateHud(); updateInfo(); tickCoach();
      if (b.result) finish();
    }
    const tgt = targeting && aim ? { ability: targeting.ability, x: aim.x, y: aim.y, ...(targeting.source !== 'pilot' ? (() => { const e = entityById(b, targeting!.source as number); return e ? { fromX: e.x, fromY: e.y } : {}; })() : {}) } : null;
    renderer.draw(b, { ghost, targeting: tgt, selectedId: ui.selected ?? undefined, showRanges: p.settings.showRanges, reduceMotion: p.settings.reduceMotion, showZones: selectedCard !== null || !!drag?.moved }, paused ? 0 : real);
  };

  // ---------------------------------------------------------------- pause / finish
  let overlay: HTMLElement | null = null;
  const pause = () => {
    if (finished || paused) return;
    paused = true;
    const confirmQuit = h('div', { class: 'stack', hidden: true },
      h('p', { class: 'small' }, 'Leave this battle? It counts as unfinished and gives no rewards.'),
      h('div', { class: 'grid2' }, h('button', { class: 'btn ghost', onclick: () => { confirmQuit.hidden = true; } }, 'Stay'), h('button', { class: 'btn danger', onclick: () => app.go(campaignScreen) }, 'Leave')),
    );
    overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
      h('div', { class: 'dialog' },
        h('p', { class: 'eyebrow' }, `${mission.name} · ${params.difficulty}`),
        h('h2', { class: 'h1' }, 'Paused'),
        h('button', { class: 'btn block', onclick: resume, 'data-autofocus': true }, 'Resume'),
        h('button', { class: 'btn ghost block', onclick: () => app.go(a => battleScreen(a, params)) }, 'Restart battle'),
        settingsControls(app, { inBattle: true }),
        h('button', { class: 'btn danger block', onclick: () => { confirmQuit.hidden = false; } }, 'Quit to campaign'),
        confirmQuit,
      ),
    );
    el.append(overlay);
    overlay.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  };
  const resume = () => { paused = false; overlay?.remove(); overlay = null; last = performance.now(); };
  const onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVis);

  const finish = () => {
    if (finished) return;
    finished = true;
    const r = b.result!;
    const won = r.winner === 0;
    const core = coreOf(b, 0);
    const coreHpFrac = core ? core.hp / core.maxHp : 0;
    const report = applyBattleResult(p, { battleId, missionId: mission.id, won, time: r.time, coreHpFrac, difficulty: params.difficulty, kills: b.sides[0].stats.kills, deployed: b.sides[0].stats.deployed });
    app.save();
    app.audio.play(won ? 'victory' : 'defeat');
    app.audio.intensity = 0;
    setTimeout(() => app.go(a => resultsScreen(a, { mission, result: r, report, stats: { ...b.sides[0].stats }, enemyStats: { ...b.sides[1].stats }, difficulty: params.difficulty, coreHpFrac })), 1400);
  };

  // Test hook for automated play-tests; only exposed with ?debug=1.
  if (debug) (globalThis as any).__branchlike = {
    battle: b,
    deploy: (i: number, x: number, y: number) => deploy(b, 0, i, x, y),
    ability: (src: number | 'pilot', x?: number, y?: number) => useAbility(b, 0, src, x, y),
    viewStats: () => (view as any)?.stats?.() ?? null,
    viewKind: () => view?.kind ?? null,
    finishNow: (win: boolean) => { b.result = { winner: win ? 0 : 1, reason: win ? 'score' : 'core', time: b.t }; },
  };

  renderHand();
  createBattleView(p.settings.graphics, query.get('render') === '2d').then(v => {
    if (disposed) { v.dispose(); return; }
    view = v;
    stage.prepend(v.el);
    el.dataset.view = v.kind;
    v.reset(b.map);
    fit();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  });

  return {
    el,
    back: () => (paused ? resume() : pause()),
    destroy: () => {
      disposed = true;
      app.root.classList.remove('wide');
      cancelAnimationFrame(raf); ro.disconnect();
      view?.dispose();
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
      drag?.ghostEl.remove();
      app.audio.intensity = 0;
    },
  };
}

