/* =====================================================================
   Odak Not — ai-study.js (Obsidian Studio & Smart Fallback Edition)
   Gemini istemcisi (yeniden deneme + çoklu yedek model), Asistan paneli,
   Markdown + KaTeX, StickyCardManager (yapışkan kartlar),
   StudyGuideBuilder (çalışma özeti + sınav soruları).
   API anahtarı koda gömülmez; kullanıcı arayüzden girer (localStorage).
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ON.esc = esc;

  /* ================= Ayarlar (localStorage) ================= */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  ON.LS = LS;
  ON.settings = Object.assign({ key: '', model: 'gemini-2.5-flash', custom: '', fingerDraw: false, minimap: true }, LS.get('on-settings', {}));
  // Geçersiz eski varsayılan model (3.8 / 3.5 vb.) kayıtlı kaldıysa çalışan modele çek
  if (!ON.settings.model || /^gemini-3\./.test(ON.settings.model)) {
    ON.settings.model = 'gemini-2.5-flash';
    LS.set('on-settings', ON.settings);
  }
  ON.saveSettings = () => LS.set('on-settings', ON.settings);

  /* ================= Markdown + KaTeX ================= */
  ON.md = (t) => {
    const blocks = [];
    t = String(t || '').replace(/\$\$[\s\S]+?\$\$/g, m => `\u0000${blocks.push(m) - 1}\u0000`);
    const h = esc(t)
      .replace(/^#{3,6} (.*)$/gm, '<h4>$1</h4>').replace(/^#{1,2} (.*)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/`([^`$]+)`/g, '<code>$1</code>')
      .replace(/^\s*(?:[-*]|\d+\.) (.*)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
      .split(/\n{2,}/).map(p => /^\s*<(h\d|ul)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    return h.replace(/\u0000(\d+)\u0000/g, (_, i) => esc(blocks[i]));
  };
  ON.renderMath = (el) => {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
          throwOnError: false
        });
      } catch {}
    }
  };
  ON.mdInto = (el, text) => { el.innerHTML = ON.md(text); ON.renderMath(el); };

  /* ================= Gemini istemcisi ================= */
  const SYS = `Sen mühendislik ve sayısal dersler için sabırlı bir öğretmen asistanısın. Kullanıcı DEHB'li bir üniversite öğrencisi.
Kurallar: Türkçe yaz. Kısa paragraflar, numaralı adımlar; her adımda tek fikir. Tüm matematiği LaTeX ile yaz:
satır içi $...$, blok $$...$$. Giriş/kapanış cümlesi yazma. Emin olmadığın el yazısı kısımları [?] ile işaretle.`;
  const API = 'https://generativelanguage.googleapis.com/v1beta/';
  const RETRY = new Set([500, 502, 503, 504]);
  const STATIC_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const detail = (status, msg) => msg ? `\n\nAyrıntı (${status}): ${msg.slice(0, 200)}` : ` (kod ${status})`;
  function friendly(status, msg) {
    if (status === 400 && /API key|API_KEY/i.test(msg)) return 'API anahtarı geçersiz görünüyor. AI Studio\'dan kopyalarken eksik kalmış olabilir.';
    if (status === 403) return 'Anahtarın bu API\'ye izni yok. AI Studio\'da yeni bir anahtar oluşturmayı dene.';
    if (status === 429) return 'Ücretsiz kota doldu ya da çok hızlı istek gitti. Yedek modeller de denendi; 1 dakika bekleyip tekrar dene.' + detail(status, msg);
    if (status === 503 || /overloaded|UNAVAILABLE|high demand/i.test(msg)) return 'Gemini şu an çok yoğun; denemeler ve yedek model de yanıt vermedi. 1-2 dakika sonra tekrar dene.' + detail(status, msg);
    if (status >= 500) return 'Google tarafında geçici bir hata oluştu; otomatik denemeler de başarısız oldu.' + detail(status, msg);
    return `Hata (${status}): ${msg}`;
  }
  function diagnose() {
    let framed = false; try { framed = window.self !== window.top; } catch { framed = true; }
    if (!navigator.onLine) return 'Cihaz çevrimdışı görünüyor. İnternete bağlanıp tekrar dene.';
    if (framed) return 'Uygulama bir önizleme penceresinin içinde açılmış; önizlemeler internete çıkışı engeller. Siteyi Chrome\'da kendi sekmesinde aç.';
    if (/^(file|content):$/.test(location.protocol)) return 'Dosya doğrudan cihazdan açılmış. Siteyi GitHub Pages linkinden aç.';
    return 'Google\'a ulaşılamadı. Reklam engelleyici, VPN veya okul/iş ağı generativelanguage.googleapis.com adresini engelliyor olabilir.';
  }
  let modelCache = null;
  async function listModels(key) {
    if (modelCache) return modelCache;
    try {
      const r = await fetch(API + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return STATIC_FALLBACKS;
      const names = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(n => /^gemini-/.test(n) && !/(tts|image|live|audio|embedding|robotics|computer|transcribe|translate)/.test(n));
      const score = n => (/flash/.test(n) ? 1000 : 0) + (/lite/.test(n) ? 150 : 0) - (/preview|exp/.test(n) ? 50 : 0) + (parseFloat(n.slice(7)) || 0);
      names.sort((a, b) => score(b) - score(a));
      const merged = [...new Set([...STATIC_FALLBACKS, ...names])];
      return (modelCache = merged);
    } catch {
      return STATIC_FALLBACKS;
    }
  }
  ON.gemini = async (s, parts, onStatus = () => {}) => {
    let viaQuery = false;
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2 } });
    const call = model => fetch(`${API}models/${encodeURIComponent(model)}:generateContent` + (viaQuery ? `?key=${encodeURIComponent(s.key)}` : ''), {
      method: 'POST',
      headers: viaQuery ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json', 'x-goog-api-key': s.key },
      body
    });
    const send = async model => {
      try { return await call(model); }
      catch {
        if (viaQuery) throw new Error(diagnose());
        viaQuery = true;
        try { return await call(model); } catch { throw new Error(diagnose()); }
      }
    };
    const first = s.custom || s.model, tried = new Set();
    let model = first, r = null, j = {}, swaps = 0, gone = false;
    while (true) {
      tried.add(model);
      const maxAttempts = swaps === 0 ? 2 : 1;
      for (let a = 0; a < maxAttempts; a++) {
        if (a) { onStatus(`Gemini yoğun, tekrar deneniyor (${a + 1}/${maxAttempts})…`); await sleep(1200 + Math.random() * 400); }
        r = await send(model);
        if (r.ok || !RETRY.has(r.status)) break;
      }
      if (r.ok) break;
      j = await r.json().catch(() => ({}));
      const canSwap = r.status === 404 || r.status === 429 || RETRY.has(r.status);
      if (!canSwap || swaps >= 3) break;
      if (r.status === 404) gone = true;
      const candidates = await listModels(s.key);
      const next = candidates.find(n => !tried.has(n));
      if (!next) break;
      onStatus(`${model} kotaya takıldı/yanıt vermedi, ${next} deneniyor…`);
      model = next; swaps++;
    }
    if (!r.ok) { if (!j.error) j = await r.json().catch(() => ({})); throw new Error(friendly(r.status, j.error?.message || '')); }
    const res = await r.json().catch(() => ({}));
    if (gone && model !== first && !s.custom) { s.model = model; ON.saveSettings(); }
    const cand = res.candidates?.[0];
    if (!cand) throw new Error('Yanıt engellendi ya da boş döndü' + (res.promptFeedback?.blockReason ? ` (${res.promptFeedback.blockReason})` : '') + '.');
    const text = (cand.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text && cand.finishReason && cand.finishReason !== 'STOP') throw new Error(`Yanıt tamamlanamadı (${cand.finishReason}). Tekrar dene.`);
    return { model, text };
  };

  /* ================= Asistan paneli ================= */
  const ACTIONS = [
    { id: 'ocr', t: 'Dijitale çevir', d: 'El yazısı → metin + LaTeX', p: 'Bu görüntüdeki el yazısını ve metni birebir dijital metne çevir. Başlıkları ### ile, formülleri LaTeX ile yaz. Yorum ekleme.' },
    { id: 'check', t: 'Çözümü kontrol et', d: 'Hatalı adımı bul', p: 'Bu görüntüdeki çözümü adım adım kontrol et. İlk hatalı adımı açıkça belirt, nedenini 1-2 cümleyle açıkla, doğrusunu göster. Hata yoksa "Çözüm doğru" de ve kısa doğrulama ver.' },
    { id: 'steps', t: 'Adım adım çöz', d: 'Soruyu baştan çöz', p: 'Görüntüdeki soruyu/problemi tespit et ve numaralı, küçük adımlarla çöz. En sonda sonucu $\\boxed{}$ içinde ver.' },
    { id: 'sum', t: 'Özet + kavramlar', d: '5 madde, ezber kartı', p: 'Bu içeriği en fazla 5 maddelik bir özet ve altında "Anahtar formüller" listesi olarak çıkar. Sonuna 2 kısa kendini test et sorusu ekle (cevaplar en altta).' }
  ];
  const TEXT_PROMPTS = {
    translate: t => `Aşağıdaki metni akıcı ve teknik terimleri doğru kullanan bir Türkçeye çevir. Formülleri LaTeX ile koru. Sadece çeviriyi yaz.\n\n"""${t}"""`,
    summarize: t => `Aşağıdaki metni en fazla 4 madde halinde Türkçe özetle. Kritik formül varsa LaTeX ile ekle.\n\n"""${t}"""`,
    explain: t => `Aşağıdaki metni bir mühendislik öğrencisine adım adım açıkla. Gerekli tüm matematiği LaTeX ile yaz, bir de küçük örnek ver.\n\n"""${t}"""`
  };

  const AI = {
    ctx: null, lastText: '', lastAnchor: null, busy: false,
    init() {
      $('acts').innerHTML = ACTIONS.map(a => `<button class="act" data-a="${a.id}"><b>${a.t}</b><span>${a.d}</span></button>`).join('');
      $('acts').onclick = e => { const b = e.target.closest('[data-a]'); if (b) this.runImage(ACTIONS.find(a => a.id === b.dataset.a).p, b); };
      $('ask').onsubmit = e => {
        e.preventDefault();
        const q = $('askIn').value.trim(); if (!q) return;
        if (this.ctx && this.ctx.text) this.runText(`${q}\n\nBağlam:\n"""${this.ctx.text}"""`);
        else this.runImage(q, null);
      };
      $('aiClose').onclick = () => this.close();
      $('aiCtxClear').onclick = () => this.setContext(null);
      $('copyOut').onclick = async () => {
        try { await navigator.clipboard.writeText(this.lastText); ON.app.toast('Kopyalandı'); } catch { ON.app.toast('Kopyalanamadı'); }
      };
      $('pinOut').onclick = () => {
        if (!this.lastText) return;
        ON.cards.create(this.lastText, this.lastAnchor || ON.app.viewAnchor());
        ON.app.toast('Kart tuvale sabitlendi');
      };
      this.setContext(null);
    },
    open() { ON.app.closePanelsExcept('ai'); $('ai').classList.add('on'); },
    close() { $('ai').classList.remove('on'); },
    toggle() { $('ai').classList.contains('on') ? this.close() : this.open(); },
    // ctx: { b64, mime, label, anchor, url } (görsel) veya { text, label, anchor }
    setContext(ctx) {
      if (this.ctx?.url) URL.revokeObjectURL(this.ctx.url);
      this.ctx = ctx;
      const box = $('aiCtx');
      if (!ctx) { box.hidden = true; $('aiCtxLbl').textContent = ''; $('acts').classList.remove('dim'); return; }
      box.hidden = false;
      $('aiCtxLbl').textContent = ctx.label;
      const img = $('aiCtxImg');
      if (ctx.url) { img.src = ctx.url; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
      $('acts').classList.toggle('dim', !!ctx.text);
    },
    status(t) { $('out').innerHTML = `<p class="hint"><span class="dots"><i></i><i></i><i></i></span> ${esc(t)}</p>`; },
    async _guard() {
      if (!ON.settings.key) {
        $('out').innerHTML = `<p class="hint">Önce Ayarlar'dan Gemini API anahtarını ekle.</p>`;
        ON.app.openSettings(); return false;
      }
      if (this.busy) return false;
      return true;
    },
    async runImage(prompt, btn) {
      if (!(await this._guard())) return;
      this.open();
      document.querySelectorAll('.act').forEach(b => b.classList.toggle('on', b === btn));
      this.busy = true;
      try {
        let ctx = this.ctx && !this.ctx.text ? this.ctx : null;
        if (!ctx) {
          this.status('Sayfa hazırlanıyor…');
          ctx = await ON.app.contextImage();
          if (!ctx) { $('out').innerHTML = `<p class="hint">Sayfa boş — önce bir şeyler yaz.</p>`; return; }
        }
        this.status('Gemini okuyor…');
        const res = await ON.gemini(ON.settings, [{ inline_data: { mime_type: ctx.mime, data: ctx.b64 } }, { text: `Defter: ${ON.app.nb?.title || ''}\n\n${prompt}` }], t => this.status(t));
        this.show(res.text, ctx.anchor);
      } catch (err) { this.error(err); }
      finally { this.busy = false; }
    },
    async runText(prompt, anchor) {
      if (!(await this._guard())) return;
      this.open();
      this.busy = true;
      try {
        this.status('Gemini düşünüyor…');
        const res = await ON.gemini(ON.settings, [{ text: prompt }], t => this.status(t));
        this.show(res.text, anchor || this.ctx?.anchor);
      } catch (err) { this.error(err); }
      finally { this.busy = false; }
    },
    textAction(kind, text, anchor) {
      this.setContext({ text, label: `Seçili metin: “${text.slice(0, 60)}${text.length > 60 ? '…' : ''}”`, anchor });
      this.runText(TEXT_PROMPTS[kind](text), anchor);
    },
    show(text, anchor) {
      this.lastText = text || 'Boş yanıt döndü.';
      this.lastAnchor = anchor || null;
      ON.mdInto($('out'), this.lastText);
      $('outActs').hidden = false;
    },
    error(err) {
      $('out').innerHTML = `<p class="hint" style="white-space:pre-line">${esc(err.message || err)}</p>`;
      $('outActs').hidden = true;
    }
  };
  ON.AI = AI;

  /* ================= StickyCardManager ================= */
  const CARD_THEMES = ['krem', 'nane', 'gokyuzu', 'koyu'];
  const CARD_THEME_NAMES = { krem: 'Krem', nane: 'Nane', gokyuzu: 'Gökyüzü', koyu: 'Koyu' };
  class StickyCardManager {
    constructor(container) { this.el = container; this.nodes = new Map(); }
    get list() { return ON.app.nb ? ON.app.nb.cards : []; }
    titleOf(md) {
      const h = (md.match(/^#{1,6}\s+(.+)$/m) || [])[1];
      return (h || md.replace(/[#*$`>\\]/g, '').trim().split('\n')[0] || 'Asistan notu').slice(0, 48);
    }
    create(md, anchor) {
      const a = anchor || ON.app.viewAnchor();
      const L = ON.app.pageOrigin(a.page), w = 340;
      let x = a.x + 16;
      // Sayfalı düzende kart sayfanın içinde kalsın (dışa aktarmada kesilmesin)
      if (L.w) x = Math.max(8, Math.min(x, L.w - w - 8));
      const y = L.h ? Math.max(8, Math.min(a.y, L.h - 268)) : a.y;
      const card = { id: ON.uid(), page: a.page, x, y, w, h: 260, collapsed: false, theme: 'krem', title: this.titleOf(md), md, created: Date.now() };
      this.list.push(card);
      this.renderOne(card);
      ON.app.markMetaDirty();
      return card;
    }
    clear() { this.el.innerHTML = ''; this.nodes.clear(); }
    renderAll() { this.clear(); for (const c of this.list) this.renderOne(c); }
    layout() {
      for (const c of this.list) {
        const n = this.nodes.get(c.id); if (!n) continue;
        const o = ON.app.pageOrigin(c.page);
        n.style.left = (o.x + c.x) + 'px'; n.style.top = (o.y + c.y) + 'px';
        n.style.width = c.w + 'px'; n.style.height = c.collapsed ? '' : c.h + 'px';
      }
    }
    renderOne(c) {
      const n = document.createElement('div');
      n.className = `snote t-${c.theme}${c.collapsed ? ' folded' : ''}`;
      n.dataset.ui = '1'; n.dataset.id = c.id;
      n.innerHTML = `<div class="snote-h"><span class="snote-grip" aria-hidden="true"></span><b class="snote-t">${esc(c.title)}</b>
        <button data-act="theme" title="Tema: ${CARD_THEME_NAMES[c.theme]}"><i class="swatch"></i></button>
        <button data-act="fold" title="${c.collapsed ? 'Aç' : 'Katla'}"><svg viewBox="0 0 24 24"><path d="${c.collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}"/></svg></button>
        <button data-act="del" title="Kartı sil"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="snote-b"></div><div class="snote-rz" title="Boyutlandır"></div>`;
      ON.mdInto(n.querySelector('.snote-b'), c.md);
      this.el.appendChild(n);
      this.nodes.set(c.id, n);
      this.bind(n, c);
      this.layout();
    }
    bind(n, c) {
      const drag = (el, onMove) => {
        el.addEventListener('pointerdown', e => {
          if (e.target.closest('button')) return;
          e.preventDefault(); e.stopPropagation();
          el.setPointerCapture(e.pointerId);
          const z = ON.app.cam.z, sx = e.clientX, sy = e.clientY, start = { x: c.x, y: c.y, w: c.w, h: c.h };
          const mv = ev => { onMove(start, (ev.clientX - sx) / z, (ev.clientY - sy) / z); this.layout(); };
          const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); ON.app.markMetaDirty(); };
          el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
        });
      };
      drag(n.querySelector('.snote-h'), (s, dx, dy) => { c.x = s.x + dx; c.y = s.y + dy; });
      drag(n.querySelector('.snote-rz'), (s, dx, dy) => { c.w = Math.max(200, s.w + dx); c.h = Math.max(120, s.h + dy); });
      n.querySelector('.snote-h').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'theme') { c.theme = CARD_THEMES[(CARD_THEMES.indexOf(c.theme) + 1) % CARD_THEMES.length]; }
        if (b.dataset.act === 'fold') c.collapsed = !c.collapsed;
        if (b.dataset.act === 'del') {
          ON.app.confirm('Kart silinsin mi?', 'Bu yapışkan kart defterden kaldırılır.', 'Sil').then(ok => {
            if (!ok) return;
            const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1);
            n.remove(); this.nodes.delete(c.id); ON.app.markMetaDirty();
          });
          return;
        }
        n.remove(); this.nodes.delete(c.id); this.renderOne(c); ON.app.markMetaDirty();
      });
      n.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
    }
    // Dışa aktarma için kartı düz (dönüşümsüz) bir kopyada tuvale çevir
    async rasterize(c, scale) {
      const n = this.nodes.get(c.id);
      const clone = document.createElement('div');
      clone.className = `snote t-${c.theme}${c.collapsed ? ' folded' : ''} snote-export`;
      clone.innerHTML = n ? n.innerHTML : `<div class="snote-h"><b class="snote-t">${esc(c.title)}</b></div><div class="snote-b"></div>`;
      if (!n) ON.mdInto(clone.querySelector('.snote-b'), c.md);
      clone.querySelectorAll('button,.snote-rz').forEach(b => b.remove());
      Object.assign(clone.style, { position: 'fixed', left: '-10000px', top: '0', width: c.w + 'px', height: c.collapsed ? 'auto' : c.h + 'px' });
      document.body.appendChild(clone);
      try {
        if (window.html2canvas) return await window.html2canvas(clone, { scale, backgroundColor: null, logging: false });
        return null;
      } catch { return null; }
      finally { clone.remove(); }
    }
  }
  ON.StickyCardManager = StickyCardManager;
  ON.CARD_COLORS = { krem: ['#FFF8E7', '#1E293B'], nane: ['#E2F7EE', '#0F2E24'], gokyuzu: ['#E0EFFF', '#102542'], koyu: ['#131926', '#F1F5F9'] };

  /* ================= StudyGuideBuilder ================= */
  const HL_NAMES = { '#FFE45C': 'Sarı', '#8EF0A6': 'Yeşil', '#FF9ECF': 'Pembe', '#8FD3FF': 'Mavi', '#C7B3FF': 'Mor' };
  class StudyGuideBuilder {
    constructor() { this.items = []; this.filter = { type: 'all', color: 'all' }; this.quiz = ''; }
    async collect() {
      const app = ON.app, nb = app.nb, out = [];
      for (let i = 0; i < nb.pages.length; i++) {
        const strokes = app.pageStrokes(i).filter(s => s.tool === 'highlighter' && s.pts);
        const groups = new Map();
        for (const s of strokes) {
          const key = s.grp || s.id;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(s);
        }
        const o = app.pageOrigin(i);
        for (const list of groups.values()) {
          const bb = list.reduce((a, s) => ON.Geo.union(a, s.bbox), null);
          let text = list.find(s => s.text)?.text || '';
          if (!text && nb.pages[i].k === 'pdf' && app.search) {
            const sc = app.pdfScale(i), parts = [];
            for (const s of list.slice().sort((a, b) => a.bbox.minY - b.bbox.minY)) {
              const r = { x: (s.bbox.minX - o.x) / sc, y: (s.bbox.minY - o.y) / sc, w: (s.bbox.maxX - s.bbox.minX) / sc, h: (s.bbox.maxY - s.bbox.minY) / sc };
              try { const t = await app.search.textInRect(nb.pages[i].n, r); if (t) parts.push(t); } catch {}
            }
            text = parts.join(' ');
          }
          out.push({ type: 'hl', page: i, color: list[0].color, text, x: bb.minX - o.x, y: bb.minY - o.y });
        }
      }
      for (const c of nb.cards) out.push({ type: 'card', page: c.page, color: c.theme, text: c.md, title: c.title, x: c.x, y: c.y, id: c.id });
      out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
      this.items = out;
      return out;
    }
    filtered() {
      return this.items.filter(it => (this.filter.type === 'all' || it.type === this.filter.type) && (this.filter.color === 'all' || it.color === this.filter.color));
    }
    toMarkdown(list = this.filtered()) {
      const nb = ON.app.nb;
      let md = `# ${nb.title} — Çalışma Özeti\n`;
      let page = -1;
      for (const it of list) {
        if (it.page !== page) { page = it.page; md += `\n## Sayfa ${page + 1}\n`; }
        if (it.type === 'hl') md += `- ${it.text ? it.text : '(el yazısı vurgu)'}${HL_NAMES[it.color] ? ` _(${HL_NAMES[it.color]})_` : ''}\n`;
        else md += `\n> **Kart: ${it.title}**\n>\n> ${it.text.replace(/\n/g, '\n> ')}\n\n`;
      }
      return md;
    }
    async open() {
      ON.app.openModal('studyDlg');
      $('sgList').innerHTML = `<p class="hint">Vurgular ve kartlar toplanıyor…</p>`;
      $('sgQuiz').hidden = true;
      await this.collect();
      this.renderFilters();
      this.renderList();
    }
    renderFilters() {
      const colors = [...new Set(this.items.filter(i => i.type === 'hl').map(i => i.color))];
      const chip = (k, v, label, extra = '') => `<button class="chip${this.filter[k] === v ? ' on' : ''}" data-k="${k}" data-v="${v}">${extra}${label}</button>`;
      $('sgFilters').innerHTML =
        chip('type', 'all', 'Tümü') + chip('type', 'hl', 'Vurgular') + chip('type', 'card', 'Kartlar') +
        (colors.length ? '<span class="sep"></span>' + chip('color', 'all', 'Tüm renkler') + colors.map(c => chip('color', c, HL_NAMES[c] || 'Renk', `<i class="dot" style="background:${c}"></i>`)).join('') : '');
      $('sgFilters').onclick = e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        this.filter[b.dataset.k] = b.dataset.v; this.renderFilters(); this.renderList();
      };
    }
    renderList() {
      const list = this.filtered();
      $('sgCount').textContent = `${list.length} öğe`;
      if (!list.length) {
        $('sgList').innerHTML = `<p class="hint">Henüz vurgu veya kart yok. Fosforlu kalemle işaretlediklerin ve tuvale sabitlediğin asistan yanıtları burada sayfa sırasıyla toplanır.</p>`;
        return;
      }
      let page = -1, h = '';
      list.forEach((it, idx) => {
        if (it.page !== page) { page = it.page; h += `<div class="sg-page">Sayfa ${page + 1}</div>`; }
        if (it.type === 'hl') h += `<button class="sg-item" data-i="${idx}"><i class="bar" style="background:${it.color}"></i><span>${it.text ? esc(it.text) : '<em>El yazısı vurgu</em>'}</span></button>`;
        else h += `<button class="sg-item card" data-i="${idx}"><i class="bar" style="background:${(ON.CARD_COLORS[it.color] || ['#FFF8E7'])[0]}"></i><span><b>${esc(it.title)}</b><small>${esc(it.text.replace(/[#*$`]/g, '').slice(0, 140))}</small></span></button>`;
      });
      $('sgList').innerHTML = h;
      $('sgList').onclick = e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        const it = list[+b.dataset.i];
        ON.app.closeModal('studyDlg');
        ON.app.jumpTo(it.page, it.x, it.y, true);
      };
    }
    async copyMarkdown() {
      try { await navigator.clipboard.writeText(this.toMarkdown()); ON.app.toast('Markdown kopyalandı'); }
      catch { ON.app.toast('Kopyalanamadı'); }
    }
    async addAsPage() {
      const md = this.toMarkdown();
      ON.app.closeModal('studyDlg');
      await ON.app.addSummaryPage(md);
    }
    async makeQuiz() {
      if (!ON.settings.key) { ON.app.toast('Önce Ayarlar\'dan Gemini API anahtarını ekle'); ON.app.openSettings(); return; }
      const content = this.toMarkdown(this.items);
      if (this.items.length === 0) { ON.app.toast('Önce birkaç yeri vurgula'); return; }
      const box = $('sgQuiz'); box.hidden = false;
      const out = $('sgQuizOut');
      out.innerHTML = `<p class="hint"><span class="dots"><i></i><i></i><i></i></span> Sorular hazırlanıyor…</p>`;
      try {
        const res = await ON.gemini(ON.settings, [{ text: `Aşağıdaki çalışma notlarına dayanarak sınav soruları hazırla: 3 çoktan seçmeli (4 şık) ve 2 açık uçlu soru. Formülleri LaTeX ile yaz. Cevap anahtarını en sona "### Cevaplar" başlığıyla koy.\n\n${content.slice(0, 24000)}` }], t => { out.innerHTML = `<p class="hint">${esc(t)}</p>`; });
        this.quiz = res.text;
        ON.mdInto(out, res.text);
      } catch (err) { out.innerHTML = `<p class="hint" style="white-space:pre-line">${esc(err.message)}</p>`; }
    }
  }
  ON.StudyGuideBuilder = StudyGuideBuilder;
})();
