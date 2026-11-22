/* =====================================================================
   Odak Not — canvas-tools.js
   Geometri (AABB + dar faz), Affine2D, kalem motoru (Path2D dış hat),
   şekil tanıma (Hold-to-Snap), silgiler, kement, HistoryManager (komutlar),
   TouchGestureRecognizer, SelectionGizmo, kağıt şablonları.
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
    computeBBox(s);
    return s;
  };

  // Basınç duyarlı dış hat → Path2D (dünya koordinatında, önbellekli)
  function strokePath(s) {
    if (s._path) return s._path;
    const P = new Path2D(), pts = s.pts, n = pts.length / 3;
    if (isLineStroke(s)) {
      P.moveTo(pts[0], pts[1]);
      if (n === 1) P.lineTo(pts[0] + 0.01, pts[1]);
      else if (s.shape || s.flat || n < 3) for (let i = 1; i < n; i++) P.lineTo(pts[i * 3], pts[i * 3 + 1]);
      else {
        for (let i = 1; i < n - 1; i++) {
          const x = pts[i * 3], y = pts[i * 3 + 1];
          P.quadraticCurveTo(x, y, (x + pts[i * 3 + 3]) / 2, (y + pts[i * 3 + 4]) / 2);
        }
        P.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1]);
      }
      s._path = P; return P;
    }
    if (n === 1) {
      P.arc(pts[0], pts[1], Math.max(0.4, widthAt(s, pts[2]) / 2), 0, Math.PI * 2);
      s._path = P; return P;
    }
    const L = new Float32Array(n * 2), R = new Float32Array(n * 2), W = new Float32Array(n), A = new Float32Array(n);
    let pnx = 0, pny = -1;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      let tx = pts[i1 * 3] - pts[i0 * 3], ty = pts[i1 * 3 + 1] - pts[i0 * 3 + 1];
      const l = Math.hypot(tx, ty);
      let nx, ny;
      if (l < 1e-6) { nx = pnx; ny = pny; } else { tx /= l; ty /= l; nx = -ty; ny = tx; }
      pnx = nx; pny = ny;
      let w = widthAt(s, pts[i * 3 + 2]);
      if (s.tool === 'fountain') w *= 0.45 + 0.55 * Math.min(1, (i + 1) / 4, (n - i) / 4);
      const r = Math.max(0.35, w / 2);
      W[i] = r; A[i] = Math.atan2(ny, nx);
      const x = pts[i * 3], y = pts[i * 3 + 1];
      L[i * 2] = x + nx * r; L[i * 2 + 1] = y + ny * r;
      R[i * 2] = x - nx * r; R[i * 2 + 1] = y - ny * r;
    }
    P.moveTo(L[0], L[1]);
    for (let i = 1; i < n - 1; i++) P.quadraticCurveTo(L[i * 2], L[i * 2 + 1], (L[i * 2] + L[i * 2 + 2]) / 2, (L[i * 2 + 1] + L[i * 2 + 3]) / 2);
    P.lineTo(L[(n - 1) * 2], L[(n - 1) * 2 + 1]);
    P.arc(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1], W[n - 1], A[n - 1], A[n - 1] - Math.PI, true);
    for (let i = n - 2; i > 0; i--) P.quadraticCurveTo(R[i * 2], R[i * 2 + 1], (R[i * 2] + R[i * 2 - 2]) / 2, (R[i * 2 + 1] + R[i * 2 - 1]) / 2);
    P.lineTo(R[0], R[1]);
    P.arc(pts[0], pts[1], W[0], A[0] + Math.PI, A[0], true);
    P.closePath();
    s._path = P;
    return P;
  }
  ON.strokePath = strokePath;
  ON.invalidateStroke = s => { s._path = null; computeBBox(s); };

  // Kurşun kalem dokusu (renk başına önbellekli desen)
  const pencilPatterns = new Map();
  function pencilPattern(ctx, color) {
    if (pencilPatterns.has(color)) return pencilPatterns.get(color);
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d');
    const [r, gg, b] = hexToRgb(color);
    const img = g.createImageData(48, 48);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b;
      img.data[i + 3] = 120 + rnd() * 135 * (rnd() > 0.18 ? 1 : 0.35);
    }
    g.putImageData(img, 0, 0);
    const p = ctx.createPattern(c, 'repeat');
    pencilPatterns.set(color, p);
    return p;
  }

  // ctx zaten dünya dönüşümünde olmalı. opts: { dark, adapt }
  ON.drawStroke = (ctx, s, opts = {}) => {
    const path = strokePath(s);
    if (s.tool === 'highlighter') {
      ctx.strokeStyle = ON.hlColor(s.color, opts.dark);
      ctx.lineWidth = s.size;
      ctx.lineCap = s.flat || s.shape ? 'butt' : 'round';
      ctx.lineJoin = 'round';
      if (opts.liveAlpha) ctx.globalAlpha = opts.liveAlpha;
      ctx.stroke(path);
      ctx.globalAlpha = 1;
      return;
    }
    const color = opts.adapt === false ? s.color : ON.adaptColor(s.color, !!opts.dark);
    if (isLineStroke(s)) {
      ctx.strokeStyle = color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke(path);
      return;
    }
    if (s.tool === 'pencil') { ctx.fillStyle = pencilPattern(ctx, color); ctx.globalAlpha = 0.92; ctx.fill(path); ctx.globalAlpha = 1; }
    else { ctx.fillStyle = color; ctx.fill(path); }
  };

  /* ================= Hold-to-Snap şekil tanıma ================= */
  function rdpXY(xy, eps) {
    const n = xy.length;
    if (n < 3) return xy.slice();
    const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]], e2 = eps * eps;
    while (stack.length) {
      const [s, e] = stack.pop();
      let max = 0, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const d = Geo.pointToSegmentDistSq(xy[i][0], xy[i][1], xy[s][0], xy[s][1], xy[e][0], xy[e][1]);
        if (d > max) { max = d; idx = i; }
      }
      if (max > e2) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
    }
    return xy.filter((_, i) => keep[i]);
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const flatten = (list) => { const f = new Float32Array(list.length * 3); list.forEach((p, i) => { f[i * 3] = p[0]; f[i * 3 + 1] = p[1]; f[i * 3 + 2] = 0.5; }); return f; };
  function arrowHead(tip, from, len) {
    const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]), s = 0.45;
    return [[tip[0] - len * Math.cos(a - s), tip[1] - len * Math.sin(a - s)], [tip[0] - len * Math.cos(a + s), tip[1] - len * Math.sin(a + s)]];
  }
  function angleAt(a, b, c) {
    const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const d = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2) || 1);
    return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
  }
  // pts: sayı dizisi [x,y,p,...]; dönüş: { name, pts: Float32Array } veya null
  ON.recognizeShape = (pts, zoom = 1) => {
    const xy = [];
    for (let i = 0; i < pts.length; i += 3) xy.push([pts[i], pts[i + 1]]);
    if (xy.length < 4) return null;
    const b = Geo.bboxOfFlat(xy.flat(), 2), w = b.maxX - b.minX, h = b.maxY - b.minY, diag = Math.hypot(w, h);
    if (diag < 14 / zoom) return null;
    let len = 0;
    for (let i = 1; i < xy.length; i++) len += dist(xy[i - 1], xy[i]);
    const start = xy[0], end = xy[xy.length - 1];
    const closed = dist(start, end) < Math.max(0.2 * diag, 16 / zoom) && len > 1.6 * diag;

    if (!closed) {
      if (dist(start, end) / len > 0.93) return { name: 'line', pts: flatten([start, end]) };
      // Ok: başlangıçtan en uzak nokta uç; uca kadar düz, sonrası kısa geri dönüş
      let tipI = 0, best = 0;
      xy.forEach((p, i) => { const d = dist(p, start); if (d > best) { best = d; tipI = i; } });
      const tip = xy[tipI];
      let mainLen = 0; for (let i = 1; i <= tipI; i++) mainLen += dist(xy[i - 1], xy[i]);
      let rest = 0; for (let i = tipI + 1; i < xy.length; i++) rest += dist(xy[i - 1], xy[i]);
      if (tipI > 2 && best / mainLen > 0.9 && rest > 0.08 * best && rest < 0.8 * best) {
        const [h1, h2] = arrowHead(tip, start, Math.min(28 / zoom + 6, best * 0.25));
        return { name: 'arrow', pts: flatten([start, tip, h1, tip, h2]) };
      }
      // Koordinat ekseni: L biçimi (≈90° köşe)
      const simp = rdpXY(xy, 0.08 * diag);
      if (simp.length === 3) {
        const ang = angleAt(simp[0], simp[1], simp[2]);
        if (ang > 65 && ang < 115) {
          const c = simp[1], A = simp[0], B = simp[2], hl = Math.min(22 / zoom + 4, diag * 0.12);
          const [a1, a2] = arrowHead(A, c, hl), [b1, b2] = arrowHead(B, c, hl);
          return { name: 'axes', pts: flatten([a1, A, a2, A, c, B, b1, B, b2]) };
        }
      }
      return null;
    }

    // Kapalı: daire/elips veya çokgen
    const cx = xy.reduce((s, p) => s + p[0], 0) / xy.length, cy = xy.reduce((s, p) => s + p[1], 0) / xy.length;
    const rs = xy.map(p => Math.hypot((p[0] - cx) / (w / 2 || 1), (p[1] - cy) / (h / 2 || 1)));
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    const cv = Math.sqrt(rs.reduce((a, r) => a + (r - mean) ** 2, 0) / rs.length) / (mean || 1);
    let simp = rdpXY(xy, 0.1 * diag);
    if (simp.length > 2 && dist(simp[0], simp[simp.length - 1]) < 0.2 * diag) simp = simp.slice(0, -1);
    // birbirine çok yakın köşeleri birleştir
    const verts = [];
    for (const p of simp) if (!verts.length || dist(verts[verts.length - 1], p) > 0.12 * diag) verts.push(p);
    if (verts.length > 2 && dist(verts[0], verts[verts.length - 1]) < 0.12 * diag) verts.pop();

    if (verts.length === 3 && cv > 0.08) return { name: 'triangle', pts: flatten([...verts, verts[0]]) };
    if (verts.length === 4 && cv > 0.07) {
      const angs = verts.map((v, i) => angleAt(verts[(i + 3) % 4], v, verts[(i + 1) % 4]));
      if (angs.every(a => a > 62 && a < 118)) {
        // Düzgün dikdörtgen: ilk kenarın yönüne hizalı
        let rot = Math.atan2(verts[1][1] - verts[0][1], verts[1][0] - verts[0][0]);
        const snap = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
        if (Math.abs(rot - snap) < 8 * Math.PI / 180) rot = snap;
        const c = Math.cos(-rot), s = Math.sin(-rot);
        const loc = verts.map(p => [(p[0] - cx) * c - (p[1] - cy) * s, (p[0] - cx) * s + (p[1] - cy) * c]);
        const lb = Geo.bboxOfFlat(loc.flat(), 2);
        const corners = [[lb.minX, lb.minY], [lb.maxX, lb.minY], [lb.maxX, lb.maxY], [lb.minX, lb.maxY]]
          .map(p => [p[0] * Math.cos(rot) - p[1] * Math.sin(rot) + cx, p[0] * Math.sin(rot) + p[1] * Math.cos(rot) + cy]);
        return { name: 'rect', pts: flatten([...corners, corners[0]]) };
      }
      return { name: 'polygon', pts: flatten([...verts, verts[0]]) };
    }
    if (cv < 0.2) {
      const rx = w / 2, ry = h / 2, ex = (b.minX + b.maxX) / 2, ey = (b.minY + b.maxY) / 2;
      const circle = Math.abs(rx - ry) / Math.max(rx, ry) < 0.16;
      const R = (rx + ry) / 2, list = [];
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * Math.PI * 2;
        list.push([ex + (circle ? R : rx) * Math.cos(t), ey + (circle ? R : ry) * Math.sin(t)]);
      }
      return { name: circle ? 'circle' : 'ellipse', pts: flatten(list) };
    }
    if (verts.length >= 5 && verts.length <= 8) return { name: 'polygon', pts: flatten([...verts, verts[0]]) };
    return null;
  };

  /* ================= Silgi ve kement (AABB + dar faz) ================= */
  // Vektör silgisi: daire ve süpürme segmenti ile isabet (sqrt yok)
  ON.strokeHit = (s, ax, ay, bx, by, r) => {
    const sweep = { minX: Math.min(ax, bx) - r, minY: Math.min(ay, by) - r, maxX: Math.max(ax, bx) + r, maxY: Math.max(ay, by) + r };
    if (!Geo.bboxIntersects(sweep, s.bbox)) return false;            // broad phase
    const p = s.pts, n = p.length / 3, rr = (r + maxWidth(s) / 2) ** 2;
    if (n === 1) return Geo.pointToSegmentDistSq(p[0], p[1], ax, ay, bx, by) <= rr;
    for (let i = 0; i < n - 1; i++) {                                   // narrow phase
      const x1 = p[i * 3], y1 = p[i * 3 + 1], x2 = p[i * 3 + 3], y2 = p[i * 3 + 4];
      if (Geo.pointToSegmentDistSq(bx, by, x1, y1, x2, y2) <= rr) return true;
      if (Geo.pointToSegmentDistSq(x1, y1, ax, ay, bx, by) <= rr) return true;
      if (Geo.segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by)) return true;
    }
    return false;
  };

  // Kısmi silgi: çizgiyi dairenin dışında kalan parçalara böl. Dokunmadıysa null.
  ON.splitStrokeByCircle = (s, cx, cy, r) => {
    const b = s.bbox;
    if (cx + r < b.minX || cx - r > b.maxX || cy + r < b.minY || cy - r > b.maxY) return null;
    const p = s.pts, n = p.length / 3, r2 = r * r;
    if (n === 1) return ((p[0] - cx) ** 2 + (p[1] - cy) ** 2 <= r2) ? [] : null;
    const pieces = [];
    let cur = [], touched = false;
    const inside0 = (p[0] - cx) ** 2 + (p[1] - cy) ** 2 < r2;
    if (!inside0) cur.push(p[0], p[1], p[2]);
    for (let i = 0; i < n - 1; i++) {
      const ax = p[i * 3], ay = p[i * 3 + 1], ap = p[i * 3 + 2], bx = p[i * 3 + 3], by = p[i * 3 + 4], bp = p[i * 3 + 5];
      const dx = bx - ax, dy = by - ay, fx = ax - cx, fy = ay - cy;
      const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r2;
      let u0 = 2, u1 = -1;
      if (A > 1e-12) {
        const disc = B * B - 4 * A * C;
        if (disc >= 0) { const sq = Math.sqrt(disc); u0 = Math.max(0, (-B - sq) / (2 * A)); u1 = Math.min(1, (-B + sq) / (2 * A)); }
      } else if (C < 0) { u0 = 0; u1 = 1; }
      if (u0 > u1) { cur.push(bx, by, bp); continue; }
      touched = true;
      if (u0 > 0) cur.push(ax + dx * u0, ay + dy * u0, ap + (bp - ap) * u0);
      if (cur.length >= 6) pieces.push(new Float32Array(cur));
      cur = [];
      if (u1 < 1) cur.push(ax + dx * u1, ay + dy * u1, ap + (bp - ap) * u1, bx, by, bp);
    }
    if (!touched) return null;
    if (cur.length >= 6) pieces.push(new Float32Array(cur));
    return pieces.filter(f => {
      let l = 0; for (let i = 3; i < f.length; i += 3) l += Math.abs(f[i] - f[i - 3]) + Math.abs(f[i + 1] - f[i - 2]);
      return l > 0.6;
    });
  };

  // Kement: polygon düz dizi; önce AABB, sonra nokta-içinde / kenar kesişimi
  ON.strokeInLasso = (s, poly, polyBox) => {
    if (!Geo.bboxIntersects(s.bbox, polyBox)) return false;
    const p = s.pts, n = p.length / 3;
    for (let i = 0; i < n; i++) if (Geo.isPointInPolygon(p[i * 3], p[i * 3 + 1], poly)) return true;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0, k = poly.length - 2; j < poly.length; k = j, j += 2) {
        if (Geo.segmentsIntersect(p[i * 3], p[i * 3 + 1], p[i * 3 + 3], p[i * 3 + 4], poly[k], poly[k + 1], poly[j], poly[j + 1])) return true;
      }
    }
    return false;
  };

  // PDF metin seçiminden gelen dikdörtgenleri satır bazında birleştir
  ON.mergeSameLineWorldRects = (rects) => {
    const list = rects.filter(r => r.w > 0.5 && r.h > 0.5).map(r => ({ ...r }))
      .sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
    const out = [];
    for (const r of list) {
      const last = out[out.length - 1];
      if (last) {
        const cy1 = last.y + last.h / 2, cy2 = r.y + r.h / 2, mh = Math.min(last.h, r.h);
        const gap = r.x - (last.x + last.w);
        if (Math.abs(cy1 - cy2) < mh * 0.5 && gap < mh * 0.8 && r.x + r.w > last.x - mh) {
          const x0 = Math.min(last.x, r.x), y0 = Math.min(last.y, r.y);
          const x1 = Math.max(last.x + last.w, r.x + r.w), y1 = Math.max(last.y + last.h, r.y + r.h);
          Object.assign(last, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          continue;
        }
      }
      out.push(r);
    }
    return out;
  };

  /* ================= HistoryManager (Command Pattern, sıfır kopya) ================= */
  // doc arayüzü: addStrokes(list), removeStrokes(list), touch(list), invalidate(bbox)
  const bboxOfStrokes = list => list.reduce((acc, s) => Geo.union(acc, s.bbox), null);
  const freeStroke = s => { s.pts = null; s._path = null; s.dead = true; };

  class AddStrokesCommand {
    constructor(doc, strokes) { this.doc = doc; this.strokes = strokes; this.label = 'Çizim'; }
    do() { this.doc.addStrokes(this.strokes); this.dirtyBBox = bboxOfStrokes(this.strokes); }
    undo() { this.doc.removeStrokes(this.strokes); this.dirtyBBox = bboxOfStrokes(this.strokes); }
    // geri alınmış halde redo yığınından düşerse çizgiler kalıcı silinir
    permanentlyRemove(where) { if (where === 'redo') this.strokes.forEach(freeStroke); }
  }
  class EraseStrokesCommand {
    constructor(doc, removed, added = []) { this.doc = doc; this.removed = removed; this.added = added; this.label = 'Silme'; this.applied = false; }
    do() {
      if (!this.applied) { this.doc.removeStrokes(this.removed); this.doc.addStrokes(this.added); }
      this.applied = true;
      this.dirtyBBox = Geo.union(bboxOfStrokes(this.removed), bboxOfStrokes(this.added));
    }
    undo() { this.doc.removeStrokes(this.added); this.doc.addStrokes(this.removed); this.applied = false; this.dirtyBBox = Geo.union(bboxOfStrokes(this.removed), bboxOfStrokes(this.added)); }
    permanentlyRemove(where) { (where === 'undo' ? this.removed : this.added).forEach(freeStroke); }
    // Canlı silgi oturumunda değişiklikler zaten uygulandı
    static fromSession(doc, removed, added) { const c = new EraseStrokesCommand(doc, removed, added); c.applied = true; return c; }
  }
  class TransformStrokesCommand {
    constructor(doc, strokes, matrix) { this.doc = doc; this.strokes = strokes; this.matrix = matrix; this.inverse = matrix.invert(); this.label = 'Dönüştürme'; }
    _apply(m) {
      const before = bboxOfStrokes(this.strokes), k = m.scaleFactor;
      for (const s of this.strokes) {
        if (!s.pts) continue;
        m.applyInPlace(s.pts, 3);
        s.size = s.size * k;
        s._path = null; computeBBox(s);
      }
      this.doc.touch(this.strokes);
      this.dirtyBBox = Geo.union(before, bboxOfStrokes(this.strokes));
    }
    do() { this._apply(this.matrix); }
    undo() { this._apply(this.inverse); }
  }
  class RecolorStrokesCommand {
    constructor(doc, strokes, color) { this.doc = doc; this.strokes = strokes; this.color = color; this.old = strokes.map(s => s.color); }
    do() { this.strokes.forEach(s => { s.color = this.color; }); this.doc.touch(this.strokes); this.dirtyBBox = bboxOfStrokes(this.strokes); }
    undo() { this.strokes.forEach((s, i) => { s.color = this.old[i]; }); this.doc.touch(this.strokes); this.dirtyBBox = bboxOfStrokes(this.strokes); }
  }
  class HistoryManager {
    constructor(doc, maxHistory = 60) { this.doc = doc; this.maxHistory = maxHistory; this.undoStack = []; this.redoStack = []; this.onChange = () => {}; }
    execute(cmd, alreadyApplied = false) {
      if (!alreadyApplied) cmd.do(); else if (!cmd.dirtyBBox) cmd.do();
      this.undoStack.push(cmd);
      this._clearRedo();
      while (this.undoStack.length > this.maxHistory) this.undoStack.shift().permanentlyRemove?.('undo');
      this.doc.invalidate(cmd.dirtyBBox);
      this.onChange();
    }
    _clearRedo() { for (const c of this.redoStack) c.permanentlyRemove?.('redo'); this.redoStack = []; }
    undo() { const c = this.undoStack.pop(); if (!c) return false; c.undo(); this.redoStack.push(c); this.doc.invalidate(c.dirtyBBox); this.onChange(); return true; }
    redo() { const c = this.redoStack.pop(); if (!c) return false; c.do(); this.undoStack.push(c); this.doc.invalidate(c.dirtyBBox); this.onChange(); return true; }
    clear() { this.undoStack.forEach(c => c.permanentlyRemove?.('undo')); this._clearRedo(); this.undoStack = []; this.onChange(); }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
  }
  Object.assign(ON, { AddStrokesCommand, EraseStrokesCommand, TransformStrokesCommand, RecolorStrokesCommand, HistoryManager });

  /* ================= TouchGestureRecognizer ================= */
  class TouchGestureRecognizer {
    constructor(opts) {
      this.MOVE_SLOP_PX = 12; this.TAP_MS = 280; this.PALM_MS = 150;
      this.o = opts; // { onTransform(dx,dy,scale,cx,cy), onTransformEnd(), onTap(count), isPenBusy() }
      this.pts = new Map(); this.reset();
    }
    reset() { this.isTransforming = false; this.maxCount = 0; this.startTime = 0; this.cancelled = false; this.anchor = null; }
    _centroid() {
      let x = 0, y = 0; const n = this.pts.size;
      for (const p of this.pts.values()) { x += p.x; y += p.y; }
      return { x: x / n, y: y / n };
    }
    _dist() {
      const a = [...this.pts.values()];
      if (a.length < 2) return 0;
      return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
    }
    _resetAnchors() { this.anchor = { c: this._centroid(), d: this._dist() }; }
    get active() { return this.pts.size > 0; }
    down(e) {
      if (this.o.isPenBusy()) { this.cancelled = true; return; }
      if (!this.pts.size) { this.reset(); this.startTime = performance.now(); }
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      this.maxCount = Math.max(this.maxCount, this.pts.size);
      this._resetAnchors();
    }
    move(e) {
      const p = this.pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (this.o.isPenBusy()) { this.cancelled = true; return; }
      if (!this.isTransforming) {
        for (const q of this.pts.values()) {
          if (Math.hypot(q.x - q.sx, q.y - q.sy) > this.MOVE_SLOP_PX) { this.isTransforming = true; this._resetAnchors(); break; }
        }
        return;
      }
      const c = this._centroid(), d = this._dist();
      const scale = this.pts.size >= 2 && this.anchor.d > 0 ? d / this.anchor.d : 1;
      this.o.onTransform(c.x - this.anchor.c.x, c.y - this.anchor.c.y, scale, c.x, c.y);
      this.anchor = { c, d };
    }
    up(e) {
      if (!this.pts.has(e.pointerId)) return;
      this.pts.delete(e.pointerId);
      if (this.pts.size) { this._resetAnchors(); return; }
      const dt = performance.now() - this.startTime;
      if (this.isTransforming) this.o.onTransformEnd();
      else if (!this.cancelled && dt < this.TAP_MS && this.maxCount >= 2) this.o.onTap(Math.min(this.maxCount, 3));
      this.reset();
    }
    cancelAll() { if (this.isTransforming) this.o.onTransformEnd(); this.pts.clear(); this.reset(); }
  }
  ON.TouchGestureRecognizer = TouchGestureRecognizer;

  /* ================= SelectionGizmo ================= */
  class SelectionGizmo {
    constructor(strokes, zoom) {
      this.strokes = strokes;
      const b = bboxOfStrokes(strokes), pad = 6 / zoom;
      this.box = { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2, angle: 0 };
      this.live = new Affine2D();
      this.drag = null;
    }
    toLocal(x, y) {
      const { cx, cy, angle } = this.box, c = Math.cos(-angle), s = Math.sin(-angle);
      return [(x - cx) * c - (y - cy) * s, (x - cx) * s + (y - cy) * c];
    }
    toWorld(lx, ly, box = this.box) {
      const c = Math.cos(box.angle), s = Math.sin(box.angle);
      return [box.cx + lx * c - ly * s, box.cy + lx * s + ly * c];
    }
    rotHandleOffset(zoom) { return this.box.h / 2 + 30 / zoom; }
    // Tutamaç algılama yerel koordinatta, yarıçap 22 / zoom
    hitTest(x, y, zoom) {
      const [lx, ly] = this.toLocal(x, y), r = 22 / zoom, hw = this.box.w / 2, hh = this.box.h / 2;
      if (Math.hypot(lx, ly + this.rotHandleOffset(zoom)) <= r) return 'rotate';
      const corners = { nw: [-hw, -hh], ne: [hw, -hh], se: [hw, hh], sw: [-hw, hh] };
      for (const k in corners) if (Math.hypot(lx - corners[k][0], ly - corners[k][1]) <= r) return k;
      if (Math.abs(lx) <= hw + 4 / zoom && Math.abs(ly) <= hh + 4 / zoom) return 'move';
      return null;
    }
    begin(kind, x, y) {
      this.drag = { kind, sx: x, sy: y, box: { ...this.box }, a0: Math.atan2(y - this.box.cy, x - this.box.cx) };
    }
    update(x, y) {
      const d = this.drag; if (!d) return;
      const b0 = d.box;
      if (d.kind === 'move') {
        this.live = Affine2D.translate(x - d.sx, y - d.sy);
        this.box = { ...b0, cx: b0.cx + x - d.sx, cy: b0.cy + y - d.sy };
      } else if (d.kind === 'rotate') {
        let ang = b0.angle + Math.atan2(y - b0.cy, x - b0.cx) - d.a0;
        const deg = ((ang * 180 / Math.PI) % 360 + 360) % 360;
        for (const t of [0, 90, 180, 270, 360]) if (Math.abs(deg - t) <= 4) { ang = t * Math.PI / 180; break; }   // manyetik hizalama
        const delta = ang - b0.angle;
        this.live = Affine2D.chain(Affine2D.translate(b0.cx, b0.cy), Affine2D.rotate(delta), Affine2D.translate(-b0.cx, -b0.cy));
        this.box = { ...b0, angle: ang };
      } else {
        const sign = { nw: [-1, -1], ne: [1, -1], se: [1, 1], sw: [-1, 1] }[d.kind];
        const ox = -sign[0] * b0.w / 2, oy = -sign[1] * b0.h / 2;                // karşı köşe (yerel)
        const c = Math.cos(-b0.angle), s = Math.sin(-b0.angle);
        const lx = (x - b0.cx) * c - (y - b0.cy) * s, ly = (x - b0.cx) * s + (y - b0.cy) * c;
        const sx = Math.max(0.05, (lx - ox) * sign[0] / b0.w), sy = Math.max(0.05, (ly - oy) * sign[1] / b0.h);
        const [wox, woy] = this.toWorld(ox, oy, b0);
        this.live = Affine2D.chain(Affine2D.translate(wox, woy), Affine2D.rotate(b0.angle), Affine2D.scale(sx, sy), Affine2D.rotate(-b0.angle), Affine2D.translate(-wox, -woy));
        const [ncx, ncy] = this.live.apply(b0.cx, b0.cy);
        this.box = { cx: ncx, cy: ncy, w: b0.w * sx, h: b0.h * sy, angle: b0.angle };
      }
    }
    end() { const m = this.live; this.live = new Affine2D(); this.drag = null; return m; }
    // ctx dünya dönüşümünde
    draw(ctx, zoom) {
      const { w, h, angle, cx, cy } = this.box;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(angle);
      ctx.lineWidth = 1.5 / zoom; ctx.strokeStyle = '#7B52DB'; ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);
      const ro = this.rotHandleOffset(zoom);
      ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -ro); ctx.stroke();
      const hs = 7 / zoom;
      ctx.fillStyle = '#F2EFFB';
      for (const [x, y] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
        ctx.beginPath(); ctx.rect(x - hs, y - hs, hs * 2, hs * 2); ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, -ro, 9 / zoom, 0, Math.PI * 2); ctx.fillStyle = '#472399'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#F2EFFB'; ctx.lineWidth = 1.4 / zoom;
      ctx.beginPath(); ctx.arc(0, -ro, 4.5 / zoom, -2.6, 1.2); ctx.stroke();
      ctx.restore();
    }
    bottomCenter() { return this.toWorld(0, this.box.h / 2); }
    worldBBox() {
      const hw = this.box.w / 2, hh = this.box.h / 2;
      const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(p => this.toWorld(p[0], p[1])).flat();
      return Geo.bboxOfFlat(pts, 2);
    }
  }
  ON.SelectionGizmo = SelectionGizmo;

  /* ================= Kağıt şablonları ================= */
  ON.PAPER_THEMES = {
    white: { bg: '#FFFFFF', line: 'rgba(60,72,140,0.20)', strong: 'rgba(60,72,140,0.34)', margin: 'rgba(214,76,76,0.35)', dark: false },
    cream: { bg: '#F7F1E3', line: 'rgba(120,92,40,0.22)', strong: 'rgba(120,92,40,0.36)', margin: 'rgba(196,80,60,0.32)', dark: false },
    dark: { bg: '#1D1B24', line: 'rgba(196,186,240,0.12)', strong: 'rgba(196,186,240,0.22)', margin: 'rgba(155,123,255,0.30)', dark: true }
  };
  ON.TEMPLATES = [
    ['plain', 'Düz'], ['lined-n', 'Çizgili (dar)'], ['lined-m', 'Çizgili (orta)'], ['lined-w', 'Çizgili (geniş)'],
    ['grid', 'Kareli'], ['mm', 'Milimetrik'], ['dots', 'Noktalı'], ['cornell', 'Cornell']
  ];
  const LINE_GAP = { 'lined-n': 24, 'lined-m': 32, 'lined-w': 42, cornell: 32 };
  const TOP = 96; // çizgili sayfalarda başlık boşluğu

  // CSS arka planı (sayfa div'i veya sınırsız tuval için). scale: px / dünya birimi
  ON.paperCSS = (paper, scale = 1, ox = 0, oy = 0, paged = true) => {
    const th = ON.PAPER_THEMES[paper.theme] || ON.PAPER_THEMES.white;
    const t = paper.template;
    const out = { backgroundColor: th.bg, backgroundImage: 'none', backgroundSize: '', backgroundPosition: '' };
    const lin = (dir, color, g, w = 1) => `repeating-linear-gradient(${dir}, ${color} 0 ${w}px, transparent ${w}px ${g}px)`;
    if (t === 'grid') {
      const g = 32 * scale;
      out.backgroundImage = `${lin('to bottom', th.line, g)}, ${lin('to right', th.line, g)}`;
      out.backgroundPosition = `${ox}px ${oy}px`;
    } else if (t === 'mm') {
      const g = 8 * scale, G = 40 * scale;
      out.backgroundImage = [lin('to bottom', th.strong, G), lin('to right', th.strong, G), lin('to bottom', th.line, g, 0.6), lin('to right', th.line, g, 0.6)].join(',');
      out.backgroundPosition = `${ox}px ${oy}px`;
    } else if (t === 'dots') {
      const g = 28 * scale;
      out.backgroundImage = `radial-gradient(circle at ${g / 2}px ${g / 2}px, ${th.strong} ${Math.max(0.9, 1.3 * scale)}px, transparent ${Math.max(1.4, 1.8 * scale)}px)`;
      out.backgroundSize = `${g}px ${g}px`;
      out.backgroundPosition = `${ox}px ${oy}px`;
    } else if (LINE_GAP[t]) {
      const g = LINE_GAP[t] * scale;
      if (paged) {
        // Üstte başlık boşluğu bırakılır, çizgiler TOP'tan başlar
        out.backgroundImage = `linear-gradient(to bottom, ${th.bg} 0 ${TOP * scale}px, transparent ${TOP * scale}px), ${lin('to bottom', th.line, g)}`;
        out.backgroundPosition = `0 0, ${ox}px ${oy + TOP * scale}px`;
      } else {
        out.backgroundImage = lin('to bottom', th.line, g);
        out.backgroundPosition = `${ox}px ${oy}px`;
      }
    }
    return out;
  };

  // Tuvale kağıt çizimi (dışa aktarma, önizleme). ctx dünya dönüşümünde; rect: sayfa dünyası
  ON.drawPaper = (ctx, rect, paper, opts = {}) => {
    const th = ON.PAPER_THEMES[opts.forceLight && paper.theme === 'dark' ? 'white' : paper.theme] || ON.PAPER_THEMES.white;
    const { x, y, w, h } = rect, t = paper.template, lw = opts.lineWidth || 1;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = th.bg; ctx.fillRect(x, y, w, h);
    const ox = opts.originX ?? x, oy = opts.originY ?? y;
    const hLines = (g, color, start, width = lw) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (let yy = oy + start + Math.ceil((y - oy - start) / g) * g; yy < y + h; yy += g) { ctx.moveTo(x, yy + 0.5 * width); ctx.lineTo(x + w, yy + 0.5 * width); }
      ctx.stroke();
    };
    const vLines = (g, color, width = lw) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
      for (let xx = ox + Math.ceil((x - ox) / g) * g; xx < x + w; xx += g) { ctx.moveTo(xx + 0.5 * width, y); ctx.lineTo(xx + 0.5 * width, y + h); }
      ctx.stroke();
    };
    if (t === 'grid') { hLines(32, th.line, 0); vLines(32, th.line); }
    else if (t === 'mm') { hLines(8, th.line, 0, lw * 0.6); vLines(8, th.line, lw * 0.6); hLines(40, th.strong, 0); vLines(40, th.strong); }
    else if (t === 'dots') {
      ctx.fillStyle = th.strong;
      for (let yy = oy + 14 + Math.ceil((y - oy - 14) / 28) * 28; yy < y + h; yy += 28)
        for (let xx = ox + 14 + Math.ceil((x - ox - 14) / 28) * 28; xx < x + w; xx += 28) { ctx.beginPath(); ctx.arc(xx, yy, 1.3, 0, Math.PI * 2); ctx.fill(); }
    } else if (LINE_GAP[t]) {
      hLines(LINE_GAP[t], th.line, opts.paged === false ? 0 : TOP);
    }
    if (t === 'cornell' && opts.paged !== false) {
      ctx.strokeStyle = th.margin; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + TOP - 8); ctx.lineTo(x + w, y + TOP - 8);
      ctx.moveTo(x + 200, y + TOP - 8); ctx.lineTo(x + 200, y + h - 220);
      ctx.moveTo(x, y + h - 220); ctx.lineTo(x + w, y + h - 220);
      ctx.stroke();
    }
    ctx.restore();
  };
  ON.CORNELL = { top: TOP - 8, cue: 200, summary: 220 };
})();
