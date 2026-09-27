// QR codes as inline SVG, drawn from the vendored generator (js/vendor/qrcode.js, MIT, Kazuhiko Arase).
import qrcode from './vendor/qrcode.js';

// Network names and passwords can have any character in them, so send them as UTF-8.
qrcode.stringToBytes = s => Array.from(new TextEncoder().encode(s));

export function qrSVG(text, { label = 'QR code' } = {}) {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount(), q = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  }
  return `<svg class="qr" viewBox="0 0 ${n + q * 2} ${n + q * 2}" role="img" aria-label="${label}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
