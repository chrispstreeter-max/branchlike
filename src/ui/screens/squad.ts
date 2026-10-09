import { h } from '../dom.js';
import type { App, Screen, ScreenFactory } from '../app.js';
import { topbar, unitCard } from '../components.js';
import { UNITS } from '../../data/units.js';
import { MISSIONS } from '../../data/missions.js';
import { DECK_SIZE, setDeck, validateDeck, type DeckError } from '../../meta/progression.js';

const DECK_ERRORS: Record<DeckError, string> = {
  size: `Your squad needs exactly ${DECK_SIZE} cards.`,
  locked: 'That unit is still locked.',
  copies: 'Up to 2 copies of a regular unit.',
  hero_copies: 'Each hero frame can only be taken once.',
  too_many_heroes: 'Up to 2 hero frames per squad.',
  unknown: 'Unknown unit.',
};

function unlockSource(id: string): string {
  const m = MISSIONS.find(m => m.firstClear.unlockUnits?.includes(id));
  return m ? `Clear ${m.name}` : 'Not yet available';
}

export function squadScreen(app: App, back: ScreenFactory): Screen {
  const p = app.profile;
  let deck = [...p.deck];
  const slots = h('div', { class: 'deck-slots', 'aria-label': 'Squad cards' });
  const roster = h('div', { class: 'roster', 'aria-label': 'Available units' });
  const status = h('p', { class: 'small', role: 'status' });
  const avg = h('span', { class: 'small muted num' });

  const tryAdd = (id: string) => {
    const next = [...deck, id];
    if (next.length > DECK_SIZE) { status.textContent = 'Squad is full. Tap a card in your squad to remove it.'; status.style.color = 'var(--warn)'; return; }
    // Partial squads are checked on copy limits only; size is checked on save.
    const counts = next.filter(x => x === id).length;
    const def = UNITS[id];
    if (def.hero && counts > 1) { status.textContent = DECK_ERRORS.hero_copies; status.style.color = 'var(--bad)'; return; }
    if (!def.hero && counts > 2) { status.textContent = DECK_ERRORS.copies; status.style.color = 'var(--bad)'; return; }
    if (next.filter(x => UNITS[x].hero).length > 2) { status.textContent = DECK_ERRORS.too_many_heroes; status.style.color = 'var(--bad)'; return; }
    deck = next; app.click(); render();
  };
  const remove = (i: number) => { deck.splice(i, 1); app.click(); render(); };

  const render = () => {
    slots.replaceChildren();
    for (let i = 0; i < DECK_SIZE; i++) {
      const id = deck[i];
      slots.append(id ? unitCard(id, { level: p.unitLevels[id], onClick: () => remove(i), label: `Remove ${UNITS[id].name}` }) : h('div', { class: 'slot-empty' }, 'Empty'));
    }
    roster.replaceChildren();
    const ids = Object.values(UNITS).filter(u => u.deployable).map(u => u.id);
    for (const id of ids) {
      const locked = !p.unlockedUnits.includes(id);
      const count = deck.filter(x => x === id).length;
      const card = unitCard(id, { level: locked ? undefined : p.unitLevels[id], locked, count, inDeck: count > 0, onClick: () => { if (locked) { status.textContent = `${UNITS[id].name} is locked. ${unlockSource(id)} to unlock it.`; status.style.color = 'var(--muted)'; return; } tryAdd(id); } });
      roster.append(card);
    }
    const err = validateDeck(p, deck);
    if (err) { status.textContent = DECK_ERRORS[err]; status.style.color = err === 'size' ? 'var(--muted)' : 'var(--bad)'; }
    else { status.textContent = 'Squad ready.'; status.style.color = 'var(--good)'; }
    const a = deck.reduce((s, id) => s + UNITS[id].cost, 0) / Math.max(1, deck.length);
    avg.textContent = `Average cost ${a.toFixed(1)}`;
    done.disabled = !!err;
  };

  const done = h('button', { class: 'btn block', onclick: () => {
    const err = setDeck(p, deck);
    if (err) { status.textContent = DECK_ERRORS[err]; return; }
    app.save(); app.click(); app.toast('Squad saved'); app.go(back);
  } }, 'Save squad');

  const leave = () => {
    if (deck.join() !== p.deck.join() && !validateDeck(p, deck)) { setDeck(p, deck); app.save(); app.toast('Squad saved'); }
    app.go(back);
  };

  const el = h('section', { class: 'screen' },
    topbar(app, 'Squad', leave),
    h('div', { class: 'screen-scroll' },
      h('div', { class: 'stack' },
        h('div', { class: 'row between' }, h('p', { class: 'eyebrow' }, `Your squad · ${DECK_SIZE} cards`), avg),
        slots,
        status,
      ),
      h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, 'Roster'),
        h('p', { class: 'small muted' }, 'Tap a unit to add it. Up to 2 copies of a regular unit, 1 of each hero frame, 2 heroes in total.'),
        roster,
      ),
      done,
    ),
  );
  render();
  return { el, back: leave };
}
