// Original vector art for the interface: unit silhouettes, pilot badges, icons
// and the BRANCHLIKE wordmark. All drawn in code (see docs/ASSETS.md).

const UNION = '#f2a93b';

/** Unit silhouette in a 100×100 box. `c` is the team colour. */
/** Frames with card portraits rendered from their 3D models (tools/render-cards.mjs). */
const RENDERED = new Set(['warden_frame', 'kestrel', 'monolith', 'vesper', 'halberd_prime']);

export function unitArt(id: string, c = UNION): string {
  if (RENDERED.has(id) && c === UNION) return `<img class="art" src="img/units/${id}.png" alt="" aria-hidden="true" draggable="false">`;
  const d = shade(c, 0.55), dk = shade(c, 0.32), lt = '#e7eaed';
  const shadow = `<ellipse cx="50" cy="90" rx="30" ry="6" fill="#000" opacity=".35"/>`;
  let body = '';
  switch (id) {
    case 'rifle_squad':
      body = [28, 50, 72].map((x, i) => `<g transform="translate(${x} ${i === 1 ? 4 : 14})"><rect x="-7" y="30" width="14" height="40" rx="5" fill="${d}"/><rect x="-7" y="30" width="14" height="20" rx="5" fill="${c}"/><circle cx="0" cy="24" r="6" fill="${lt}"/><rect x="4" y="40" width="14" height="3" fill="${lt}" opacity=".8"/></g>`).join('');
      break;
    case 'breaker_team':
      body = [36, 64].map(x => `<g transform="translate(${x} 10)"><rect x="-8" y="34" width="16" height="42" rx="5" fill="${d}"/><rect x="-8" y="34" width="16" height="20" rx="5" fill="${c}"/><circle cx="0" cy="27" r="6.5" fill="${lt}"/><rect x="-14" y="30" width="30" height="8" rx="3" fill="${dk}"/><circle cx="16" cy="34" r="4" fill="${c}"/></g>`).join('');
      break;
    case 'wasp_drone':
      body = `<g transform="translate(50 46)"><ellipse cx="0" cy="44" rx="16" ry="4" fill="#000" opacity=".3"/><path d="M0 -14 L18 4 L0 14 L-18 4 Z" fill="${c}"/><path d="M0 -14 L18 4 L0 0 Z" fill="${shade(c, .8)}"/><circle cx="-22" cy="-6" r="9" fill="none" stroke="${lt}" stroke-width="2" opacity=".6"/><circle cx="22" cy="-6" r="9" fill="none" stroke="${lt}" stroke-width="2" opacity=".6"/><circle cx="0" cy="2" r="3" fill="${lt}"/></g>`;
      break;
    case 'hound_apc':
      body = `${shadow}<path d="M14 72 L22 52 L76 52 L88 66 L88 80 L14 80 Z" fill="${d}"/><path d="M22 52 L76 52 L82 60 L18 60 Z" fill="${c}"/><rect x="40" y="40" width="22" height="12" rx="2" fill="${shade(c, .75)}"/><rect x="60" y="44" width="26" height="4" fill="${lt}" opacity=".85"/><circle cx="28" cy="82" r="6" fill="${dk}"/><circle cx="50" cy="82" r="6" fill="${dk}"/><circle cx="72" cy="82" r="6" fill="${dk}"/>`;
      break;
    case 'mortar_crawler':
      body = `${shadow}<rect x="14" y="74" width="72" height="12" rx="6" fill="${dk}"/><rect x="18" y="52" width="64" height="22" rx="2" fill="${d}"/><rect x="18" y="52" width="64" height="7" fill="${c}"/><g transform="rotate(-40 50 52)"><rect x="46" y="18" width="12" height="38" rx="2" fill="${shade(c, .7)}"/><rect x="44" y="16" width="16" height="6" fill="${lt}" opacity=".8"/></g>`;
      break;
    case 'mender_rig':
      body = `${shadow}<path d="M26 86 L34 62 M74 86 L66 62 M40 88 L44 62 M60 88 L56 62" stroke="${dk}" stroke-width="5" stroke-linecap="round"/><rect x="24" y="40" width="52" height="24" rx="4" fill="${d}"/><rect x="24" y="40" width="52" height="8" rx="3" fill="${c}"/><rect x="45" y="48" width="10" height="14" fill="#6fd3ef"/><rect x="40" y="52" width="20" height="6" fill="#6fd3ef"/>`;
      break;
    case 'bastion_turret':
      body = `${shadow}<path d="M50 62 L76 74 L76 84 L50 92 L24 84 L24 74 Z" fill="${dk}"/><rect x="44" y="38" width="12" height="34" fill="${d}"/><circle cx="50" cy="38" r="13" fill="${c}"/><rect x="50" y="34" width="34" height="7" rx="2" fill="${lt}" opacity=".85"/>`;
      break;
    case 'warden_frame':
      body = `${shadow}<rect x="30" y="58" width="12" height="30" fill="${dk}"/><rect x="58" y="58" width="12" height="30" fill="${dk}"/><rect x="22" y="28" width="56" height="34" rx="3" fill="${d}"/><path d="M22 28 L78 28 L72 18 L28 18 Z" fill="${c}"/><rect x="38" y="34" width="24" height="6" fill="#0c0f13"/><rect x="42" y="35" width="16" height="3" fill="${lt}"/><rect x="74" y="36" width="20" height="8" rx="2" fill="${shade(c, .45)}"/>`;
      break;
    case 'kestrel':
      body = `${shadow}<path d="M38 60 L32 90 M62 60 L68 90" stroke="${dk}" stroke-width="8" stroke-linecap="round"/><path d="M50 14 L74 40 L66 62 L34 62 L26 40 Z" fill="${d}"/><path d="M50 14 L74 40 L50 34 L26 40 Z" fill="${c}"/><path d="M26 40 L6 30 L22 50 Z M74 40 L94 30 L78 50 Z" fill="${c}" opacity=".85"/><rect x="42" y="40" width="16" height="5" fill="${lt}"/><rect x="66" y="48" width="22" height="5" rx="2" fill="#6fd3ef"/>`;
      break;
    case 'monolith':
      body = `${shadow}<rect x="24" y="62" width="18" height="28" fill="${dk}"/><rect x="58" y="62" width="18" height="28" fill="${dk}"/><rect x="18" y="22" width="64" height="44" rx="3" fill="${d}"/><rect x="18" y="22" width="64" height="10" fill="${c}"/><rect x="4" y="26" width="16" height="36" rx="3" fill="${shade(c, .75)}"/><rect x="80" y="26" width="16" height="36" rx="3" fill="${shade(c, .75)}"/><rect x="38" y="38" width="24" height="6" fill="${lt}"/><rect x="44" y="50" width="12" height="22" fill="${shade(c, .4)}"/>`;
      break;
    case 'vesper':
      body = `${shadow}<path d="M42 56 L34 92 M58 56 L66 92" stroke="${dk}" stroke-width="5" stroke-linecap="round"/><path d="M50 8 L62 30 L60 58 L40 58 L38 30 Z" fill="${d}"/><path d="M50 8 L62 30 L50 26 L38 30 Z" fill="${c}"/><rect x="45" y="30" width="10" height="4" fill="${lt}"/><rect x="58" y="20" width="40" height="5" rx="2" fill="${shade(c, .5)}"/><rect x="88" y="19" width="10" height="7" fill="#6fd3ef"/>`;
      break;
    case 'halberd_prime':
      body = `${shadow}<rect x="16" y="60" width="22" height="30" fill="${dk}"/><rect x="62" y="60" width="22" height="30" fill="${dk}"/><rect x="10" y="16" width="80" height="48" rx="4" fill="${d}"/><rect x="10" y="16" width="80" height="12" fill="${c}"/><rect x="20" y="4" width="14" height="20" fill="${shade(c, .6)}"/><rect x="66" y="4" width="14" height="20" fill="${shade(c, .6)}"/><rect x="36" y="34" width="28" height="7" fill="#ff6158"/>`;
      break;
    case 'missile_strike':
      body = `<circle cx="50" cy="78" r="16" fill="none" stroke="#ff6158" stroke-width="3"/><circle cx="50" cy="78" r="4" fill="#ff6158"/><g transform="rotate(35 50 40)"><rect x="44" y="6" width="12" height="46" rx="6" fill="${lt}"/><path d="M44 46 L36 58 L44 54 Z M56 46 L64 58 L56 54 Z" fill="${c}"/><rect x="44" y="20" width="12" height="4" fill="${c}"/><path d="M47 52 L50 66 L53 52 Z" fill="#ffb36b"/></g>`;
      break;
    case 'supply_depot':
      body = `${shadow}<rect x="16" y="70" width="68" height="12" fill="${dk}"/><rect x="20" y="46" width="28" height="24" fill="${d}"/><rect x="52" y="46" width="28" height="24" fill="${c}"/><rect x="36" y="24" width="28" height="22" fill="${d}"/><rect x="47" y="10" width="6" height="16" fill="#6fd3ef"/>`;
      break;
    case 'core':
      body = `${shadow}<path d="M50 6 L64 26 L64 86 L36 86 L36 26 Z" fill="${d}"/><path d="M50 6 L64 26 L36 26 Z" fill="${c}"/><rect x="44" y="40" width="12" height="4" fill="${lt}"/>`;
      break;
    default:
      body = `<circle cx="50" cy="50" r="20" fill="${c}"/>`;
  }
  return `<svg class="art" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

export function pilotArt(id: string): string {
  const palette: Record<string, [string, string]> = {
    juno_vale: ['#f2a93b', '#6fd3ef'], ruk_okonkwo: ['#f2a93b', '#ff8a4c'], sable_ito: ['#f2a93b', '#9583ff'], dir_castellan: ['#9583ff', '#ff6158'],
  };
  const [a, b] = palette[id] ?? ['#f2a93b', '#6fd3ef'];
  const mark = id === 'juno_vale' ? `<path d="M28 40 L36 26 L44 40 Z" fill="${b}"/>` : id === 'ruk_okonkwo' ? `<rect x="29" y="27" width="14" height="14" fill="${b}"/>` : `<circle cx="36" cy="34" r="7" fill="none" stroke="${b}" stroke-width="3"/>`;
  return `<svg viewBox="0 0 72 72" aria-hidden="true"><rect x="2" y="2" width="68" height="68" rx="8" fill="#11151a" stroke="${a}" stroke-width="2"/><circle cx="36" cy="30" r="13" fill="#2a323c"/><path d="M14 66 C16 48 56 48 58 66 Z" fill="#2a323c"/><rect x="22" y="26" width="28" height="7" rx="3" fill="${a}" opacity=".9"/>${mark}</svg>`;
}

export const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  campaign: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 26L13 8l6 10 3-5 5 13z"/><path d="M13 8V3l5 2-5 2"/></svg>',
  squad: '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><rect x="3" y="8" width="8" height="12" rx="1.5"/><rect x="12" y="6" width="8" height="12" rx="1.5"/><rect x="21" y="8" width="8" height="12" rx="1.5"/><rect x="7" y="22" width="18" height="3" rx="1"/></svg>',
  hangar: '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><rect x="8" y="9" width="16" height="10" rx="1.5"/><rect x="10" y="19" width="4" height="9"/><rect x="18" y="19" width="4" height="9"/><rect x="22" y="12" width="8" height="3"/><path d="M8 9l2-4h12l2 4z" opacity=".7"/></svg>',
  profile: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="16" cy="11" r="5"/><path d="M6 28c1-7 19-7 20 0"/></svg>',
  settings: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M5 9h14M23 9h4M5 23h4M13 23h14"/><circle cx="21" cy="9" r="3"/><circle cx="11" cy="23" r="3"/></svg>',
};

export function logoSvg(): string {
  // Wordmark: two converging branch strokes forming a chevron, then the name in condensed caps.
  return `<svg class="logo" viewBox="0 0 360 120" role="img" aria-label="BRANCHLIKE">
    <g fill="none" stroke="${UNION}" stroke-width="7" stroke-linecap="square">
      <path d="M8 96 L44 24 L80 96"/><path d="M26 60 L44 96 L62 60" opacity=".55"/>
    </g>
    <text x="96" y="78" font-family="Bahnschrift, 'DIN Alternate', 'Roboto Condensed', 'Arial Narrow', sans-serif" font-stretch="condensed" font-weight="700" font-size="50" letter-spacing="3" fill="#e7eaed">BRANCHLIKE</text>
    <text x="98" y="104" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" letter-spacing="5" fill="#8b95a1">MARK V · CINDER REACH</text>
  </svg>`;
}

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round((n >> 16 & 255) * f), g = Math.round((n >> 8 & 255) * f), b = Math.round((n & 255) * f);
  return `#${((1 << 24) | (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b)).toString(16).slice(1)}`;
}
