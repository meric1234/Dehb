/* =====================================================================
   Odak Not — ai-study.js
   Gemini istemcisi (tüm aktif modellerde canlı keşif + tam yedekleme),
   Asistan paneli, Markdown + KaTeX, StickyCardManager,
   StudyGuideBuilder ve İnteraktif Sınav + S Pen Karalama Motoru.
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
  ON.settings = Object.assign({ key: '', model: 'gemini-3.8-flash', custom: '', fingerDraw: false, minimap: true }, LS.get('on-settings', {}));
  if (!ON.settings.model || /^gemini-(1\.|2\.0-flash$)/.test(ON.settings.model)) {
    ON.settings.model = 'gemini-3.8-flash';
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
  const SAFE_FALLBACKS = [
    'gemini-3.8-flash',
    'gemini-3.8-flash-lite',
    'gemini-3.8-pro',
    'gemini-3.5-flash',
    'gemini-3.5-pro',
    'gemini-3.0-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-flash-latest',
    'gemini-pro-latest'
  ];
  const EXCLUDE_RE = /(tts|image|imagen|veo|lyria|aqa|live|audio|embedding|robotics|computer|transcribe|translate)/i;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const detail = (status, msg) => msg ? `\n\nAyrıntı (${status}): ${msg.slice(0, 220)}` : ` (kod ${status})`;

  function friendly(status, msg) {
    if (status === 400 && /API key|API_KEY/i.test(msg)) return 'API anahtarı geçersiz görünüyor. AI Studio\'dan kopyalarken eksik kalmış olabilir.';
    if (status === 403) return 'Anahtarın bu API\'ye izni yok. AI Studio\'da yeni bir anahtar oluşturmayı dene.';
    if (status === 429) return 'Aktif tüm modellerin ücretsiz kotası dolmuş görünüyor. 1 dakika bekleyip tekrar dene.' + detail(status, msg);
    if (status === 503 || /overloaded|UNAVAILABLE|high demand/i.test(msg)) return 'Gemini sunucuları şu an çok yoğun; aktif tüm modeller denendi ancak yanıt alınamadı. 1-2 dakika sonra tekrar dene.' + detail(status, msg);
    if (status >= 500) return 'Google tarafında geçici bir hata oluştu; tüm aktif modeller denendi.' + detail(status, msg);
    return `Hata (${status}): ${msg}`;
  }

  function diagnose() {
    let framed = false; try { framed = window.self !== window.top; } catch { framed = true; }
    if (!navigator.onLine) return 'Cihaz çevrimdışı görünüyor. İnternete bağlanıp tekrar dene.';
    if (framed) return 'Uygulama bir önizleme penceresinin içinde açılmış; önizlemeler internete çıkışı engeller. Siteyi Chrome\'da kendi sekmesinde aç.';
    if (/^(file|content):$/.test(location.protocol)) return 'Dosya doğrudan cihazdan açılmış. Siteyi GitHub Pages linkinden aç.';
    return 'Google\'a ulaşılamadı. Reklam engelleyici, VPN veya okul/iş ağı generativelanguage.googleapis.com adresini engelliyor olabilir.';
  }

  let cacheKey = '', modelCache = null, liveSet = new Set();
  async function listModels(key, force = false) {
    if (!force && modelCache && cacheKey === key) return modelCache;
    try {
      const r = await fetch(API + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return SAFE_FALLBACKS;
      const names = (j.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(n => /^gemini-/.test(n) && !/^gemini-1\./.test(n) && !EXCLUDE_RE.test(n));

      const score = n => {
        let s = 0;
        if (/flash/.test(n)) s += 1000;
        else if (/pro/.test(n)) s += 700;
        if (/lite/.test(n)) s -= 80;
        if (/preview|exp/.test(n)) s -= 40;
        const ver = parseFloat((n.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0');
        s += ver * 25;
        return s;
      };
      names.sort((a, b) => score(b) - score(a));
      liveSet = new Set(names);
      cacheKey = key;
      modelCache = names.length ? [...new Set([...names, ...SAFE_FALLBACKS])] : SAFE_FALLBACKS;
      return modelCache;
    } catch {
      return SAFE_FALLBACKS;
    }
  }
  ON.listModels = listModels;

  ON.gemini = async (s, parts, onStatus = () => {}) => {
    let viaQuery = false;
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2 }
    });
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

    const allCandidates = await listModels(s.key);
    const queue = [];
    if (s.custom) {
      queue.push(s.custom);
    } else if (s.model && (!liveSet.size || liveSet.has(s.model))) {
      queue.push(s.model);
    }
    for (const m of allCandidates) {
      if (!queue.includes(m)) queue.push(m);
    }

    let r = null, j = {}, activeModel = queue[0], initialSwapped = false;
    for (let idx = 0; idx < queue.length; idx++) {
      const model = queue[idx];
      activeModel = model;
      if (idx > 0) {
        initialSwapped = true;
        onStatus(`Aktif model aranıyor (${idx + 1}/${queue.length}): ${model}…`);
      }

      const maxAttempts = idx === 0 ? 2 : 1;
      for (let a = 0; a < maxAttempts; a++) {
        if (a > 0) {
          onStatus(`${model} yoğun, tekrar deneniyor…`);
          await sleep(1000 + Math.random() * 300);
        }
        r = await send(model);
        if (r.ok || !RETRY.has(r.status)) break;
      }

      if (r.ok) break;
      j = await r.json().catch(() => ({}));
      const errMsg = j.error?.message || '';
      if (r.status === 400 && /API key|API_KEY/i.test(errMsg)) break;
    }

    if (!r || !r.ok) {
      if (!j.error && r) j = await r.json().catch(() => ({}));
      throw new Error(friendly(r?.status || 0, j.error?.message || ''));
    }

    const res = await r.json().catch(() => ({}));
    if (initialSwapped && !s.custom && s.model !== activeModel) {
      s.model = activeModel;
      ON.saveSettings();
    }

    const cand = res.candidates?.[0];
    if (!cand) throw new Error('Yanıt engellendi ya da boş döndü' + (res.promptFeedback?.blockReason ? ` (${res.promptFeedback.blockReason})` : '') + '.');
    const text = (cand.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
    if (!text && cand.finishReason && cand.finishReason !== 'STOP') throw new Error(`Yanıt tamamlanamadı (${cand.finishReason}). Tekrar dene.`);
    return { model: activeModel, text };
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

  /* ================= İnteraktif Sınav & S Pen Karalama Yardımcısı ================= */
  function injectQuizStyles() {
    if ($('on-quiz-style')) return;
    const st = document.createElement('style');
    st.id = 'on-quiz-style';
    st.textContent = `
      #studyDlg .card.wide { max-height: 90dvh; overflow-y: auto; }
      #sgQuizOut { white-space: normal !important; max-height: none !important; padding: 0 !important; background: transparent !important; border: none !important; overflow: visible !important; }
      #onQuizApp { margin-top: 10px; display: flex; flex-direction: column; gap: 12px; color: #F2EFFB; font-family: inherit; }
      .qz-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); }
      .qz-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; font-weight: 600; }
      .qz-badge { padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(96,165,250,.18); color: #93C5FD; border: 1px solid rgba(96,165,250,.38); font-variant-numeric: tabular-nums; }
      .qz-badge.ok { background: rgba(46,204,113,.16); color: #7EE8A8; border-color: rgba(46,204,113,.35); }
      .qz-badge.bad { background: rgba(255,90,126,.16); color: #FF9BB0; border-color: rgba(255,90,126,.35); }
      .qz-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .qz-pill { padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,.06); color: #E2DCF5; border: 1px solid rgba(255,255,255,.12); cursor: pointer; transition: .15s; }
      .qz-pill:hover:not(:disabled) { background: rgba(255,255,255,.13); }
      .qz-pill:disabled { opacity: .45; cursor: default; }
      .qz-pill.on { background: #3B82F6; color: #fff; border-color: #60A5FA; }
      .qz-pill.ok-btn { background: rgba(46,204,113,.18); border-color: #2ECC71; color: #9CF5BE; }
      .qz-pill.bad-btn { background: rgba(255,90,126,.18); border-color: #FF5A7E; color: #FFADC0; }
      .qz-dots { display: flex; flex-wrap: wrap; gap: 6px; }
      .qz-dot { width: 28px; height: 28px; border-radius: 8px; font-size: 12px; font-weight: 700; display: grid; place-items: center; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: #D8D1EC; cursor: pointer; }
      .qz-dot.cur { outline: 2px solid #60A5FA; outline-offset: 1px; }
      .qz-dot.correct { background: rgba(46,204,113,.22); border-color: #2ECC71; color: #9CF5BE; }
      .qz-dot.wrong { background: rgba(255,90,126,.22); border-color: #FF5A7E; color: #FFADC0; }
      .qz-card { padding: 14px 16px; border-radius: 14px; background: #121722; border: 1px solid rgba(255,255,255,.1); display: flex; flex-direction: column; gap: 11px; }
      .qz-qhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .qz-qnum { font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .04em; }
      .qz-diff { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,.07); color: #CBD5E1; }
      .qz-qtext { font-size: 15px; line-height: 1.55; font-weight: 500; color: #F8FAFC; }
      .qz-opts { display: flex; flex-direction: column; gap: 8px; }
      .qz-opt { display: flex; align-items: flex-start; gap: 10px; text-align: left; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.11); color: #ECE7FA; font-size: 14px; line-height: 1.45; cursor: pointer; transition: .15s; }
      .qz-opt:hover:not(:disabled) { background: rgba(59,130,246,.16); border-color: rgba(96,165,250,.5); }
      .qz-opt:disabled { cursor: default; }
      .qz-opt .key { flex: 0 0 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.09); color: #E2E8F0; }
      .qz-opt.correct { background: rgba(46,204,113,.16); border-color: #2ECC71; color: #E8FFF1; }
      .qz-opt.correct .key { background: #2ECC71; color: #082414; }
      .qz-opt.wrong { background: rgba(255,90,126,.16); border-color: #FF5A7E; color: #FFE8EE; }
      .qz-opt.wrong .key { background: #FF5A7E; color: #2B0610; }
      .qz-open-box { display: flex; flex-direction: column; gap: 8px; }
      .qz-open-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.14); color: #F8FAFC; font-size: 13.5px; font-family: inherit; }
      .qz-hint-box { padding: 9px 12px; border-radius: 10px; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.32); color: #FDE68A; font-size: 13px; line-height: 1.45; }
      .qz-exp { padding: 11px 13px; border-radius: 11px; background: rgba(45,212,191,.09); border: 1px solid rgba(45,212,191,.3); color: #CCFBF1; font-size: 13.5px; line-height: 1.55; }
      .qz-exp b { color: #5EEAD4; display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .qz-scratch { border-radius: 10px; border: 1px dashed rgba(96,165,250,.45); background: #0B0E14; overflow: hidden; }
      .qz-scratch-bar { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; padding: 5px 10px; background: rgba(255,255,255,.04); font-size: 11px; color: #94A3B8; }
      .qz-scratch canvas { display: block; width: 100%; height: 165px; touch-action: none; cursor: crosshair; }
      .qz-ai-fb { padding: 9px 12px; border-radius: 10px; background: rgba(96,165,250,.1); border: 1px solid rgba(96,165,250,.3); color: #DBEAFE; font-size: 13px; line-height: 1.5; }
      .qz-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .qz-summary { padding: 14px 16px; border-radius: 14px; background: linear-gradient(135deg, rgba(59,130,246,.22), rgba(45,212,191,.12)); border: 1px solid rgba(96,165,250,.38); display: flex; flex-direction: column; gap: 10px; }
      .qz-summary-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .qz-loading { padding: 18px; text-align: center; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.15); font-size: 13.5px; color: #93C5FD; }
    `;
    document.head.appendChild(st);
  }

  function formatRichText(raw) {
    let html = esc(String(raw || ''));
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    const decodeEntities = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (window.katex) {
      html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        try { return window.katex.renderToString(decodeEntities(tex), { displayMode: true, throwOnError: false }); }
        catch { return `$$${tex}$$`; }
      });
      html = html.replace(/\$([^$\n]+?)\$/g, (_, tex) => {
        try { return window.katex.renderToString(decodeEntities(tex), { displayMode: false, throwOnError: false }); }
        catch { return `$${tex}$`; }
      });
    } else if (window.prettifyMathText) {
      html = window.prettifyMathText(html);
    }
    return html;
  }

  function safeParseQuizJSON(raw) {
    const s = String(raw || '').trim();
    const start = s.indexOf('[');
    const end = s.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    let jsonStr = s.slice(start, end + 1)
      .replace(/,\s*([}\]])/g, '$1')
      // LaTeX ters eğik çizgilerinin JSON.parse hatası vermesini önle
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
    let arr;
    try {
      arr = JSON.parse(jsonStr);
    } catch {
      return null;
    }
    if (!Array.isArray(arr) || !arr.length) return null;

    return arr.map((item, idx) => {
      const kind = item.kind === 'open' || (!Array.isArray(item.options) || item.options.length < 2) ? 'open' : 'mcq';
      const opts = kind === 'mcq'
        ? item.options.slice(0, 4).map(o => String(o).replace(/^[A-Da-d][).:\-]\s*/, '').trim())
        : [];
      while (kind === 'mcq' && opts.length < 4) opts.push('—');
      let ans = Number(item.answer);
      if (!Number.isInteger(ans) || ans < 0 || ans > 3) ans = 0;
      return {
        id: idx,
        kind,
        q: String(item.q || item.question || '').trim(),
        options: opts,
        answer: ans,
        hint: String(item.hint || '').trim(),
        explanation: String(item.explanation || item.solution || 'Çözüm açıklaması belirtilmedi.').trim(),
        difficulty: String(item.difficulty || 'Orta').trim()
      };
    }).filter(x => x.q);
  }

  function questionsToMarkdown(questions) {
    const letters = ['A', 'B', 'C', 'D'];
    const body = questions.map((item, i) => {
      if (item.kind === 'open') {
        return `${i + 1}. [Klasik · ${item.difficulty}] ${item.q}`;
      }
      const opts = item.options.map((o, oi) => `   ${letters[oi]}) ${o}`).join('\n');
      return `${i + 1}. [${item.difficulty}] ${item.q}\n${opts}`;
    }).join('\n\n');

    const key = questions.map((item, i) => {
      if (item.kind === 'open') return `${i + 1}) **Çözüm:** ${item.explanation}`;
      return `${i + 1}) **${letters[item.answer]}** — ${item.explanation}`;
    }).join('\n');

    return `## Sınav Soruları\n\n${body}\n\n---\n### Cevap Anahtarı ve Çözümler\n${key}`;
  }

  function bindScratchpad(canvas, savedDataUrl, onSave) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.round(rect.width || 520));
    const h = 165;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#60A5FA';

    if (savedDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = savedDataUrl;
    }

    let drawing = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      lx = e.clientX - r.left;
      ly = e.clientY - r.top;
      drawing = true;
      const isErase = e.pointerType === 'pen' && ((e.buttons & 32) || (e.buttons & 2));
      ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      ctx.lineWidth = isErase ? 16 : (e.pointerType === 'pen' && e.pressure > 0 ? 1.2 + e.pressure * 2.1 : 2);
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(x, y);
      ctx.stroke();
      lx = x; ly = y;
    });
    const endDraw = () => {
      if (!drawing) return;
      drawing = false;
      onSave(canvas.toDataURL('image/png'));
    };
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
  }

  function exportScratchForVision(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.width || 600;
        cv.height = img.height || 200;
        const c = cv.getContext('2d');
        c.fillStyle = '#0B0E14';
        c.fillRect(0, 0, cv.width, cv.height);
        c.drawImage(img, 0, 0);
        const out = cv.toDataURL('image/jpeg', 0.88);
        resolve(out.split(',')[1]);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  /* ================= StudyGuideBuilder ================= */
  const HL_NAMES = { '#FFE45C': 'Sarı', '#8EF0A6': 'Yeşil', '#FF9ECF': 'Pembe', '#8FD3FF': 'Mavi', '#C7B3FF': 'Mor' };
  class StudyGuideBuilder {
    constructor() { this.items = []; this.filter = { type: 'all', color: 'all' }; this.quiz = ''; this.quizData = []; }
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

    async _gatherQuizContext() {
      const app = ON.app;
      const chunks = [];
      if (this.items.length > 0) {
        chunks.push(this.toMarkdown(this.items).slice(0, 14000));
      }
      if (app.nb) {
        const objTexts = (app.nb.objects || []).filter(o => o.type === 'text' && o.text?.trim()).map(o => o.text.trim()).join('\n');
        if (objTexts) chunks.push('Sayfa Metin Kutuları:\n' + objTexts.slice(0, 3000));

        if (app.search && typeof app.search.pageText === 'function' && typeof app.currentPage === 'function') {
          try {
            const curP = app.nb.pages[app.currentPage()];
            if (curP && curP.k === 'pdf') {
              const pt = await app.search.pageText(curP.n);
              if (pt) chunks.push('Aktif PDF Sayfası Metni:\n' + pt.slice(0, 4000));
            }
          } catch {}
        }
      }
      let imgPart = null;
      if (chunks.join('').length < 220 && app.contextImage) {
        try {
          const img = await app.contextImage();
          if (img && img.b64) {
            imgPart = { inline_data: { mime_type: img.mime || 'image/jpeg', data: img.b64 } };
          }
        } catch {}
      }
      return { text: chunks.join('\n\n'), imgPart };
    }

    async makeQuiz(opts = {}) {
      if (!ON.settings.key) { ON.app.toast('Önce Ayarlar\'dan Gemini API anahtarını ekle'); ON.app.openSettings(); return; }
      injectQuizStyles();

      const count = opts.count || 5;
      const box = $('sgQuiz');
      const out = $('sgQuizOut');
      box.hidden = false;
      out.innerHTML = `<div id="onQuizApp"><div class="qz-loading"><span class="dots"><i></i><i></i><i></i></span> Notların analiz ediliyor ve ${count} adet interaktif sınav sorusu hazırlanıyor…</div></div>`;
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      const mount = $('onQuizApp');
      try {
        const ctx = await this._gatherQuizContext();
        if (!ctx.text && !ctx.imgPart) {
          mount.innerHTML = `<div class="qz-loading">Soru üretmek için önce sayfaya bir şeyler yaz, PDF aç ya da birkaç yeri vurgula.</div>`;
          return;
        }

        const mcqCount = Math.max(3, count - 1);
        const openCount = Math.max(1, count - mcqCount);
        const prompt = [
          `Aşağıdaki ders notlarına dayanarak Türkçe, öğretici ve mühendislik sınavı kalitesinde toplam ${count} soru üret (${mcqCount} çoktan seçmeli + ${openCount} klasik işlem/yorum sorusu).`,
          `Kurallar:`,
          `- SADECE geçerli bir JSON dizisi (array) döndür; başına veya sonuna hiçbir açıklama veya markdown kod bloğu yazma.`,
          `- Matematiksel ifadeler ve formüller için LaTeX kullan ($...$ veya $$...$$).`,
          `- Çoktan seçmeli soru şeması:`,
          `  {"kind":"mcq","q":"Soru metni","options":["Şık A","Şık B","Şık C","Şık D"],"answer":0,"hint":"Kısa ipucu veya ilgili formül","explanation":"Adım adım çözüm açıklaması","difficulty":"Temel|Orta|Zor"}`,
          `- Klasik (açık uçlu) soru şeması:`,
          `  {"kind":"open","q":"Soru metni","hint":"Kısa ipucu","explanation":"Adım adım tam çözüm ve nihai sonuç","difficulty":"Orta|Zor"}`,
          `- "answer" alanı doğru şıkkın 0 tabanlı indeksidir (0, 1, 2 veya 3).`,
          ctx.text ? `\nDers İçeriği:\n${ctx.text}` : '\nEkli sayfa görüntüsündeki el yazısı/notları analiz et.'
        ].join('\n');

        const parts = [];
        if (ctx.imgPart) parts.push(ctx.imgPart);
        parts.push({ text: prompt });

        const res = await ON.gemini(ON.settings, parts, t => {
          const ld = mount.querySelector('.qz-loading');
          if (ld && t) ld.textContent = t;
        });

        const questions = safeParseQuizJSON(res.text);
        if (!questions || !questions.length) {
          this.quiz = res.text;
          ON.mdInto(out, res.text);
          return;
        }

        this.quizData = questions;
        this.quiz = questionsToMarkdown(questions);
        this._renderInteractiveQuiz(mount, questions);
      } catch (err) {
        mount.innerHTML = `<div class="qz-loading" style="color:#FF9BB0;white-space:pre-line">${esc(err.message || err)}</div>`;
      }
    }

    _renderInteractiveQuiz(mount, allQuestions) {
      const state = {
        questions: allQuestions.slice(),
        results: new Map(),      // q.id -> { correct: boolean, chosen?: number, userText?: string }
        openRevealed: new Set(), // q.id
        hintsOpen: new Set(),    // q.id
        scratchOpen: new Set(),  // q.id
        scratchData: new Map(),  // q.id -> dataUrl
        scratchFeedback: new Map(), // q.id -> string
        mode: 'single',          // 'single' | 'list'
        curIdx: 0,
        startedAt: Date.now()
      };
      const letters = ['A', 'B', 'C', 'D'];

      const elapsedStr = () => {
        const sec = Math.floor((Date.now() - state.startedAt) / 1000);
        return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      };

      const metrics = () => {
        let correct = 0, wrong = 0;
        for (const q of state.questions) {
          const r = state.results.get(q.id);
          if (!r) continue;
          if (r.correct) correct++;
          else wrong++;
        }
        return { correct, wrong, answered: correct + wrong, total: state.questions.length };
      };

      const renderCard = (q, idx, showNav) => {
        const res = state.results.get(q.id) || null;
        const isSolved = res !== null;
        const hintVisible = state.hintsOpen.has(q.id);
        const scratchVisible = state.scratchOpen.has(q.id);
        const openShown = state.openRevealed.has(q.id);
        const aiFb = state.scratchFeedback.get(q.id) || '';

        let bodyControlHtml = '';
        if (q.kind === 'mcq') {
          const optsHtml = q.options.map((opt, oi) => {
            let cls = 'qz-opt';
            if (isSolved) {
              if (oi === q.answer) cls += ' correct';
              else if (oi === res.chosen) cls += ' wrong';
            }
            return `<button type="button" class="${cls}" data-qid="${q.id}" data-oi="${oi}" ${isSolved ? 'disabled' : ''}>
              <span class="key">${letters[oi]}</span>
              <span>${formatRichText(opt)}</span>
            </button>`;
          }).join('');
          bodyControlHtml = `<div class="qz-opts">${optsHtml}</div>`;
        } else {
          bodyControlHtml = `
            <div class="qz-open-box">
              <input type="text" class="qz-open-input" data-open-in="${q.id}" placeholder="İstersen cevabını yaz veya S Pen karalama alanını kullan…" value="${esc(res?.userText || '')}">
              ${!openShown && !isSolved ? `<div><button type="button" class="qz-pill on" data-reveal-open="${q.id}">Çözümü Göster</button></div>` : ''}
              ${(openShown || isSolved) ? `
                <div class="qz-exp"><b>Adım Adım Çözüm</b>${formatRichText(q.explanation)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <span style="font-size:12px;color:#94A3B8">Kendini değerlendir:</span>
                  <button type="button" class="qz-pill ${res?.correct === true ? 'ok-btn' : ''}" data-grade-open="${q.id}" data-ok="1">✓ Doğru Yaptım</button>
                  <button type="button" class="qz-pill ${res?.correct === false ? 'bad-btn' : ''}" data-grade-open="${q.id}" data-ok="0">✕ Tekrar Çalışmalıyım</button>
                </div>
              ` : ''}
            </div>
          `;
        }

        return `
          <div class="qz-card">
            <div class="qz-qhead">
              <span class="qz-qnum">Soru ${idx + 1} / ${state.questions.length} ${q.kind === 'open' ? '· Klasik' : ''}</span>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <button type="button" class="qz-pill ${scratchVisible ? 'on' : ''}" data-scratch="${q.id}">Karalama (S Pen)</button>
                ${!isSolved && q.hint ? `<button type="button" class="qz-pill" data-hint="${q.id}">${hintVisible ? 'İpucunu Gizle' : 'İpucu'}</button>` : ''}
                <span class="qz-diff">${esc(q.difficulty)}</span>
              </div>
            </div>
            <div class="qz-qtext">${formatRichText(q.q)}</div>
            ${scratchVisible ? `
              <div class="qz-scratch">
                <div class="qz-scratch-bar">
                  <span>S Pen İşlem Alanı (yan tuş: silgi)</span>
                  <div style="display:flex;gap:6px">
                    <button type="button" class="qz-pill" style="padding:2px 8px;font-size:11px" data-scratch-check="${q.id}">Çizimimi Kontrol Et</button>
                    <button type="button" class="qz-pill" style="padding:2px 8px;font-size:11px" data-scratch-clear="${q.id}">Temizle</button>
                  </div>
                </div>
                <canvas data-scratch-cv="${q.id}"></canvas>
              </div>
              ${aiFb ? `<div class="qz-ai-fb">${formatRichText(aiFb)}</div>` : ''}
            ` : ''}
            ${hintVisible && !isSolved && q.hint ? `<div class="qz-hint-box"><strong>İpucu:</strong> ${formatRichText(q.hint)}</div>` : ''}
            ${bodyControlHtml}
            ${q.kind === 'mcq' && isSolved ? `<div class="qz-exp"><b>${res.correct ? 'Doğru Cevap ✓' : `Yanlış — Doğru Şık: ${letters[q.answer]}`} · Adım Adım Çözüm</b>${formatRichText(q.explanation)}</div>` : ''}
            ${showNav ? `
              <div class="qz-nav">
                <button type="button" class="qz-pill" data-nav="-1" ${idx === 0 ? 'disabled' : ''}>← Önceki</button>
                <button type="button" class="qz-pill on" data-nav="1" ${idx >= state.questions.length - 1 ? 'disabled' : ''}>Sonraki Soru →</button>
              </div>
            ` : ''}
          </div>
        `;
      };

      const draw = () => {
        const m = metrics();
        const finished = m.answered === m.total && m.total > 0;
        const pct = m.total ? Math.round((m.correct / m.total) * 100) : 0;

        const dotsHtml = state.questions.map((q, i) => {
          const r = state.results.get(q.id);
          const cls = 'qz-dot' + (state.mode === 'single' && i === state.curIdx ? ' cur' : '') + (r ? (r.correct ? ' correct' : ' wrong') : '');
          return `<button type="button" class="${cls}" data-jump="${i}">${i + 1}</button>`;
        }).join('');

        const bodyHtml = state.mode === 'single'
          ? renderCard(state.questions[state.curIdx], state.curIdx, true)
          : state.questions.map((q, i) => renderCard(q, i, false)).join('');

        mount.innerHTML = `
          <div class="qz-top">
            <div class="qz-stats">
              <span class="qz-badge">${m.answered}/${m.total} Çözüldü</span>
              <span class="qz-badge ok">✓ ${m.correct}</span>
              <span class="qz-badge bad">✕ ${m.wrong}</span>
              <span class="qz-badge" id="qzClock">⏱ ${elapsedStr()}</span>
            </div>
            <div class="qz-controls">
              <button type="button" class="qz-pill ${state.mode === 'single' ? 'on' : ''}" data-mode="single">Tek Tek</button>
              <button type="button" class="qz-pill ${state.mode === 'list' ? 'on' : ''}" data-mode="list">Tüm Liste</button>
              <button type="button" class="qz-pill" data-regen="5">Yeni 5 Soru</button>
              <button type="button" class="qz-pill" data-regen="10">10 Soru</button>
            </div>
          </div>
          <div class="qz-dots">${dotsHtml}</div>
          ${bodyHtml}
          ${finished ? `
            <div class="qz-summary">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                <strong>Sınav Tamamlandı · Başarı: %${pct} (${elapsedStr()})</strong>
                <span style="font-size:12.5px;opacity:.85">${m.correct} Doğru, ${m.wrong} Yanlış</span>
              </div>
              <div class="qz-summary-actions">
                ${m.wrong > 0 ? `<button type="button" class="qz-pill on" id="qzRetryWrong">Yanlışları Tekrar Çöz (${m.wrong})</button>` : ''}
                <button type="button" class="qz-pill" id="qzResetAll">Tümünü Sıfırla</button>
                <button type="button" class="qz-pill" id="qzToWorksheet">Çalışma Yaprağı Olarak Deftere Ekle</button>
                ${m.wrong > 0 ? `<button type="button" class="qz-pill" id="qzPinWrong">Yanlışları Tuvale Kart Yap</button>` : ''}
              </div>
            </div>
          ` : `
            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="qz-pill" id="qzToWorksheet">Çalışma Yaprağı Olarak Deftere Ekle</button>
            </div>
          `}
        `;

        ON.renderMath(mount);
        mount.querySelectorAll('[data-scratch-cv]').forEach(cv => {
          const qid = Number(cv.dataset.scratchCv);
          bindScratchpad(cv, state.scratchData.get(qid), dataUrl => state.scratchData.set(qid, dataUrl));
        });
      };

      const clockInterval = setInterval(() => {
        if (!document.body.contains(mount)) { clearInterval(clockInterval); return; }
        const el = $('qzClock');
        if (el) el.textContent = '⏱ ' + elapsedStr();
      }, 1000);

      mount.onclick = async e => {
        const optBtn = e.target.closest('.qz-opt');
        if (optBtn) {
          const qid = Number(optBtn.dataset.qid);
          const oi = Number(optBtn.dataset.oi);
          const q = state.questions.find(x => x.id === qid);
          if (q && !state.results.has(qid)) {
            state.results.set(qid, { correct: oi === q.answer, chosen: oi });
            draw();
          }
          return;
        }

        const revealBtn = e.target.closest('[data-reveal-open]');
        if (revealBtn) {
          const qid = Number(revealBtn.dataset.revealOpen);
          state.openRevealed.add(qid);
          draw();
          return;
        }

        const gradeBtn = e.target.closest('[data-grade-open]');
        if (gradeBtn) {
          const qid = Number(gradeBtn.dataset.gradeOpen);
          const ok = gradeBtn.dataset.ok === '1';
          const inp = mount.querySelector(`[data-open-in="${qid}"]`);
          state.results.set(qid, { correct: ok, userText: inp ? inp.value : '' });
          draw();
          return;
        }

        const scratchBtn = e.target.closest('[data-scratch]');
        if (scratchBtn) {
          const qid = Number(scratchBtn.dataset.scratch);
          if (state.scratchOpen.has(qid)) state.scratchOpen.delete(qid);
          else state.scratchOpen.add(qid);
          draw();
          return;
        }

        const clearBtn = e.target.closest('[data-scratch-clear]');
        if (clearBtn) {
          const qid = Number(clearBtn.dataset.scratchClear);
          state.scratchData.delete(qid);
          state.scratchFeedback.delete(qid);
          draw();
          return;
        }

        const checkScratchBtn = e.target.closest('[data-scratch-check]');
        if (checkScratchBtn) {
          const qid = Number(checkScratchBtn.dataset.scratchCheck);
          const dataUrl = state.scratchData.get(qid);
          const q = state.questions.find(x => x.id === qid);
          if (!dataUrl || !q) { ON.app.toast('Önce karalama alanına çözümünü yaz'); return; }
          state.scratchFeedback.set(qid, 'S Pen çözümün kontrol ediliyor…');
          draw();
          const b64 = await exportScratchForVision(dataUrl);
          if (!b64) return;
          try {
            const fb = await ON.gemini(ON.settings, [
              { inline_data: { mime_type: 'image/jpeg', data: b64 } },
              { text: `Soru: ${q.q}\nBeklenen Çözüm: ${q.explanation}\n\nÖğrencinin el yazısı karalama alanındaki adımlarını kontrol et. Hatalı adım varsa kısaca belirt, doğru yoldaysa onayla.` }
            ]);
            state.scratchFeedback.set(qid, fb.text);
          } catch (err) {
            state.scratchFeedback.set(qid, 'Kontrol edilemedi: ' + (err.message || err));
          }
          draw();
          return;
        }

        const hintBtn = e.target.closest('[data-hint]');
        if (hintBtn) {
          const qid = Number(hintBtn.dataset.hint);
          if (state.hintsOpen.has(qid)) state.hintsOpen.delete(qid);
          else state.hintsOpen.add(qid);
          draw();
          return;
        }

        const jumpBtn = e.target.closest('[data-jump]');
        if (jumpBtn) {
          state.mode = 'single';
          state.curIdx = Number(jumpBtn.dataset.jump);
          draw();
          return;
        }

        const navBtn = e.target.closest('[data-nav]');
        if (navBtn) {
          const dir = Number(navBtn.dataset.nav);
          state.curIdx = Math.max(0, Math.min(state.questions.length - 1, state.curIdx + dir));
          draw();
          return;
        }

        const modeBtn = e.target.closest('[data-mode]');
        if (modeBtn) {
          state.mode = modeBtn.dataset.mode;
          draw();
          return;
        }

        const regenBtn = e.target.closest('[data-regen]');
        if (regenBtn) {
          clearInterval(clockInterval);
          this.makeQuiz({ count: Number(regenBtn.dataset.regen) || 5 });
          return;
        }

        if (e.target.closest('#qzRetryWrong')) {
          const wrongQs = state.questions.filter(q => state.results.get(q.id)?.correct === false);
          if (wrongQs.length) {
            state.questions = wrongQs;
            state.results.clear();
            state.openRevealed.clear();
            state.hintsOpen.clear();
            state.curIdx = 0;
            state.startedAt = Date.now();
            draw();
          }
          return;
        }

        if (e.target.closest('#qzResetAll')) {
          state.questions = allQuestions.slice();
          state.results.clear();
          state.openRevealed.clear();
          state.hintsOpen.clear();
          state.curIdx = 0;
          state.startedAt = Date.now();
          draw();
          return;
        }

        if (e.target.closest('#qzToWorksheet')) {
          ON.app.closeModal('studyDlg');
          await ON.app.addSummaryPage(questionsToMarkdown(state.questions));
          return;
        }

        if (e.target.closest('#qzPinWrong')) {
          const wrongQs = state.questions.filter(q => state.results.get(q.id)?.correct === false);
          if (wrongQs.length && ON.cards) {
            ON.cards.create(questionsToMarkdown(wrongQs), ON.app.viewAnchor());
            ON.app.closeModal('studyDlg');
            ON.app.toast(`${wrongQs.length} yanlış soru tuvale kart olarak sabitlendi`);
          }
        }
      };

      draw();
    }
  }
  ON.StudyGuideBuilder = StudyGuideBuilder;
})();
