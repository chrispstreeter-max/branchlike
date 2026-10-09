import { h, frag } from '../dom.js';
import { logoSvg } from '../art.js';
import type { App, Screen } from '../app.js';
import { menuScreen } from './menu.js';

export function titleScreen(app: App): Screen {
  const start = () => {
    app.audio.unlock();
    app.click();
    app.go(menuScreen);
  };
  const statusNote = app.loadStatus === 'recovered'
    ? 'Your last save was damaged. Progress was restored from the backup.'
    : !app.persistent ? 'Storage is blocked in this browser, so progress will not be kept after you close it.' : null;
  const el = h('section', { class: 'screen title-screen' },
    h('div', { class: 'title-scan' }),
    h('div', { class: 'title-hero' },
      frag(logoSvg()),
      h('p', { class: 'title-tag' }, 'Tactical frame warfare'),
      h('p', { class: 'muted', style: { maxWidth: '34ch' } }, 'The Halcyon Directorate has sealed the Cinder Reach. Lead the Corsair Union through it, one hardpoint at a time.'),
    ),
    h('div', { class: 'title-foot' },
      statusNote ? h('p', { class: 'small', style: { color: 'var(--warn)' } }, statusNote) : null,
      h('button', { class: 'btn block press', onclick: start, 'data-autofocus': true }, app.profile.stats.battles ? 'Continue' : 'Start'),
      h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'Prototype build · Original IP · Not affiliated with any existing game'),
    ),
  );
  return { el };
}
