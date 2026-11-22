/* =====================================================================
   Odak Not — app.js (Obsidian Studio & Focus Suite Edition)
   Uygulama orkestrasyonu: kütüphane, defter yükleme/kaydetme, kamera,
   giriş (S Pen / dokunma / fare), araçlar, kement, nesneler, kenar paneli,
   gelişmiş odak sayacı + kronometre + odak sesleri, zen modu, mini harita,
   dışa aktarma, ayarlar.
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON;
  const { Store, Geo, LS } = ON;
  const $ = id => document.getElementById(id);
  const esc = ON.esc;
  const GAP = 32;
  const dprOf = () => Math.min(window.devicePixelRatio || 1, 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  /* ================= İkonlar ================= */
  const ICONS = {
    ballpoint: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    fountain: '<path d="M14 4l6 6-8 8-5 1 1-5z"/><path d="M7 19l-3 2 1-4"/><circle cx="13.5" cy="10.5" r="1.3"/>',
    pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M5 16l3 3"/><path d="M15 6l3 3"/><path d="M4 20l1.5-1.5"/>',
    highlighter: '<path d="M9 15l-3 5h6"/><path d="M9 15l8-8 3 3-8 8z"/><path d="M14 6l4 4"/>',
    eraser: '<path d="M8 20h12"/><path d="M4 15l9-9 6 6-7 7H8z"/>',
    lasso: '<path d="M8 17.5C5.5 16.5 4 14.6 4 12.5 4 8.9 7.6 6 12 6s8 2.9 8 6.5-3.6 6.5-8 6.5c-1.1 0-2.1-.2-3-.5"/><path d="M9 17.5c-1 1.6-.4 3.5 2 3.5"/>',
    laser: '<circle cx="12" cy="12" r="2.6"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    textsel: '<path d="M9 4h6M9 20h6M12 4v16"/><path d="M5 9h2M5 15h2M17 9h2M17 15h2"/>',
    insert: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
    text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    caret: '<path d="M9 6l6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    study: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6M9 11h4"/>',
    paper: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h8"/>',
    export: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    zen: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    pages: '<rect x="4" y="3" width="7" height="9" rx="1"/><rect x="13" y="3" width="7" height="9" rx="1"/><rect x="4" y="14" width="7" height="7" rx="1"/><rect x="13" y="14" width="7" height="7" rx="1"/>',
    toc: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    pin: '<path d="M12 17v5M6 17h12l-2-4V5H8v8z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  ON.icon = icon;
  const fillIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => {
    if (!el.querySelector(':scope > svg')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });

  /* ================= Uygulama durumu ================= */
  const stage = $('stage'), world = $('world'), worldTop = $('worldTop');
  const hlC = $('hlCanvas'), inkC = $('inkCanvas'), liveC = $('liveCanvas');
  const hlX = hlC.getContext('2d'), inkX = inkC.getContext('2d');
  const liveX = liveC.getContext('2d', { desynchronized: true });

  const TOOLS_DEFAULT = {
    tool: 'pen', pen: 'fountain',
    sizes: { pen: [1.4, 2.4, 4.2], highlighter: [12, 18, 26], eraser: [8, 16, 30] },
    sizeIdx: { pen: 1, highlighter: 1, eraser: 1 },
    favDark: ['#F2EFFB', '#9B7BFF', '#5FD3C6', '#FFB86B', '#7AB8FF'],
    favLight: ['#1B1830', '#472399', '#0F7A6F', '#C2410C', '#2563EB'],
    favHl: ['#FFE45C', '#8EF0A6', '#FF9ECF', '#8FD3FF', '#C7B3FF'],
    inkDark: '#F2EFFB', inkLight: '#1B1830', hlColor: '#FFE45C',
    eraserMode: 'partial', eraseHlOnly: false, hlStraight: true,
    toolbarPos: null, collapsed: false
  };
  const tools = Object.assign({}, TOOLS_DEFAULT, LS.get('on-tools', {}));
  const saveTools = () => LS.set('on-tools', tools);

  const app = ON.app = {
    nb: null, pages: [], layout: [], docW: 0, docH: 0,
    cam: { tx: 0, ty: 0, z: 1 },
    engine: null, virt: null, search: null,
    lib: { folders: [] }, notebooks: [], folderId: null,
    history: null
  };
  let W = 0, H = 0, stageRect = { left: 0, top: 0 };
  let penDown = false, penUpAt = 0, active = null, cur = null, gizmo = null, lasso = null, hoverPt = null;
  let laser = [], selectedObj = null, saving = false, metaDirty = false, saveTimer = 0;
  const dirtyPages = new Set();
  const assetURLs = new Map();

  /* ================= Yardımcılar ================= */
  const surfaceDark = (nb = app.nb) => !!nb && (nb.pdfHash ? !!nb.pdfDark : nb.paper.theme === 'dark');
  const isInfinite = (nb = app.nb) => !!nb && nb.mode === 'infinite';
  const pageStrokes = i => app.pages[i] || (app.pages[i] = []);
  app.pageStrokes = pageStrokes;
  app.pageOrigin = i => app.layout[i] || { x: 0, y: 0, w: 0, h: 0 };
  app.pdfScale = i => { const p = app.nb.pages[i]; return p && p.pw ? app.layout[i].w / p.pw : 1; };
  app.toast = (msg, ms = 1800) => {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(app._toastT); app._toastT = setTimeout(() => t.classList.remove('on'), ms);
  };
  const fmtRel = t => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const d = new Date(t); d.setHours(0, 0, 0, 0);
    const days = Math.round((d0 - d) / 86400000);
    if (days <= 0) return 'Bugün';
    if (days === 1) return 'Dün';
    if (days < 7) return `${days} gün önce`;
    return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ================= Açılır pencereler ================= */
  app.openModal = id => { $(id).classList.add('on'); };
  app.closeModal = id => { $(id).classList.remove('on'); };
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { e.preventDefault(); m.classList.remove('on'); } });
  });
  app.confirm = (title, msg, yes = 'Tamam') => new Promise(res => {
    $('cfT').textContent = title; $('cfMsg').textContent = msg; $('cfYes').textContent = yes;
    app.openModal('confirmDlg');
    const done = v => { app.closeModal('confirmDlg'); $('cfYes').onclick = $('cfNo').onclick = null; res(v); };
    $('cfYes').onclick = () => done(true); $('cfNo').onclick = () => done(false);
  });
  app.closePanelsExcept = (keep) => {
    if (keep !== 'ai') ON.AI && ON.AI.close();
    if (keep !== 'pop') hidePop();
    if (keep !== 'timer') $('timerPop').hidden = true;
    if (keep === 'ai' && matchMedia('(max-width:820px)').matches) $('app').classList.add('side-closed');
  };

  /* ================= Kamera ================= */
  function viewRect() { const { tx, ty, z } = app.cam; return { minX: -tx / z, minY: -ty / z, maxX: (W - tx) / z, maxY: (H - ty) / z }; }
  app.screenToWorld = (cx, cy) => ({ x: (cx - stageRect.left - app.cam.tx) / app.cam.z, y: (cy - stageRect.top - app.cam.ty) / app.cam.z });
  const worldToStage = (x, y) => ({ x: x * app.cam.z + app.cam.tx, y: y * app.cam.z + app.cam.ty });
  function applyCamera() {
    const { tx, ty, z } = app.cam;
    const tr = `translate(${tx}px,${ty}px) scale(${z})`;
    world.style.transform = tr; worldTop.style.transform = tr;
    if (app.nb && isInfinite()) {
      const css = ON.paperCSS(app.nb.paper, z, tx, ty, false);
      Object.assign(stage.style, css);
    } else stage.style.backgroundImage = 'none';
    requestRedraw(); scheduleMini(); updateBackBtn(); positionGizmoBar();
    if (app.virt) app.virt.schedule();
    updateCurrentPage();
  }
  function clampPan() {
    if (!app.nb || isInfinite()) return;
    const { z } = app.cam;
    const minTx = Math.min(W * 0.5 - app.docW * z, (W - app.docW * z) / 2), maxTx = Math.max(W * 0.5, (W - app.docW * z) / 2);
    app.cam.tx = clamp(app.cam.tx, minTx, maxTx);
    app.cam.ty = clamp(app.cam.ty, H * 0.5 - app.docH * z, H * 0.5);
  }
  function zoomAt(f, sx, sy) {
    const z0 = app.cam.z, z1 = clamp(z0 * f, 0.2, 6);
    app.cam.tx = sx - (sx - app.cam.tx) * (z1 / z0);
    app.cam.ty = sy - (sy - app.cam.ty) * (z1 / z0);
    app.cam.z = z1;
  }
  function fitWidth(keepY = false) {
    if (!app.nb) return;
    if (isInfinite()) { if (!keepY) app.cam = { tx: 40, ty: 40, z: 1 }; return; }
    const z = clamp((W - 48) / app.docW, 0.25, 1.6);
    const cy = keepY ? (H / 2 - app.cam.ty) / app.cam.z : 0;
    app.cam.z = z; app.cam.tx = (W - app.docW * z) / 2;
    app.cam.ty = keepY ? H / 2 - cy * z : 24;
  }
  const refreshAfterZoom = debounce(() => { if (app.virt) app.virt.refreshResolution(); saveViewSoon(); }, 180);
  const saveViewSoon = debounce(() => { if (app.nb) { app.nb.view = { ...app.cam }; markMetaDirty(); } }, 1200);

  /* ================= Sayfa düzeni ================= */
  function computeLayout(nb) {
    if (nb.mode === 'infinite') return { layout: [{ x: 0, y: 0, w: 0, h: 0 }], docW: 0, docH: 0 };
    const maxW = Math.max(...nb.pages.map(p => p.w));
    const layout = []; let y = 0;
    for (const p of nb.pages) { layout.push({ x: (maxW - p.w) / 2, y, w: p.w, h: p.h }); y += p.h + GAP; }
    return { layout, docW: maxW, docH: Math.max(0, y - GAP) };
  }
  function relayout() {
    const L = computeLayout(app.nb);
    app.layout = L.layout; app.docW = L.docW; app.docH = L.docH;
  }
  function withRelayout(mutate) {
    const old = new Map(app.nb.pages.map((p, i) => [p, app.layout[i]]));
    const oldPages = app.pages.slice(), oldPageObjs = app.nb.pages.slice();
    mutate();
    relayout();
    const strokesByPage = new Map(oldPageObjs.map((p, i) => [p, oldPages[i] || []]));
    app.pages = app.nb.pages.map(p => strokesByPage.get(p) || []);
    app.nb.pages.forEach((p, i) => {
      const o = old.get(p), n = app.layout[i];
      for (const s of app.pages[i]) {
        s.page = i;
        if (o && (o.x !== n.x || o.y !== n.y)) { ON.Affine2D.translate(n.x - o.x, n.y - o.y).applyInPlace(s.pts); s._path = null; ON.computeBBox(s); }
      }
    });
  }
  function pageAt(x, y) {
    if (!app.nb || isInfinite()) return 0;
    const L = app.layout;
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].y <= y) lo = m; else hi = m - 1; }
    if (lo < L.length - 1 && y > L[lo].y + L[lo].h + GAP / 2) return lo + 1;
    return lo;
  }
  app.pageAt = pageAt;
  function visiblePages(r) {
    if (!app.nb) return [];
    if (isInfinite()) return [0];
    const out = [];
    for (let i = pageAt(r.minX, r.minY - GAP); i < app.layout.length; i++) {
      const L = app.layout[i];
      if (L.y > r.maxY) break;
      if (L.y + L.h >= r.minY) out.push(i);
    }
    return out;
  }
  function currentPage() { const v = viewRect(); return pageAt((v.minX + v.maxX) / 2, (v.minY + v.maxY) / 2); }
  app.currentPage = currentPage;

  /* ================= Sayfa DOM'u ================= */
  function buildPagesDOM() {
    if (app.virt) app.virt.clear();
    world.innerHTML = '';
    const nb = app.nb;
    stage.style.backgroundColor = '';
    if (isInfinite()) { renderObjects(); return; }
    const th = ON.PAPER_THEMES[nb.paper.theme] || ON.PAPER_THEMES.white;
    nb.pages.forEach((p, i) => {
      const L = app.layout[i];
      const el = document.createElement('div');
      el.className = 'page' + (p.k === 'pdf' && nb.pdfDark ? ' dark-pdf' : '');
      Object.assign(el.style, { left: L.x + 'px', top: L.y + 'px', width: L.w + 'px', height: L.h + 'px' });
      el.dataset.page = i;
      if (p.k === 'pdf') el.style.background = nb.pdfDark ? '#1D1B24' : '#FFFFFF';
      else {
        Object.assign(el.style, ON.paperCSS(nb.paper, 1, 0, 0, true));
        if (nb.paper.template === 'cornell') {
          const C = ON.CORNELL;
          el.insertAdjacentHTML('beforeend', `<div class="cornell" style="--cornell:${th.margin}"><i style="left:0;right:0;top:${C.top}px;height:2px"></i><i style="left:${C.cue}px;top:${C.top}px;bottom:${C.summary}px;width:2px"></i><i style="left:0;right:0;bottom:${C.summary}px;height:2px"></i></div>`);
        }
      }
      el.insertAdjacentHTML('beforeend', `<span class="page-no">${i + 1}</span>`);
      world.appendChild(el);
      if (p.k === 'pdf' && app.virt) app.virt.register(i, el, p.n, p.pw, p.ph, L.w);
    });
    renderObjects();
    if (app.virt) { app.virt.setTextMode(tools.tool === 'textsel'); app.virt.schedule(); }
  }
  const pageEl = i => world.querySelector(`.page[data-page="${i}"]`);

  /* ================= Çizim belgesi (komutların hedefi) ================= */
  const doc = {
    addStrokes(list) { for (const s of list) { if (!s.pts) continue; pageStrokes(s.page).push(s); markDirty(s.page); } },
    removeStrokes(list) {
      for (const s of list) {
        const arr = pageStrokes(s.page), i = arr.indexOf(s);
        if (i >= 0) arr.splice(i, 1);
        markDirty(s.page);
      }
    },
    touch(list) {
      for (const s of list) {
        if (!s.pts) continue;
        const np = pageAt((s.bbox.minX + s.bbox.maxX) / 2, (s.bbox.minY + s.bbox.maxY) / 2);
        if (np !== s.page) {
          const arr = pageStrokes(s.page), i = arr.indexOf(s);
          if (i >= 0) arr.splice(i, 1);
          markDirty(s.page); s.page = np; pageStrokes(np).push(s);
        }
        markDirty(s.page);
      }
    },
    invalidate(b) { requestRedraw(b || null); if (gizmo) { positionGizmoBar(); } }
  };

  /* ================= Çizim (render) ================= */
  let redrawAll = false, dirtyRect = null, rafId = 0, liveNeeded = false;
  function requestRedraw(b) {
    if (!b) redrawAll = true; else dirtyRect = Geo.union(dirtyRect, b);
    if (!rafId) rafId = requestAnimationFrame(frame);
  }
  function requestLive() { liveNeeded = true; if (!rafId) rafId = requestAnimationFrame(frame); }
  function frame() {
    rafId = 0;
    if (redrawAll || dirtyRect) { drawInk(redrawAll ? null : dirtyRect); redrawAll = false; dirtyRect = null; liveNeeded = true; }
    if (liveNeeded) { liveNeeded = false; drawLive(); }
  }
  function resizeCanvases() {
    const r = stage.getBoundingClientRect();
    stageRect = r; W = r.width; H = r.height;
    const d = dprOf();
    for (const c of [hlC, inkC, liveC]) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
    requestRedraw(); scheduleMini();
  }
  function setWorldTransform(ctx) { const d = dprOf(), { tx, ty, z } = app.cam; ctx.setTransform(d * z, 0, 0, d * z, d * tx, d * ty); }
  function drawInk(rect) {
    const d = dprOf();
    let view = viewRect();
    for (const ctx of [hlX, inkX]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (rect) {
        const a = worldToStage(rect.minX, rect.minY), b = worldToStage(rect.maxX, rect.maxY);
        ctx.save(); ctx.beginPath(); ctx.rect(Math.floor(a.x * d) - 2, Math.floor(a.y * d) - 2, Math.ceil((b.x - a.x) * d) + 4, Math.ceil((b.y - a.y) * d) + 4); ctx.clip();
        ctx.clearRect(0, 0, hlC.width, hlC.height);
      } else ctx.clearRect(0, 0, hlC.width, hlC.height);
      setWorldTransform(ctx);
    }
    if (!app.nb) { if (rect) { hlX.restore(); inkX.restore(); } return; }
    if (rect) view = { minX: Math.max(view.minX, rect.minX), minY: Math.max(view.minY, rect.minY), maxX: Math.min(view.maxX, rect.maxX), maxY: Math.min(view.maxY, rect.maxY) };
    const dark = surfaceDark();
    hlC.classList.toggle('on-dark', dark);
    for (const i of visiblePages(view)) {
      for (const s of pageStrokes(i)) {
        if (s._hidden || !s.pts || !Geo.bboxIntersects(s.bbox, view)) continue;
        ON.drawStroke(s.tool === 'highlighter' ? hlX : inkX, s, { dark });
      }
    }
    if (rect) { hlX.restore(); inkX.restore(); }
  }
  function tempStroke(c) {
    const pts = c.shapePts || new Float32Array(c.arr);
    return { tool: c.tool, color: c.color, size: c.size, pts, shape: c.shape, flat: false, _path: null };
  }
  function drawLive() {
    liveX.setTransform(1, 0, 0, 1, 0, 0);
    liveX.clearRect(0, 0, liveC.width, liveC.height);
    if (!app.nb) return;
    setWorldTransform(liveX);
    const z = app.cam.z, dark = surfaceDark();
    if (cur && cur.arr.length) ON.drawStroke(liveX, tempStroke(cur), { dark, liveAlpha: cur.tool === 'highlighter' ? 0.55 : 0 });
    if (lasso && lasso.length > 2) {
      liveX.save();
      liveX.beginPath(); liveX.moveTo(lasso[0], lasso[1]);
      for (let i = 2; i < lasso.length; i += 2) liveX.lineTo(lasso[i], lasso[i + 1]);
      liveX.closePath();
      liveX.fillStyle = 'rgba(123,82,219,0.08)'; liveX.fill();
      liveX.setLineDash([6 / z, 5 / z]); liveX.lineWidth = 1.5 / z; liveX.strokeStyle = '#7B52DB'; liveX.stroke();
      liveX.restore();
    }
    if (gizmo) {
      if (gizmo.drag) {
        liveX.save();
        const m = gizmo.live.m; liveX.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        for (const s of gizmo.strokes) if (s.pts) ON.drawStroke(liveX, s, { dark, liveAlpha: s.tool === 'highlighter' ? 0.55 : 0 });
        liveX.restore();
      }
      gizmo.draw(liveX, z);
    }
    if (laser.length) {
      const t = now();
      laser = laser.filter(p => t - p.t < 1500);
      liveX.save(); liveX.lineCap = 'round'; liveX.lineJoin = 'round';
      liveX.shadowColor = '#FF2E63'; liveX.shadowBlur = 14;
      for (let i = 1; i < laser.length; i++) {
        const a = laser[i - 1], b = laser[i];
        if (b.t - a.t > 120) continue;
        const age = Math.max(0, (t - b.t - 300) / 1200);
        liveX.globalAlpha = Math.max(0, 1 - age);
        liveX.strokeStyle = '#FF5A7E'; liveX.lineWidth = 4.5 / z;
        liveX.beginPath(); liveX.moveTo(a.x, a.y); liveX.lineTo(b.x, b.y); liveX.stroke();
      }
      liveX.restore();
      if (laser.length) requestLive();
    }
    if (hoverPt && (tools.tool === 'eraser' || (active && active.type === 'erase'))) {
      liveX.beginPath(); liveX.arc(hoverPt.x, hoverPt.y, eraserRadius(), 0, Math.PI * 2);
      liveX.lineWidth = 1.2 / z; liveX.strokeStyle = dark ? 'rgba(242,239,251,.7)' : 'rgba(27,24,48,.6)'; liveX.stroke();
    }
  }

  /* ================= Kaydetme ================= */
  function markDirty(p) {
    if (p == null || p < 0) p = 0;
    dirtyPages.add(p);
    scheduleSave();
  }
  function markMetaDirty() { metaDirty = true; scheduleSave(); }
  app.markMetaDirty = markMetaDirty;
  function scheduleSave() {
    if ($('saved')) $('saved').textContent = 'Kaydediliyor…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 120);
  }
  async function saveNow() {
    clearTimeout(saveTimer);
    if (!app.nb || (!dirtyPages.size && !metaDirty)) {
      if ($('saved')) $('saved').textContent = 'Kaydedildi';
      return;
    }
    if (saving) { saveTimer = setTimeout(saveNow, 150); return; }
    saving = true;
    const nb = app.nb;
    const pagesNow = [...dirtyPages];
    const hadMeta = metaDirty;
    try {
      for (const p of pagesNow) {
        if (p < 0 || p >= nb.pages.length) {
          dirtyPages.delete(p);
          continue;
        }
        const o = app.pageOrigin(p);
        const list = pageStrokes(p).filter(s => s.pts);
        const enc = await ON.encodeStrokes(list, o.x, o.y);
        await Store.put('pages', { notebookId: nb.id, pageIndex: p, data: enc.data, gz: enc.gz, n: list.length });
        nb.pages[p].v = (nb.pages[p].v || 0) + 1;
        dirtyPages.delete(p);
        if (thumbIO) refreshThumb(p);
      }
      if (hadMeta || pagesNow.length) {
        nb.updated = Date.now();
        await Store.put('notebooks', nb);
        metaDirty = false;
        const i = app.notebooks.findIndex(n => n.id === nb.id);
        if (i >= 0) app.notebooks[i] = nb; else app.notebooks.push(nb);
        renderNotebookList();
      }
      if ($('saved')) $('saved').textContent = 'Kaydedildi';
    } catch (err) {
      console.error(err);
      if ($('saved')) $('saved').textContent = 'Kaydedilemedi';
      app.toast('Kayıt hatası: ' + (err.message || err), 4000);
    } finally { saving = false; }
    if (dirtyPages.size || metaDirty) scheduleSave();
  }
  app.saveNow = saveNow;
  addEventListener('pagehide', () => { saveNow(); FocusAudio.stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

  /* ================= Kütüphane ================= */
  async function loadLibrary() {
    app.lib = (await Store.meta.get('library')) || { folders: [] };
    if (!app.lib.folders.length) { app.lib.folders.push({ id: ON.uid(), name: 'Genel', created: Date.now() }); await Store.meta.set('library', app.lib); }
    app.notebooks = await Store.all('notebooks');
    app.folderId = LS.get('on-folder', null);
    if (!app.lib.folders.some(f => f.id === app.folderId)) app.folderId = app.lib.folders[0].id;
    for (const n of app.notebooks) if (!app.lib.folders.some(f => f.id === n.folderId)) n.folderId = app.lib.folders[0].id;
  }
  function renderFolders() {
    $('folders').innerHTML = app.lib.folders.map(f => {
      const c = app.notebooks.filter(n => n.folderId === f.id).length;
      return `<button class="item${f.id === app.folderId ? ' on' : ''}" data-f="${f.id}">${icon('folder')}<span class="t">${esc(f.name)}</span><small>${c}</small></button>`;
    }).join('');
  }
  function renderNotebookList() {
    renderFolders();
    const list = app.notebooks.filter(n => n.folderId === app.folderId).sort((a, b) => b.updated - a.updated);
    $('notebooks').innerHTML = list.length ? list.map(n => {
      const kind = n.pdfHash ? 'PDF' : n.mode === 'infinite' ? 'Sınırsız' : 'A4';
      return `<div class="item${app.nb && n.id === app.nb.id ? ' on' : ''}" data-n="${n.id}" role="button" tabindex="0">${icon(n.pdfHash ? 'paper' : 'notebook')}<span class="t">${esc(n.title)}</span><span class="kind">${kind}</span><small>${fmtRel(n.updated)}</small><button class="del" data-del="${n.id}" title="Defteri sil">${icon('trash')}</button></div>`;
    }).join('') : `<p class="hint small" style="padding:6px">Bu derste henüz defter yok.</p>`;
  }
  $('folders').onclick = e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    app.folderId = b.dataset.f; LS.set('on-folder', app.folderId); renderNotebookList();
  };
  $('notebooks').onclick = async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const nb = app.notebooks.find(n => n.id === del.dataset.del);
      if (await app.confirm('Defter silinsin mi?', `“${nb.title}” ve içindeki tüm çizimler kalıcı olarak silinir.`, 'Sil')) deleteNotebook(nb.id);
      return;
    }
    const it = e.target.closest('[data-n]'); if (!it) return;
    await openNotebook(it.dataset.n);
    if (matchMedia('(max-width:820px)').matches) $('app').classList.add('side-closed');
  };
  $('addFolderBtn').onclick = () => { $('folderRow').classList.toggle('on'); $('folderIn').focus(); };
  $('folderRow').onsubmit = async e => {
    e.preventDefault();
    const name = $('folderIn').value.trim(); if (!name) return;
    const f = { id: ON.uid(), name, created: Date.now() };
    app.lib.folders.push(f); app.folderId = f.id; LS.set('on-folder', f.id);
    await Store.meta.set('library', app.lib);
    $('folderIn').value = ''; $('folderRow').classList.remove('on');
    renderNotebookList();
  };
  async function deleteNotebook(id) {
    if (app.nb && app.nb.id === id) { await closeNotebook(); }
    await Store.del('notebooks', id);
    await Store.delByIndex('pages', 'notebookId', id);
    await Store.delByIndex('thumbnails', 'notebookId', id);
    await Store.delByIndex('assets', 'notebookId', id);
    app.notebooks = app.notebooks.filter(n => n.id !== id);
    ON.cleanupOrphans().catch(() => {});
    renderNotebookList();
    const next = app.notebooks.filter(n => n.folderId === app.folderId).sort((a, b) => b.updated - a.updated)[0] || app.notebooks[0];
    if (next) openNotebook(next.id); else showEmpty(true);
    app.toast('Defter silindi');
  }
  function showEmpty(on) { $('empty').hidden = !on; $('tools').hidden = on; $('minimap').hidden = on; }

  /* ================= Defter açma / kapama ================= */
  async function closeNotebook() {
    await saveNow();
    if (app.virt) app.virt.clear();
    if (app.engine) app.engine.destroy();
    if (thumbGen) thumbGen.clear();
    app.virt = app.engine = app.search = null;
    if (app.history) app.history.clear();
    gizmo = null; lasso = null; cur = null; selectedObj = null;
    hideGizmoBar(); hideSelMenu();
    ON.cards && ON.cards.clear();
    world.innerHTML = '';
    for (const u of assetURLs.values()) URL.revokeObjectURL(u);
    assetURLs.clear();
    app.nb = null; app.pages = [];
    requestRedraw();
  }
  async function openNotebook(id) {
    await closeNotebook();
    const nb = await Store.get('notebooks', id);
    if (!nb) { app.toast('Defter bulunamadı'); return; }
    app.nb = nb;
    nb.objects = nb.objects || []; nb.cards = nb.cards || [];
    showEmpty(false);
    LS.set('on-nb', id);
    if (nb.folderId !== app.folderId) { app.folderId = nb.folderId; LS.set('on-folder', nb.folderId); }
    relayout();
    if (nb.pdfHash) {
      try {
        const rec = await Store.get('pdfs', nb.pdfHash);
        if (!rec) throw new Error('PDF dosyası depoda bulunamadı. Yedekten geri yükleyebilirsin.');
        app.engine = await new ON.PDFEngine().open(await rec.blob.arrayBuffer());
        app.search = new ON.PDFOutlineAndSearch(app.engine, nb.pdfHash, { isPaused: penBusy });
        app.virt = new ON.PDFPageVirtualizer(app.engine, { root: stage, getZoom: () => app.cam.z, maxActive: 4 });
      } catch (err) { app.toast(err.message || 'PDF açılamadı', 5000); }
    }
    const recs = await Store.all('pages', 'notebookId', nb.id);
    app.pages = nb.pages.map(() => []);
    await Promise.all(recs.map(async rec => {
      if (rec.pageIndex >= nb.pages.length) return;
      const o = app.layout[rec.pageIndex];
      try {
        const list = await ON.decodeStrokes(rec, o.x, o.y);
        for (const s of list) { s.page = rec.pageIndex; ON.computeBBox(s); }
        app.pages[rec.pageIndex] = list;
      } catch (err) { console.warn('Sayfa çözülemedi', rec.pageIndex, err); }
    }));
    app.history = new ON.HistoryManager(doc, 60);
    app.history.onChange = syncUndo;
    syncUndo();
    buildPagesDOM();
    ON.cards.renderAll();
    $('title').value = nb.title;
    if (nb.view && nb.view.z) app.cam = { ...nb.view }; else fitWidth();
    applyCamera();
    refreshPalette();
    renderNotebookList();
    updateTabs();
    if (activeTab === 'pages') renderThumbs();
    if (activeTab === 'toc') renderToc();
    if (activeTab === 'find') runFind();
    requestRedraw();
  }
  app.openNotebook = openNotebook;
  $('title').addEventListener('input', () => { if (app.nb) { app.nb.title = $('title').value || 'Adsız defter'; markMetaDirty(); } });
  $('title').addEventListener('keydown', e => { if (e.key === 'Enter') $('title').blur(); });

  /* ================= Yeni defter / PDF içe aktarma ================= */
  const nbForm = { mode: 'p', template: 'grid', theme: 'dark' };
  function chipsHTML(list, val) { return list.map(([v, l]) => `<button type="button" class="chip${v === val ? ' on' : ''}" data-v="${v}">${l}</button>`).join(''); }
  const THEMES = [['white', 'Beyaz'], ['cream', 'Krem'], ['dark', 'Koyu antrasit']];
  function openNewNb() {
    $('nbTitle').value = ''; $('nbMsg').textContent = '';
    const render = () => {
      $('nbTpl').innerHTML = chipsHTML(ON.TEMPLATES, nbForm.template);
      $('nbTheme').innerHTML = chipsHTML(THEMES, nbForm.theme);
      $('nbMode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === nbForm.mode));
    };
    $('nbTpl').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { nbForm.template = b.dataset.v; render(); } };
    $('nbTheme').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { nbForm.theme = b.dataset.v; render(); } };
    $('nbMode').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { nbForm.mode = b.dataset.v; render(); } };
    render();
    app.openModal('newNbDlg');
    setTimeout(() => $('nbTitle').focus(), 50);
  }
  $('newNbBtn').onclick = openNewNb;
  $('emptyNew').onclick = openNewNb;
  $('emptyPdf').onclick = () => $('pdfIn').click();
  $('nbFromPdf').onclick = () => $('pdfIn').click();
  $('newNbForm').onsubmit = async e => {
    e.preventDefault();
    const nb = ON.newNotebookRecord({
      title: $('nbTitle').value.trim() || 'Adsız defter', folderId: app.folderId,
      mode: nbForm.mode === 'inf' ? 'infinite' : 'paged',
      paper: { template: nbForm.template, theme: nbForm.theme, orient: nbForm.mode === 'l' ? 'l' : 'p' }
    });
    await Store.put('notebooks', nb);
    app.notebooks.push(nb);
    app.closeModal('newNbDlg');
    await openNotebook(nb.id);
  };
  $('pdfIn').onchange = () => { const f = $('pdfIn').files[0]; $('pdfIn').value = ''; if (f) importPDF(f); };
  async function importPDF(file) {
    app.closeModal('newNbDlg');
    app.toast('PDF hazırlanıyor…', 60000);
    let engine;
    try {
      const buf = await file.arrayBuffer();
      const hash = await ON.sha256(buf);
      if (!(await Store.get('pdfs', hash))) await Store.put('pdfs', { hash, name: file.name, size: file.size, blob: new Blob([buf], { type: 'application/pdf' }) });
      engine = await new ON.PDFEngine().open(buf);
      const sizes = await engine.sizes((d, t) => app.toast(`Sayfalar ölçülüyor ${d}/${t}…`, 60000));
      const k = ON.A4.w / sizes[0].w;
      const pages = sizes.map((s, i) => ({ k: 'pdf', n: i + 1, w: Math.round(s.w * k), h: Math.round(s.h * k), pw: s.w, ph: s.h, v: 0 }));
      const nb = ON.newNotebookRecord({ title: file.name.replace(/\.pdf$/i, ''), folderId: app.folderId, mode: 'paged', pdfHash: hash, pdfName: file.name, pdfDark: true, pages, paper: { template: 'plain', theme: 'dark', orient: 'p' } });
      await Store.put('notebooks', nb);
      app.notebooks.push(nb);
      engine.destroy(); engine = null;
      await openNotebook(nb.id);
      app.toast(`${pages.length} sayfa hazır. Üzerine kalemle yazabilirsin.`, 2600);
      ON.requestPersist();
    } catch (err) {
      if (engine) engine.destroy();
      app.toast(/password/i.test(String(err && (err.name + err.message))) ? 'Bu PDF şifreli. Şifresiz bir kopyasını dene.' : 'PDF açılamadı: ' + (err.message || err), 5000);
    }
  }

  /* ================= Giriş: S Pen, dokunma, fare ================= */
  const penBusy = () => penDown || now() - penUpAt < 150;
  const gesture = new ON.TouchGestureRecognizer({
    isPenBusy: penBusy,
    onTransform(dx, dy, scale, cx, cy) {
      app.cam.tx += dx; app.cam.ty += dy;
      if (scale !== 1) zoomAt(scale, cx - stageRect.left, cy - stageRect.top);
      if (app.virt) app.virt.frozen = true;
      applyCamera();
    },
    onTransformEnd() { clampPan(); applyCamera(); refreshAfterZoom(); },
    onTap(n) {
      clearSelection();
      if (n === 2) { if (app.history && app.history.undo()) app.toast('Geri alındı', 900); }
      else if (n === 3) { if (app.history && app.history.redo()) app.toast('Yinelendi', 900); }
    }
  });
  const pressureOf = e => e.pointerType === 'pen' ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5;
  const DRAW_TOOLS = new Set(['pen', 'highlighter', 'eraser', 'lasso', 'laser']);
  let fingerStroke = null;

  stage.addEventListener('pointerdown', onDown, true);
  stage.addEventListener('pointermove', onMove, true);
  stage.addEventListener('pointerup', onUp, true);
  stage.addEventListener('pointercancel', onUp, true);
  stage.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !active) { hoverPt = null; requestLive(); } });
  stage.addEventListener('contextmenu', e => { if (!e.target.closest('.snote-b, #out, input, textarea, [contenteditable="true"]')) e.preventDefault(); });

  function onDown(e) {
    if (!app.nb) return;
    const ui = e.target.closest('[data-ui]');
    if (ui && !e.target.closest('#world')) return;
    hidePop(); $('timerPop').hidden = true;
    const pt = app.screenToWorld(e.clientX, e.clientY);

    if (gizmo) {
      const hit = gizmo.hitTest(pt.x, pt.y, app.cam.z);
      if (hit) {
        e.preventDefault(); e.stopPropagation();
        stage.setPointerCapture(e.pointerId);
        gizmo.begin(hit, pt.x, pt.y);
        for (const s of gizmo.strokes) s._hidden = true;
        requestRedraw(gizmo.worldBBox());
        hideGizmoBar();
        active = { type: 'gizmo', id: e.pointerId };
        return;
      }
      if (e.pointerType !== 'touch') clearSelection();
    }

    if (e.pointerType === 'touch') {
      if (penBusy()) return;
      if (active && active.type === 'stroke' && active.finger) {
        cur = null; active = null; requestLive();
        gesture.down(fingerStroke); fingerStroke = null;
        gesture.down(e); return;
      }
      if (ON.settings.fingerDraw && !gesture.active && DRAW_TOOLS.has(tools.tool)) {
        fingerStroke = e;
        e.preventDefault();
        startTool(e, pt, tools.tool, true);
        return;
      }
      gesture.down(e);
      return;
    }

    if (e.pointerType === 'pen') { penDown = true; gesture.cancelAll(); }
    if (e.pointerType === 'mouse' && e.button === 1) {
      e.preventDefault(); stage.setPointerCapture(e.pointerId);
      active = { type: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    const tool = tools.tool;
    if (tool === 'textsel') {
      if (e.pointerType === 'pen') penSelectStart(e);
      return;
    }
    const objEl = e.target.closest('.obj');
    if (objEl && (tool === 'lasso' || tool === 'text')) { objectPointerDown(e, objEl); return; }
    if (objEl && objEl.isContentEditable) return;
    const sideBtn = e.pointerType === 'pen' && ((e.buttons & 32) || e.button === 5 || (e.buttons & 2));
    const rightMouse = e.pointerType === 'mouse' && e.button === 2;
    e.preventDefault();
    const wasEditing = document.activeElement && document.activeElement.isContentEditable;
    if (wasEditing) document.activeElement.blur();
    if (wasEditing && tool === 'text') return;
    startTool(e, pt, sideBtn || rightMouse ? 'eraser' : tool, false, sideBtn);
  }

  function startTool(e, pt, tool, finger, viaSideButton = false) {
    try { stage.setPointerCapture(e.pointerId); } catch {}
    if (tool === 'pen' || tool === 'highlighter') {
      const isHl = tool === 'highlighter';
      cur = {
        tool: isHl ? 'highlighter' : tools.pen,
        color: isHl ? tools.hlColor : inkColor(),
        size: currentSize(isHl ? 'highlighter' : 'pen'),
        arr: [], page: pageAt(pt.x, pt.y), lastT: e.timeStamp, lastX: e.clientX, lastY: e.clientY, prevP: 0.5,
        hold: { x: e.clientX, y: e.clientY }, shape: null, shapePts: null
      };
      active = { type: 'stroke', id: e.pointerId, finger };
      addPoints(e);
      armSnap();
    } else if (tool === 'eraser') {
      active = { type: 'erase', id: e.pointerId, removed: new Set(), added: new Set(), last: pt, side: viaSideButton };
      if (viaSideButton) setToolBadge('eraser');
      hoverPt = pt;
      eraseSweep(pt, pt);
    } else if (tool === 'lasso') {
      lasso = [pt.x, pt.y];
      active = { type: 'lasso', id: e.pointerId };
    } else if (tool === 'laser') {
      laser.push({ x: pt.x, y: pt.y, t: now() });
      active = { type: 'laser', id: e.pointerId };
      requestLive();
    } else if (tool === 'text') {
      createTextBox(pt);
    }
  }

  function onMove(e) {
    if (!app.nb) return;
    if (e.pointerType === 'touch' && !(active && active.finger && active.id === e.pointerId)) {
      if (active && active.type === 'gizmo' && active.id === e.pointerId) { /* aşağıda */ }
      else { gesture.move(e); return; }
    }
    if (tools.tool === 'textsel' && penSel) { penSelectMove(e); return; }
    if (!active) {
      if (tools.tool === 'eraser' && e.pointerType !== 'touch') { hoverPt = app.screenToWorld(e.clientX, e.clientY); requestLive(); }
      return;
    }
    if (e.pointerId !== active.id) return;
    const pt = app.screenToWorld(e.clientX, e.clientY);
    switch (active.type) {
      case 'stroke': addPoints(e); break;
      case 'erase': {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs) { const p = app.screenToWorld(ev.clientX, ev.clientY); eraseSweep(active.last, p); active.last = p; }
        hoverPt = pt; requestLive();
        break;
      }
      case 'lasso': {
        const lx = lasso[lasso.length - 2], ly = lasso[lasso.length - 1];
        if (Math.hypot(pt.x - lx, pt.y - ly) > 2 / app.cam.z) { lasso.push(pt.x, pt.y); requestLive(); }
        break;
      }
      case 'laser': laser.push({ x: pt.x, y: pt.y, t: now() }); requestLive(); break;
      case 'gizmo': gizmo.update(pt.x, pt.y); requestLive(); break;
      case 'pan':
        app.cam.tx += e.clientX - active.x; app.cam.ty += e.clientY - active.y;
        active.x = e.clientX; active.y = e.clientY; applyCamera(); break;
    }
  }

  function onUp(e) {
    if (e.pointerType === 'pen') { penDown = false; penUpAt = now(); }
    if (tools.tool === 'textsel' && penSel && e.pointerType === 'pen') { penSel = null; return; }
    if (e.pointerType === 'touch' && !(active && active.id === e.pointerId)) { gesture.up(e); return; }
    if (!active || e.pointerId !== active.id) return;
    const a = active; active = null;
    if (a.finger) fingerStroke = null;
    switch (a.type) {
      case 'stroke': finishStroke(); break;
      case 'erase':
        if (a.removed.size || a.added.size) app.history.execute(ON.EraseStrokesCommand.fromSession(doc, [...a.removed], [...a.added]), true);
        if (a.side) setToolBadge(null);
        if (e.pointerType !== 'mouse') hoverPt = null;
        requestLive();
        break;
      case 'lasso': finishLasso(); break;
      case 'gizmo': {
        const M = gizmo.end();
        for (const s of gizmo.strokes) s._hidden = false;
        if (!M.isIdentity()) app.history.execute(new ON.TransformStrokesCommand(doc, gizmo.strokes, M));
        else requestRedraw(gizmo.worldBBox());
        showGizmoBar(); requestLive();
        break;
      }
      case 'pan': clampPan(); applyCamera(); refreshAfterZoom(); break;
      case 'laser': requestLive(); break;
    }
  }

  /* ---------- Kalem ---------- */
  function addPoints(e) {
    if (!cur || cur.shape) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const minD = 0.4 / app.cam.z;
    for (const ev of evs) {
      const w = app.screenToWorld(ev.clientX, ev.clientY);
      let p = pressureOf(ev);
      if (cur.tool === 'fountain') {
        const dt = Math.max(1, ev.timeStamp - cur.lastT), d = Math.hypot(ev.clientX - cur.lastX, ev.clientY - cur.lastY);
        const f = clamp(1.2 - (d / dt) * 0.28, 0.5, 1.15);
        p = clamp(p * f, 0.05, 1);
        p = cur.prevP * 0.45 + p * 0.55;
      }
      cur.lastT = ev.timeStamp; cur.lastX = ev.clientX; cur.lastY = ev.clientY; cur.prevP = p;
      const n = cur.arr.length;
      if (n >= 3 && Math.hypot(w.x - cur.arr[n - 3], w.y - cur.arr[n - 2]) < minD) { cur.arr[n - 1] = Math.max(cur.arr[n - 1], p); continue; }
      cur.arr.push(w.x, w.y, p);
    }
    if (Math.hypot(e.clientX - cur.hold.x, e.clientY - cur.hold.y) > 4) { cur.hold = { x: e.clientX, y: e.clientY }; armSnap(); }
    requestLive();
  }
  let snapTimer = 0;
  function armSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      if (!cur || cur.shape || cur.tool === 'highlighter' || cur.arr.length < 12) return;
      const r = ON.recognizeShape(cur.arr, app.cam.z);
      if (r) {
        cur.shape = r.name; cur.shapePts = r.pts;
        const names = { line: 'Çizgi', arrow: 'Ok', rect: 'Dikdörtgen', circle: 'Daire', ellipse: 'Elips', triangle: 'Üçgen', axes: 'Koordinat ekseni', polygon: 'Çokgen' };
        app.toast(names[r.name] || 'Şekil', 900);
        requestLive();
      }
    }, 500);
  }
  function finishStroke() {
    clearTimeout(snapTimer);
    if (!cur || !cur.arr.length) { cur = null; requestLive(); return; }
    let pts = cur.shapePts || ON.rdp(new Float32Array(cur.arr), 0.3);
    let flat = false;
    if (cur.tool === 'highlighter' && tools.hlStraight && pts.length >= 6) {
      const n = pts.length / 3;
      let len = 0; for (let i = 1; i < n; i++) len += Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2]);
      const x0 = pts[0], x1 = pts[(n - 1) * 3], y1 = pts[(n - 1) * 3 + 1];
      let y0 = pts[1];
      const straight = Math.hypot(x1 - x0, y1 - y0) / (len || 1);
      if (straight > 0.95 && len > 12) {
        let ny1 = y1;
        if (Math.abs(Math.atan2(y1 - y0, x1 - x0)) < 6 * Math.PI / 180 || Math.abs(Math.abs(Math.atan2(y1 - y0, x1 - x0)) - Math.PI) < 6 * Math.PI / 180) ny1 = y0 = (y0 + y1) / 2;
        pts = new Float32Array([x0, y0, 0.5, x1, ny1, 0.5]);
        flat = true;
      }
    }
    const s = ON.makeStroke({ tool: cur.tool, color: cur.color, size: cur.size, pts, page: pageAt(pts[0], pts[1]), shape: cur.shape, flat });
    cur = null;
    app.history.execute(new ON.AddStrokesCommand(doc, [s]));
    const o = app.pageOrigin(s.page);
    app.nb.last = { page: s.page, x: s.bbox.maxX - o.x, y: s.bbox.maxY - o.y };
    markMetaDirty();
    saveNow();
    requestLive();
  }

  /* ---------- Silgi ---------- */
  const eraserRadius = () => currentSize('eraser') / app.cam.z;
  function eraseCandidates(a, b, r) {
    const box = { minX: Math.min(a.x, b.x) - r, minY: Math.min(a.y, b.y) - r, maxX: Math.max(a.x, b.x) + r, maxY: Math.max(a.y, b.y) + r };
    const out = [];
    for (const i of visiblePages(box)) for (const s of pageStrokes(i)) if (s.pts && Geo.bboxIntersects(s.bbox, box)) out.push(s);
    return out;
  }
  function eraseSweep(a, b) {
    const r = eraserRadius(), A = active;
    let dirty = null;
    const remove = s => {
      doc.removeStrokes([s]);
      if (A.added.has(s)) A.added.delete(s); else A.removed.add(s);
      dirty = Geo.union(dirty, s.bbox);
    };
    const onlyHl = tools.eraseHlOnly;
    if (tools.eraserMode === 'stroke') {
      for (const s of eraseCandidates(a, b, r)) {
        if (onlyHl && s.tool !== 'highlighter') continue;
        if (ON.strokeHit(s, a.x, a.y, b.x, b.y, r)) remove(s);
      }
    } else {
      const d = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(d / (r * 0.5)));
      for (let k = 1; k <= steps; k++) {
        const cx = a.x + (b.x - a.x) * k / steps, cy = a.y + (b.y - a.y) * k / steps;
        for (const s of eraseCandidates({ x: cx, y: cy }, { x: cx, y: cy }, r)) {
          if (onlyHl && s.tool !== 'highlighter') continue;
          const pieces = ON.splitStrokeByCircle(s, cx, cy, r);
          if (!pieces) continue;
          remove(s);
          const made = pieces.map(pts => ON.makeStroke({ tool: s.tool, color: s.color, size: s.size, pts, page: s.page, shape: s.shape, flat: s.flat, text: s.text, grp: s.grp }));
          doc.addStrokes(made);
          for (const m of made) { A.added.add(m); dirty = Geo.union(dirty, m.bbox); }
        }
      }
    }
    if (dirty) requestRedraw(dirty);
  }

  /* ---------- Kement ---------- */
  function finishLasso() {
    const poly = lasso; lasso = null;
    if (!poly || poly.length < 8) { requestLive(); return; }
    const box = Geo.bboxOfFlat(poly, 2);
    const sel = [];
    for (const i of visiblePages(box)) for (const s of pageStrokes(i)) if (s.pts && ON.strokeInLasso(s, poly, box)) sel.push(s);
    if (sel.length) { gizmo = new ON.SelectionGizmo(sel, app.cam.z); showGizmoBar(); }
    requestLive();
  }
  function clearSelection() { if (!gizmo) return; gizmo = null; hideGizmoBar(); requestLive(); }
  function showGizmoBar() { if (!gizmo) return; $('gizmoBar').hidden = false; $('gzDot').style.background = inkColor(); positionGizmoBar(); }
  function hideGizmoBar() { $('gizmoBar').hidden = true; }
  function positionGizmoBar() {
    if (!gizmo || $('gizmoBar').hidden) return;
    const b = gizmo.worldBBox();
    const p = worldToStage((b.minX + b.maxX) / 2, b.maxY);
    const bar = $('gizmoBar'), bw = bar.offsetWidth || 320, bh = bar.offsetHeight || 50;
    let top = p.y + 14;
    if (top + bh > H - 90) top = worldToStage(0, b.minY).y - bh - 46;
    bar.style.left = clamp(p.x - bw / 2, 8, W - bw - 8) + 'px';
    bar.style.top = clamp(top, 8, H - bh - 8) + 'px';
  }
  $('gzColor').onclick = () => {
    if (!gizmo) return;
    const hl = gizmo.strokes.filter(s => s.tool === 'highlighter'), ink = gizmo.strokes.filter(s => s.tool !== 'highlighter');
    if (ink.length) app.history.execute(new ON.RecolorStrokesCommand(doc, ink, inkColor()));
    if (hl.length) app.history.execute(new ON.RecolorStrokesCommand(doc, hl, tools.hlColor));
  };
  $('gzDup').onclick = () => {
    if (!gizmo) return;
    const off = 24 / app.cam.z;
    const clones = gizmo.strokes.filter(s => s.pts).map(s => {
      const pts = new Float32Array(s.pts);
      for (let i = 0; i < pts.length; i += 3) { pts[i] += off; pts[i + 1] += off; }
      return ON.makeStroke({ tool: s.tool, color: s.color, size: s.size, pts, page: s.page, shape: s.shape, flat: s.flat });
    });
    app.history.execute(new ON.AddStrokesCommand(doc, clones));
    gizmo = new ON.SelectionGizmo(clones, app.cam.z); showGizmoBar(); requestLive();
  };
  $('gzDel').onclick = deleteSelection;
  function deleteSelection() {
    if (!gizmo) return;
    app.history.execute(new ON.EraseStrokesCommand(doc, gizmo.strokes.filter(s => s.pts), []));
    clearSelection();
  }
  $('gzAi').onclick = async () => {
    if (!gizmo) return;
    const b = Geo.expand(gizmo.worldBBox(), 10);
    const rect = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
    const scale = Math.min(2.5, 3000 / Math.max(rect.w, rect.h));
    app.toast('Bölge hazırlanıyor…');
    const canvas = await renderRegion(liveData(), rect, scale, { print: true, strokeFilter: new Set(gizmo.strokes), cards: false });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const b64 = await blobToB64(blob);
    const page = pageAt((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2), o = app.pageOrigin(page);
    ON.AI.setContext({ b64, mime: 'image/png', label: `Kement seçimi (${gizmo.strokes.length} çizgi) gönderilecek`, anchor: { page, x: b.maxX - o.x, y: b.minY - o.y }, url: URL.createObjectURL(blob) });
    ON.AI.open();
    $('askIn').focus();
  };
  const blobToB64 = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });

  /* ---------- PDF metin seçimi (kalemle) ---------- */
  let penSel = null;
  function caretAt(x, y) {
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); return r && { node: r.startContainer, offset: r.startOffset }; }
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, offset: p.offset }; }
    return null;
  }
  function penSelectStart(e) {
    const c = caretAt(e.clientX, e.clientY);
    if (!c || !(c.node.parentElement || c.node).closest('.pdf-text-layer')) { penSel = null; getSelection().removeAllRanges(); return; }
    e.preventDefault();
    penSel = c;
    getSelection().setBaseAndExtent(c.node, c.offset, c.node, c.offset);
  }
  function penSelectMove(e) {
    const c = caretAt(e.clientX, e.clientY);
    if (!c || !(c.node.parentElement || c.node).closest('.pdf-text-layer')) return;
    try { getSelection().setBaseAndExtent(penSel.node, penSel.offset, c.node, c.offset); } catch {}
  }
  let selInfo = null;
  document.addEventListener('selectionchange', debounce(updateSelMenu, 180));
  function updateSelMenu() {
    if (tools.tool !== 'textsel') { hideSelMenu(); return; }
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) { hideSelMenu(); return; }
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 1 ? node : node.parentElement;
    const pg = el && el.closest('.page');
    if (!pg || !el.closest('.pdf-text-layer, .page')) { hideSelMenu(); return; }
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) { hideSelMenu(); return; }
    const r = range.getBoundingClientRect();
    selInfo = { text, rects: [...range.getClientRects()], page: +pg.dataset.page, box: r };
    const m = $('selMenu');
    m.hidden = false;
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let top = r.top - stageRect.top - mh - 10;
    if (top < 8) top = r.bottom - stageRect.top + 10;
    m.style.left = clamp(r.left - stageRect.left + r.width / 2 - mw / 2, 8, W - mw - 8) + 'px';
    m.style.top = clamp(top, 8, H - mh - 8) + 'px';
  }
  function hideSelMenu() { $('selMenu').hidden = true; selInfo = null; }
  $('selColors').innerHTML = TOOLS_DEFAULT.favHl.slice(0, 4).map(c => `<button data-hl="${c}" title="Fosforlu vurgu"><i class="dot" style="background:${c}"></i></button>`).join('');
  $('selMenu').addEventListener('pointerdown', e => e.preventDefault());
  $('selMenu').onclick = async e => {
    const b = e.target.closest('button'); if (!b || !selInfo) return;
    const info = selInfo;
    const tl = app.screenToWorld(info.box.right, info.box.top), o = app.pageOrigin(info.page);
    const anchor = { page: info.page, x: Math.min(tl.x - o.x, app.layout[info.page].w - 20), y: tl.y - o.y };
    if (b.dataset.hl) { highlightSelection(info, b.dataset.hl); return; }
    if (b.dataset.sel === 'copy') { try { await navigator.clipboard.writeText(info.text); app.toast('Kopyalandı'); } catch { app.toast('Kopyalanamadı'); } return; }
    ON.AI.textAction(b.dataset.sel, info.text, anchor);
    getSelection().removeAllRanges(); hideSelMenu();
  };
  function highlightSelection(info, color) {
    const rects = info.rects.map(r => {
      const a = app.screenToWorld(r.left, r.top), b = app.screenToWorld(r.right, r.bottom);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    });
    const merged = ON.mergeSameLineWorldRects(rects);
    if (!merged.length) return;
    const grp = ON.uid();
    const strokes = merged.map((r, i) => ON.makeStroke({
      tool: 'highlighter', color, size: r.h, flat: true, grp, text: i === 0 ? info.text : '',
      pts: new Float32Array([r.x, r.y + r.h / 2, 0.5, r.x + r.w, r.y + r.h / 2, 0.5]),
      page: info.page
    }));
    app.history.execute(new ON.AddStrokesCommand(doc, strokes));
    getSelection().removeAllRanges(); hideSelMenu();
    app.toast('Vurgulandı');
  }

  /* ================= Nesneler: metin kutusu ve görsel ================= */
  function objEl(o) {
    const el = document.createElement('div');
    el.className = 'obj ' + (o.type === 'text' ? 'tbox' : 'img');
    el.dataset.id = o.id;
    if (o.type === 'text') {
      el.textContent = o.text;
      el.style.fontSize = (o.fs || 20) + 'px';
      el.style.color = ON.adaptColor(o.color || '#1B1830', surfaceDark());
      el.spellcheck = false;
    } else {
      const img = document.createElement('img');
      img.alt = ''; img.draggable = false;
      assetURL(o.asset).then(u => { if (u) img.src = u; });
      el.appendChild(img);
    }
    el.insertAdjacentHTML('beforeend', `<span class="oh rz"></span><span class="oh dl">${icon('close')}</span>`);
    return el;
  }
  async function assetURL(id) {
    if (assetURLs.has(id)) return assetURLs.get(id);
    const a = await Store.get('assets', id);
    if (!a) return null;
    const u = URL.createObjectURL(a.blob);
    assetURLs.set(id, u);
    return u;
  }
  function placeObj(el, o) {
    const L = app.pageOrigin(o.page);
    el.style.left = (L.x + o.x) + 'px'; el.style.top = (L.y + o.y) + 'px'; el.style.width = o.w + 'px';
    if (o.type === 'image') el.style.height = o.h + 'px';
  }
  function renderObjects() {
    world.querySelectorAll('.obj').forEach(n => n.remove());
    if (!app.nb) return;
    for (const o of app.nb.objects) { const el = objEl(o); placeObj(el, o); world.appendChild(el); }
  }
  function createTextBox(pt) {
    const page = pageAt(pt.x, pt.y), L = app.pageOrigin(page);
    const o = { id: ON.uid(), type: 'text', page, x: pt.x - L.x, y: pt.y - L.y - 14, w: 280, text: '', color: inkColor(), fs: 20 };
    app.nb.objects.push(o);
    const el = objEl(o); placeObj(el, o); world.appendChild(el);
    editText(el, o);
  }
  function editText(el, o) {
    el.contentEditable = 'true';
    const caretEnd = () => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    el.focus(); caretEnd();
    setTimeout(() => { if (document.activeElement !== el) { el.focus(); caretEnd(); } }, 0);
    el.onblur = () => {
      el.contentEditable = 'false';
      o.text = el.innerText.replace(/\n$/, '');
      if (!o.text.trim()) { app.nb.objects.splice(app.nb.objects.indexOf(o), 1); el.remove(); }
      el.onblur = null;
      markMetaDirty();
    };
  }
  function objectPointerDown(e, el) {
    const o = app.nb.objects.find(x => x.id === el.dataset.id);
    if (!o) return;
    if (tools.tool === 'text' && o.type === 'text') { if (!el.isContentEditable) { e.preventDefault(); editText(el, o); } return; }
    e.preventDefault(); e.stopPropagation();
    if (selectedObj && selectedObj !== el) selectedObj.classList.remove('sel');
    selectedObj = el; el.classList.add('sel');
    if (e.target.closest('.dl')) {
      app.nb.objects.splice(app.nb.objects.indexOf(o), 1); el.remove(); selectedObj = null; markMetaDirty(); return;
    }
    const mode = e.target.closest('.rz') ? 'resize' : 'move';
    const sx = e.clientX, sy = e.clientY, s0 = { x: o.x, y: o.y, w: o.w, h: o.h || 0 }, z = app.cam.z;
    el.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      if (mode === 'move') { o.x = s0.x + dx; o.y = s0.y + dy; }
      else { o.w = Math.max(40, s0.w + dx); if (o.type === 'image') o.h = o.w * (s0.h / s0.w); }
      placeObj(el, o);
    };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); markMetaDirty(); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  $('imgIn').onchange = async () => {
    const f = $('imgIn').files[0]; $('imgIn').value = '';
    if (!f || !app.nb) return;
    try {
      const bmp = await createImageBitmap(f);
      const id = ON.uid();
      await Store.put('assets', { id, notebookId: app.nb.id, blob: f, type: 'image' });
      const v = viewRect(), cx = (v.minX + v.maxX) / 2, cy = (v.minY + v.maxY) / 2;
      const page = pageAt(cx, cy), L = app.pageOrigin(page);
      const w = Math.min(420, bmp.width, (v.maxX - v.minX) * 0.6), h = w * bmp.height / bmp.width;
      bmp.close && bmp.close();
      const o = { id: ON.uid(), type: 'image', page, asset: id, x: cx - L.x - w / 2, y: cy - L.y - h / 2, w, h };
      app.nb.objects.push(o);
      const el = objEl(o); placeObj(el, o); world.appendChild(el);
      markMetaDirty();
      setTool('lasso');
      app.toast('Görsel eklendi — kement aracıyla taşı veya boyutlandır');
    } catch { app.toast('Görsel okunamadı'); }
  };

  /* ================= Araç çubuğu ================= */
  const inkColor = () => surfaceDark() ? tools.inkDark : tools.inkLight;
  const family = t => (t === 'highlighter' ? 'highlighter' : t === 'eraser' ? 'eraser' : 'pen');
  const currentSize = fam => tools.sizes[fam][tools.sizeIdx[fam]];
  function palette() {
    if (tools.tool === 'highlighter') return { key: 'favHl', list: tools.favHl, current: tools.hlColor };
    const dark = surfaceDark();
    return dark ? { key: 'favDark', list: tools.favDark, current: tools.inkDark } : { key: 'favLight', list: tools.favLight, current: tools.inkLight };
  }
  function setColor(c) {
    if (tools.tool === 'highlighter') tools.hlColor = c;
    else if (surfaceDark()) tools.inkDark = c; else tools.inkLight = c;
    saveTools(); refreshPalette();
    if (gizmo) $('gzDot').style.background = inkColor();
  }
  function refreshPalette() {
    const p = palette();
    $('swatches').innerHTML = p.list.map((c, i) => `<button class="sw${c.toLowerCase() === String(p.current).toLowerCase() ? ' on' : ''}" data-i="${i}" title="Renk — uzun bas: değiştir"><i style="background:${c}"></i></button>`).join('');
    const fam = family(tools.tool === 'pen' || tools.tool === 'highlighter' || tools.tool === 'eraser' ? tools.tool : 'pen');
    const sizes = tools.sizes[fam];
    const maxS = Math.max(...sizes);
    $('sizes').innerHTML = sizes.map((s, i) => `<button class="sz${i === tools.sizeIdx[fam] ? ' on' : ''}" data-i="${i}" title="Kalınlık ${i + 1}"><i style="width:${4 + 12 * s / maxS}px;height:${4 + 12 * s / maxS}px"></i></button>`).join('');
    $('colorPick').value = /^#[0-9a-f]{6}$/i.test(p.current) ? p.current : '#ffffff';
    const penBtn = $('toolBtns').querySelector('[data-tool="pen"]');
    penBtn.innerHTML = icon(tools.pen) + `<i class="badge" style="background:${inkColor()}"></i>`;
    const hlBtn = $('toolBtns').querySelector('[data-tool="highlighter"]');
    hlBtn.querySelector('.badge')?.remove();
    hlBtn.insertAdjacentHTML('beforeend', `<i class="badge" style="background:${tools.hlColor}"></i>`);
  }
  let slotEdit = null, pressT = 0;
  $('swatches').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    pressT = setTimeout(() => { slotEdit = +b.dataset.i; $('colorPick').click(); }, 550);
  });
  $('swatches').addEventListener('pointerup', () => clearTimeout(pressT));
  $('swatches').addEventListener('pointerleave', () => clearTimeout(pressT));
  $('swatches').onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b || slotEdit !== null) return;
    setColor(palette().list[+b.dataset.i]);
  };
  $('swatches').ondblclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; slotEdit = +b.dataset.i; $('colorPick').click(); };
  $('colorPick').addEventListener('input', () => {
    const c = $('colorPick').value, p = palette();
    if (slotEdit !== null) { tools[p.key][slotEdit] = c; }
    setColor(c);
  });
  $('colorPick').addEventListener('change', () => { slotEdit = null; });
  $('colorPick').addEventListener('blur', () => { setTimeout(() => { slotEdit = null; }, 300); });
  $('sizes').onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const fam = family(['pen', 'highlighter', 'eraser'].includes(tools.tool) ? tools.tool : 'pen');
    tools.sizeIdx[fam] = +b.dataset.i; saveTools(); refreshPalette();
  };
  function setTool(t) {
    if (t !== 'lasso') clearSelection();
    if (selectedObj) { selectedObj.classList.remove('sel'); selectedObj = null; }
    tools.tool = t; saveTools();
    $('toolBtns').querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t || (t === 'text' && b.dataset.tool === 'insert')));
    stage.classList.toggle('tool-textsel', t === 'textsel');
    stage.dataset.cursor = t === 'eraser' ? 'eraser' : t === 'text' ? 'text' : t === 'lasso' ? 'lasso' : t === 'textsel' ? '' : 'pen';
    if (app.virt) app.virt.setTextMode(t === 'textsel');
    if (t !== 'textsel') hideSelMenu();
    if (t !== 'eraser') { hoverPt = null; requestLive(); }
    if (t === 'textsel' && app.nb && !app.nb.pdfHash) app.toast('Metin seçimi PDF sayfalarında çalışır');
    refreshPalette();
  }
  function setToolBadge(t) { $('toolBtns').querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', t ? b.dataset.tool === t : b.dataset.tool === tools.tool)); }
  $('toolBtns').onclick = e => {
    const b = e.target.closest('[data-tool]'); if (!b) return;
    const t = b.dataset.tool;
    if (t === 'insert') { togglePop('insert', b); return; }
    if (t === tools.tool && ['pen', 'highlighter', 'eraser'].includes(t)) { togglePop(t, b); return; }
    hidePop(); setTool(t);
  };
  $('undo').onclick = () => { clearSelection(); app.history && app.history.undo(); };
  $('redo').onclick = () => { clearSelection(); app.history && app.history.redo(); };
  function syncUndo() {
    $('undo').style.opacity = app.history && app.history.canUndo ? 1 : 0.35;
    $('redo').style.opacity = app.history && app.history.canRedo ? 1 : 0.35;
  }
  let popKind = null;
  function hidePop() { $('toolPop').hidden = true; popKind = null; }
  function togglePop(kind, anchorBtn) {
    if (popKind === kind) { hidePop(); return; }
    popKind = kind;
    const pop = $('toolPop');
    const fam = family(kind);
    const slider = (min, max, step) => `<div class="lbl">Kalınlık <b id="szVal">${currentSize(fam)}</b></div><input type="range" id="szRange" min="${min}" max="${max}" step="${step}" value="${currentSize(fam)}">`;
    if (kind === 'pen') {
      const opts = [['fountain', 'Dolma kalem', 'Basınç ve hıza duyarlı'], ['ballpoint', 'Tükenmez kalem', 'Düzgün, sabit çizgi'], ['pencil', 'Kurşun kalem', 'Dokulu, yumuşak']];
      pop.innerHTML = opts.map(([v, t, d]) => `<button class="opt${tools.pen === v ? ' on' : ''}" data-pen="${v}">${icon(v)}<span>${t}<small>${d}</small></span></button>`).join('') +
        slider(0.5, 10, 0.1) + `<p class="hint small">Şekil çizip kalemi 0,5 sn sabit tut: çizgi, ok, daire, dikdörtgen, üçgen ve eksen düzgünleşir.</p>`;
    } else if (kind === 'highlighter') {
      pop.innerHTML = slider(6, 40, 1) + `<label class="chk"><input type="checkbox" id="hlStr"${tools.hlStraight ? ' checked' : ''}> Düz çizgi hizalama</label>`;
    } else if (kind === 'eraser') {
      pop.innerHTML = `<button class="opt${tools.eraserMode === 'partial' ? ' on' : ''}" data-er="partial">${icon('eraser')}<span>Kısmi silgi<small>Yalnızca dokunduğu yeri siler</small></span></button>
        <button class="opt${tools.eraserMode === 'stroke' ? ' on' : ''}" data-er="stroke">${icon('eraser')}<span>Çizgi silgisi<small>Dokunduğu çizginin tamamını siler</small></span></button>
        <label class="chk"><input type="checkbox" id="erHl"${tools.eraseHlOnly ? ' checked' : ''}> Sadece fosforlu kalemi sil</label>` + slider(4, 60, 1) +
        `<p class="hint small">S Pen yan tuşunu basılı tutarak da silebilirsin.</p>`;
    } else if (kind === 'insert') {
      pop.innerHTML = `<button class="opt" data-ins="text">${icon('text')}<span>Metin kutusu<small>Dokunduğun yere yaz (T)</small></span></button>
        <button class="opt" data-ins="image">${icon('image')}<span>Görsel ekle<small>Fotoğraf veya ekran görüntüsü</small></span></button>`;
    }
    pop.hidden = false;
    const r = anchorBtn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = clamp(r.left - stageRect.left + r.width / 2 - pw / 2, 8, W - pw - 8) + 'px';
    const above = r.top - stageRect.top - ph - 10;
    pop.style.top = (above > 8 ? above : r.bottom - stageRect.top + 10) + 'px';
    pop.onclick = e => {
      const pb = e.target.closest('[data-pen]'), eb = e.target.closest('[data-er]'), ib = e.target.closest('[data-ins]');
      if (pb) { tools.pen = pb.dataset.pen; saveTools(); refreshPalette(); hidePop(); }
      if (eb) { tools.eraserMode = eb.dataset.er; saveTools(); hidePop(); app.toast(eb.dataset.er === 'partial' ? 'Kısmi silgi' : 'Çizgi silgisi', 900); }
      if (ib) { hidePop(); if (ib.dataset.ins === 'text') { setTool('text'); app.toast('Yazmak istediğin yere dokun', 1400); } else $('imgIn').click(); }
    };
    pop.oninput = e => {
      if (e.target.id === 'szRange') { tools.sizes[fam][tools.sizeIdx[fam]] = +e.target.value; $('szVal').textContent = e.target.value; saveTools(); refreshPalette(); }
      if (e.target.id === 'hlStr') { tools.hlStraight = e.target.checked; saveTools(); }
      if (e.target.id === 'erHl') { tools.eraseHlOnly = e.target.checked; saveTools(); }
    };
  }
  (() => {
    const bar = $('tools'), grip = $('toolGrip');
    const place = p => { bar.classList.add('placed'); bar.style.left = p.x + 'px'; bar.style.top = p.y + 'px'; bar.style.bottom = 'auto'; };
    if (tools.toolbarPos) requestAnimationFrame(() => place(tools.toolbarPos));
    if (tools.collapsed) bar.classList.add('collapsed');
    grip.addEventListener('pointerdown', e => {
      e.preventDefault(); grip.setPointerCapture(e.pointerId);
      const r = bar.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      const mv = ev => {
        const p = { x: clamp(ev.clientX - stageRect.left - ox, 4, W - r.width - 4), y: clamp(ev.clientY - stageRect.top - oy, 4, H - r.height - 4) };
        place(p); tools.toolbarPos = p;
      };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); saveTools(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => { tools.toolbarPos = null; saveTools(); bar.classList.remove('placed'); bar.style.left = bar.style.top = bar.style.bottom = ''; });
    $('collapseTools').onclick = () => { bar.classList.toggle('collapsed'); tools.collapsed = bar.classList.contains('collapsed'); saveTools(); hidePop(); };
  })();

  /* ================= Kenar paneli sekmeleri ================= */
  let activeTab = 'lib';
  $('tabs').onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b || b.disabled) return;
    activeTab = b.dataset.tab;
    $('tabs').querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    $({ lib: 'paneLib', pages: 'panePages', toc: 'paneToc', find: 'paneFind' }[activeTab]).classList.add('on');
    if (activeTab === 'pages') renderThumbs();
    if (activeTab === 'toc') renderToc();
    if (activeTab === 'find') { $('findIn').focus(); runFind(); }
  };
  function updateTabs() {
    const paged = app.nb && !isInfinite();
    $('tabs').querySelector('[data-tab="pages"]').disabled = !paged;
    $('tabs').querySelector('[data-tab="toc"]').disabled = !(app.nb && app.nb.pdfHash);
    $('addPageBtn').disabled = !paged;
    if (!paged && activeTab === 'pages') $('tabs').querySelector('[data-tab="lib"]').click();
  }
  $('hideSide').onclick = () => $('app').classList.add('side-closed');
  $('toggleSide').onclick = () => { $('app').classList.toggle('side-closed'); setTimeout(resizeCanvases, 220); };

  /* ---------- Sayfalar (önizlemeler) ---------- */
  let thumbIO = null;
  const thumbGen = new ON.ThumbnailGenerator({
    width: 160,
    isPaused: penBusy,
    async getCached(job) {
      const r = await Store.get('thumbnails', [job.nbId, job.i]);
      return r && r.v === job.v ? r.blob : null;
    },
    async store(job, blob) { await Store.put('thumbnails', { notebookId: job.nbId, pageIndex: job.i, v: job.v, blob }); },
    async draw(ctx, canvas, job) {
      if (!app.nb || app.nb.id !== job.nbId) return;
      const p = app.nb.pages[job.i], L = app.layout[job.i], sc = canvas.width / L.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (p.k === 'pdf' && app.engine) {
        const page = await app.engine.getPage(p.n);
        await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: canvas.width / p.pw }) }).promise;
        if (app.nb.pdfDark) { const id = ctx.getImageData(0, 0, canvas.width, canvas.height), a = id.data; for (let i = 0; i < a.length; i += 4) { const k = 255 - Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]); a[i] += k; a[i + 1] += k; a[i + 2] += k; } ctx.putImageData(id, 0, 0); }
      } else {
        ctx.setTransform(sc, 0, 0, sc, 0, 0);
        ON.drawPaper(ctx, { x: 0, y: 0, w: L.w, h: L.h }, app.nb.paper, { lineWidth: 1.5 / sc });
      }
      ctx.setTransform(sc, 0, 0, sc, -L.x * sc, -L.y * sc);
      const dark = surfaceDark();
      for (const s of pageStrokes(job.i)) {
        if (!s.pts) continue;
        ctx.globalCompositeOperation = s.tool === 'highlighter' ? (dark ? 'screen' : 'multiply') : 'source-over';
        ON.drawStroke(ctx, s, { dark });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  });
  const thumbURLs = new Map();
  function refreshThumb(i) {
    const el = $('thumbs').querySelector(`[data-i="${i}"]`);
    if (!el || !app.nb) return;
    const p = app.nb.pages[i];
    thumbGen.request({
      key: `${app.nb.id}:${i}`, nbId: app.nb.id, i, v: p.v || 0, aspect: app.layout[i].h / app.layout[i].w,
      onReady(blob) {
        const img = el.querySelector('img'); if (!img) return;
        if (thumbURLs.has(i)) URL.revokeObjectURL(thumbURLs.get(i));
        const u = URL.createObjectURL(blob); thumbURLs.set(i, u); img.src = u;
      }
    });
  }
  function renderThumbs() {
    if (thumbIO) thumbIO.disconnect();
    thumbGen.clear();
    for (const u of thumbURLs.values()) URL.revokeObjectURL(u);
    thumbURLs.clear();
    const box = $('thumbs');
    if (!app.nb || isInfinite()) { box.innerHTML = ''; return; }
    box.innerHTML = app.nb.pages.map((p, i) => `<button class="thumb" data-i="${i}"><span class="ph" style="aspect-ratio:${app.layout[i].w}/${app.layout[i].h}"><img alt=""></span>${i + 1}${p.k === 'paper' && app.nb.pdfHash ? ' · boş' : ''}</button>`).join('');
    thumbIO = new IntersectionObserver(list => {
      for (const e of list) if (e.isIntersecting) { const i = +e.target.dataset.i; if (!e.target.dataset.req) { e.target.dataset.req = 1; refreshThumb(i); } thumbGen.prioritize(`${app.nb.id}:${i}`); }
    }, { root: $('panePages'), rootMargin: '200px 0px' });
    box.querySelectorAll('.thumb').forEach(t => thumbIO.observe(t));
    updateCurrentPage(true);
  }
  $('thumbs').onclick = e => { const b = e.target.closest('[data-i]'); if (b) app.jumpTo(+b.dataset.i, 0, 0); };
  let lastCurPage = -1;
  function updateCurrentPage(force) {
    if (!app.nb) return;
    const c = currentPage();
    if (c === lastCurPage && !force) return;
    lastCurPage = c;
    $('thumbs').querySelectorAll('.thumb.on').forEach(t => t.classList.remove('on'));
    const t = $('thumbs').querySelector(`[data-i="${c}"]`);
    if (t) { t.classList.add('on'); if (activeTab === 'pages' && !force) t.scrollIntoView({ block: 'nearest' }); }
  }
  $('addPageBtn').onclick = () => insertPage(currentPage() + 1);
  $('delPageBtn').onclick = async () => {
    if (!app.nb || isInfinite() || app.nb.pages.length < 2) { app.toast('Son sayfa silinemez'); return; }
    const i = currentPage();
    if (!(await app.confirm(`Sayfa ${i + 1} silinsin mi?`, 'Bu sayfadaki çizimler, metin kutuları ve kartlar da silinir. Geri alınamaz.', 'Sil'))) return;
    await deletePage(i);
  };
  async function insertPage(at, opts = {}) {
    if (!app.nb || isInfinite()) return;
    const nb = app.nb, ref = nb.pages[Math.min(at, nb.pages.length) - 1] || nb.pages[0];
    const port = nb.paper.orient !== 'l';
    const w = ref && ref.k === 'paper' ? ref.w : (port ? ON.A4.w : ON.A4.h), h = ref && ref.k === 'paper' ? ref.h : (port ? ON.A4.h : ON.A4.w);
    const page = { k: 'paper', w, h, v: 0 };
    await saveNow();
    app.history.clear();
    withRelayout(() => { nb.pages.splice(at, 0, page); });
    for (const o of nb.objects) if (o.page >= at) o.page++;
    for (const c of nb.cards) if (c.page >= at) c.page++;
    for (let i = at; i < nb.pages.length; i++) dirtyPages.add(i);
    await Store.delByIndex('thumbnails', 'notebookId', nb.id);
    rebuildAfterStructure();
    markMetaDirty();
    if (!opts.silent) { app.jumpTo(at, 0, 0); app.toast(`Sayfa ${at + 1} eklendi`); }
    return at;
  }
  async function deletePage(i) {
    const nb = app.nb, oldN = nb.pages.length;
    await saveNow();
    app.history.clear();
    withRelayout(() => { nb.pages.splice(i, 1); });
    nb.objects = nb.objects.filter(o => o.page !== i); nb.objects.forEach(o => { if (o.page > i) o.page--; });
    nb.cards = nb.cards.filter(c => c.page !== i); nb.cards.forEach(c => { if (c.page > i) c.page--; });
    for (let k = i; k < nb.pages.length; k++) dirtyPages.add(k);
    await Store.del('pages', [nb.id, oldN - 1]);
    await Store.delByIndex('thumbnails', 'notebookId', nb.id);
    rebuildAfterStructure();
    markMetaDirty();
    app.jumpTo(Math.max(0, i - 1), 0, 0);
    app.toast('Sayfa silindi');
  }
  function rebuildAfterStructure() {
    buildPagesDOM(); ON.cards.renderAll(); clampPan(); applyCamera(); requestRedraw();
    if (activeTab === 'pages') renderThumbs();
  }

  /* ---------- İçindekiler ---------- */
  async function renderToc() {
    const box = $('toc');
    if (!app.search) { box.innerHTML = `<p class="hint small" style="padding:8px">İçindekiler yalnızca PDF defterlerinde görünür.</p>`; return; }
    box.innerHTML = `<p class="hint small" style="padding:8px">Yükleniyor…</p>`;
    const tree = await app.search.outline();
    if (!tree.length) { box.innerHTML = `<p class="hint small" style="padding:8px">Bu PDF'te içindekiler bilgisi yok. Sayfalar sekmesini veya aramayı kullanabilirsin.</p>`; return; }
    const nodes = [];
    const build = (items) => items.map(it => {
      const id = nodes.push(it) - 1;
      const btn = `<button class="toc-i" data-o="${id}">${esc(it.title)}</button>`;
      if (it.items && it.items.length) return `<details><summary class="toc-row"><span class="caret">${icon('caret')}</span>${btn}</summary><div class="toc-c">${build(it.items)}</div></details>`;
      return `<div class="toc-row"><span class="caret"></span>${btn}</div>`;
    }).join('');
    box.innerHTML = build(tree);
    box.onclick = async e => {
      const b = e.target.closest('[data-o]'); if (!b) return;
      e.preventDefault();
      const n = await app.search._resolveDestinationPage(nodes[+b.dataset.o].dest);
      if (n == null) { app.toast('Hedef sayfa bulunamadı'); return; }
      const idx = app.nb.pages.findIndex(p => p.k === 'pdf' && p.n === n);
      if (idx >= 0) app.jumpTo(idx, 0, 0);
    };
  }

  /* ---------- Arama ---------- */
  let lastQuery = '';
  const runFind = debounce(async () => {
    const q = $('findIn').value.trim();
    lastQuery = q;
    const res = $('findRes'), prog = $('findProg');
    clearSearchHL();
    if (!app.nb) return;
    if (app.search && !app.search.complete) {
      app.search.indexAll((d, t) => { prog.textContent = d < t ? `PDF metni indeksleniyor: ${d}/${t}` : ''; if (lastQuery) renderFindResults(lastQuery); });
    } else prog.textContent = '';
    renderFindResults(q);
  }, 250);
  function renderFindResults(q) {
    const res = $('findRes');
    if (q.length < 2) { res.innerHTML = `<p class="hint small">En az 2 harf yaz. PDF metni, metin kutuları ve kartlar aranır.</p>`; return; }
    const nq = q.toLocaleLowerCase('tr');
    const items = [];
    if (app.search) for (const r of app.search.search(q)) {
      const idx = app.nb.pages.findIndex(p => p.k === 'pdf' && p.n === r.n);
      if (idx >= 0) items.push({ page: idx, html: `<b>Sayfa ${idx + 1} · ${r.count} eşleşme</b>${esc(r.before)}<mark>${esc(r.match)}</mark>${esc(r.after)}`, pdf: r.n });
    }
    for (const o of app.nb.objects) if (o.type === 'text' && o.text.toLocaleLowerCase('tr').includes(nq)) items.push({ page: o.page, x: o.x, y: o.y, html: `<b>Sayfa ${o.page + 1} · metin kutusu</b>${esc(o.text.slice(0, 120))}` });
    for (const c of app.nb.cards) if (c.md.toLocaleLowerCase('tr').includes(nq)) items.push({ page: c.page, x: c.x, y: c.y, html: `<b>Sayfa ${c.page + 1} · kart</b>${esc(c.title)}` });
    items.sort((a, b) => a.page - b.page);
    res.innerHTML = items.length ? items.map((it, i) => `<button class="res" data-r="${i}">${it.html}</button>`).join('') : `<p class="hint small">Sonuç yok.</p>`;
    res.onclick = e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      const it = items[+b.dataset.r];
      if (it.pdf) {
        const boxes = app.search.matchBoxes(it.pdf, q);
        showSearchHL(it.page, boxes);
        const sc = app.pdfScale(it.page);
        app.jumpTo(it.page, boxes[0] ? boxes[0].x * sc : 0, boxes[0] ? boxes[0].y * sc : 0);
      } else app.jumpTo(it.page, it.x, it.y, true);
    };
  }
  $('findIn').addEventListener('input', runFind);
  $('findForm').onsubmit = e => { e.preventDefault(); runFind(); };
  function clearSearchHL() { world.querySelectorAll('.search-hl').forEach(n => n.remove()); }
  function showSearchHL(i, boxes) {
    clearSearchHL();
    const el = pageEl(i); if (!el) return;
    const sc = app.pdfScale(i);
    for (const b of boxes) {
      const d = document.createElement('div'); d.className = 'search-hl';
      Object.assign(d.style, { left: b.x * sc + 'px', top: b.y * sc + 'px', width: b.w * sc + 'px', height: b.h * sc + 'px' });
      el.appendChild(d);
    }
  }

  /* ================= Gezinme ================= */
  app.jumpTo = (page, lx = 0, ly = 0, flash = false) => {
    if (!app.nb) return;
    const L = app.pageOrigin(page);
    const z = app.cam.z;
    const wx = L.x + lx, wy = L.y + ly;
    if (isInfinite() || lx || ly) { app.cam.tx = W / 2 - wx * z; app.cam.ty = H * 0.35 - wy * z; }
    else app.cam.ty = 16 - L.y * z;
    if (!isInfinite() && app.docW * z <= W) app.cam.tx = (W - app.docW * z) / 2;
    clampPan(); applyCamera();
    if (flash) {
      const f = document.createElement('div'); f.className = 'flash';
      f.style.left = wx + 'px'; f.style.top = wy + 'px';
      world.appendChild(f); setTimeout(() => f.remove(), 1300);
    }
  };
  app.viewAnchor = () => {
    const v = viewRect(), x = v.minX + (v.maxX - v.minX) * 0.55, y = v.minY + (v.maxY - v.minY) * 0.2;
    const page = pageAt(x, y), o = app.pageOrigin(page);
    return { page, x: x - o.x, y: y - o.y };
  };
  function updateBackBtn() {
    const btn = $('backBtn');
    const l = app.nb && app.nb.last;
    if (!l || l.page >= app.nb.pages.length) { btn.hidden = true; return; }
    const o = app.pageOrigin(l.page), v = viewRect(), x = o.x + l.x, y = o.y + l.y;
    btn.hidden = x > v.minX && x < v.maxX && y > v.minY && y < v.maxY;
  }
  $('backBtn').onclick = () => { const l = app.nb.last; app.jumpTo(l.page, l.x, l.y, true); };

  /* ================= Mini harita ================= */
  const mini = $('minimap'), miniX = mini.getContext('2d');
  let miniRaf = 0, miniMap = null;
  function scheduleMini() { if (!miniRaf) miniRaf = requestAnimationFrame(drawMini); }
  function contentBounds() {
    let b = null;
    for (const list of app.pages) for (const s of list) if (s.pts) b = Geo.union(b, s.bbox);
    return b;
  }
  function drawMini() {
    miniRaf = 0;
    if (!app.nb || mini.hidden || !ON.settings.minimap) return;
    const d = dprOf(), mw = mini.clientWidth, mh = mini.clientHeight;
    if (mini.width !== Math.round(mw * d)) { mini.width = Math.round(mw * d); mini.height = Math.round(mh * d); }
    miniX.setTransform(d, 0, 0, d, 0, 0);
    miniX.clearRect(0, 0, mw, mh);
    const v = viewRect();
    let wb = isInfinite() ? Geo.union(contentBounds(), v) : { minX: 0, minY: 0, maxX: app.docW, maxY: app.docH };
    if (!wb) wb = v;
    wb = Geo.expand(wb, 20);
    const sc = Math.min((mw - 8) / (wb.maxX - wb.minX), (mh - 8) / (wb.maxY - wb.minY));
    const ox = (mw - (wb.maxX - wb.minX) * sc) / 2 - wb.minX * sc, oy = (mh - (wb.maxY - wb.minY) * sc) / 2 - wb.minY * sc;
    miniMap = { sc, ox, oy };
    const dark = surfaceDark();
    if (!isInfinite()) {
      miniX.fillStyle = dark ? '#2A2535' : '#E9E6F2';
      for (const L of app.layout) miniX.fillRect(ox + L.x * sc, oy + L.y * sc, Math.max(1, L.w * sc), Math.max(1, L.h * sc));
    }
    miniX.fillStyle = 'rgba(155,123,255,.8)';
    app.pages.forEach(list => { for (const s of list) if (s.pts) { const b = s.bbox; miniX.fillRect(ox + b.minX * sc, oy + b.minY * sc, Math.max(1, (b.maxX - b.minX) * sc), Math.max(1, (b.maxY - b.minY) * sc)); } });
    miniX.strokeStyle = '#F2EFFB'; miniX.lineWidth = 1.2;
    miniX.strokeRect(ox + v.minX * sc, oy + v.minY * sc, (v.maxX - v.minX) * sc, (v.maxY - v.minY) * sc);
  }
  const miniNav = e => {
    if (!miniMap) return;
    const r = mini.getBoundingClientRect();
    const wx = (e.clientX - r.left - miniMap.ox) / miniMap.sc, wy = (e.clientY - r.top - miniMap.oy) / miniMap.sc;
    app.cam.tx = W / 2 - wx * app.cam.z; app.cam.ty = H / 2 - wy * app.cam.z;
    clampPan(); applyCamera();
  };
  mini.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); mini.setPointerCapture(e.pointerId); miniNav(e);
    const mv = ev => miniNav(ev);
    const up = () => { mini.removeEventListener('pointermove', mv); mini.removeEventListener('pointerup', up); refreshAfterZoom(); };
    mini.addEventListener('pointermove', mv); mini.addEventListener('pointerup', up);
  });

  /* ================= Fare tekerleği ================= */
  stage.addEventListener('wheel', e => {
    if (!app.nb || e.target.closest('#ai, .snote, .pop, #tools')) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - stageRect.left, e.clientY - stageRect.top);
    else { app.cam.tx -= e.shiftKey ? e.deltaY : e.deltaX; app.cam.ty -= e.shiftKey ? 0 : e.deltaY; }
    if (app.virt) app.virt.frozen = true;
    clampPan(); applyCamera(); refreshAfterZoom();
  }, { passive: false });

  /* ================= Odak Sayacı, Kronometre & Odak Sesleri ================= */
  const FocusAudio = (() => {
    let ctx = null, gain = null, srcNode = null, oscA = null, oscB = null;
    const state = Object.assign({ mode: 'off', vol: 0.35 }, LS.get('on-focus-audio', {}));
    const save = () => LS.set('on-focus-audio', state);

    function ensureCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }

    function stopNodes() {
      try { srcNode && srcNode.stop(); } catch {}
      try { srcNode && srcNode.disconnect(); } catch {}
      try { oscA && oscA.stop(); } catch {}
      try { oscB && oscB.stop(); } catch {}
      srcNode = oscA = oscB = null;
    }

    function apply(mode = state.mode) {
      state.mode = mode;
      save();
      stopNodes();
      if (mode === 'off') return;
      const c = ensureCtx();
      if (!c) return;
      gain = c.createGain();
      gain.gain.value = state.vol * (mode === 'gamma' ? 0.14 : 0.35);
      gain.connect(c.destination);

      if (mode === 'brown' || mode === 'rain') {
        const len = c.sampleRate * 3;
        const buf = c.createBuffer(1, len, c.sampleRate);
        const out = buf.getChannelData(0);
        if (mode === 'brown') {
          let last = 0;
          for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            out[i] = (last + 0.02 * w) / 1.02;
            last = out[i];
            out[i] *= 3.2;
          }
        } else {
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.96900 * b2 + w * 0.1538520;
            b3 = 0.86650 * b3 + w * 0.3104856;
            b4 = 0.55000 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.0168980;
            out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08;
            b6 = w * 0.115926;
          }
        }
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = mode === 'brown' ? 320 : 1400;
        srcNode = c.createBufferSource();
        srcNode.buffer = buf;
        srcNode.loop = true;
        srcNode.connect(filter);
        filter.connect(gain);
        srcNode.start();
      } else if (mode === 'gamma') {
        oscA = c.createOscillator();
        oscB = c.createOscillator();
        oscA.type = 'sine'; oscB.type = 'sine';
        oscA.frequency.value = 200;
        oscB.frequency.value = 240;
        oscA.connect(gain); oscB.connect(gain);
        oscA.start(); oscB.start();
      }
    }

    function setVol(v) {
      state.vol = clamp(v, 0, 1);
      save();
      if (gain && ctx) gain.gain.setTargetAtTime(state.vol * (state.mode === 'gamma' ? 0.14 : 0.35), ctx.currentTime, 0.05);
    }

    function chime() {
      const c = ensureCtx();
      if (!c) return;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = c.currentTime + idx * 0.14;
        g.gain.setValueAtTime(0.001, t0);
        g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + 0.95);
      });
    }

    return { state, apply, setVol, chime, stop: stopNodes };
  })();

  let timer = LS.get('on-timer', null);
  let timerTab = timer?.kind === 'sw' ? 'sw' : 'cd';
  let chimedFor = 0;

  const fmtClock = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  function renderTimer() {
    const btn = $('timerBtn'), bar = $('timerBar').firstElementChild;
    btn.classList.remove('done');
    if (!timer) {
      $('timerTxt').textContent = '';
      bar.style.width = '0';
      const liveEl = $('tmLive'); if (liveEl) liveEl.textContent = timerTab === 'sw' ? '00:00' : '25:00';
      return;
    }
    if (timer.kind === 'sw') {
      const elapsed = timer.paused ? timer.elapsed : (timer.elapsed + (Date.now() - timer.started));
      const txt = fmtClock(elapsed);
      $('timerTxt').textContent = txt;
      bar.style.width = ((elapsed % 3600000) / 36000).toFixed(1) + '%';
      const liveEl = $('tmLive'); if (liveEl) liveEl.textContent = txt;
      return;
    }
    const left = timer.paused ? timer.rem : (timer.end - Date.now());
    if (left <= 0) {
      $('timerTxt').textContent = 'Mola';
      btn.classList.add('done');
      bar.style.width = '100%';
      const liveEl = $('tmLive'); if (liveEl) liveEl.textContent = '00:00';
      if (chimedFor !== timer.end) {
        chimedFor = timer.end;
        FocusAudio.chime();
        app.toast('Odak süresi tamamlandı — kısa bir mola ver', 3200);
      }
      return;
    }
    const txt = fmtClock(left);
    $('timerTxt').textContent = txt;
    bar.style.width = (100 * (1 - left / (timer.total * 60000))).toFixed(1) + '%';
    const liveEl = $('tmLive'); if (liveEl) liveEl.textContent = txt;
  }

  function startTimer(min) {
    min = clamp(Math.round(min) || 25, 1, 180);
    timer = { kind: 'cd', end: Date.now() + min * 60000, total: min, paused: false };
    chimedFor = 0;
    LS.set('on-timer', timer);
    renderTimer();
    buildTimerPop();
    app.toast(`${min} dakikalık odak sayacı başladı`);
  }

  function togglePauseTimer() {
    if (!timer) {
      if (timerTab === 'sw') {
        timer = { kind: 'sw', started: Date.now(), elapsed: 0, paused: false };
        LS.set('on-timer', timer); renderTimer(); buildTimerPop();
      } else startTimer(25);
      return;
    }
    if (timer.kind === 'sw') {
      if (timer.paused) { timer.started = Date.now(); timer.paused = false; }
      else { timer.elapsed += Date.now() - timer.started; timer.paused = true; }
    } else {
      if (timer.paused) { timer.end = Date.now() + timer.rem; timer.paused = false; }
      else { timer.rem = Math.max(0, timer.end - Date.now()); timer.paused = true; }
    }
    LS.set('on-timer', timer);
    renderTimer();
    buildTimerPop();
  }

  function resetTimerAll() {
    timer = null;
    LS.set('on-timer', null);
    renderTimer();
    buildTimerPop();
  }

  function buildTimerPop() {
    const pop = $('timerPop');
    const isSw = timerTab === 'sw';
    const running = timer && !timer.paused && (timer.kind === 'sw' || timer.end > Date.now());
    const curVal = !timer ? (isSw ? '00:00' : '25:00') : (timer.kind === 'sw'
      ? fmtClock(timer.paused ? timer.elapsed : timer.elapsed + (Date.now() - timer.started))
      : fmtClock(Math.max(0, timer.paused ? timer.rem : timer.end - Date.now())));
    const audioModes = [['off', 'Sessiz'], ['brown', 'Derin odak'], ['rain', 'Yağmur'], ['gamma', '40 Hz']];

    pop.style.width = '276px';
    pop.innerHTML = `
      <div style="display:flex;gap:4px;margin-bottom:10px;background:rgba(255,255,255,.04);padding:3px;border-radius:10px">
        <button type="button" data-tmode="cd" style="flex:1;padding:6px;border-radius:8px;font-size:12px;font-weight:600;background:${!isSw ? 'var(--accent,#7B52DB)' : 'transparent'};color:${!isSw ? '#fff' : 'inherit'}">Geri sayım</button>
        <button type="button" data-tmode="sw" style="flex:1;padding:6px;border-radius:8px;font-size:12px;font-weight:600;background:${isSw ? 'var(--accent,#7B52DB)' : 'transparent'};color:${isSw ? '#fff' : 'inherit'}">Kronometre</button>
      </div>
      <div style="text-align:center;padding:6px 0 10px">
        <div id="tmLive" style="font-variant-numeric:tabular-nums;font-size:28px;font-weight:700;letter-spacing:.03em">${curVal}</div>
      </div>
      ${!isSw ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px">
          ${[15, 25, 45, 60].map(m => `<button type="button" data-min="${m}" style="padding:6px 0;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,.1));font-size:12px;font-weight:600">${m} dk</button>`).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <input id="tmCustomIn" type="number" min="1" max="180" placeholder="Özel dk" style="flex:1;min-width:0;padding:6px 8px;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,.12));background:rgba(0,0,0,.2);color:inherit;font-size:12px">
          <button type="button" id="tmCustomGo" style="padding:6px 12px;border-radius:8px;background:var(--accent,#7B52DB);color:#fff;font-size:12px;font-weight:600">Başlat</button>
        </div>
      ` : ''}
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button type="button" id="tmToggle" style="flex:1;padding:7px;border-radius:8px;background:var(--accent,#7B52DB);color:#fff;font-size:12px;font-weight:600">${running ? 'Duraklat' : (timer ? 'Devam et' : 'Başlat')}</button>
        <button type="button" id="timerStop" style="padding:7px 12px;border-radius:8px;border:1px solid var(--line,rgba(255,255,255,.12));font-size:12px">Sıfırla</button>
      </div>
      <div style="border-top:1px solid var(--line,rgba(255,255,255,.08));padding-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11px;opacity:.75">
          <span>Odak Sesi (Çevrimdışı)</span>
          <span>${Math.round(FocusAudio.state.vol * 100)}%</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px">
          ${audioModes.map(([id, lbl]) => `<button type="button" data-snd="${id}" style="padding:5px 2px;border-radius:7px;font-size:11px;border:1px solid ${FocusAudio.state.mode === id ? 'var(--accent,#7B52DB)' : 'var(--line,rgba(255,255,255,.1))'};background:${FocusAudio.state.mode === id ? 'rgba(123,82,219,.22)' : 'transparent'}">${lbl}</button>`).join('')}
        </div>
        <input type="range" id="tmVol" min="0" max="1" step="0.05" value="${FocusAudio.state.vol}" style="width:100%">
      </div>
    `;
  }

  $('timerBtn').onclick = e => {
    e.stopPropagation();
    if (timer && timer.kind === 'cd' && !timer.paused && timer.end <= Date.now()) {
      resetTimerAll();
      return;
    }
    const pop = $('timerPop');
    const opening = pop.hidden;
    app.closePanelsExcept('timer');
    pop.hidden = !opening;
    if (!pop.hidden) {
      buildTimerPop();
      const r = $('timerBtn').getBoundingClientRect();
      pop.style.top = r.bottom + 8 + 'px';
      pop.style.left = clamp(r.left - 110, 8, innerWidth - 292) + 'px';
      pop.style.right = 'auto';
    }
  };
  $('timerPop').addEventListener('pointerdown', e => e.stopPropagation());
  $('timerPop').onclick = e => {
    const modeBtn = e.target.closest('[data-tmode]');
    if (modeBtn) {
      timerTab = modeBtn.dataset.tmode;
      if (timer && timer.kind !== timerTab) resetTimerAll();
      else buildTimerPop();
      return;
    }
    const minBtn = e.target.closest('[data-min]');
    if (minBtn) { timerTab = 'cd'; startTimer(+minBtn.dataset.min); return; }
    if (e.target.closest('#tmCustomGo')) {
      const v = +$('tmCustomIn')?.value;
      if (v > 0) { timerTab = 'cd'; startTimer(v); }
      return;
    }
    if (e.target.closest('#tmToggle')) { togglePauseTimer(); return; }
    if (e.target.closest('#timerStop')) { resetTimerAll(); return; }
    const sndBtn = e.target.closest('[data-snd]');
    if (sndBtn) { FocusAudio.apply(sndBtn.dataset.snd); buildTimerPop(); }
  };
  $('timerPop').oninput = e => {
    if (e.target.id === 'tmVol') {
      FocusAudio.setVol(+e.target.value);
      const lbl = $('timerPop').querySelector('span:last-child');
      if (lbl && lbl.textContent.endsWith('%')) lbl.textContent = Math.round(FocusAudio.state.vol * 100) + '%';
    }
  };
  setInterval(renderTimer, 1000);

  /* ================= Zen modu ================= */
  function setZen(on) {
    $('app').classList.toggle('zen', on);
    $('zenExit').hidden = !on;
    if (on) { app.closePanelsExcept(null); hidePop(); }
    setTimeout(resizeCanvases, 230);
  }
  $('zenBtn').onclick = () => setZen(true);
  $('zenExit').onclick = () => setZen(false);
  document.addEventListener('pointermove', e => {
    if (!$('app').classList.contains('zen') || e.pointerType === 'pen') return;
    $('app').classList.toggle('peek', e.clientY < 10);
  });

  /* ================= Asistan, kartlar, özet ================= */
  ON.cards = new ON.StickyCardManager(worldTop);
  ON.AI.init();
  const guide = new ON.StudyGuideBuilder();
  $('aiOpen').onclick = () => ON.AI.toggle();
  $('studyBtn').onclick = () => { if (app.nb) guide.open(); };
  $('sgCopy').onclick = () => guide.copyMarkdown();
  $('sgAdd').onclick = () => guide.addAsPage();
  $('sgQuizBtn').onclick = () => guide.makeQuiz();
  $('sgQuizCopy').onclick = async () => { try { await navigator.clipboard.writeText(guide.quiz); app.toast('Kopyalandı'); } catch {} };
  $('sgQuizPin').onclick = () => { if (guide.quiz) { ON.cards.create(guide.quiz, app.viewAnchor()); app.closeModal('studyDlg'); app.toast('Sorular tuvale sabitlendi'); } };

  app.contextImage = async () => {
    if (!app.nb) return null;
    let rect, page;
    if (isInfinite()) { const v = viewRect(); rect = { x: v.minX, y: v.minY, w: v.maxX - v.minX, h: v.maxY - v.minY }; page = 0; }
    else { page = currentPage(); const L = app.layout[page]; rect = { x: L.x, y: L.y, w: L.w, h: L.h }; }
    const hasInk = pageStrokes(page).some(s => s.pts) || app.nb.pages[page].k === 'pdf' || app.nb.objects.some(o => o.page === page);
    if (!hasInk) return null;
    const scale = Math.min(2, 1600 / Math.max(rect.w, rect.h));
    const canvas = await renderRegion(liveData(), rect, scale, { print: true, cards: false });
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    const o = app.pageOrigin(page);
    return { b64: await blobToB64(blob), mime: 'image/jpeg', anchor: isInfinite() ? app.viewAnchor() : { page, x: rect.w + 16 - (rect.x - o.x), y: Math.max(0, viewRect().minY - o.y + 40) } };
  };
  app.addSummaryPage = async (md) => {
    if (!app.nb) return;
    const text = md.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/_([^_]+)_/g, '$1').replace(/^> ?/gm, '');
    let page, x = 48, y = 60;
    if (isInfinite()) {
      const b = contentBounds();
      page = 0; x = b ? b.minX : 40; y = b ? b.maxY + 80 : 40;
    } else page = await insertPage(app.nb.pages.length, { silent: true });
    const w = isInfinite() ? 640 : app.layout[page].w - 96;
    app.nb.objects.push({ id: ON.uid(), type: 'text', page, x, y, w, text, color: inkColor(), fs: 16 });
    renderObjects(); markMetaDirty();
    app.jumpTo(page, x, y, true);
    app.toast('Özet sayfası eklendi');
  };

  /* ================= Bölge çizimi (dışa aktarma, Gemini, önizleme) ================= */
  const liveData = () => ({ nb: app.nb, layout: app.layout, pages: app.pages, engine: app.engine, live: true });
  async function loadNotebookData(nb) {
    const L = computeLayout(nb);
    const pages = nb.pages.map(() => []);
    for (const rec of await Store.all('pages', 'notebookId', nb.id)) {
      if (rec.pageIndex >= nb.pages.length) continue;
      const o = L.layout[rec.pageIndex];
      const list = await ON.decodeStrokes(rec, o.x, o.y);
      list.forEach(s => { s.page = rec.pageIndex; ON.computeBBox(s); });
      pages[rec.pageIndex] = list;
    }
    let engine = null;
    if (nb.pdfHash) { const r = await Store.get('pdfs', nb.pdfHash); if (r) engine = await new ON.PDFEngine().open(await r.blob.arrayBuffer()); }
    return { nb, layout: L.layout, docW: L.docW, pages, engine, live: false };
  }
  const bitmapCache = new Map();
  async function assetBitmap(id) {
    if (bitmapCache.has(id)) return bitmapCache.get(id);
    const a = await Store.get('assets', id);
    const bmp = a ? await createImageBitmap(a.blob) : null;
    bitmapCache.set(id, bmp);
    return bmp;
  }
  function wrapText(g, text, x, y, w, fs) {
    const lh = fs * 1.35;
    let yy = y + fs;
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (g.measureText(t).width > w && line) { g.fillText(line, x, yy); yy += lh; line = word; } else line = t;
      }
      g.fillText(line, x, yy); yy += lh;
    }
  }
  async function renderRegion(data, rect, scale, opts = {}) {
    const nb = data.nb, inf = nb.mode === 'infinite';
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(rect.w * scale)); c.height = Math.max(1, Math.ceil(rect.h * scale));
    const g = c.getContext('2d');
    const darkSurf = surfaceDark(nb) && !opts.print;
    g.fillStyle = opts.print ? '#FFFFFF' : '#07050F'; g.fillRect(0, 0, c.width, c.height);
    const wt = () => g.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
    const R = { minX: rect.x, minY: rect.y, maxX: rect.x + rect.w, maxY: rect.y + rect.h };
    const idxs = inf ? [0] : data.layout.map((L, i) => i).filter(i => { const L = data.layout[i]; return L.x < R.maxX && L.x + L.w > R.minX && L.y < R.maxY && L.y + L.h > R.minY; });
    for (const i of idxs) {
      const p = nb.pages[i], L = inf ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : data.layout[i];
      wt();
      g.save(); g.beginPath(); g.rect(L.x, L.y, L.w, L.h); g.clip();
      if (p.k === 'pdf' && data.engine) {
        const k = L.w / p.pw;
        const ix0 = Math.max(R.minX, L.x), iy0 = Math.max(R.minY, L.y), ix1 = Math.min(R.maxX, L.x + L.w), iy1 = Math.min(R.maxY, L.y + L.h);
        const region = { x: (ix0 - L.x) / k, y: (iy0 - L.y) / k, w: (ix1 - ix0) / k, h: (iy1 - iy0) / k };
        const s = data.engine.clampScale(region.w, region.h, scale * k);
        const pc = await data.engine.renderRegion(p.n, s, region);
        if (nb.pdfDark && !opts.print) g.filter = 'invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.95)';
        g.drawImage(pc, ix0, iy0, ix1 - ix0, iy1 - iy0);
        g.filter = 'none';
        pc.width = pc.height = 0;
      } else {
        ON.drawPaper(g, inf ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : L, nb.paper, { forceLight: opts.print, paged: !inf, originX: inf ? 0 : L.x, originY: inf ? 0 : L.y });
      }
      for (const o of nb.objects) {
        if (o.page !== i) continue;
        const ox = (inf ? 0 : L.x) + o.x, oy = (inf ? 0 : L.y) + o.y;
        if (o.type === 'image') { const bmp = await assetBitmap(o.asset); wt(); if (bmp) g.drawImage(bmp, ox, oy, o.w, o.h); }
        else { g.fillStyle = ON.adaptColor(o.color || '#1B1830', darkSurf); g.font = `${o.fs || 20}px Inter, system-ui, sans-serif`; wrapText(g, o.text, ox + 6, oy + 4, o.w - 12, o.fs || 20); }
      }
      const list = (data.pages[i] || []).filter(s => s.pts && (!opts.strokeFilter || opts.strokeFilter.has(s)) && Geo.bboxIntersects(s.bbox, R));
      g.globalCompositeOperation = darkSurf ? 'screen' : 'multiply';
      for (const s of list) if (s.tool === 'highlighter') ON.drawStroke(g, s, { dark: darkSurf });
      g.globalCompositeOperation = 'source-over';
      for (const s of list) if (s.tool !== 'highlighter') ON.drawStroke(g, s, { dark: darkSurf });
      g.restore();
    }
    if (opts.cards) {
      for (const card of nb.cards) {
        const L = inf ? { x: 0, y: 0 } : data.layout[card.page];
        if (!L) continue;
        const cx = L.x + card.x, cy = L.y + card.y, ch = card.collapsed ? 44 : card.h;
        if (cx > R.maxX || cx + card.w < R.minX || cy > R.maxY || cy + ch < R.minY) continue;
        const img = await ON.cards.rasterize(card, scale);
        g.setTransform(1, 0, 0, 1, 0, 0);
        const px = (cx - rect.x) * scale, py = (cy - rect.y) * scale;
        if (img) { g.drawImage(img, px, py, card.w * scale, img.height * (card.w * scale / img.width)); img.width = img.height = 0; }
        else {
          const [bg, fg] = ON.CARD_COLORS[card.theme] || ON.CARD_COLORS.krem;
          wt(); g.fillStyle = bg; g.fillRect(cx, cy, card.w, ch);
          g.fillStyle = fg; g.font = '600 14px Inter, sans-serif'; g.fillText(card.title, cx + 12, cy + 24);
          g.font = '13px Inter, sans-serif'; wrapText(g, card.md.replace(/[#*`]/g, ''), cx + 12, cy + 34, card.w - 24, 13);
        }
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }
  app.renderRegion = renderRegion;

  /* ================= PDF dışa aktarma (jsPDF) ================= */
  let exportCancel = false, exportScope = 'nb', exportQ = 2;
  $('exportBtn').onclick = () => {
    if (!app.nb) return;
    $('expMsg').textContent = ''; $('expProg').hidden = true; $('expGo').disabled = false;
    $('expPrint').checked = LS.get('on-exp-print', true);
    app.openModal('exportDlg');
  };
  $('expScope').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; exportScope = b.dataset.v; $('expScope').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('expQ').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; exportQ = +b.dataset.v; $('expQ').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('expCancel').onclick = () => { exportCancel = true; app.closeModal('exportDlg'); };
  $('expPrint').onchange = () => LS.set('on-exp-print', $('expPrint').checked);
  function regionsOf(data, onlyPage = null) {
    const nb = data.nb;
    if (nb.mode !== 'infinite') {
      return data.layout.map((L, i) => ({ i, rect: { x: L.x, y: L.y, w: L.w, h: L.h } })).filter(r => onlyPage == null || r.i === onlyPage);
    }
    let b = null;
    for (const list of data.pages) for (const s of list) if (s.pts) b = Geo.union(b, s.bbox);
    for (const o of nb.objects) b = Geo.union(b, { minX: o.x, minY: o.y, maxX: o.x + o.w, maxY: o.y + (o.h || 60) });
    for (const c of nb.cards) b = Geo.union(b, { minX: c.x, minY: c.y, maxX: c.x + c.w, maxY: c.y + c.h });
    if (!b) return [];
    b = Geo.expand(b, 40);
    const w = Math.max(ON.A4.w, b.maxX - b.minX), h = w * 1.4142, out = [];
    for (let y = b.minY; y < b.maxY; y += h) out.push({ i: 0, rect: { x: b.minX, y, w, h } });
    return out;
  }
  $('expGo').onclick = async () => {
    if (!window.jspdf) { $('expMsg').textContent = 'PDF oluşturucu yüklenemedi. İnternet bağlantısını kontrol et.'; return; }
    exportCancel = false;
    $('expGo').disabled = true; $('expProg').hidden = false;
    const bar = $('expProg').firstElementChild, msg = $('expMsg');
    const print = $('expPrint').checked, cards = $('expCards').checked;
    await saveNow();
    let targets;
    if (exportScope === 'folder') targets = app.notebooks.filter(n => n.folderId === app.nb.folderId).sort((a, b) => a.created - b.created);
    else targets = [app.nb];
    const { jsPDF } = window.jspdf;
    let pdf = null, count = 0;
    try {
      for (const nb of targets) {
        msg.textContent = `“${nb.title}” hazırlanıyor…`;
        const data = nb.id === app.nb.id ? liveData() : await loadNotebookData(nb);
        const regs = regionsOf(data, exportScope === 'page' ? currentPage() : null);
        for (let k = 0; k < regs.length; k++) {
          if (exportCancel) throw new Error('İptal edildi');
          const { rect } = regs[k];
          const scale = Math.min(exportQ, 4000 / Math.max(rect.w, rect.h));
          const canvas = await renderRegion(data, rect, scale, { print, cards });
          const wpt = rect.w * 0.75, hpt = rect.h * 0.75, ori = wpt > hpt ? 'l' : 'p';
          if (!pdf) pdf = new jsPDF({ unit: 'pt', format: [wpt, hpt], orientation: ori, compress: true });
          else pdf.addPage([wpt, hpt], ori);
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wpt, hpt);
          canvas.width = canvas.height = 0;
          count++;
          bar.style.width = Math.round(100 * (k + 1) / regs.length) + '%';
          msg.textContent = `“${nb.title}” — sayfa ${k + 1}/${regs.length}`;
          await new Promise(r => setTimeout(r));
        }
        if (data.engine && !data.live) data.engine.destroy();
      }
      if (!pdf) { msg.textContent = 'Dışa aktarılacak içerik yok.'; return; }
      const name = (exportScope === 'folder' ? (app.lib.folders.find(f => f.id === app.nb.folderId)?.name || 'Ders') : app.nb.title).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
      pdf.setProperties({ title: name, creator: 'Odak Not' });
      pdf.save(name + '.pdf');
      msg.textContent = `${count} sayfalık PDF indirildi.`;
    } catch (err) {
      msg.textContent = 'Dışa aktarma durdu: ' + (err.message || err);
    } finally { $('expGo').disabled = false; }
  };

  /* ================= Kâğıt ve düzen ================= */
  function openPaper() {
    if (!app.nb) return;
    const nb = app.nb, pdf = !!nb.pdfHash;
    $('paperLayoutBox').hidden = pdf;
    $('pdDarkRow').hidden = !pdf;
    $('pdTplNote').textContent = pdf ? '(eklenen boş sayfalar için)' : '';
    $('pdDark').checked = !!nb.pdfDark;
    const lay = nb.mode === 'infinite' ? 'inf' : nb.paper.orient;
    $('pdLayout').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === lay));
    $('pdTpl').innerHTML = chipsHTML(ON.TEMPLATES, nb.paper.template);
    $('pdTheme').innerHTML = chipsHTML(THEMES, nb.paper.theme);
    app.openModal('paperDlg');
  }
  $('paperBtn').onclick = openPaper;
  $('pdTpl').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; app.nb.paper.template = b.dataset.v; paperChanged(); openPaper(); };
  $('pdTheme').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; app.nb.paper.theme = b.dataset.v; paperChanged(); openPaper(); };
  $('pdDark').onchange = () => { app.nb.pdfDark = $('pdDark').checked; app.nb.paper.theme = app.nb.pdfDark ? 'dark' : 'white'; paperChanged(); };
  $('pdLayout').onclick = async e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    await changeLayout(b.dataset.v); openPaper();
  };
  function paperChanged() {
    markMetaDirty();
    buildPagesDOM(); applyCamera(); refreshPalette(); requestRedraw();
    if (activeTab === 'pages') { Store.delByIndex('thumbnails', 'notebookId', app.nb.id).then(renderThumbs); }
  }
  async function changeLayout(v) {
    const nb = app.nb;
    if (nb.pdfHash) return;
    const cur = nb.mode === 'infinite' ? 'inf' : nb.paper.orient;
    if (v === cur) return;
    await saveNow();
    app.history.clear(); clearSelection();
    const oldN = nb.pages.length;
    const toWorld = (o) => { const L = app.pageOrigin(o.page); return { x: L.x + o.x, y: L.y + o.y }; };
    const items = [...nb.objects, ...nb.cards].map(o => ({ o, w: toWorld(o) }));
    const all = app.pages.flat().filter(s => s.pts);
    if (v === 'inf') {
      nb.mode = 'infinite';
      nb.pages = [{ k: 'inf', w: 0, h: 0, v: 0 }];
      relayout();
      app.pages = [all]; all.forEach(s => { s.page = 0; });
      for (const { o, w } of items) { o.page = 0; o.x = w.x; o.y = w.y; }
    } else {
      const pw = v === 'l' ? ON.A4.h : ON.A4.w, ph = v === 'l' ? ON.A4.w : ON.A4.h;
      if (nb.mode === 'infinite') {
        let b = null; for (const s of all) b = Geo.union(b, s.bbox);
        for (const { w } of items) b = Geo.union(b, { minX: w.x, minY: w.y, maxX: w.x, maxY: w.y });
        const dx = b ? 40 - b.minX : 0, dy = b ? 40 - b.minY : 0;
        const T = ON.Affine2D.translate(dx, dy);
        all.forEach(s => { T.applyInPlace(s.pts); s._path = null; ON.computeBBox(s); });
        items.forEach(it => { it.w.x += dx; it.w.y += dy; });
        const maxY = b ? b.maxY + dy : 0;
        const n = Math.max(1, Math.ceil((maxY + 40) / (ph + GAP)));
        nb.mode = 'paged'; nb.paper.orient = v;
        nb.pages = Array.from({ length: n }, () => ({ k: 'paper', w: pw, h: ph, v: 0 }));
        relayout();
        app.pages = nb.pages.map(() => []);
        for (const s of all) { s.page = pageAt(0, (s.bbox.minY + s.bbox.maxY) / 2); app.pages[s.page].push(s); }
      } else {
        nb.paper.orient = v;
        withRelayout(() => { nb.pages.forEach(p => { if (p.k === 'paper') { p.w = pw; p.h = ph; } }); });
      }
      for (const it of items) { const p = pageAt(it.w.x, it.w.y), L = app.pageOrigin(p); it.o.page = p; it.o.x = it.w.x - L.x; it.o.y = it.w.y - L.y; }
    }
    for (let k = nb.pages.length; k < oldN; k++) await Store.del('pages', [nb.id, k]);
    for (let k = 0; k < nb.pages.length; k++) dirtyPages.add(k);
    await Store.delByIndex('thumbnails', 'notebookId', nb.id);
    updateTabs();
    rebuildAfterStructure();
    fitWidth(); applyCamera();
    markMetaDirty();
  }

  /* ================= Ayarlar, depolama, yedek ================= */
  app.openSettings = async () => {
    const s = ON.settings;
    const sel = $('modelIn');
    [...sel.options].forEach(o => { if (/^gemini-3\./.test(o.value)) o.remove(); });
    for (const [val, label] of [['gemini-2.5-flash', 'Gemini 2.5 Flash (Önerilen)'], ['gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite (Hızlı / Yüksek Kota)'], ['gemini-2.5-pro', 'Gemini 2.5 Pro (Derin Analiz)']]) {
      if (![...sel.options].some(o => o.value === val)) sel.add(new Option(label, val));
    }
    if (![...sel.options].some(o => o.value === s.model)) sel.add(new Option(s.model + ' (otomatik seçildi)', s.model));
    $('keyIn').value = s.key; $('modelCustom').value = s.custom; $('testMsg').textContent = '';
    sel.value = s.model;
    $('fingerDraw').checked = !!s.fingerDraw; $('showMini').checked = s.minimap !== false;
    $('backupMsg').textContent = '';
    app.openModal('settingsDlg');
    updateQuota();
  };
  async function updateQuota() {
    const q = await ON.storageInfo();
    const mb = b => (b / 1048576).toFixed(b > 1e9 ? 0 : 1);
    $('quotaBar').firstElementChild.style.width = q.quota ? Math.min(100, 100 * q.usage / q.quota).toFixed(1) + '%' : '0';
    $('quotaTxt').textContent = q.quota ? `${mb(q.usage)} MB kullanılıyor / ${mb(q.quota)} MB kullanılabilir · ${q.persisted ? 'Kalıcı depolama açık' : 'Kalıcı depolama izni verilmedi (tarayıcı yer açmak için silebilir)'}` : 'Depolama bilgisi alınamadı.';
  }
  $('openSettings').onclick = app.openSettings;
  const readSettings = () => Object.assign({}, ON.settings, {
    key: $('keyIn').value.replace(/\s+/g, ''), model: $('modelIn').value, custom: $('modelCustom').value.trim(),
    fingerDraw: $('fingerDraw').checked, minimap: $('showMini').checked
  });
  $('setForm').onsubmit = e => {
    e.preventDefault();
    Object.assign(ON.settings, readSettings()); ON.saveSettings();
    $('app').classList.toggle('no-mini', !ON.settings.minimap); scheduleMini();
    app.closeModal('settingsDlg'); app.toast('Ayarlar kaydedildi');
  };
  $('testBtn').onclick = async () => {
    const s = readSettings(), m = $('testMsg');
    if (!s.key) { m.textContent = 'Önce anahtarı yapıştır.'; return; }
    m.textContent = 'Deneniyor…';
    try {
      const r = await ON.gemini(s, [{ text: 'Sadece "tamam" yaz.' }], t => { m.textContent = t; });
      Object.assign(ON.settings, s); ON.saveSettings();
      m.textContent = `Bağlantı çalışıyor ✓ (model: ${r.model}). Ayarlar kaydedildi.`;
    } catch (err) { m.textContent = err.message; }
  };
  $('backupBtn').onclick = async () => {
    const m = $('backupMsg');
    try {
      await saveNow();
      const blob = await ON.exportBackup(t => { m.textContent = t; });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `odak-not-yedek-${new Date().toISOString().slice(0, 10)}.odaknot`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      m.textContent = `Yedek indirildi (${(blob.size / 1048576).toFixed(1)} MB). Güvenli bir yere kaydet.`;
    } catch (err) { m.textContent = 'Yedek alınamadı: ' + err.message; }
  };
  $('restoreBtn').onclick = () => $('restoreIn').click();
  $('restoreIn').onchange = async () => {
    const f = $('restoreIn').files[0]; $('restoreIn').value = '';
    if (!f) return;
    const m = $('backupMsg');
    if (!(await app.confirm('Yedek yüklensin mi?', 'Yedekteki defterler mevcut kütüphanene eklenir; aynı defterler yedekteki haliyle değiştirilir.', 'Yükle'))) return;
    try {
      const r = await ON.importBackup(f, t => { m.textContent = t; });
      await loadLibrary(); renderNotebookList();
      m.textContent = `${r.notebooks} defter geri yüklendi.`;
      if (app.nb) openNotebook(app.nb.id);
    } catch (err) { m.textContent = 'Geri yüklenemedi: ' + err.message; }
  };
  $('cleanBtn').onclick = async () => {
    const r = await ON.cleanupOrphans();
    $('backupMsg').textContent = r.removed ? `${r.removed} kullanılmayan dosya silindi (${(r.freed / 1048576).toFixed(1)} MB).` : 'Temizlenecek bir şey yok.';
    updateQuota();
  };

  /* ================= Klavye ================= */
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); clearSelection(); e.shiftKey ? app.history?.redo() : app.history?.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); clearSelection(); app.history?.redo(); return; }
    if (mod) return;
    if (k === 'escape') {
      if (document.querySelector('.modal.on')) { document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); return; }
      if (gizmo) { clearSelection(); return; }
      if ($('app').classList.contains('zen')) { setZen(false); return; }
      app.closePanelsExcept(null); return;
    }
    if ((k === 'delete' || k === 'backspace') && gizmo) { deleteSelection(); return; }
    const map = { p: 'pen', h: 'highlighter', e: 'eraser', l: 'lasso', s: 'textsel', t: 'text' };
    if (map[k]) { setTool(map[k]); return; }
    if (k === 'z') { setZen(!$('app').classList.contains('zen')); return; }
    if (k === '+' || k === '=') { zoomAt(1.2, W / 2, H / 2); applyCamera(); refreshAfterZoom(); }
    if (k === '-') { zoomAt(1 / 1.2, W / 2, H / 2); applyCamera(); refreshAfterZoom(); }
    if (k === '0') { fitWidth(true); applyCamera(); refreshAfterZoom(); }
  });

  /* ================= Açılış ================= */
  new ResizeObserver(() => { resizeCanvases(); if (app.nb) { clampPan(); applyCamera(); } }).observe(stage);
  async function boot() {
    fillIcons();
    $('app').classList.toggle('no-mini', ON.settings.minimap === false);
    if (matchMedia('(max-width:820px)').matches) $('app').classList.add('side-closed');
    resizeCanvases();
    setTool(['textsel', 'text', 'insert'].includes(tools.tool) ? 'pen' : tools.tool);
    renderTimer();
    try { await Store.open(); }
    catch (err) { app.toast('Depolama açılamadı: ' + (err.message || err), 8000); return; }
    try { const n = await ON.migrateV1(); if (n) app.toast(`Önceki sürümdeki ${n} notun yeni yapıya taşındı`, 4000); } catch (err) { console.warn('Göç', err); }
    await loadLibrary();
    if (!app.notebooks.length) {
      const nb = ON.newNotebookRecord({ title: 'İlk defterim', folderId: app.folderId, paper: { template: 'grid', theme: 'dark', orient: 'p' } });
      await Store.put('notebooks', nb); app.notebooks.push(nb);
    }
    renderNotebookList();
    const last = LS.get('on-nb', null);
    const pick = app.notebooks.find(n => n.id === last) || app.notebooks.filter(n => n.folderId === app.folderId).sort((a, b) => b.updated - a.updated)[0] || app.notebooks[0];
    if (pick) await openNotebook(pick.id); else showEmpty(true);
    ON.requestPersist();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
