/* =====================================================================
   Odak Not — pdf-engine.js
   PDFEngine (pdf.js sarmalayıcı), PDFPageVirtualizer (sanal kaydırma),
   ThumbnailGenerator (arka plan önizleme), PDFOutlineAndSearch.
   pdf.js 3.11.174 (UMD) — index.html içinde yüklenir.
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON;
  const PDFJS_VERSION = '3.11.174';
  const WORKER_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  const MAX_CANVAS_PIXELS = 12_000_000;   // mobil GPU güvenli sınırı
  const MAX_CANVAS_DIM = 8192;
  const idle = (cb) => (window.requestIdleCallback ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 30));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').toLocaleLowerCase('tr').normalize('NFC');

  /* ================= PDFEngine ================= */
  class PDFEngine {
    constructor() { this.doc = null; this.cache = new Map(); this.LRU = 24; }
    static get lib() {
      if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi. İlk kullanımda internet bağlantısı gerekir.');
      return window.pdfjsLib;
    }
    async open(buffer) {
      const lib = PDFEngine.lib;
      lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      this.doc = await lib.getDocument({ data: new Uint8Array(buffer.slice ? buffer.slice(0) : buffer), isEvalSupported: false }).promise;
      return this;
    }
    get numPages() { return this.doc ? this.doc.numPages : 0; }
    async getPage(n) {
      if (this.cache.has(n)) {
        const p = this.cache.get(n); this.cache.delete(n); this.cache.set(n, p); return p;
      }
      const p = await this.doc.getPage(n);
      this.cache.set(n, p);
      while (this.cache.size > this.LRU) {
        const [k, old] = this.cache.entries().next().value;
        this.cache.delete(k);
        try { old.cleanup(); } catch {}
      }
      return p;
    }
    // Tüm sayfaların scale:1 ölçüleri (pt) — sanal yer tutucular için
    async sizes(onProgress = () => {}) {
      const out = [];
      for (let n = 1; n <= this.numPages; n++) {
        const vp = (await this.getPage(n)).getViewport({ scale: 1 });
        out.push({ w: vp.width, h: vp.height });
        if (n % 10 === 0) { onProgress(n, this.numPages); await sleep(0); }
      }
      return out;
    }
    clampScale(ptW, ptH, s) {
      const byPix = Math.sqrt(MAX_CANVAS_PIXELS / (ptW * ptH));
      const byDim = MAX_CANVAS_DIM / Math.max(ptW, ptH);
      return Math.max(0.1, Math.min(s, byPix, byDim));
    }
    // Bir sayfanın bir bölgesini (pt cinsinden) verilen ölçekle yeni bir tuvale çiz
    async renderRegion(n, scale, region /* {x,y,w,h} pt */) {
      const page = await this.getPage(n);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(region.w * scale));
      c.height = Math.max(1, Math.ceil(region.h * scale));
      const vp = page.getViewport({ scale, offsetX: -region.x * scale, offsetY: -region.y * scale });
      await page.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp }).promise;
      return c;
    }
    destroy() { try { this.doc && this.doc.destroy(); } catch {} this.doc = null; this.cache.clear(); }
  }
  ON.PDFEngine = PDFEngine;

  /* ================= PDFPageVirtualizer =================
     Tüm sayfalar boş div yer tutucudur. IntersectionObserver (rootMargin 120%)
     ile yalnızca aktif + 1 üst/alt tampon (en fazla 4) sayfaya tuval bağlanır. */
  class PDFPageVirtualizer {
    constructor(engine, opts) {
      this.engine = engine;
      this.o = Object.assign({ maxActive: 4, getZoom: () => 1, onRendered: () => {} }, opts);
      this.entries = new Map();
      this.visible = new Set();
      this.queue = [];
      this.running = false;
      this.frozen = false;
      this.textMode = false;
      this.keep = new Set();
      this.io = new IntersectionObserver(list => {
        for (const e of list) {
          const i = +e.target.dataset.index;
          if (e.isIntersecting) this.visible.add(i); else this.visible.delete(i);
        }
        this.schedule();
      }, { root: this.o.root, rootMargin: '120% 0px' });
    }
    register(index, el, pdfPage, ptW, ptH, worldW) {
      el.dataset.index = index;
      this.entries.set(index, { el, n: pdfPage, ptW, ptH, worldW, canvas: null, task: null, scale: 0, text: null });
      this.io.observe(el);
    }
    clear() {
      this.io.disconnect();
      for (const i of this.entries.keys()) this.detach(i);
      this.entries.clear(); this.visible.clear(); this.queue = []; this.keep.clear();
    }
    desiredScale(e) {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      return this.engine.clampScale(e.ptW, e.ptH, this.o.getZoom() * dpr * (e.worldW / e.ptW));
    }
    schedule(force = false) {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._apply(force); });
    }
    _pick() {
      const rr = this.o.root.getBoundingClientRect(), cy = rr.top + rr.height / 2;
      return [...this.visible].map(i => {
        const r = this.entries.get(i).el.getBoundingClientRect();
        const out = r.bottom < rr.top ? rr.top - r.bottom : r.top > rr.bottom ? r.top - rr.bottom : 0;
        return { i, d: out * 1e3 + Math.abs((r.top + r.bottom) / 2 - cy) };
      }).sort((a, b) => a.d - b.d).slice(0, this.o.maxActive).map(x => x.i);
    }
    _apply() {
      const pick = this._pick();
      this.keep = new Set(pick);
      for (const [i, e] of this.entries) if ((e.canvas || e.task) && !this.keep.has(i)) this.detach(i);
      for (const i of pick) {
        const e = this.entries.get(i);
        const want = this.desiredScale(e);
        const stale = !e.canvas || (!this.frozen && Math.abs(e.scale / want - 1) > 0.2);
        if (stale && !e.task && !this.queue.includes(i)) this.queue.push(i);
        if (this.textMode && !e.text) this.ensureTextLayer(i);
      }
      this.queue.sort((a, b) => pick.indexOf(a) - pick.indexOf(b));
      this._run();
    }
    async _run() {
      if (this.running) return;
      this.running = true;
      while (this.queue.length) {
        const i = this.queue.shift();
        if (!this.keep.has(i)) continue;
        try { await this._render(i); } catch (err) { if (err?.name !== 'RenderingCancelledException') console.warn('PDF sayfa çizimi', err); }
      }
      this.running = false;
    }
    async _render(i) {
      const e = this.entries.get(i);
      if (!e) return;
      const s = this.desiredScale(e);
      const page = await this.engine.getPage(e.n);
      const vp = page.getViewport({ scale: s });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.className = 'pdf-canvas';
      const task = page.render({ canvasContext: c.getContext('2d', { alpha: false }), viewport: vp });
      e.task = task;
      try { await task.promise; }
      catch (err) { c.width = c.height = 0; if (e.task === task) e.task = null; throw err; }
      if (e.task === task) e.task = null;
      if (!this.keep.has(i)) { c.width = c.height = 0; return; }
      const old = e.canvas;
      e.el.insertBefore(c, e.el.firstChild);
      e.canvas = c; e.scale = s;
      if (old) { old.remove(); old.width = old.height = 0; }
      this.o.onRendered(i);
    }
    // Tampon dışına çıkan sayfa: çizimi iptal et, GPU belleğini sıfırla
    detach(i) {
      const e = this.entries.get(i);
      if (!e) return;
      if (e.task) { try { e.task.cancel(); } catch {} e.task = null; }
      if (e.canvas) { e.canvas.width = 0; e.canvas.height = 0; e.canvas.remove(); e.canvas = null; e.scale = 0; }
      this.removeTextLayer(i);
      const q = this.queue.indexOf(i); if (q >= 0) this.queue.splice(q, 1);
    }
    // Yakınlaştırma bitince (180 ms) aktif sayfaları HiDPI netleştir
    refreshResolution() { this.frozen = false; this.schedule(true); }
    setTextMode(on) {
      this.textMode = on;
      for (const [i, e] of this.entries) {
        if (on && (e.canvas || this.keep.has(i))) this.ensureTextLayer(i);
        if (!on) this.removeTextLayer(i);
      }
    }
    async ensureTextLayer(i) {
      const e = this.entries.get(i);
      if (!e || e.text) return;
      const div = document.createElement('div');
      div.className = 'textLayer pdf-text-layer';
      const scale = e.worldW / e.ptW;
      div.style.setProperty('--scale-factor', scale);
      e.text = div;
      e.el.appendChild(div);
      try {
        const page = await this.engine.getPage(e.n);
        const tc = await page.getTextContent();
        if (e.text !== div) return;
        await PDFEngine.lib.renderTextLayer({ textContentSource: tc, container: div, viewport: page.getViewport({ scale }), textDivs: [] }).promise;
      } catch (err) { console.warn('Metin katmanı', err); }
    }
    removeTextLayer(i) {
      const e = this.entries.get(i);
      if (e && e.text) { e.text.remove(); e.text = null; }
    }
  }
  ON.PDFPageVirtualizer = PDFPageVirtualizer;

  /* ================= ThumbnailGenerator =================
     Tek bir 160 px ortak offscreen tuval; görünür sayfalar kuyruğun başına,
     S Pen aktifken duraklar, boşta (requestIdleCallback) çalışır. */
  class ThumbnailGenerator {
    constructor(opts) {
      this.o = Object.assign({ width: 160, isPaused: () => false }, opts); // draw(ctx, canvas, job), getCached(job), store(job, blob)
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.queue = [];
      this.running = false;
      this.generation = 0;
    }
    request(job) {
      const i = this.queue.findIndex(j => j.key === job.key);
      if (i >= 0) this.queue[i] = job; else this.queue.push(job);
      this._kick();
    }
    prioritize(key) {
      const i = this.queue.findIndex(j => j.key === key);
      if (i > 0) this.queue.unshift(this.queue.splice(i, 1)[0]);
    }
    clear() { this.queue = []; this.generation++; }
    _kick() { if (this.running) return; this.running = true; idle(() => this._step()); }
    async _step() {
      if (!this.queue.length) { this.running = false; return; }
      if (this.o.isPaused()) { setTimeout(() => this._step(), 300); return; }
      const job = this.queue.shift(), gen = this.generation;
      try {
        const cached = await this.o.getCached(job);
        if (cached) { if (gen === this.generation) job.onReady(cached); }
        else {
          const W = this.o.width;
          this.canvas.width = W;
          this.canvas.height = Math.max(1, Math.round(W * job.aspect));
          await this.o.draw(this.ctx, this.canvas, job);
          const blob = await new Promise(r => this.canvas.toBlob(r, 'image/jpeg', 0.78));
          if (blob) { await this.o.store(job, blob); if (gen === this.generation) job.onReady(blob); }
        }
      } catch (err) { console.warn('Önizleme', err); }
      idle(() => this._step());
    }
  }
  ON.ThumbnailGenerator = ThumbnailGenerator;

  /* ================= PDFOutlineAndSearch ================= */
  class PDFOutlineAndSearch {
    constructor(engine, hash, opts = {}) {
      this.engine = engine; this.hash = hash;
      this.isPaused = opts.isPaused || (() => false);
      this.mem = new Map();
      this.indexing = false; this.complete = false;
      this.progress = { done: 0, total: engine.numPages };
    }
    async outline() { try { return (await this.engine.doc.getOutline()) || []; } catch { return []; } }
    // Tembel hedef çözümleme → 1 tabanlı PDF sayfa numarası
    async _resolveDestinationPage(dest) {
      try {
        let d = dest;
        if (typeof d === 'string') d = await this.engine.doc.getDestination(d);
        if (!Array.isArray(d)) return null;
        const ref = d[0];
        const idx = typeof ref === 'number' ? ref : await this.engine.doc.getPageIndex(ref);
        return idx + 1;
      } catch { return null; }
    }
    async _compute(n) {
      const lib = PDFEngine.lib;
      const page = await this.engine.getPage(n);
      const tc = await page.getTextContent();
      const vp = page.getViewport({ scale: 1 });
      const items = [];
      let text = '';
      for (const it of tc.items) {
        if (!('str' in it) || !it.str) { if (it.hasEOL) text += '\n'; continue; }
        const tx = lib.Util.transform(vp.transform, it.transform);
        const fh = Math.hypot(tx[2], tx[3]) || 10;
        items.push({ s: it.str, x: +tx[4].toFixed(1), y: +(tx[5] - fh * 0.82).toFixed(1), w: +(it.width || fh * it.str.length * 0.5).toFixed(1), h: +(fh * 1.08).toFixed(1), o: text.length });
        text += it.str + (it.hasEOL ? '\n' : ' ');
      }
      return { text, items };
    }
    async pageText(n) {
      if (this.mem.has(n)) return this.mem.get(n);
      let rec = null;
      try { rec = await ON.Store.get('pdf_text_cache', [this.hash, n]); } catch {}
      if (!rec) {
        const d = await this._compute(n);
        rec = { hash: this.hash, pageIndex: n, text: d.text, items: d.items };
        try { await ON.Store.put('pdf_text_cache', rec); } catch {}
      }
      const out = { text: rec.text, items: rec.items };
      this.mem.set(n, out);
      return out;
    }
    // 5'erli paketler; S Pen aktifken bekler
    async indexAll(onProgress = () => {}) {
      if (this.indexing || this.complete) { onProgress(this.progress.done, this.progress.total); return; }
      this.indexing = true;
      const N = this.engine.numPages;
      for (let start = 1; start <= N; start += 5) {
        while (this.isPaused()) await sleep(250);
        if (!this.engine.doc) break;
        const batch = [];
        for (let n = start; n < start + 5 && n <= N; n++) batch.push(this.pageText(n).catch(() => null));
        await Promise.all(batch);
        this.progress = { done: Math.min(N, start + 4), total: N };
        onProgress(this.progress.done, N);
        await new Promise(r => idle(r));
      }
      this.indexing = false;
      this.complete = !!this.engine.doc;
    }
    search(q, limit = 200) {
      const nq = norm(q).trim();
      if (nq.length < 2) return [];
      const out = [];
      for (const [n, d] of [...this.mem.entries()].sort((a, b) => a[0] - b[0])) {
        const t = norm(d.text);
        let idx = t.indexOf(nq), count = 0, first = -1;
        while (idx >= 0) { if (first < 0) first = idx; count++; idx = t.indexOf(nq, idx + nq.length); }
        if (count) {
          const a = Math.max(0, first - 40), b = Math.min(d.text.length, first + nq.length + 60);
          out.push({ n, count, before: (a > 0 ? '…' : '') + d.text.slice(a, first), match: d.text.slice(first, first + nq.length), after: d.text.slice(first + nq.length, b) + (b < d.text.length ? '…' : '') });
          if (out.length >= limit) break;
        }
      }
      return out;
    }
    // Eşleşen kelimelerin kutuları (pt cinsinden)
    matchBoxes(n, q) {
      const d = this.mem.get(n), nq = norm(q).trim();
      if (!d || !nq) return [];
      const out = [];
      for (const it of d.items) {
        const s = norm(it.s), len = s.length || 1;
        let idx = s.indexOf(nq);
        while (idx >= 0) {
          out.push({ x: it.x + it.w * idx / len, y: it.y, w: Math.max(4, it.w * Math.min(nq.length, len - idx) / len), h: it.h });
          idx = s.indexOf(nq, idx + nq.length);
        }
      }
      return out;
    }
    // Serbest fosforlu vurgunun altındaki metin (koordinat kesişimi, pt)
    async textInRect(n, r) {
      const d = await this.pageText(n);
      const lines = [];
      for (const it of d.items) {
        const top = Math.max(r.y, it.y), bot = Math.min(r.y + r.h, it.y + it.h);
        if (bot - top < it.h * 0.45) continue;
        const x0 = Math.max(r.x, it.x), x1 = Math.min(r.x + r.w, it.x + it.w);
        if (x1 - x0 < 2) continue;
        const len = it.s.length;
        const a = Math.max(0, Math.floor((x0 - it.x) / it.w * len)), b = Math.min(len, Math.ceil((x1 - it.x) / it.w * len));
        const part = it.s.slice(a, b);
        if (!part.trim()) continue;
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.y - it.y) < it.h * 0.5) last.t += (last.t.endsWith(' ') ? '' : ' ') + part;
        else lines.push({ y: it.y, t: part });
      }
      return lines.map(l => l.t.trim()).join(' ').replace(/\s+/g, ' ').trim();
    }
  }
  ON.PDFOutlineAndSearch = PDFOutlineAndSearch;
})();
