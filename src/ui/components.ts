import { h, frag } from './dom.js';
import { ICONS, unitArt } from './art.js';
import type { App } from './app.js';
import { UNITS, DAMAGE_TABLE, levelMultiplier, ABILITIES } from '../data/units.js';
import type { ArmorClass, UnitDef } from '../data/types.js';

export function topbar(app: App, title: string, onBack: (() => void) | null, right?: Node | null): HTMLElement {
  return h('header', { class: 'topbar' },
    onBack ? iconButton('back', 'Back', () => { app.click(); onBack(); }) : null,
    h('div', { class: 'title' }, h('h1', { class: 'h2' }, title)),
    right ?? creditsChip(app),
  );
}

export function iconButton(icon: keyof typeof ICONS, label: string, onClick: () => void, extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: 'icon-btn', 'aria-label': label, title: label, onclick: onClick, ...extra });
  b.append(frag(ICONS[icon]));
  return b;
}

export function creditsChip(app: App): HTMLElement {
  return h('span', { class: 'chip', title: 'Credits' }, 'Credits ', h('span', { class: 'num' }, String(app.profile.credits)));
}

export function screen(...children: (Node | null)[]): HTMLElement {
  const el = h('section', { class: 'screen' });
  for (const c of children) if (c) el.append(c);
  return el;
}

export function unitCard(id: string, opts: { level?: number; locked?: boolean; count?: number; inDeck?: boolean; onClick?: () => void; label?: string } = {}): HTMLButtonElement {
  const d = UNITS[id];
  const cls = ['ucard', d.hero ? 'hero' : '', opts.locked ? 'locked' : '', opts.inDeck ? 'in-deck' : ''].filter(Boolean).join(' ');
  const b = h('button', { class: cls, onclick: opts.onClick, 'aria-label': opts.label ?? `${d.name}, ${d.cost} supply${opts.locked ? ', locked' : ''}` },
    h('span', { class: 'cost' }, String(d.cost)),
    opts.level ? h('span', { class: 'lvl' }, `L${opts.level}`) : null,
    h('span', { class: 'nm' }, d.name),
    opts.count ? h('span', { class: 'count' }, `×${opts.count}`) : null,
  );
  b.prepend(frag(unitArt(id)));
  return b;
}

const ARMOR_LABEL: Record<ArmorClass, string> = { light: 'Infantry', armored: 'Armour', air: 'Drones', structure: 'Structures' };

/** Derive "strong against / weak against" from the damage table rather than writing it by hand. */
export function counterTags(d: UnitDef): { strong: string[]; weak: string[] } {
  const strong: string[] = [], weak: string[] = [];
  if (d.weapon) {
    for (const k of ['light', 'armored', 'air', 'structure'] as ArmorClass[]) {
      let m = DAMAGE_TABLE[d.weapon.type][k];
      if (k === 'air' && !d.weapon.hitsAir) m = 0;
      if (m >= 1.2) strong.push(ARMOR_LABEL[k]);
      if (m === 0) weak.push(`Can't hit ${ARMOR_LABEL[k].toLowerCase()}`);
    }
  }
  // Who counters this unit?
  const threats: string[] = [];
  for (const u of Object.values(UNITS)) {
    if (!u.deployable || !u.weapon || u.id === d.id || u.hero) continue;
    let m = DAMAGE_TABLE[u.weapon.type][d.armor];
    if (d.armor === 'air' && !u.weapon.hitsAir) m = 0;
    if (m >= 1.2) threats.push(u.name);
  }
  if (threats.length) weak.push(`Countered by ${threats.slice(0, 2).join(', ')}`);
  return { strong, weak };
}

export function statRows(d: UnitDef, level: number): HTMLElement {
  const mul = levelMultiplier(level);
  if (d.strike) {
    const st = d.strike;
    return h('div', { class: 'stack' },
      h('div', { class: 'stat' }, h('span', { class: 'muted' }, 'Damage'), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, st.damage * mul / 200 * 100)}%` } })), h('span', { class: 'num' }, String(Math.round(st.damage * mul)))),
      h('div', { class: 'stat' }, h('span', { class: 'muted' }, 'Blast radius'), h('div', { class: 'bar' }, h('i', { style: { width: `${st.radius / 60 * 100}%` } })), h('span', { class: 'num' }, String(st.radius))),
      h('p', { class: 'small muted' }, `Lands ${st.delay}s after you aim it, anywhere on the field. Cannot hit drones.`),
    );
  }
  const w = d.weapon;
  const dps = w ? (w.damage * mul / w.cooldown) * (d.squad ?? 1) : 0;
  const rows: [string, number, number, string][] = [
    ['Health', d.hp * mul * (d.squad ?? 1), 3000, `${Math.round(d.hp * mul)}${d.squad ? ` ×${d.squad}` : ''}`],
    ['Damage/s', dps, 90, w ? Math.round(dps).toString() : '—'],
    ['Range', w?.range ?? d.heal?.range ?? 0, 200, w ? String(w.range) : d.heal ? String(d.heal.range) : '—'],
    ['Speed', d.speed, 75, d.speed ? String(d.speed) : 'Static'],
  ];
  const wrap = h('div', { class: 'stack' });
  for (const [label, v, max, text] of rows) {
    wrap.append(h('div', { class: 'stat' }, h('span', { class: 'muted' }, label), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, v / max * 100)}%` } })), h('span', { class: 'num' }, text)));
  }
  if (d.supplyBoost) wrap.append(h('p', { class: 'small muted' }, `Raises supply regeneration by ${Math.round(d.supplyBoost * 100)}% while it stands.`));
  if (d.holdAtRally) wrap.append(h('p', { class: 'small muted' }, 'Holds position at its rally point.'));
  if (d.heal) wrap.append(h('p', { class: 'small muted' }, `Repairs ${Math.round(d.heal.amount * mul)} health per second to the most damaged ally in range.`));
  if (d.ability) wrap.append(h('p', { class: 'small' }, h('b', null, ABILITIES[d.ability].name + ': '), ABILITIES[d.ability].desc));
  return wrap;
}

export function segmented<T extends string>(options: { value: T; label: string }[], current: T, onChange: (v: T) => void, label: string): HTMLElement {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label });
  const render = (val: T) => {
    seg.replaceChildren(...options.map(o => h('button', { 'aria-pressed': String(o.value === val), onclick: () => { render(o.value); onChange(o.value); } }, o.label)));
  };
  render(current);
  return seg;
}

export function toggleRow(label: string, value: boolean, onChange: (v: boolean) => void, id: string): HTMLElement {
  const sw = h('button', { class: 'switch', role: 'switch', id, 'aria-checked': String(value), 'aria-label': label });
  sw.addEventListener('click', () => { const v = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(v)); onChange(v); });
  return h('div', { class: 'toggle' }, h('label', { for: id }, label), sw);
}

export function sliderRow(label: string, value: number, onChange: (v: number) => void, id: string): HTMLElement {
  const out = h('span', { class: 'num muted' }, `${Math.round(value * 100)}%`);
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(value * 100)), id });
  input.addEventListener('input', () => { out.textContent = `${input.value}%`; onChange(Number(input.value) / 100); });
  return h('div', { class: 'field' }, h('div', { class: 'row between' }, h('label', { for: id }, label), out), input);
}
