import { h } from '../dom.js';
import type { App, Screen, ScreenFactory } from '../app.js';
import { topbar, sliderRow, toggleRow, segmented } from '../components.js';
import { resetProfile } from '../../meta/save.js';
import type { Difficulty } from '../../data/types.js';

/** Settings controls, shared by the settings screen and the in-battle pause menu. */
export function settingsControls(app: App, opts: { inBattle?: boolean } = {}): HTMLElement {
  const s = app.profile.settings;
  const persist = () => { app.applySettings(); app.save(); };
  return h('div', { class: 'stack' },
    sliderRow('Music volume', s.music, v => { s.music = v; persist(); }, 'set-music'),
    sliderRow('Effects volume', s.sfx, v => { s.sfx = v; persist(); app.audio.play('click'); }, 'set-sfx'),
    toggleRow('Show attack ranges', s.showRanges, v => { s.showRanges = v; persist(); }, 'set-ranges'),
    toggleRow('Reduce motion (no screen shake)', s.reduceMotion, v => { s.reduceMotion = v; persist(); }, 'set-motion'),
    opts.inBattle ? null : h('div', { class: 'stack' },
      h('p', { class: 'eyebrow' }, 'Default difficulty'),
      segmented<Difficulty>([{ value: 'recruit', label: 'Recruit' }, { value: 'veteran', label: 'Veteran' }, { value: 'elite', label: 'Elite' }], s.difficulty, v => { s.difficulty = v; persist(); }, 'Default difficulty'),
    ),
  );
}

export function settingsScreen(app: App, back: ScreenFactory): Screen {
  const confirmBox = h('div', { class: 'panel stack', hidden: true },
    h('p', null, 'Erase all campaign progress, credits, upgrades and unlocks on this device? This cannot be undone.'),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn ghost', onclick: () => { confirmBox.hidden = true; resetBtn.hidden = false; } }, 'Keep progress'),
      h('button', { class: 'btn danger', onclick: () => { app.profile = resetProfile(app.kv); app.applySettings(); app.toast('Progress erased'); app.go(a => settingsScreen(a, back)); } }, 'Erase progress'),
    ),
  );
  const resetBtn = h('button', { class: 'btn danger block', onclick: () => { resetBtn.hidden = true; confirmBox.hidden = false; } }, 'Reset progress');
  const el = h('section', { class: 'screen' },
    topbar(app, 'Settings', () => app.go(back)),
    h('div', { class: 'screen-scroll' },
      settingsControls(app),
      h('div', { class: 'divider' }),
      h('div', { class: 'stack' },
        h('p', { class: 'eyebrow' }, 'Data'),
        h('p', { class: 'small muted' }, app.persistent ? 'Progress is saved on this device automatically after every battle and change.' : 'This browser blocks storage, so progress lasts only until you close it.'),
        resetBtn, confirmBox,
      ),
      h('p', { class: 'small muted' }, 'BRANCHLIKE prototype. All characters, units and settings are original. Audio is synthesised in real time.'),
    ),
  );
  return { el, back: () => app.go(back) };
}
