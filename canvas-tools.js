/* =====================================================================
   Odak Not — canvas-tools.js (Obsidian Studio & S Pen Edition)
   Geometri (AABB + dar faz), Affine2D, kalem motoru (Path2D dış hat),
   şekil tanıma (Hold-to-Snap), silgiler, kement, HistoryManager (komutlar),
   TouchGestureRecognizer, SelectionGizmo, kağıt şablonları, S Pen yan tuş.
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON;

  /* ================= Geometri ================= */
  const Geo = {
    pointToSegmentDistSq(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + t * dx - px, qy = ay + t * dy - py;
      return qx * qx + qy * qy;
    },
    orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); },
    segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
      const o = Geo.orient;
      const d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by);
      const d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy);
      return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
    },
    // poly: düz dizi [x0,y0,x1,y1,...]
    isPointInPolygon(x, y, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
        const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
    bboxIntersects: (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY,
    union(a, b) {
      if (!a) return b ? { ...b } : null;
      if (!b) return { ...a };
      return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
    },
    expand: (b, r) => ({ minX: b.minX - r, minY: b.minY - r, maxX: b.maxX + r, maxY: b.maxY + r }),
    bboxOfFlat(pts, stride = 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += stride) {
        const x = pts[i], y = pts[i + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { minX, minY, maxX, maxY };
    }
  };
  ON.Geo = Geo;

  /* ================= Affine2D (2x3) ================= */
  class Affine2D {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { this.m = new Float64Array([a, b, c, d, e, f]); }
    static translate(x, y) { return new Affine2D(1, 0, 0, 1, x, y); }
    static rotate(t) { const c = Math.cos(t), s = Math.sin(t); return new Affine2D(c, s, -s, c, 0, 0); }
    static scale(sx, sy = sx) { return new Affine2D(sx, 0, 0, sy, 0, 0); }
    // this ∘ o  (önce o, sonra this)
    multiply(o) {
      const [a, b, c, d, e, f] = this.m, [A, B, C, D, E, F] = o.m;
      return new Affine2D(a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f);
    }
    static chain(...ms) { return ms.reduce((acc, m) => acc.multiply(m)); }
    invert() {
      const [a, b, c, d, e, f] = this.m, det = a * d - b * c || 1e-12;
      return new Affine2D(d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det);
    }
    get det() { return this.m[0] * this.m[3] - this.m[1] * this.m[2]; }
    get scaleFactor() { return Math.sqrt(Math.abs(this.det)); }
    apply(x, y) { const [a, b, c, d, e, f] = this.m; return [a * x + c * y + e, b * x + d * y + f]; }
    // Float32Array üzerinde yerinde uygular (stride = 3: x, y, basınç)
    applyInPlace(pts, stride = 3) {
      const [a, b, c, d, e, f] = this.m;
      for (let i = 0; i < pts.length; i += stride) {
        const x = pts[i], y = pts[i + 1];
        pts[i] = a * x + c * y + e; pts[i + 1] = b * x + d * y + f;
      }
    }
    isIdentity() { const m = this.m; return Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[3] - 1) < 1e-9 && Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && Math.abs(m[4]) < 1e-9 && Math.abs(m[5]) < 1e-9; }
  }
  ON.Affine2D = Affine2D;

  /* ================= Renk yardımcıları ================= */
  function hexToRgb(hex) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function lightness(hex) { const [r, g, b] = hexToRgb(hex); return (Math.max(r, g, b) + Math.min(r, g, b)) / 510; }
  // Ton korunarak açıklık terslenir (koyu zeminde siyah mürekkep → açık)
  function invertLightness(hex) {
    const [r, g, b] = hexToRgb(hex);
    const k = 255 - Math.max(r, g, b) - Math.min(r, g, b);
    return toHex(r + k, g + k, b + k);
  }
  const adaptCache = new Map();
  ON.adaptColor = (hex, darkSurface) => {
    const key = hex + (darkSurface ? 'd' : 'l');
    if (adaptCache.has(key)) return adaptCache.get(key);
    const L = lightness(hex);
    const out = (darkSurface && L < 0.3) || (!darkSurface && L > 0.82) ? invertLightness(hex) : hex;
    adaptCache.set(key, out);
    return out;
  };
  // Fosforlu: açık zeminde pastel (multiply), koyu zeminde koyulaştırılmış (screen)
  ON.hlColor = (hex, darkSurface) => {
    if (!darkSurface) return hex;
    const [r, g, b] = hexToRgb(hex);
    return toHex(r * 0.5, g * 0.5, b * 0.5);
  };
  ON.hexToRgb = hexToRgb; ON.toHex = toHex; ON.lightness = lightness;

  /* ================= Kalem motoru ================= */
  const LINE_TOOLS = new Set(['highlighter']);
  const isLineStroke = s => LINE_TOOLS.has(s.tool) || !!s.shape;
  function widthAt(s, p) {
    switch (s.tool) {
      case 'fountain': return s.size * (0.25 + 1.35 * p);
      case 'pencil': return s.size * (0.6 + 0.6 * p);
      case 'ballpoint': return s.size * (0.85 + 0.3 * p);
      default: return s.size;
    }
  }
  const maxWidth = s => isLineStroke(s) ? s.size : s.size * (s.tool === 'fountain' ? 1.6 : 1.2);
  ON.widthAt = widthAt;

  function computeBBox(s) {
    const b = Geo.bboxOfFlat(s.pts, 3);
    const r = maxWidth(s) / 2 + 1;
    s.bbox = Geo.expand(b, r);
    return s.bbox;
  }
  ON.computeBBox = computeBBox;

  ON.makeStroke = (o) => {
    const s = { id: o.id || ON.uid(), tool: o.tool, color: o.color, size: o.size, pts: o.pts, page: o.page ?? 0,
      shape: o.shape || null, flat: !!o.flat, text: o.text || '', grp: o.grp || '' };
