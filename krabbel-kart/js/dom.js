// Tiny DOM builder: h('button', { class: 'btn', onclick: fn }, 'Text', childNode)
export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k in e && k !== 'list') { try { e[k] = v; } catch (_) { e.setAttribute(k, v); } }
      else e.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid === undefined || kid === null || kid === false) continue;
    e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return e;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Small inline icons (stroke style) so the UI does not depend on emoji fonts.
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  play: I('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  pencil: I('<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>'),
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  back: I('<path d="M14 5l-7 7 7 7"/>'),
  next: I('<path d="M10 5l7 7-7 7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  camera: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  brush: I('<path d="M4 20c0-3 2-4 4-4s3 1 3 3-3 3-7 1z" fill="currentColor"/><path d="M10 15L20 4"/>'),
  eraser: I('<path d="M8 19l-4-4L14 5l6 6-8 8z"/><path d="M9 10l6 6M8 19h12"/>'),
  undo: I('<path d="M8 5L4 9l4 4"/><path d="M4 9h10a5 5 0 010 10h-3"/>'),
  flip: I('<path d="M12 3v18"/><path d="M9 7L4 12l5 5z" fill="currentColor"/><path d="M15 7l5 5-5 5z"/>'),
  rotate: I('<path d="M20 12a8 8 0 11-3-6.2"/><path d="M20 4v5h-5"/>'),
  crop: I('<path d="M7 3v14h14"/><path d="M3 7h14v14"/>'),
  trash: I('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  pause: I('<path d="M8 5v14M16 5v14"/>'),
  fill: I('<path d="M5 12l7-7 7 7-7 7z"/><path d="M19 16c1 1.5 1.5 2.5 1.5 3.3a1.5 1.5 0 01-3 0c0-.8.5-1.8 1.5-3.3z" fill="currentColor"/>'),
  sound: I('<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
  music: I('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>'),
  wheel: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M12 14.2V21M9.9 11.2L3.6 9M14.1 11.2L20.4 9"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  download: I('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
  one: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.500 8 7"/>'),
  two: I('<circle cx="8" cy="9" r="3.4"/><circle cx="17" cy="9" r="3.4"/><path d="M2 20c0-3.6 2.600-5.500 6-5.500s6 1.900 6 5.500M14.500 14.700c.800-.200 1.600-.200 2.500-.200 3.400 0 5.500 1.900 5.500 5.500"/>'),
};
