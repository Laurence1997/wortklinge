type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined | null>;

/** Tiny hyperscript: h('button.btn.primary', { onclick }, '确定'). */
export function h(spec: string, attrs: Attrs | Child = {}, ...children: Child[]): HTMLElement {
  const [head, ...classes] = spec.split('.');
  const [tag, id] = head.split('#');
  const el = document.createElement(tag || 'div');
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  let a: Attrs = {};
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node)) a = attrs as Attrs;
  else children.unshift(attrs as Child);
  for (const [k, v] of Object.entries(a)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'class') el.className += ' ' + v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

export function clear(el: HTMLElement): HTMLElement {
  el.replaceChildren();
  return el;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function bar(cls: string, value: number, max: number, label?: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return h(`div.bar.${cls}`, h('i', { style: `width:${pct}%` }), label ? h('span', label) : null);
}

export function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
}

/** ä ö ü ß buttons that type into the given input at the caret. */
export function umlautButtons(input: HTMLInputElement): HTMLElement {
  const wrap = h('div.umlauts');
  for (const ch of ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']) {
    wrap.append(
      h(
        'button.btn',
        {
          type: 'button',
          tabindex: -1,
          title: `输入 ${ch}`,
          onmousedown: (e: Event) => e.preventDefault(),
          onclick: () => {
            const s = input.selectionStart ?? input.value.length;
            const e = input.selectionEnd ?? s;
            input.value = input.value.slice(0, s) + ch + input.value.slice(e);
            input.setSelectionRange(s + 1, s + 1);
            input.focus();
          },
        },
        ch,
      ),
    );
  }
  return wrap;
}
