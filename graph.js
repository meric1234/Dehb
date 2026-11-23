/* =====================================================================
   Odak Not — graph.js
   Özel karakter & üst simge (x³, √, π, θ) korumalı matematik ayrıştırıcı,
   canlı KaTeX önizlemeli interaktif 2B fonksiyon çizici.
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON || (window.ON = {});
  const $ = id => document.getElementById(id);
  const esc = ON.esc || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  const PALETTE = ['#60A5FA', '#34D399', '#F472B6', '#FBBF24', '#A78BFA'];

  /* ================= 1. Üst Simge & Özel Karakter Korumalı Temizleyici ================= */
  const SUP_CHARS = '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿˣʸᵗ';
  const SUB_CHARS = '₀₁₂₃₄₅₆₇₈₉';

  const SUP_MAP = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
    'ⁿ': 'n', 'ˣ': 'x', 'ʸ': 'y', 'ᵗ': 't'
  };
  const SUB_MAP = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9'
  };

  function replaceBalancedLatex(str, cmd, replacer) {
    let out = str;
    const needle = '\\' + cmd;
    let safety = 0;
    while (out.includes(needle) && safety++ < 20) {
      const idx = out.indexOf(needle);
      let pos = idx + needle.length;
      while (pos < out.length && /\s/.test(out[pos])) pos++;
      const args = [];
      while (pos < out.length && out[pos] === '{') {
        let depth = 0, start = pos + 1;
        while (pos < out.length) {
          if (out[pos] === '{') depth++;
          else if (out[pos] === '}') {
            depth--;
            if (depth === 0) { args.push(out.slice(start, pos)); pos++; break; }
          }
          pos++;
        }
      }
      if (!args.length) break;
      out = out.slice(0, idx) + replacer(args) + out.slice(pos);
    }
    return out;
  }

  // PDF italik karakterlerini (𝑓, 𝑥, 𝑦) düzeltirken x³, x², √, π, θ işaretlerini BİREBİR korur
  function cleanForDisplay(rawInput) {
    let s = String(rawInput || '').trim();
    if (!s) return '';

    s = s.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();

    // NFKC'nin ³ -> 3 dönüşümü yapmasını önlemek için üst/alt simgeleri geçici koru
    const savedSup = [];
    s = s.replace(new RegExp(`[${SUP_CHARS}${SUB_CHARS}]`, 'g'), ch => {
      const idx = savedSup.push(ch) - 1;
      return `\uE000${idx}\uE001`;
    });

    // Matematiksel Unicode harfleri (𝑓, 𝑥, 𝑦) standart harflere çevir
    s = s.normalize('NFKC');

    // Üst/alt simgeleri (³, ² vb.) geri yükle
    s = s.replace(/\uE000(\d+)\uE001/g, (_, i) => savedSup[Number(i)] || '');

    // LaTeX varsa okunabilir matematik biçimine çevir
    s = s.replace(/\\left\s*\||\\right\s*\|/g, '|');
    s = s.replace(/\\left|\\right/g, '');
    s = replaceBalancedLatex(s, 'frac', a => `(${a[0] || '0'})/(${a[1] || '1'})`);
    s = replaceBalancedLatex(s, 'dfrac', a => `(${a[0] || '0'})/(${a[1] || '1'})`);
    s = replaceBalancedLatex(s, 'tfrac', a => `(${a[0] || '0'})/(${a[1] || '1'})`);
    s = replaceBalancedLatex(s, 'sqrt', a => `√(${a[0] || '0'})`);
    s = replaceBalancedLatex(s, 'text', a => a[0] || '');
    s = replaceBalancedLatex(s, 'mathrm', a => a[0] || '');
    s = replaceBalancedLatex(s, 'mathbf', a => a[0] || '');

    const toSupDigits = str => [...str].map(c => Object.keys(SUP_MAP).find(k => SUP_MAP[k] === c) || c).join('');
    s = s
      .replace(/\^\{([0-9+-]+)\}/g, (_, g) => toSupDigits(g))
      .replace(/\^([0-9])\b/g, (_, g) => toSupDigits(g))
      .replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|abs)\b/g, '$1')
      .replace(/\\cdot|\\times/g, '·')
      .replace(/\\div/g, '/')
      .replace(/\\pi\b/g, 'π')
      .replace(/\\theta\b/g, 'θ')
      .replace(/\\omega\b/g, 'ω')
      .replace(/[−–—﹣－]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Baştaki "f(x) =" veya "y =" kısmını sadeleştir
    s = s.replace(/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*(x|t|theta|θ|s|u)\s*\)\s*=\s*/i, '');
    s = s.replace(/^\s*y\s*=\s*/i, '');

    return s.trim();
  }

  // KaTeX önizlemesi için LaTeX üretir (örn. x³ -> x^{3}, √(x) -> \sqrt{x})
  function toKatexPreview(displayStr) {
    let t = String(displayStr || '').trim();
    if (!t) return '';
    t = t.replace(new RegExp(`[${SUP_CHARS}]+`, 'g'), m => {
      const inner = [...m].map(ch => SUP_MAP[ch] || ch).join('');
      return `^{${inner}}`;
    });
    t = t.replace(new RegExp(`[${SUB_CHARS}]+`, 'g'), m => {
      const inner = [...m].map(ch => SUB_MAP[ch] || ch).join('');
      return `_{${inner}}`;
    });
    t = t
      .replace(/√\s*\(([^()]+)\)/g, '\\sqrt{$1}')
      .replace(/√\s*([a-zA-Z0-9_.]+)/g, '\\sqrt{$1}')
      .replace(/\b(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp)\b/g, '\\$1')
      .replace(/\bpi\b|π/g, '\\pi ')
      .replace(/\btheta\b|θ/g, '\\theta ')
      .replace(/\bomega\b|ω/g, '\\omega ')
      .replace(/\*/g, '\\cdot ');
    return t;
  }

  // Yalnızca arka planda sayısal hesaplama için ifadeyi ayrıştırır (kullanıcıya gösterilmez)
  function normalizeForEval(rawInput) {
    let s = String(rawInput || '').trim();
    if (!s) return { expr: '', axisVar: 'x' };

    s = s.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();

    // Üst simgeleri NFKC'den önce ^(..) yap
    s = s.replace(new RegExp(`[${SUP_CHARS}]+`, 'g'), m => {
      const inner = [...m].map(ch => SUP_MAP[ch] || ch).join('');
      return `^(${inner})`;
    });
    s = s.replace(new RegExp(`[${SUB_CHARS}]+`, 'g'), m => [...m].map(ch => SUB_MAP[ch] || ch).join(''));

    s = s.normalize('NFKC');

    s = s.replace(/\\left\s*\||\\right\s*\|/g, '|');
    s = s.replace(/\\left|\\right/g, '');
    s = replaceBalancedLatex(s, 'frac', a => `((${a[0] || '0'})/(${a[1] || '1'}))`);
    s = replaceBalancedLatex(s, 'dfrac', a => `((${a[0] || '0'})/(${a[1] || '1'}))`);
    s = replaceBalancedLatex(s, 'tfrac', a => `((${a[0] || '0'})/(${a[1] || '1'}))`);
    s = replaceBalancedLatex(s, 'sqrt', a => `sqrt(${a[0] || '0'})`);
    s = replaceBalancedLatex(s, 'text', a => a[0] || '');
    s = replaceBalancedLatex(s, 'mathrm', a => a[0] || '');
    s = replaceBalancedLatex(s, 'mathbf', a => a[0] || '');

    s = s
      .replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|abs|min|max)\b/g, '$1')
      .replace(/\\cdot|\\times|\\ast/g, '*')
      .replace(/\\div/g, '/')
      .replace(/\\pi\b/g, 'pi')
      .replace(/\\theta\b/g, 'theta')
      .replace(/\\omega\b/g, 'omega')
      .replace(/\\alpha\b/g, 'a')
      .replace(/\\beta\b/g, 'b')
      .replace(/\\gamma\b/g, 'c')
      .replace(/\^\{([^{}]+)\}/g, '^($1)')
      .replace(/[{}]/g, m => (m === '{' ? '(' : ')'));

    s = s
      .replace(/[−–—﹣－]/g, '-')
      .replace(/[＋]/g, '+')
      .replace(/[×·•⋅∗✕✖]/g, '*')
      .replace(/[÷∶∕⁄]/g, '/')
      .replace(/[πΠ]/g, 'pi')
      .replace(/[θΘ]/g, 'theta')
      .replace(/[ωΩ]/g, 'omega')
      .replace(/[α]/g, 'a')
      .replace(/[β]/g, 'b')
      .replace(/∛\s*\(([^)]+)\)/g, 'cbrt($1)')
      .replace(/∛\s*([a-zA-Z0-9_.]+)/g, 'cbrt($1)')
      .replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)')
      .replace(/√\s*([a-zA-Z0-9_.]+)/g, 'sqrt($1)');

    // Ondalık virgül: 0,5 -> 0.5
    s = s.replace(/(\d)\s*,\s*(\d)/g, '$1.$2');

    let detectedAxis = null;
    const fnPrefix = s.match(/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(\s*(x|t|theta|s|u)\s*\)\s*=\s*(.+)$/i);
    if (fnPrefix) {
      detectedAxis = fnPrefix[1].toLowerCase();
      s = fnPrefix[2];
    } else if (/^\s*y\s*=\s*/i.test(s)) {
      s = s.replace(/^\s*y\s*=\s*/i, '');
    } else if (s.includes('=')) {
      const parts = s.split('=');
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        s = `(${parts[0].trim()}) - (${parts[1].trim()})`;
      }
    }

    let pipeGuard = 0;
    while (s.includes('|') && pipeGuard++ < 10) {
      const next = s.replace(/\|([^|]+)\|/g, 'abs($1)');
      if (next === s) break;
      s = next;
    }

    s = s.replace(/[^\w\s+\-*/^().,]/g, ' ').replace(/\s+/g, ' ').trim();
    return { expr: s, axisVar: detectedAxis };
  }

  /* ================= 2. Güvenli Matematik Motoru ================= */
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    cot: x => 1 / Math.tan(x), sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x),
    asin: Math.asin, arcsin: Math.asin, acos: Math.acos, arccos: Math.acos,
    atan: Math.atan, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt || (x => Math.cbrt(x)), abs: Math.abs,
    ln: Math.log, log: Math.log10 || (x => Math.log(x) / Math.LN10),
    log10: Math.log10 || (x => Math.log(x) / Math.LN10), log2: Math.log2 || (x => Math.log(x) / Math.LN2),
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, min: Math.min, max: Math.max, pow: Math.pow
  };
  const CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E };
  const ALT_VARS = new Set(['t', 'theta', 's', 'u']);
  const PARAM_NAMES = new Set(['a', 'b', 'c']);

  function compileMath(rawInput) {
    const norm = normalizeForEval(rawInput);
    const src = norm.expr;
    if (!src) return { ok: false, error: 'Denklem girilmedi.', axisVar: 'x', params: [] };

    const rawTokens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        let num = '';
        while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
        if (i < src.length && (src[i] === 'e' || src[i] === 'E') && /[0-9+-]/.test(src[i + 1] || '')) {
          num += src[i++];
          if (src[i] === '+' || src[i] === '-') num += src[i++];
          while (i < src.length && /[0-9]/.test(src[i])) num += src[i++];
        }
        const val = parseFloat(num);
        if (!Number.isFinite(val)) return { ok: false, error: `Geçersiz sayı: ${num}`, axisVar: 'x', params: [] };
        rawTokens.push({ t: 'num', v: val });
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        let id = '';
        while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) id += src[i++];
        if (!FUNCS[id] && !CONSTS[id] && id !== 'x' && !ALT_VARS.has(id) && !PARAM_NAMES.has(id)) {
          if (id.startsWith('pi') && id.length > 2) {
            rawTokens.push({ t: 'const', v: Math.PI, name: 'pi' });
            id = id.slice(2);
          } else if (id.startsWith('e') && id.length > 1 && id !== 'exp') {
            rawTokens.push({ t: 'const', v: Math.E, name: 'e' });
            id = id.slice(1);
          }
        }
        if (FUNCS[id]) rawTokens.push({ t: 'fn', v: FUNCS[id], name: id });
        else if (CONSTS[id] !== undefined) rawTokens.push({ t: 'const', v: CONSTS[id], name: id });
        else rawTokens.push({ t: 'id', name: id });
        continue;
      }
      if ('+-*/^(),'.includes(ch)) {
        rawTokens.push({ t: 'op', v: ch });
        i++;
        continue;
      }
      return { ok: false, error: `Tanınmayan karakter: ${ch}`, axisVar: 'x', params: [] };
    }

    const ids = new Set(rawTokens.filter(tk => tk.t === 'id').map(tk => tk.name));
    let axisVar = norm.axisVar || 'x';
    if (!ids.has('x')) {
      for (const cand of ['t', 'theta', 's', 'u']) {
        if (ids.has(cand)) { axisVar = cand; break; }
      }
    }

    const usedParams = new Set();
    for (const tk of rawTokens) {
      if (tk.t === 'id') {
        if (tk.name === 'x' || tk.name === axisVar) tk.isVar = true;
        else if (PARAM_NAMES.has(tk.name)) { tk.isParam = true; usedParams.add(tk.name); }
        else return { ok: false, error: `Bilinmeyen sembol: "${tk.name}"`, axisVar, params: [] };
      }
    }

    const tokens = [];
    const isValueEnd = tk => tk && (tk.t === 'num' || tk.t === 'const' || tk.t === 'id' || (tk.t === 'op' && tk.v === ')'));
    const isValueStart = tk => tk && (tk.t === 'num' || tk.t === 'const' || tk.t === 'id' || tk.t === 'fn' || (tk.t === 'op' && tk.v === '('));
    for (let k = 0; k < rawTokens.length; k++) {
      const cur = rawTokens[k];
      if (k > 0 && isValueEnd(rawTokens[k - 1]) && isValueStart(cur)) tokens.push({ t: 'op', v: '*' });
      tokens.push(cur);
    }

    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    function parseExpr() {
      let node = parseTerm();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = consume().v;
        const right = parseTerm();
        const left = node;
        node = op === '+' ? (x, p) => left(x, p) + right(x, p) : (x, p) => left(x, p) - right(x, p);
      }
      return node;
    }

    function parseTerm() {
      let node = parseUnary();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        const op = consume().v;
        const right = parseUnary();
        const left = node;
        node = op === '*' ? (x, p) => left(x, p) * right(x, p) : (x, p) => left(x, p) / right(x, p);
      }
      return node;
    }

    function parseUnary() {
      if (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = consume().v;
        const inner = parseUnary();
        return op === '-' ? (x, p) => -inner(x, p) : inner;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().t === 'op' && peek().v === '^') {
        consume();
        const exp = parseUnary();
        return (x, p) => Math.pow(base(x, p), exp(x, p));
      }
      return base;
    }

    function parsePrimary() {
      const tk = peek();
      if (!tk) throw new Error('Eksik ifade');
      if (tk.t === 'num' || tk.t === 'const') { consume(); const v = tk.v; return () => v; }
      if (tk.t === 'id') {
        consume();
        if (tk.isVar) return x => x;
        const pname = tk.name;
        return (_, p) => (p && p[pname] !== undefined ? p[pname] : 1);
      }
      if (tk.t === 'fn') {
        const fn = consume().v;
        if (!peek() || peek().t !== 'op' || peek().v !== '(') {
          const arg = parseUnary();
          return (x, p) => fn(arg(x, p));
        }
        consume();
        const args = [parseExpr()];
        while (peek() && peek().t === 'op' && peek().v === ',') { consume(); args.push(parseExpr()); }
        if (!peek() || peek().t !== 'op' || peek().v !== ')') throw new Error('Kapanmamış parantez');
        consume();
        return (x, p) => fn(...args.map(a => a(x, p)));
      }
      if (tk.t === 'op' && tk.v === '(') {
        consume();
        const inner = parseExpr();
        if (!peek() || peek().t !== 'op' || peek().v !== ')') throw new Error('Kapanmamış parantez');
        consume();
        return inner;
      }
      throw new Error(`Beklenmeyen sembol: ${tk.v || tk.name}`);
    }

    try {
      const fn = parseExpr();
      if (pos < tokens.length) throw new Error(`Fazla karakter: ${tokens[pos].v || tokens[pos].name}`);
      return { ok: true, fn, axisVar: axisVar === 'theta' ? 'θ' : axisVar, params: [...usedParams] };
    } catch (e) {
      return { ok: false, error: e.message || 'İfade çözümlenemedi', axisVar: 'x', params: [] };
    }
  }

  /* ================= 3. Stil Enjeksiyonu ================= */
  function injectGraphStyles() {
    if ($('on-graph-style')) return;
    const st = document.createElement('style');
    st.id = 'on-graph-style';
    st.textContent = `
      #onGraphWin {
        position: fixed;
        right: 16px;
        bottom: 76px;
        width: min(440px, calc(100vw - 24px));
        background: #101520;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,.55);
        color: #F1F5F9;
        z-index: 9500;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
      }
      #onGraphWin[hidden] { display: none !important; }
      .gp-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        background: rgba(255,255,255,.04);
        border-bottom: 1px solid rgba(255,255,255,.08);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .gp-head:active { cursor: grabbing; }
      .gp-head b { font-size: 13px; font-weight: 600; color: #E2E8F0; }
      .gp-head .gp-sub { font-size: 11px; color: #94A3B8; margin-left: auto; }
      .gp-ibtn {
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.06);
        color: #E2E8F0;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
      }
      .gp-ibtn:hover { background: rgba(255,255,255,.13); }
      .gp-ibtn.on { background: #2563EB; border-color: #60A5FA; color: #fff; }
      .gp-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; max-height: 78dvh; overflow-y: auto; }
      .gp-funcs { display: flex; flex-direction: column; gap: 6px; }
      .gp-frow {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 10px;
        padding: 5px 8px;
      }
      .gp-frow.active { border-color: rgba(96,165,250,.55); background: rgba(59,130,246,.08); }
      .gp-dot { width: 12px; height: 12px; border-radius: 50%; flex: 0 0 12px; cursor: pointer; border: 2px solid rgba(255,255,255,.3); }
      .gp-dot.off { opacity: .28; }
      .gp-lbl { font-size: 12.5px; font-weight: 600; color: #94A3B8; white-space: nowrap; }
      .gp-in {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        outline: none;
        color: #F8FAFC;
        font-size: 14.5px;
        font-family: inherit;
      }
      .gp-math-prev {
        padding: 3px 10px 2px 26px;
        font-size: 13.5px;
        color: #CBD5E1;
        min-height: 20px;
      }
      .gp-err { font-size: 11px; color: #FCA5A5; padding: 2px 6px 0; }
      .gp-keypad { display: flex; flex-wrap: wrap; gap: 4px; }
      .gp-key {
        padding: 3px 8px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(255,255,255,.05);
        color: #E2E8F0;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .gp-key:hover { background: rgba(96,165,250,.22); border-color: rgba(96,165,250,.45); }
      .gp-sliders { display: flex; flex-direction: column; gap: 5px; padding: 6px 8px; border-radius: 10px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); }
      .gp-srow { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .gp-srow span { width: 54px; font-variant-numeric: tabular-nums; color: #CBD5E1; font-weight: 600; }
      .gp-srow input { flex: 1; accent-color: #60A5FA; }
      .gp-cv-wrap {
        position: relative;
        width: 100%;
        height: 250px;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,.12);
        background: #090D16;
      }
      .gp-cv-wrap canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
      .gp-hud {
        position: absolute;
        left: 8px;
        bottom: 8px;
        padding: 3px 8px;
        border-radius: 7px;
        background: rgba(9,13,22,.82);
        border: 1px solid rgba(255,255,255,.1);
        font-size: 11px;
        color: #CBD5E1;
        font-variant-numeric: tabular-nums;
        pointer-events: none;
      }
      .gp-zooms {
        position: absolute;
        right: 8px;
        top: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .gp-zooms button {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(16,21,32,.86);
        color: #F1F5F9;
        font-weight: 700;
        cursor: pointer;
      }
      .gp-tools { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
      .gp-int-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; padding: 6px 8px; border-radius: 9px; background: rgba(52,211,153,.09); border: 1px solid rgba(52,211,153,.28); color: #A7F3D0; }
      .gp-int-bar input { width: 52px; padding: 2px 5px; border-radius: 6px; border: 1px solid rgba(255,255,255,.18); background: rgba(0,0,0,.3); color: #fff; font-size: 11.5px; }
    `;
    document.head.appendChild(st);
  }

  /* ================= 4. İnteraktif Grafik Çizici Yöneticisi ================= */
  const GraphPlotter = {
    win: null,
    canvas: null,
    funcs: [],
    activeIdx: 0,
    params: { a: 1, b: 1, c: 0 },
    view: { cx: 0, cy: 0, scale: 38 },
    opts: { deriv: false, integral: false, roots: true },
    hoverPt: null,
    keyPoints: [],

    init() {
      injectGraphStyles();
      if (this.win) return;

      const win = document.createElement('section');
      win.id = 'onGraphWin';
      win.dataset.ui = '1';
      win.hidden = true;
      win.innerHTML = `
        <div class="gp-head" id="gpDrag">
          <span>📈</span>
          <b>Grafik Çizici</b>
          <span class="gp-sub" id="gpAxisBadge">y = f(x)</span>
          <button type="button" class="gp-ibtn" id="gpPinCard" title="Grafiği tuvale yapışkan kart olarak ekle">Tuvale Sabitle</button>
          <button type="button" class="gp-ibtn" id="gpClose" title="Kapat">✕</button>
        </div>
        <div class="gp-body">
          <div class="gp-funcs" id="gpFuncs"></div>
          <div class="gp-keypad" id="gpKeypad">
            <button type="button" class="gp-key" data-ins="²">x²</button>
            <button type="button" class="gp-key" data-ins="³">x³</button>
            <button type="button" class="gp-key" data-ins="⁴">x⁴</button>
            <button type="button" class="gp-key" data-ins="√(">√</button>
            <button type="button" class="gp-key" data-ins="π">π</button>
            <button type="button" class="gp-key" data-ins="θ">θ</button>
            <button type="button" class="gp-key" data-ins="sin(">sin</button>
            <button type="button" class="gp-key" data-ins="cos(">cos</button>
            <button type="button" class="gp-key" data-ins="eˣ">eˣ</button>
            <button type="button" class="gp-key" data-ins="ln(">ln</button>
            <button type="button" class="gp-key" data-ins="|x|">|x|</button>
          </div>
          <div class="gp-sliders" id="gpSliders" hidden></div>
          <div class="gp-cv-wrap">
            <canvas id="gpCanvas"></canvas>
            <div class="gp-hud" id="gpHud">Dokun / sürükle: kaydır</div>
            <div class="gp-zooms">
              <button type="button" id="gpZoomIn" title="Yakınlaş">+</button>
              <button type="button" id="gpZoomOut" title="Uzaklaş">−</button>
              <button type="button" id="gpReset" title="Merkezle">⌂</button>
            </div>
          </div>
          <div class="gp-tools">
            <button type="button" class="gp-ibtn" id="gpAddFn">+ Fonksiyon</button>
            <button type="button" class="gp-ibtn" id="gpDeriv">f'(x) Türev</button>
            <button type="button" class="gp-ibtn" id="gpIntegral">∫ Alan</button>
            <button type="button" class="gp-ibtn on" id="gpRoots">Kök &amp; Kesişim</button>
          </div>
          <div class="gp-int-bar" id="gpIntBar" hidden>
            <span>Aralık:</span>
            <label>a = <input type="number" step="0.5" id="gpIntA" value="0"></label>
            <label>b = <input type="number" step="0.5" id="gpIntB" value="2"></label>
            <b id="gpIntVal" style="margin-left:auto"></b>
          </div>
        </div>
      `;
      document.body.appendChild(win);
      this.win = win;
      this.canvas = $('gpCanvas');

      this._bindEvents();
      this.setExpressions(['x³ - 3x']);
    },

    setExpressions(exprList) {
      this.init();
      const list = (Array.isArray(exprList) ? exprList : [exprList]).filter(Boolean);
      if (!list.length) list.push('x³ - 3x');
      this.funcs = list.slice(0, 5).map((raw, i) => {
        const displayRaw = cleanForDisplay(raw);
        return {
          raw: displayRaw || raw,
          color: PALETTE[i % PALETTE.length],
          visible: true,
          compiled: compileMath(displayRaw || raw)
        };
      });
      this.activeIdx = 0;
      this.hoverPt = null;
      this._renderFuncRows();
      this._renderSliders();
      this.draw();
    },

    openWith(exprOrList) {
      this.init();
      if (exprOrList) this.setExpressions(exprOrList);
      this.win.hidden = false;
      requestAnimationFrame(() => this.draw());
    },

    close() {
      if (this.win) this.win.hidden = true;
    },

    _renderPreviewInto(el, rawText, axisVar) {
      if (!el) return;
      const tex = toKatexPreview(rawText);
      if (!tex) { el.innerHTML = ''; return; }
      if (window.katex) {
        try {
          window.katex.render(`f(${axisVar || 'x'}) = ${tex}`, el, { displayMode: false, throwOnError: false });
          return;
        } catch {}
      }
      el.textContent = rawText;
    },

    _renderFuncRows() {
      const box = $('gpFuncs');
      box.innerHTML = this.funcs.map((f, idx) => {
        const c = f.compiled;
        return `
          <div data-fwrap="${idx}">
            <div class="gp-frow ${idx === this.activeIdx ? 'active' : ''}" data-fidx="${idx}">
              <span class="gp-dot ${f.visible ? '' : 'off'}" data-ftoggle="${idx}" style="background:${f.color}" title="Göster/Gizle"></span>
              <span class="gp-lbl">f<sub>${idx + 1}</sub>(${esc(c.axisVar || 'x')}) =</span>
              <input class="gp-in" data-finput="${idx}" value="${esc(f.raw)}" placeholder="ör. x³ - 3x² + 2, sin(2x)" autocomplete="off" spellcheck="false">
              ${this.funcs.length > 1 ? `<button type="button" class="gp-ibtn" data-fdel="${idx}" style="padding:2px 6px">✕</button>` : ''}
            </div>
            ${c.ok ? `<div class="gp-math-prev" data-fprev="${idx}"></div>` : `<div class="gp-err">⚠ ${esc(c.error)}</div>`}
          </div>
        `;
      }).join('');

      this.funcs.forEach((f, idx) => {
        if (f.compiled.ok) {
          this._renderPreviewInto(box.querySelector(`[data-fprev="${idx}"]`), f.raw, f.compiled.axisVar);
        }
      });

      const activeAxis = this.funcs[this.activeIdx]?.compiled?.axisVar || 'x';
      $('gpAxisBadge').textContent = `y = f(${activeAxis})`;
    },

    _renderSliders() {
      const needed = new Set();
      for (const f of this.funcs) {
        if (f.visible && f.compiled.ok) {
          for (const p of f.compiled.params) needed.add(p);
        }
      }
      const box = $('gpSliders');
      if (!needed.size) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = [...needed].map(p => `
        <div class="gp-srow">
          <span>${p} = ${this.params[p].toFixed(1)}</span>
          <input type="range" min="-10" max="10" step="0.1" value="${this.params[p]}" data-param="${p}">
        </div>
      `).join('');
    },

    _computeKeyPoints(xMin, xMax) {
      const pts = [];
      const active = this.funcs[this.activeIdx];
      if (active && active.visible && active.compiled.ok) {
        const fn = x => active.compiled.fn(x, this.params);
        const y0 = fn(0);
        if (Number.isFinite(y0) && Math.abs(y0) < 1e5) {
          pts.push({ x: 0, y: y0, label: `y-kesişim (0, ${y0.toFixed(2)})`, color: active.color });
        }
        const steps = 220;
        const dx = (xMax - xMin) / steps;
        let px = xMin, py = fn(px);
        for (let i = 1; i <= steps; i++) {
          const cx = xMin + i * dx;
          const cy = fn(cx);
          if (Number.isFinite(py) && Number.isFinite(cy) && Math.abs(py) < 1e4 && Math.abs(cy) < 1e4) {
            if (py === 0 || py * cy < 0) {
              let a = px, b = cx, fa = py;
              for (let k = 0; k < 20; k++) {
                const m = 0.5 * (a + b), fm = fn(m);
                if (!Number.isFinite(fm)) break;
                if (fa * fm <= 0) b = m;
                else { a = m; fa = fm; }
              }
              const rx = 0.5 * (a + b);
              if (Math.abs(fn(rx)) < 0.05) {
                pts.push({ x: rx, y: 0, label: `Kök (${rx.toFixed(2)}, 0)`, color: '#FBBF24' });
              }
            }
          }
          px = cx; py = cy;
        }
      }

      const vis = this.funcs.filter(f => f.visible && f.compiled.ok);
      if (vis.length >= 2) {
        const diff = x => vis[0].compiled.fn(x, this.params) - vis[1].compiled.fn(x, this.params);
        const steps = 220, dx = (xMax - xMin) / steps;
        let px = xMin, py = diff(px);
        for (let i = 1; i <= steps; i++) {
          const cx = xMin + i * dx, cy = diff(cx);
          if (Number.isFinite(py) && Number.isFinite(cy) && Math.abs(py) < 1e4 && Math.abs(cy) < 1e4 && py * cy <= 0) {
            let a = px, b = cx, fa = py;
            for (let k = 0; k < 20; k++) {
              const m = 0.5 * (a + b), fm = diff(m);
              if (!Number.isFinite(fm)) break;
              if (fa * fm <= 0) b = m;
              else { a = m; fa = fm; }
            }
            const ix = 0.5 * (a + b), iy = vis[0].compiled.fn(ix, this.params);
            if (Number.isFinite(iy) && Math.abs(diff(ix)) < 0.05) {
              pts.push({ x: ix, y: iy, label: `Kesişim (${ix.toFixed(2)}, ${iy.toFixed(2)})`, color: '#F472B6' });
            }
          }
          px = cx; py = cy;
        }
      }
      this.keyPoints = pts.slice(0, 16);
    },

    _simpsonIntegral(fn, a, b) {
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 0;
      const n = 200;
      const h = (b - a) / n;
      let sum = fn(a) + fn(b);
      for (let i = 1; i < n; i++) {
        const y = fn(a + i * h);
        if (!Number.isFinite(y)) return NaN;
        sum += (i % 2 === 0 ? 2 : 4) * y;
      }
      return (h / 3) * sum;
    },

    draw() {
      const cv = this.canvas;
      if (!cv || this.win.hidden) return;
      const rect = cv.getBoundingClientRect();
      const w = Math.max(280, Math.round(rect.width || 400));
      const h = Math.max(200, Math.round(rect.height || 250));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
      }

      const ctx = cv.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, w, h);

      const { cx, cy, scale } = this.view;
      const toPxX = x => w / 2 + (x - cx) * scale;
      const toPxY = y => h / 2 - (y - cy) * scale;
      const toMathX = px => cx + (px - w / 2) / scale;
      const toMathY = py => cy - (py - h / 2) / scale;

      const xMin = toMathX(0), xMax = toMathX(w);
      const yMin = toMathY(h), yMax = toMathY(0);

      const rawStep = 55 / scale;
      const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const normStep = rawStep / pow10;
      const step = (normStep < 1.5 ? 1 : normStep < 3.5 ? 2 : normStep < 7.5 ? 5 : 10) * pow10;

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = Math.floor(xMin / step) * step; gx <= xMax; gx += step) {
        const px = toPxX(gx);
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let gy = Math.floor(yMin / step) * step; gy <= yMax; gy += step) {
        const py = toPxY(gy);
        ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();

      const ox = toPxX(0), oy = toPxY(0);
      ctx.strokeStyle = 'rgba(226,232,240,0.34)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (ox >= 0 && ox <= w) { ctx.moveTo(ox, 0); ctx.lineTo(ox, h); }
      if (oy >= 0 && oy <= h) { ctx.moveTo(0, oy); ctx.lineTo(w, oy); }
      ctx.stroke();

      ctx.fillStyle = 'rgba(148,163,184,0.85)';
      ctx.font = '10.5px Inter, sans-serif';
      for (let gx = Math.floor(xMin / step) * step; gx <= xMax; gx += step) {
        if (Math.abs(gx) < step * 0.1) continue;
        const px = toPxX(gx);
        const ly = Math.max(12, Math.min(h - 6, oy + 13));
        ctx.fillText(Number(gx.toFixed(4)).toString(), px + 3, ly);
      }
      for (let gy = Math.floor(yMin / step) * step; gy <= yMax; gy += step) {
        if (Math.abs(gy) < step * 0.1) continue;
        const py = toPxY(gy);
        const lx = Math.max(4, Math.min(w - 28, ox + 5));
        ctx.fillText(Number(gy.toFixed(4)).toString(), lx, py - 3);
      }

      const activeFn = this.funcs[this.activeIdx];
      if (this.opts.integral && activeFn && activeFn.visible && activeFn.compiled.ok) {
        const ia = parseFloat($('gpIntA')?.value || '0') || 0;
        const ib = parseFloat($('gpIntB')?.value || '2') || 0;
        const lo = Math.min(ia, ib), hi = Math.max(ia, ib);
        if (hi > lo) {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
          ctx.beginPath();
          ctx.moveTo(toPxX(lo), toPxY(0));
          const samples = 140;
          for (let s = 0; s <= samples; s++) {
            const x = lo + (s / samples) * (hi - lo);
            const y = activeFn.compiled.fn(x, this.params);
            if (Number.isFinite(y)) ctx.lineTo(toPxX(x), toPxY(y));
          }
          ctx.lineTo(toPxX(hi), toPxY(0));
          ctx.closePath();
          ctx.fill();

          const area = this._simpsonIntegral(x => activeFn.compiled.fn(x, this.params), ia, ib);
          const intValEl = $('gpIntVal');
          if (intValEl) intValEl.textContent = Number.isFinite(area) ? `∫ = ${area.toFixed(4)}` : 'Tanımsız aralık';
        }
      }

      for (let fi = 0; fi < this.funcs.length; fi++) {
        const f = this.funcs[fi];
        if (!f.visible || !f.compiled.ok) continue;

        ctx.strokeStyle = f.color;
        ctx.lineWidth = fi === this.activeIdx ? 2.4 : 1.7;
        ctx.beginPath();
        let penDown = false, prevPy = null;
        for (let px = 0; px <= w; px += 1.5) {
          const x = toMathX(px);
          const y = f.compiled.fn(x, this.params);
          if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
            penDown = false; prevPy = null; continue;
          }
          const py = toPxY(y);
          if (prevPy !== null && Math.abs(py - prevPy) > h * 0.85) penDown = false;
          if (!penDown) { ctx.moveTo(px, py); penDown = true; }
          else ctx.lineTo(px, py);
          prevPy = py;
        }
        ctx.stroke();

        if (this.opts.deriv && fi === this.activeIdx) {
          const eps = 1e-5;
          ctx.save();
          ctx.strokeStyle = '#FBBF24';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          let dDown = false, dPrev = null;
          for (let px = 0; px <= w; px += 2) {
            const x = toMathX(px);
            const dy = (f.compiled.fn(x + eps, this.params) - f.compiled.fn(x - eps, this.params)) / (2 * eps);
            if (!Number.isFinite(dy) || Math.abs(dy) > 1e6) { dDown = false; dPrev = null; continue; }
            const py = toPxY(dy);
            if (dPrev !== null && Math.abs(py - dPrev) > h * 0.85) dDown = false;
            if (!dDown) { ctx.moveTo(px, py); dDown = true; }
            else ctx.lineTo(px, py);
            dPrev = py;
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      if (this.opts.roots) {
        this._computeKeyPoints(xMin, xMax);
        for (const kp of this.keyPoints) {
          const px = toPxX(kp.x), py = toPxY(kp.y);
          if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue;
          ctx.fillStyle = kp.color;
          ctx.beginPath();
          ctx.arc(px, py, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#090D16';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      if (this.hoverPt) {
        const { px, py, text } = this.hoverPt;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        $('gpHud').textContent = text;
      }

      ctx.restore();
    },

    _bindEvents() {
      $('gpClose').onclick = () => this.close();

      const head = $('gpDrag');
      head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        head.setPointerCapture(e.pointerId);
        const r = this.win.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY, sl = r.left, st = r.top;
        const mv = ev => {
          const nl = Math.max(8, Math.min(window.innerWidth - r.width - 8, sl + (ev.clientX - sx)));
          const nt = Math.max(8, Math.min(window.innerHeight - r.height - 8, st + (ev.clientY - sy)));
          this.win.style.left = nl + 'px';
          this.win.style.top = nt + 'px';
          this.win.style.right = 'auto';
          this.win.style.bottom = 'auto';
        };
        const up = () => {
          head.removeEventListener('pointermove', mv);
          head.removeEventListener('pointerup', up);
        };
        head.addEventListener('pointermove', mv);
        head.addEventListener('pointerup', up);
      });

      // Hızlı matematik sembol tuşları (x², x³, √, π, θ...)
      $('gpKeypad').addEventListener('click', e => {
        const btn = e.target.closest('[data-ins]');
        if (!btn) return;
        const ins = btn.dataset.ins;
        const inp = $('gpFuncs').querySelector(`[data-finput="${this.activeIdx}"]`);
        if (!inp) return;
        const start = inp.selectionStart ?? inp.value.length;
        const end = inp.selectionEnd ?? inp.value.length;
        inp.value = inp.value.slice(0, start) + ins + inp.value.slice(end);
        inp.focus();
        inp.selectionStart = inp.selectionEnd = start + ins.length;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Fonksiyon girişleri (kullanıcının yazdığı x³ biçimine dokunmaz, altında KaTeX gösterir)
      $('gpFuncs').addEventListener('input', e => {
        const inp = e.target.closest('[data-finput]');
        if (!inp) return;
        const idx = Number(inp.dataset.finput);
        this.activeIdx = idx;
        this.funcs[idx].raw = inp.value;
        this.funcs[idx].compiled = compileMath(inp.value);

        const wrap = inp.closest('[data-fwrap]');
        wrap.querySelectorAll('.gp-err, .gp-math-prev').forEach(n => n.remove());
        const c = this.funcs[idx].compiled;
        if (!c.ok) {
          wrap.insertAdjacentHTML('beforeend', `<div class="gp-err">⚠ ${esc(c.error)}</div>`);
        } else {
          const prevEl = document.createElement('div');
          prevEl.className = 'gp-math-prev';
          wrap.appendChild(prevEl);
          this._renderPreviewInto(prevEl, inp.value, c.axisVar);
        }
        $('gpAxisBadge').textContent = `y = f(${c.axisVar || 'x'})`;
        this._renderSliders();
        this.draw();
      });

      $('gpFuncs').addEventListener('click', e => {
        const tog = e.target.closest('[data-ftoggle]');
        if (tog) {
          const idx = Number(tog.dataset.ftoggle);
          this.funcs[idx].visible = !this.funcs[idx].visible;
          this._renderFuncRows();
          this._renderSliders();
          this.draw();
          return;
        }
        const del = e.target.closest('[data-fdel]');
        if (del) {
          const idx = Number(del.dataset.fdel);
          this.funcs.splice(idx, 1);
          this.activeIdx = Math.max(0, this.activeIdx - 1);
          this._renderFuncRows();
          this._renderSliders();
          this.draw();
          return;
        }
        const row = e.target.closest('[data-fidx]');
        if (row) {
          this.activeIdx = Number(row.dataset.fidx);
          $('gpFuncs').querySelectorAll('.gp-frow').forEach((r, i) => r.classList.toggle('active', i === this.activeIdx));
        }
      });

      $('gpSliders').addEventListener('input', e => {
        const p = e.target.dataset?.param;
        if (!p) return;
        this.params[p] = parseFloat(e.target.value) || 0;
        e.target.previousElementSibling.textContent = `${p} = ${this.params[p].toFixed(1)}`;
        this.draw();
      });

      $('gpAddFn').onclick = () => {
        if (this.funcs.length >= 5) return;
        this.funcs.push({ raw: 'x² - 2', color: PALETTE[this.funcs.length % PALETTE.length], visible: true, compiled: compileMath('x² - 2') });
        this.activeIdx = this.funcs.length - 1;
        this._renderFuncRows();
        this._renderSliders();
        this.draw();
      };

      $('gpDeriv').onclick = () => {
        this.opts.deriv = !this.opts.deriv;
        $('gpDeriv').classList.toggle('on', this.opts.deriv);
        this.draw();
      };

      $('gpIntegral').onclick = () => {
        this.opts.integral = !this.opts.integral;
        $('gpIntegral').classList.toggle('on', this.opts.integral);
        $('gpIntBar').hidden = !this.opts.integral;
        this.draw();
      };

      $('gpRoots').onclick = () => {
        this.opts.roots = !this.opts.roots;
        $('gpRoots').classList.toggle('on', this.opts.roots);
        this.draw();
      };

      $('gpIntA').oninput = () => this.draw();
      $('gpIntB').oninput = () => this.draw();

      $('gpZoomIn').onclick = () => { this.view.scale = Math.min(400, this.view.scale * 1.25); this.draw(); };
      $('gpZoomOut').onclick = () => { this.view.scale = Math.max(4, this.view.scale / 1.25); this.draw(); };
      $('gpReset').onclick = () => { this.view = { cx: 0, cy: 0, scale: 38 }; this.hoverPt = null; $('gpHud').textContent = 'Dokun / sürükle: kaydır'; this.draw(); };

      // Tuvale yapışkan kart olarak sabitle (gerçek KaTeX üslü gösterimle)
      $('gpPinCard').onclick = () => {
        if (!ON.cards || !ON.app?.nb) {
          ON.app?.toast?.('Önce bir defter açmalısın');
          return;
        }
        const dataUrl = this.canvas.toDataURL('image/png');
        const legend = this.funcs
          .filter(f => f.visible && f.compiled.ok)
          .map((f, i) => `- $f_${i + 1}(${f.compiled.axisVar}) = ${toKatexPreview(f.raw)}$`)
          .join('\n');
        const kpText = this.keyPoints.slice(0, 4).map(k => `- ${k.label}`).join('\n');
        const md = `### Fonksiyon Grafiği\n![Grafik](${dataUrl})\n${legend}${kpText ? `\n\n**Kritik Noktalar:**\n${kpText}` : ''}`;
        ON.cards.create(md, ON.app.viewAnchor());
        ON.app.toast('Grafik tuvale kart olarak sabitlendi');
      };

      let dragging = false, lx = 0, ly = 0, pinchDist = 0;
      const pointers = new Map();

      this.canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          dragging = true;
          lx = e.clientX;
          ly = e.clientY;
        } else if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()];
          pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
      });

      this.canvas.addEventListener('pointermove', e => {
        if (pointers.has(e.pointerId)) {
          pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (pointers.size === 2) {
          const [p1, p2] = [...pointers.values()];
          const nd = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (pinchDist > 0 && nd > 0) {
            this.view.scale = Math.max(4, Math.min(400, this.view.scale * (nd / pinchDist)));
            pinchDist = nd;
            this.draw();
          }
          return;
        }
        if (dragging) {
          const dx = e.clientX - lx, dy = e.clientY - ly;
          lx = e.clientX; ly = e.clientY;
          this.view.cx -= dx / this.view.scale;
          this.view.cy += dy / this.view.scale;
          this.draw();
          return;
        }

        const r = this.canvas.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const w = r.width, h = r.height;
        const mathX = this.view.cx + (mx - w / 2) / this.view.scale;

        for (const kp of this.keyPoints) {
          const kpx = w / 2 + (kp.x - this.view.cx) * this.view.scale;
          const kpy = h / 2 - (kp.y - this.view.cy) * this.view.scale;
          if (Math.hypot(mx - kpx, my - kpy) < 14) {
            this.hoverPt = { px: kpx, py: kpy, text: kp.label };
            this.draw();
            return;
          }
        }

        const act = this.funcs[this.activeIdx];
        if (act && act.visible && act.compiled.ok) {
          const fy = act.compiled.fn(mathX, this.params);
          if (Number.isFinite(fy)) {
            const py = h / 2 - (fy - this.view.cy) * this.view.scale;
            this.hoverPt = { px: mx, py, text: `(${mathX.toFixed(2)}, ${fy.toFixed(3)})` };
            this.draw();
          }
        }
      });

      const endPtr = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchDist = 0;
        if (pointers.size === 0) dragging = false;
      };
      this.canvas.addEventListener('pointerup', endPtr);
      this.canvas.addEventListener('pointercancel', endPtr);

      this.canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.view.scale = Math.max(4, Math.min(400, this.view.scale * factor));
        this.draw();
      }, { passive: false });
    }
  };

  ON.GraphPlotter = GraphPlotter;

  /* ================= 5. PDF Seçimi, Kement (S Pen) ve Üst Menü Entegrasyonu ================= */
  document.addEventListener('DOMContentLoaded', () => {
    let cachedSelection = '';
    document.addEventListener('selectionchange', () => {
      const txt = window.getSelection()?.toString()?.trim();
      if (txt) cachedSelection = txt;
    });

    const selMenu = $('selMenu');
    if (selMenu && !$('selGraphBtn')) {
      const btn = document.createElement('button');
      btn.id = 'selGraphBtn';
      btn.type = 'button';
      btn.style.cssText = 'color:#60A5FA;font-weight:600';
      btn.textContent = '📈 Grafik Çiz';
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const raw = (window.getSelection()?.toString()?.trim() || cachedSelection || '').trim();
        selMenu.hidden = true;
        if (!raw) {
          ON.app?.toast?.('Önce bir denklem seçin');
          return;
        }
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        GraphPlotter.openWith(lines.length > 1 ? lines.slice(0, 4) : [raw]);
      });
      selMenu.insertBefore(btn, selMenu.firstChild);
    }

    const gizmoBar = $('gizmoBar');
    if (gizmoBar && !$('gzGraph')) {
      const gBtn = document.createElement('button');
      gBtn.id = 'gzGraph';
      gBtn.type = 'button';
      gBtn.className = 'acc';
      gBtn.title = 'Kementle seçilen el yazısı denklemin grafiğini çiz';
      gBtn.textContent = '📈 Grafik';
      gBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        if (!ON.settings?.key) {
          ON.app?.toast?.('El yazısını okumak için önce Gemini API anahtarını ekle');
          ON.app?.openSettings?.();
          return;
        }

        const gzAi = $('gzAi');
        if (!gzAi || !ON.AI) return;

        const origRunImage = ON.AI.runImage.bind(ON.AI);
        const origOpen = ON.AI.open.bind(ON.AI);
        let capturedCtx = null;

        ON.AI.open = () => {};
        ON.AI.runImage = async function () {
          capturedCtx = this.ctx && !this.ctx.text ? this.ctx : null;
        };

        gzAi.click();

        setTimeout(async () => {
          ON.AI.runImage = origRunImage;
          ON.AI.open = origOpen;

          const ctx = capturedCtx || (ON.AI.ctx && !ON.AI.ctx.text ? ON.AI.ctx : null) || (await ON.app?.contextImage?.());
          if (!ctx || !ctx.b64) {
            ON.app?.toast?.('Kement görüntüsü alınamadı');
            return;
          }

          ON.app?.toast?.('El yazısı denklem okunuyor…');
          try {
            const prompt = [
              'Bu el yazısı çizimindeki matematiksel fonksiyon veya denklemleri oku.',
              'Kurallar:',
              '- SADECE temiz matematiksel ifadeleri JSON dizisi olarak döndür. Örnek: ["x³ - 4x", "2x + 1"]',
              '- Küçük tam sayı üsleri için ², ³, ⁴ üst simgelerini kullan; gereksiz * veya parantez koyma.',
              '- Başına "y =" veya "f(x) =" yazma, açıklama ekleme.'
            ].join('\n');

            const res = await ON.gemini(ON.settings, [
              { inline_data: { mime_type: ctx.mime || 'image/jpeg', data: ctx.b64 } },
              { text: prompt }
            ]);

            const raw = String(res?.text || '').trim();
            const s = raw.indexOf('['), end = raw.lastIndexOf(']');
            let exprs = [];
            if (s !== -1 && end > s) {
              try { exprs = JSON.parse(raw.slice(s, end + 1)); } catch {}
            }
            if (!Array.isArray(exprs) || !exprs.length) {
              exprs = raw.split(/\r?\n/).map(x => x.replace(/^[-*•\d.)]+\s*/, '').trim()).filter(Boolean);
            }
            GraphPlotter.openWith(exprs);
          } catch (err) {
            ON.app?.toast?.('Denklem okunamadı: ' + (err.message || err));
          }
        }, 30);
      });
      gizmoBar.appendChild(gBtn);
    }

    const studyBtn = $('studyBtn');
    if (studyBtn && !$('graphOpenBtn')) {
      const topBtn = document.createElement('button');
      topBtn.id = 'graphOpenBtn';
      topBtn.className = 'ico';
      topBtn.type = 'button';
      topBtn.title = 'Fonksiyon Grafik Çizici';
      topBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15c2-6 4-6 6 0s4 6 6 0"/></svg>`;
      topBtn.onclick = () => {
        if (GraphPlotter.win && !GraphPlotter.win.hidden) GraphPlotter.close();
        else GraphPlotter.openWith();
      };
      studyBtn.parentElement.insertBefore(topBtn, studyBtn);
    }
  });
})();
