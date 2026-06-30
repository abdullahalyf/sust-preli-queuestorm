/* QueueStorm — inlined icon subset.
 * 12 icons, hand-authored SVG strings, exposed on window.QSIcons.
 * No fetch, no CDN. Each is a 24x24 viewBox stroke icon styled with currentColor.
 * Usage: <span class="qsi-icon">${QSIcons.bolt}</span>  (qsi-icon sets width/height/stroke).
 */
(function () {
  "use strict";
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  const icons = {
    bolt: `<svg viewBox="0 0 24 24" ${stroke}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" ${stroke}><path d="M20 6L9 17l-5-5"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>`,
    loader: `<svg viewBox="0 0 24 24" ${stroke}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" ${stroke}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    checkCircle: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`,
    x: `<svg viewBox="0 0 24 24" ${stroke}><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 5v14M5 12h14"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" ${stroke}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`,
    arrowRight: `<svg viewBox="0 0 24 24" ${stroke}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    pulse: `<svg viewBox="0 0 24 24" ${stroke}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    sparkle: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></svg>`,
    layers: `<svg viewBox="0 0 24 24" ${stroke}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`,
  };
  window.QSIcons = icons;
})();