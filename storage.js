/* =====================================================================
   Odak Not — storage.js
   Sıkıştırılmış IndexedDB depolama, çizgi kodlayıcı, yedekleme, göç.
   Depolar:
     meta            : anahtar-değer (kütüphane / ayar bayrakları)
     pdfs            : { hash, name, size, blob }   (SHA-256 ile tekilleştirilmiş ham PDF)
     notebooks       : defter kayıtları
     pages           : { notebookId, pageIndex, data, gz, n }  anahtar [notebookId, pageIndex]
     thumbnails      : { notebookId, pageIndex, v, blob }
     pdf_text_cache  : { hash, pageIndex, text, items }
     assets          : { id, notebookId, blob, type }  (eklenen görseller)
   ===================================================================== */
'use strict';
window.ON = window.ON || {};
(() => {
  const ON = window.ON;
  const DB_NAME = 'odak-not';
  const DB_VERSION = 2;

  ON.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);

  /* ---------------- IndexedDB çekirdeği ---------------- */
  let dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        const make = (name, opts, indexes = []) => {
          if (db.objectStoreNames.contains(name)) return;
          const s = db.createObjectStore(name, opts);
          for (const [iname, path] of indexes) s.createIndex(iname, path);
        };
        make('meta');
        make('pdfs', { keyPath: 'hash' });
        make('notebooks', { keyPath: 'id' }, [['folderId', 'folderId']]);
        make('pages', { keyPath: ['notebookId', 'pageIndex'] }, [['notebookId', 'notebookId']]);
        make('thumbnails', { keyPath: ['notebookId', 'pageIndex'] }, [['notebookId', 'notebookId']]);
        make('pdf_text_cache', { keyPath: ['hash', 'pageIndex'] }, [['hash', 'hash']]);
        make('assets', { keyPath: 'id' }, [['notebookId', 'notebookId']]);
        // v1'den kalan 'kv' deposu göç için korunur
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Veritabanı başka bir sekmede açık. Diğer sekmeleri kapatıp yenileyin.'));
    });
    return dbPromise;
  }
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  async function tx(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let out;
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('İşlem iptal edildi'));
      const r = fn(t);
      if (r && typeof r.then === 'function') r.then(v => { out = v; }, reject);
      else out = r;
    });
  }

  const Store = {
    open,
    get: (store, key) => tx([store], 'readonly', t => wrap(t.objectStore(store).get(key))),
    put: (store, value, key) => tx([store], 'readwrite', t => { t.objectStore(store).put(value, key); }),
    del: (store, key) => tx([store], 'readwrite', t => { t.objectStore(store).delete(key); }),
    all: (store, index, query) => tx([store], 'readonly', t => {
      const s = t.objectStore(store);
      return wrap(index ? s.index(index).getAll(query) : s.getAll(query));
    }),
    allKeys: (store) => tx([store], 'readonly', t => wrap(t.objectStore(store).getAllKeys())),
    delByIndex: (store, index, value) => tx([store], 'readwrite', t => new Promise((res, rej) => {
      const r = t.objectStore(store).index(index).openCursor(IDBKeyRange.only(value));
      r.onsuccess = () => { const c = r.result; if (c) { c.delete(); c.continue(); } else res(); };
      r.onerror = () => rej(r.error);
    })),
    putMany: (store, values) => tx([store], 'readwrite', t => { const s = t.objectStore(store); for (const v of values) s.put(v); }),
    has: async (store) => (await open()).objectStoreNames.contains(store),
    meta: {
      get: key => Store.get('meta', key),
      set: (key, val) => Store.put('meta', val, key)
    }
  };
  ON.Store = Store;

  /* ---------------- Sıkıştırma ---------------- */
  const canGzip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function gzip(u8) {
    if (!canGzip) return { gz: false, data: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) };
    const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
    return { gz: true, data: await new Response(stream).arrayBuffer() };
  }
  async function gunzip(buf, gz) {
    if (!gz) return new Uint8Array(buf);
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  ON.gzip = gzip; ON.gunzip = gunzip;

  /* ---------------- Ramer–Douglas–Peucker (stride = 3) ---------------- */
  function rdp(pts, epsilon = 0.3) {
    const n = pts.length / 3;
    if (n < 3) return pts;
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const e2 = epsilon * epsilon;
    const stack = [0, n - 1];
    while (stack.length) {
      const e = stack.pop(), s = stack.pop();
      const ax = pts[s * 3], ay = pts[s * 3 + 1], bx = pts[e * 3], by = pts[e * 3 + 1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      let max = 0, idx = -1;
      for (let i = s + 1; i < e; i++) {
        const px = pts[i * 3], py = pts[i * 3 + 1];
        let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx - px, qy = ay + t * dy - py, d = qx * qx + qy * qy;
        if (d > max) { max = d; idx = i; }
      }
      if (max > e2 && idx > 0) { keep[idx] = 1; stack.push(s, idx, idx, e); }
    }
    let k = 0;
    for (let i = 0; i < n; i++) k += keep[i];
    const out = new Float32Array(k * 3);
    for (let i = 0, j = 0; i < n; i++) if (keep[i]) { out[j++] = pts[i * 3]; out[j++] = pts[i * 3 + 1]; out[j++] = pts[i * 3 + 2]; }
    return out;
  }
  ON.rdp = rdp;

  /* ---------------- Çizgi kodlayıcı ----------------
     [u32 başlık uzunluğu][başlık JSON (utf8)][hizalama][Float32 noktalar (sayfa-yerel)] → gzip */
  const enc = new TextEncoder(), dec = new TextDecoder();
  async function encodeStrokes(strokes, ox, oy) {
    let total = 0;
    const meta = strokes.map(s => {
      total += s.pts.length;
      const m = { i: s.id, t: s.tool, c: s.color, z: +s.size.toFixed(2), n: s.pts.length / 3 };
      if (s.shape) m.sh = s.shape;
      if (s.flat) m.f = 1;
      if (s.text) m.tx = s.text;
      if (s.grp) m.g = s.grp;
      return m;
    });
    const head = enc.encode(JSON.stringify({ v: 2, s: meta }));
    const pad = (4 - ((4 + head.length) % 4)) % 4;
    const buf = new ArrayBuffer(4 + head.length + pad + total * 4);
    new DataView(buf).setUint32(0, head.length, true);
    new Uint8Array(buf, 4, head.length).set(head);
    const f = new Float32Array(buf, 4 + head.length + pad, total);
    let o = 0;
    for (const s of strokes) {
      const p = s.pts;
      for (let i = 0; i < p.length; i += 3) { f[o++] = p[i] - ox; f[o++] = p[i + 1] - oy; f[o++] = p[i + 2]; }
    }
    return gzip(new Uint8Array(buf));
  }
  async function decodeStrokes(rec, ox, oy) {
    if (!rec || !rec.data) return [];
    const u8 = await gunzip(rec.data, rec.gz);
    const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const hl = new DataView(buf).getUint32(0, true);
    const head = JSON.parse(dec.decode(new Uint8Array(buf, 4, hl)));
    const pad = (4 - ((4 + hl) % 4)) % 4;
    const all = new Float32Array(buf, 4 + hl + pad);
    const out = [];
    let o = 0;
    for (const m of head.s) {
      const len = m.n * 3, pts = new Float32Array(len);
      for (let i = 0; i < len; i += 3) { pts[i] = all[o + i] + ox; pts[i + 1] = all[o + i + 1] + oy; pts[i + 2] = all[o + i + 2]; }
      o += len;
      out.push({ id: m.i, tool: m.t, color: m.c, size: m.z, pts, shape: m.sh || null, flat: !!m.f, text: m.tx || '', grp: m.g || '' });
    }
    return out;
  }
  ON.encodeStrokes = encodeStrokes;
  ON.decodeStrokes = decodeStrokes;

  /* ---------------- SHA-256 ---------------- */
  ON.sha256 = async (buf) => {
    if (crypto && crypto.subtle) {
      const h = await crypto.subtle.digest('SHA-256', buf);
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Güvenli olmayan bağlamda (http) basit yedek özet
    let h1 = 0x811c9dc5, u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i++) { h1 ^= u8[i]; h1 = Math.imul(h1, 16777619); }
    return 'fnv-' + (h1 >>> 0).toString(16) + '-' + u8.length;
  };

  /* ---------------- Kalıcı depolama, kota, temizlik ---------------- */
  ON.storageInfo = async () => {
    const out = { usage: 0, quota: 0, persisted: false };
    try { if (navigator.storage?.estimate) Object.assign(out, await navigator.storage.estimate()); } catch {}
    try { if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted(); } catch {}
    return out;
  };
  ON.requestPersist = async () => {
    try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch {}
    return false;
  };
  ON.cleanupOrphans = async () => {
    const nbs = await Store.all('notebooks');
    const used = new Set(nbs.map(n => n.pdfHash).filter(Boolean));
    const ids = new Set(nbs.map(n => n.id));
    let removed = 0, freed = 0;
    for (const p of await Store.all('pdfs')) {
      if (!used.has(p.hash)) {
        freed += p.size || 0; removed++;
        await Store.del('pdfs', p.hash);
        await Store.delByIndex('pdf_text_cache', 'hash', p.hash);
      }
    }
    for (const a of await Store.all('assets')) {
      if (!ids.has(a.notebookId)) { freed += a.blob?.size || 0; removed++; await Store.del('assets', a.id); }
    }
    for (const k of await Store.allKeys('thumbnails')) if (!ids.has(k[0])) await Store.del('thumbnails', k);
    for (const k of await Store.allKeys('pages')) if (!ids.has(k[0])) await Store.del('pages', k);
    return { removed, freed };
  };

  /* ---------------- Yedekleme (.odaknot) ---------------- */
  function b64FromBuf(buf) {
    const u8 = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function bufFromB64(b64) {
    const s = atob(b64), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8.buffer;
  }
  async function toPlain(v) {
    if (v instanceof Blob) return { __blob: b64FromBuf(await v.arrayBuffer()), type: v.type };
    if (v instanceof ArrayBuffer) return { __buf: b64FromBuf(v) };
    if (ArrayBuffer.isView(v)) return { __buf: b64FromBuf(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) };
    if (Array.isArray(v)) { const a = []; for (const x of v) a.push(await toPlain(x)); return a; }
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await toPlain(v[k]); return o; }
    return v;
  }
  function fromPlain(v) {
    if (Array.isArray(v)) return v.map(fromPlain);
    if (v && typeof v === 'object') {
      if ('__blob' in v) return new Blob([bufFromB64(v.__blob)], { type: v.type || '' });
      if ('__buf' in v) return bufFromB64(v.__buf);
      const o = {}; for (const k of Object.keys(v)) o[k] = fromPlain(v[k]); return o;
    }
    return v;
  }
  ON.exportBackup = async (onProgress = () => {}) => {
    const out = { app: 'odak-not', version: 2, created: Date.now(), library: await Store.meta.get('library') };
    for (const name of ['notebooks', 'pages', 'pdfs', 'assets']) {
      onProgress(`${name} hazırlanıyor…`);
      out[name] = await toPlain(await Store.all(name));
    }
    onProgress('Sıkıştırılıyor…');
    const { data } = await gzip(enc.encode(JSON.stringify(out)));
    return new Blob([data], { type: 'application/octet-stream' });
  };
  ON.importBackup = async (file, onProgress = () => {}) => {
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const isGz = u8[0] === 0x1f && u8[1] === 0x8b;
    onProgress('Açılıyor…');
    const json = JSON.parse(dec.decode(await gunzip(buf, isGz)));
    if (json.app !== 'odak-not') throw new Error('Bu bir Odak Not yedeği değil.');
    const data = fromPlain(json);
    const lib = (await Store.meta.get('library')) || { folders: [] };
    for (const f of (data.library?.folders || [])) if (!lib.folders.some(x => x.id === f.id)) lib.folders.push(f);
    await Store.meta.set('library', lib);
    for (const name of ['pdfs', 'assets', 'pages', 'notebooks']) {
      onProgress(`${name} yükleniyor…`);
      if (data[name]?.length) await Store.putMany(name, data[name]);
    }
    return { notebooks: data.notebooks?.length || 0 };
  };

  /* ---------------- v1 → v2 göçü ----------------
     v1: 'kv' deposunda 'index' (klasör+not listesi), 'note:<id>' {strokes:[{color,w,hl,pts:[[x,y,p]]}], bg}, 'pages:<id>' [JPEG sayfalar] */
  ON.migrateV1 = async () => {
    if (!(await Store.has('kv'))) return 0;
    if (await Store.meta.get('migratedV1')) return 0;
    const kvGet = key => tx(['kv'], 'readonly', t => wrap(t.objectStore('kv').get(key)));
    const index = await kvGet('index');
    if (!index || !index.notes) { await Store.meta.set('migratedV1', true); return 0; }
    const lib = (await Store.meta.get('library')) || { folders: [] };
    for (const f of index.folders || []) if (!lib.folders.some(x => x.id === f.id)) lib.folders.push({ id: f.id, name: f.name, created: Date.now() });
    await Store.meta.set('library', lib);
    let count = 0;
    for (const n of index.notes) {
      const d = (await kvGet('note:' + n.id)) || { strokes: [] };
      const oldPages = (await kvGet('pages:' + n.id)) || [];
      const nb = ON.newNotebookRecord({
        id: n.id, folderId: n.folderId, title: n.title || 'Adsız not',
        mode: 'infinite',
        paper: { template: d.bg === 'dots' ? 'dots' : d.bg === 'plain' ? 'plain' : 'grid', theme: 'dark', orient: 'p' }
      });
      nb.updated = n.updated || Date.now();
      for (const p of oldPages) {
        const blob = await (await fetch(p.src)).blob();
        const id = ON.uid();
        await Store.put('assets', { id, notebookId: nb.id, blob, type: 'image' });
        nb.objects.push({ id: ON.uid(), type: 'image', page: 0, asset: id, x: p.x, y: p.y, w: p.w, h: p.h });
      }
      const strokes = (d.strokes || []).map(s => {
        const pts = new Float32Array(s.pts.length * 3);
        s.pts.forEach((q, i) => { pts[i * 3] = q[0]; pts[i * 3 + 1] = q[1]; pts[i * 3 + 2] = q[2] ?? 0.5; });
        return { id: s.id || ON.uid(), tool: s.hl ? 'highlighter' : 'fountain', color: s.hl ? '#C7B3FF' : s.color, size: s.hl ? 18 : s.w, pts };
      });
      const enc0 = await encodeStrokes(strokes, 0, 0);
      await Store.put('pages', { notebookId: nb.id, pageIndex: 0, data: enc0.data, gz: enc0.gz, n: strokes.length });
      await Store.put('notebooks', nb);
      count++;
    }
    await Store.meta.set('migratedV1', true);
    return count;
  };

  /* ---------------- Defter kaydı fabrikası ---------------- */
  ON.A4 = { w: 794, h: 1123 };
  ON.newNotebookRecord = (o = {}) => {
    const mode = o.mode || 'paged';
    const paper = Object.assign({ template: 'grid', theme: 'dark', orient: 'p' }, o.paper || {});
    const pw = paper.orient === 'l' ? ON.A4.h : ON.A4.w, ph = paper.orient === 'l' ? ON.A4.w : ON.A4.h;
    return {
      id: o.id || ON.uid(),
      folderId: o.folderId || null,
      title: o.title || 'Adsız defter',
      created: Date.now(), updated: Date.now(),
      mode, paper,
      pdfHash: o.pdfHash || null, pdfName: o.pdfName || '', pdfDark: !!o.pdfDark,
      pages: o.pages || (mode === 'infinite' ? [{ k: 'inf', w: 0, h: 0, v: 0 }] : [{ k: 'paper', w: pw, h: ph, v: 0 }]),
      objects: [], cards: [],
      last: null, view: null
    };
  };
})();
