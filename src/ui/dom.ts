// Tiny DOM builder. Keeps screens declarative without a framework.
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) append(el, c);
  return el;
}

export function append(el: Element, c: Child) {
  if (c === null || c === undefined || c === false) return;
  el.append(typeof c === 'number' ? String(c) : c);
}

/** Parse an SVG/HTML string into a single node. */
export function frag(html: string): Element {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild!;
}

export function clear(el: Element) { while (el.firstChild) el.removeChild(el.firstChild); }

export function fmtTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function starString(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export function starsEl(n: number): HTMLElement {
  const s = h('span', { class: 'stars', 'aria-label': `${n} of 3 stars` });
  for (let i = 0; i < 3; i++) s.append(h('span', { class: i < n ? '' : 'off' }, '★'));
  return s;
}
