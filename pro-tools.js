/* pro-tools.js — Odak Not Mühendislik, S Pen & Active Recall Eklenti Paketi */
(() => {
  'use strict';

  const NS = window.ON || (window.ON = {});
  const FC_KEY = 'on-flashcards-v1';

  const state = {
    canvasLocked: false,
    tapeMode: false,
    pipOpen: false,
    selectedStamp: null,
    flashcards: []
  };

  try {
    state.flashcards = JSON.parse(localStorage.getItem(FC_KEY) || '[]');
  } catch {
    state.flashcards = [];
  }

  const saveFlashcards = () => {
    try { localStorage.setItem(FC_KEY, JSON.stringify(state.flashcards)); } catch {}
  };

  const toast = msg => {
    if (NS.app?.toast) {
      NS.app.toast(msg);
      return;
    }
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._ptT);
    el._ptT = setTimeout(() => el.classList.remove('show'), 2400);
  };

  const getApiKey = () => {
    const inp = document.getElementById('keyIn')?.value?.trim();
    if (inp && inp.startsWith('AIza')) return inp;
    if (NS.settings?.apiKey?.startsWith('AIza')) return NS.settings.apiKey;
    if (NS.settings?.key?.startsWith('AIza')) return NS.settings.key;
    for (let i = 0; i < localStorage.length; i++) {
      const val = localStorage.getItem(localStorage.key(i)) || '';
      const m = val.match(/AIza[0-9A-Za-z_-]{30,}/);
      if (m) return m[0];
    }
    return '';
  };

  const getModelName = () => {
    const custom = document.getElementById('modelCustom')?.value?.trim();
    if (custom) return custom;
    const sel = document.getElementById('modelIn')?.value?.trim();
    return sel || 'gemini-2.5-flash';
  };

  const getWorldScale = () => {
    const wt = document.getElementById('worldTop');
    if (!wt || !wt.offsetWidth) return 1;
    const r = wt.getBoundingClientRect();
    const s = r.width / wt.offsetWidth;
    return s > 0.05 ? s : 1;
  };

  const clientToWorld = (clientX, clientY) => {
    const wt = document.getElementById('worldTop');
    if (!wt) return { x: 140, y: 140 };
    const r = wt.getBoundingClientRect();
    const s = getWorldScale();
    return {
      x: (clientX - r.left) / s,
      y: (clientY - r.top) / s
    };
  };

  const getViewportCenterWorld = () => {
    const stage = document.getElementById('stage');
    if (!stage) return { x: 200, y: 200 };
    const r = stage.getBoundingClientRect();
    return clientToWorld(r.left + r.width * 0.45, r.top + r.height * 0.4);
  };

  /* -------------------- CSS STİLLERİ -------------------- */
  const injectStyles = () => {
    if (document.getElementById('pt-styles')) return;
    const st = document.createElement('style');
    st.id = 'pt-styles';
    st.textContent = `
      .pt-top-btn.active {
        background: rgba(59, 130, 246, 0.25) !important;
        color: #60a5fa !important;
        box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.45);
      }
      #ptEngModal {
        position: fixed;
        top: 56px;
        right: 16px;
        width: 310px;
        max-width: calc(100vw - 24px);
        background: #131824;
        border: 1px solid #263147;
        border-radius: 14px;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.55);
        padding: 12px;
        z-index: 9500;
        color: #f1f5f9;
        font-family: Inter, system-ui, sans-serif;
      }
      #ptEngModal[hidden] { display: none !important; }
      .pt-hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .pt-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .pt-close:hover { background: rgba(255,255,255,.08); color: #fff; }
      .pt-sec-lbl {
        font-size: 11px;
        color: #94a3b8;
        margin: 8px 0 6px;
        font-weight: 500;
      }
      .pt-stamp-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 6px;
      }
      .pt-sbtn {
        display: flex;
        align-items: center;
        gap: 7px;
        background: #1b2234;
        border: 1px solid #2b364e;
        color: #e2e8f0;
        border-radius: 8px;
        padding: 7px 8px;
        font-size: 11.5px;
        cursor: pointer;
        text-align: left;
        transition: background .15s, border-color .15s;
      }
      .pt-sbtn:hover, .pt-sbtn:active {
        background: #243049;
        border-color: #3b82f6;
      }
      .pt-sbtn svg {
        width: 24px;
        height: 16px;
        flex-shrink: 0;
        stroke: #60a5fa;
        fill: none;
        stroke-width: 2;
      }
      .pt-pad-wrap {
        margin-top: 6px;
        background: #0b0e14;
        border: 1px dashed #334155;
        border-radius: 10px;
        padding: 6px;
      }
      #ptShapePad {
        display: block;
        width: 100%;
        height: 135px;
        touch-action: none;
        cursor: crosshair;
        border-radius: 6px;
      }
      .pt-pad-hint {
        font-size: 10.5px;
        color: #64748b;
        margin-top: 4px;
        text-align: center;
      }

      /* Tuval Üzerindeki Mühendislik Damgaları & Şekiller */
      .pt-widget {
        position: absolute;
        user-select: none;
        touch-action: none;
        cursor: grab;
        border: 1px dashed transparent;
        border-radius: 8px;
        padding: 4px;
        transition: border-color .15s;
      }
      .pt-widget.selected, .pt-widget:hover {
        border-color: rgba(96, 165, 250, 0.7);
        background: rgba(59, 130, 246, 0.05);
      }
      .pt-w-ctrl {
        position: absolute;
        top: -30px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
        gap: 3px;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 7px;
        padding: 2px 4px;
        box-shadow: 0 6px 16px rgba(0,0,0,.45);
        z-index: 20;
        white-space: nowrap;
      }
      .pt-widget.selected .pt-w-ctrl, .pt-widget:hover .pt-w-ctrl {
        display: flex;
      }
      .pt-w-ctrl button {
        background: transparent;
        border: none;
        color: #e2e8f0;
        font-size: 11px;
        padding: 2px 5px;
        border-radius: 4px;
        cursor: pointer;
      }
      .pt-w-ctrl button:hover { background: rgba(255,255,255,.12); }
      .pt-w-ctrl button.del { color: #f87171; }
      .pt-stamp-lbl {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        color: #93c5fd;
        margin-top: 2px;
        outline: none;
        cursor: text;
        min-width: 24px;
        user-select: text !important;
        -webkit-user-select: text !important;
      }

      /* Örtü Bandı (Active Recall) */
      .pt-tape {
        position: absolute;
        background: repeating-linear-gradient(
          -45deg,
          #1e293b,
          #1e293b 10px,
          #283548 10px,
          #283548 20px
        );
        border: 1.5px solid #475569;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,.35);
        cursor: pointer;
        opacity: 0.97;
        transition: opacity .18s, background .18s;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 600;
        touch-action: none;
      }
      .pt-tape.revealed {
        opacity: 0.14;
      }
      .pt-tape-del {
        position: absolute;
        top: -9px;
        right: -9px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #ef4444;
        color: #fff;
        border: none;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.9;
      }
      #ptTapePreview {
        position: fixed;
        border: 2px dashed #60a5fa;
        background: rgba(59, 130, 246, 0.18);
        pointer-events: none;
        z-index: 9400;
        border-radius: 6px;
      }

      /* Köşeye Sabitle (PiP) Penceresi */
      #ptPipWin {
        position: fixed;
        top: 62px;
        right: 16px;
        width: 270px;
        height: 195px;
        min-width: 170px;
        min-height: 120px;
        resize: both;
        overflow: hidden;
        background: #0f141f;
        border: 1.5px solid #3b82f6;
        border-radius: 12px;
        box-shadow: 0 14px 36px rgba(0,0,0,.6);
        z-index: 9450;
        display: flex;
        flex-direction: column;
      }
      #ptPipWin[hidden] { display: none !important; }
      .pt-pip-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        background: #172033;
        font-size: 11px;
        font-weight: 600;
        color: #e2e8f0;
        cursor: move;
        touch-action: none;
      }
      .pt-pip-bar input[type="range"] {
        width: 58px;
        accent-color: #3b82f6;
      }
      .pt-pip-body {
        flex: 1;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0b0e14;
        padding: 4px;
      }
      .pt-pip-body img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 4px;
      }

      /* KaTeX & Çözüm Kartları */
      .pt-sol-card {
        position: absolute;
        min-width: 220px;
        max-width: 390px;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid #334155;
        border-left: 3px solid #3b82f6;
        border-radius: 10px;
        padding: 10px 12px;
        color: #f1f5f9;
        font-size: 13px;
        line-height: 1.5;
        box-shadow: 0 10px 28px rgba(0,0,0,.45);
        touch-action: none;
        cursor: grab;
      }
      .pt-sol-hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        color: #60a5fa;
        margin-bottom: 6px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        padding-bottom: 4px;
      }
      .pt-sol-body {
        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: text;
        word-break: break-word;
      }
      .pt-si-box {
        margin-top: 8px;
        padding: 6px 8px;
        background: rgba(34, 197, 94, 0.12);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 6px;
        font-size: 11.5px;
        color: #86efac;
      }

      /* Flashcard Paneli (Çalışma Özeti İçi) */
      #ptFcSection {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #263147;
      }
      .pt-fc-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 8px;
        max-height: 210px;
        overflow-y: auto;
        margin-top: 8px;
      }
      .pt-fc-item {
        background: #171e2e;
        border: 1px solid #2b3750;
        border-radius: 9px;
        padding: 9px;
        cursor: pointer;
        position: relative;
      }
      .pt-fc-item b { color: #60a5fa; font-size: 12.5px; display: block; margin-bottom: 4px; }
      .pt-fc-item p { font-size: 11.5px; color: #cbd5e1; margin: 0; }
      .pt-fc-acts { display: flex; gap: 4px; margin-top: 6px; }
      .pt-fc-acts button {
        font-size: 10.5px;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #334155;
        background: #0f172a;
        color: #e2e8f0;
        cursor: pointer;
      }
    `;
    document.head.appendChild(st);
  };

  /* -------------------- MÜHENDİSLİK DAMGALARI & AKILLI ŞEKİL -------------------- */
  const STAMPS = [
    {
      id: 'resistor',
      name: 'Direnç (R)',
      label: '10kΩ',
      w: 110,
      h: 44,
      svg: `<svg viewBox="0 0 110 44" width="100%" height="100%"><line x1="0" y1="22" x2="22" y2="22"/><polyline points="22,22 28,10 38,34 48,10 58,34 68,10 78,34 84,22"/><line x1="84" y1="22" x2="110" y2="22"/></svg>`
    },
    {
      id: 'capacitor',
      name: 'Kondansatör (C)',
      label: '100nF',
      w: 96,
      h: 48,
      svg: `<svg viewBox="0 0 96 48" width="100%" height="100%"><line x1="0" y1="24" x2="41" y2="24"/><line x1="41" y1="6" x2="41" y2="42"/><line x1="55" y1="6" x2="55" y2="42"/><line x1="55" y1="24" x2="96" y2="24"/></svg>`
    },
    {
      id: 'inductor',
      name: 'Bobin (L)',
      label: '10mH',
      w: 116,
      h: 44,
      svg: `<svg viewBox="0 0 116 44" width="100%" height="100%"><line x1="0" y1="26" x2="20" y2="26"/><path d="M20 26 A9 12 0 0 1 38 26 A9 12 0 0 1 56 26 A9 12 0 0 1 74 26 A9 12 0 0 1 92 26"/><line x1="92" y1="26" x2="116" y2="26"/></svg>`
    },
    {
      id: 'dc',
      name: 'DC Kaynak',
      label: '12V',
      w: 68,
      h: 88,
      svg: `<svg viewBox="0 0 68 88" width="100%" height="100%"><line x1="34" y1="0" x2="34" y2="20"/><circle cx="34" cy="44" r="24"/><line x1="34" y1="27" x2="34" y2="37"/><line x1="29" y1="32" x2="39" y2="32"/><line x1="29" y1="56" x2="39" y2="56"/><line x1="34" y1="68" x2="34" y2="88"/></svg>`
    },
    {
      id: 'ac',
      name: 'AC Kaynak',
      label: '220V~',
      w: 68,
      h: 88,
      svg: `<svg viewBox="0 0 68 88" width="100%" height="100%"><line x1="34" y1="0" x2="34" y2="20"/><circle cx="34" cy="44" r="24"/><path d="M22 44 Q28 32 34 44 T46 44"/><line x1="34" y1="68" x2="34" y2="88"/></svg>`
    },
    {
      id: 'gnd',
      name: 'Toprak (GND)',
      label: 'GND',
      w: 60,
      h: 64,
      svg: `<svg viewBox="0 0 60 64" width="100%" height="100%"><line x1="30" y1="0" x2="30" y2="32"/><line x1="10" y1="32" x2="50" y2="32"/><line x1="17" y1="42" x2="43" y2="42"/><line x1="24" y1="52" x2="36" y2="52"/></svg>`
    },
    {
      id: 'diode',
      name: 'Diyot',
      label: '1N4148',
      w: 96,
      h: 48,
      svg: `<svg viewBox="0 0 96 48" width="100%" height="100%"><line x1="0" y1="24" x2="34" y2="24"/><polygon points="34,10 34,38 60,24"/><line x1="60" y1="10" x2="60" y2="38"/><line x1="60" y1="24" x2="96" y2="24"/></svg>`
    },
    {
      id: 'opamp',
      name: 'Op-Amp',
      label: 'Op-Amp',
      w: 116,
      h: 84,
      svg: `<svg viewBox="0 0 116 84" width="100%" height="100%"><line x1="0" y1="26" x2="26" y2="26"/><line x1="0" y1="58" x2="26" y2="58"/><polygon points="26,10 26,74 88,42"/><line x1="32" y1="26" x2="40" y2="26"/><line x1="32" y1="58" x2="40" y2="58"/><line x1="36" y1="54" x2="36" y2="62"/><line x1="88" y1="42" x2="116" y2="42"/></svg>`
    },
    {
      id: 'axes',
      name: '2B Eksen',
      label: 'f(x)',
      w: 140,
      h: 140,
      svg: `<svg viewBox="0 0 140 140" width="100%" height="100%"><line x1="10" y1="70" x2="130" y2="70"/><polyline points="122,64 130,70 122,76"/><line x1="70" y1="130" x2="70" y2="10"/><polyline points="64,18 70,10 76,18"/></svg>`
    },
    {
      id: 'unitcircle',
      name: 'Birim Çember',
      label: 'r = 1',
      w: 140,
      h: 140,
      svg: `<svg viewBox="0 0 140 140" width="100%" height="100%"><line x1="8" y1="70" x2="132" y2="70"/><line x1="70" y1="132" x2="70" y2="8"/><circle cx="70" cy="70" r="46"/></svg>`
    }
  ];

  const makeWidgetDraggable = (el, handle = el) => {
    let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0;

    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input, [contenteditable="true"]')) return;
      e.stopPropagation();
      document.querySelectorAll('.pt-widget.selected').forEach(w => w.classList.remove('selected'));
      el.classList.add('selected');
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseFloat(el.style.left) || 0;
      origTop = parseFloat(el.style.top) || 0;
      handle.setPointerCapture?.(e.pointerId);
    });

    handle.addEventListener('pointermove', e => {
      if (!dragging) return;
      e.stopPropagation();
      const s = getWorldScale();
      el.style.left = (origLeft + (e.clientX - startX) / s) + 'px';
      el.style.top = (origTop + (e.clientY - startY) / s) + 'px';
    });

    const endDrag = e => {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture?.(e.pointerId); } catch {}
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  };

  const spawnVectorWidget = ({ svgMarkup, labelText = '', w = 110, h = 60, x, y }) => {
    const wt = document.getElementById('worldTop');
    if (!wt) return;
    const pos = (typeof x === 'number' && typeof y === 'number') ? { x, y } : getViewportCenterWorld();

    const box = document.createElement('div');
    box.className = 'pt-widget selected';
    box.style.left = pos.x + 'px';
    box.style.top = pos.y + 'px';

    let rot = 0;
    let curW = w;
    let curH = h;

    const ctrl = document.createElement('div');
    ctrl.className = 'pt-w-ctrl';
    ctrl.innerHTML = `
      <button type="button" data-act="rot" title="45° Döndür">↻</button>
      <button type="button" data-act="inc" title="Büyüt">+</button>
      <button type="button" data-act="dec" title="Küçült">−</button>
      <button type="button" data-act="del" class="del" title="Sil">×</button>
    `;

    const svgWrap = document.createElement('div');
    svgWrap.style.width = curW + 'px';
    svgWrap.style.height = curH + 'px';
    svgWrap.style.transition = 'transform .12s';
    svgWrap.innerHTML = svgMarkup;
    const svgEl = svgWrap.querySelector('svg');
    if (svgEl) {
      svgEl.style.stroke = '#60a5fa';
      svgEl.style.fill = 'none';
      svgEl.style.strokeWidth = '2.4';
      svgEl.style.strokeLinecap = 'round';
      svgEl.style.strokeLinejoin = 'round';
    }

    box.appendChild(ctrl);
    box.appendChild(svgWrap);

    if (labelText) {
      const lbl = document.createElement('div');
      lbl.className = 'pt-stamp-lbl';
      lbl.contentEditable = 'true';
      lbl.textContent = labelText;
      box.appendChild(lbl);
    }

    ctrl.addEventListener('click', e => {
      e.stopPropagation();
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'rot') {
        rot = (rot + 45) % 360;
        svgWrap.style.transform = `rotate(${rot}deg)`;
      } else if (act === 'inc') {
        curW = Math.round(curW * 1.18);
        curH = Math.round(curH * 1.18);
        svgWrap.style.width = curW + 'px';
        svgWrap.style.height = curH + 'px';
      } else if (act === 'dec') {
        curW = Math.max(36, Math.round(curW * 0.85));
        curH = Math.max(24, Math.round(curH * 0.85));
        svgWrap.style.width = curW + 'px';
        svgWrap.style.height = curH + 'px';
      } else if (act === 'del') {
        box.remove();
      }
    });

    document.querySelectorAll('.pt-widget.selected').forEach(el => el.classList.remove('selected'));
    wt.appendChild(box);
    makeWidgetDraggable(box);
  };

  /* -------------------- AKILLI ŞEKİL ALGILAMA -------------------- */
  const classifyAndSpawnShape = pts => {
    if (pts.length < 5) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pathLen = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (i > 0) pathLen += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    }
    const bw = Math.max(24, maxX - minX);
    const bh = Math.max(24, maxY - minY);
    const diag = Math.hypot(bw, bh);
    const start = pts[0];
    const end = pts[pts.length - 1];
    const endDist = Math.hypot(end.x - start.x, end.y - start.y);

    // 1. Doğru veya Ok (Açık çizgi)
    if (endDist > diag * 0.65 && pathLen < endDist * 1.28) {
      let dx = end.x - start.x;
      let dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      // Yatay veya dikey yakınsa hizala
      if (Math.abs(dy) < Math.abs(dx) * 0.14) dy = 0;
      else if (Math.abs(dx) < Math.abs(dy) * 0.14) dx = 0;

      const w = Math.max(40, Math.abs(dx) + 24);
      const h = Math.max(30, Math.abs(dy) + 24);
      const x1 = dx >= 0 ? 12 : w - 12;
      const y1 = dy >= 0 ? 12 : h - 12;
      const x2 = dx >= 0 ? w - 12 : 12;
      const y2 = dy >= 0 ? h - 12 : 12;

      // Uçta ok başı kıvrımı varsa ok, yoksa düz doğru
      const isArrow = pathLen > endDist * 1.09;
      if (isArrow) {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const ax1 = x2 - 12 * Math.cos(a - 0.45);
        const ay1 = y2 - 12 * Math.sin(a - 0.45);
        const ax2 = x2 - 12 * Math.cos(a + 0.45);
        const ay2 = y2 - 12 * Math.sin(a + 0.45);
        spawnVectorWidget({
          w, h,
          svgMarkup: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><polyline points="${ax1.toFixed(1)},${ay1.toFixed(1)} ${x2},${y2} ${ax2.toFixed(1)},${ay2.toFixed(1)}"/></svg>`
        });
        toast('Ok şekli tuvale eklendi');
      } else {
        spawnVectorWidget({
          w, h,
          svgMarkup: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/></svg>`
        });
        toast('Doğru çizgi tuvale eklendi');
      }
      return;
    }

    // Kapalı şekiller: Daire / Üçgen / Dikdörtgen
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = bw / 2;
    const ry = bh / 2;
    let radialErr = 0;
    for (const p of pts) {
      const nx = (p.x - cx) / rx;
      const ny = (p.y - cy) / ry;
      radialErr += Math.abs(Math.hypot(nx, ny) - 1);
    }
    radialErr /= pts.length;

    const w = Math.round(bw * 1.15);
    const h = Math.round(bh * 1.15);

    if (radialErr < 0.16) {
      spawnVectorWidget({
        w, h,
        svgMarkup: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 6}" ry="${h / 2 - 6}"/></svg>`
      });
      toast('Daire / Elips tuvale eklendi');
      return;
    }

    // Üst yarı genişliği vs alt yarı genişliği ile üçgen / dikdörtgen ayrımı
    let topSpread = 0, botSpread = 0;
    const midY = (minY + maxY) / 2;
    let topMin = Infinity, topMax = -Infinity, botMin = Infinity, botMax = -Infinity;
    for (const p of pts) {
      if (p.y < midY - bh * 0.15) {
        if (p.x < topMin) topMin = p.x;
        if (p.x > topMax) topMax = p.x;
      } else if (p.y > midY + bh * 0.15) {
        if (p.x < botMin) botMin = p.x;
        if (p.x > botMax) botMax = p.x;
      }
    }
    topSpread = topMax > topMin ? (topMax - topMin) : 0;
    botSpread = botMax > botMin ? (botMax - botMin) : 0;

    if (topSpread < botSpread * 0.55 || botSpread < topSpread * 0.55) {
      const inverted = botSpread < topSpread * 0.55;
      const poly = inverted
        ? `6,6 ${w - 6},6 ${w / 2},${h - 6}`
        : `${w / 2},6 ${w - 6},${h - 6} 6,${h - 6}`;
      spawnVectorWidget({
        w, h,
        svgMarkup: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><polygon points="${poly}"/></svg>`
      });
      toast('Üçgen tuvale eklendi');
    } else {
      spawnVectorWidget({
        w, h,
        svgMarkup: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><rect x="6" y="6" width="${w - 12}" height="${h - 12}" rx="4"/></svg>`
      });
      toast('Dikdörtgen tuvale eklendi');
    }
  };

  /* -------------------- ÖRTÜ BANDI (ACTIVE RECALL) -------------------- */
  const initTapeTool = () => {
    const stage = document.getElementById('stage');
    const wt = document.getElementById('worldTop');
    if (!stage || !wt) return;

    let drawing = false, sx = 0, sy = 0, preview = null;

    stage.addEventListener('pointerdown', e => {
      if (!state.tapeMode) return;
      if (e.target.closest('[data-ui], .pt-tape')) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      drawing = true;
      sx = e.clientX;
      sy = e.clientY;
      preview = document.createElement('div');
      preview.id = 'ptTapePreview';
      preview.style.left = sx + 'px';
      preview.style.top = sy + 'px';
      preview.style.width = '0px';
      preview.style.height = '0px';
      document.body.appendChild(preview);
    }, { capture: true });

    window.addEventListener('pointermove', e => {
      if (!drawing || !preview) return;
      const x = Math.min(sx, e.clientX);
      const y = Math.min(sy, e.clientY);
      const w = Math.abs(e.clientX - sx);
      const h = Math.abs(e.clientY - sy);
      preview.style.left = x + 'px';
      preview.style.top = y + 'px';
      preview.style.width = w + 'px';
      preview.style.height = h + 'px';
    }, { capture: true });

    window.addEventListener('pointerup', e => {
      if (!drawing) return;
      drawing = false;
      preview?.remove();
      preview = null;

      const x1 = Math.min(sx, e.clientX);
      const y1 = Math.min(sy, e.clientY);
      const x2 = Math.max(sx, e.clientX);
      const y2 = Math.max(sy, e.clientY);
      if (x2 - x1 < 18 || y2 - y1 < 12) return;

      const p1 = clientToWorld(x1, y1);
      const p2 = clientToWorld(x2, y2);

      const tape = document.createElement('div');
      tape.className = 'pt-tape';
      tape.style.left = p1.x + 'px';
      tape.style.top = p1.y + 'px';
      tape.style.width = Math.max(24, p2.x - p1.x) + 'px';
      tape.style.height = Math.max(18, p2.y - p1.y) + 'px';
      tape.textContent = 'Dokun: Göster / Gizle';

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'pt-tape-del';
      del.textContent = '×';
      del.addEventListener('click', ev => {
        ev.stopPropagation();
        tape.remove();
      });

      tape.addEventListener('click', ev => {
        ev.stopPropagation();
        tape.classList.toggle('revealed');
      });

      tape.appendChild(del);
      wt.appendChild(tape);
    }, { capture: true });
  };

  /* -------------------- KÖŞEYE SABİTLE (PiP) -------------------- */
  const captureStageImage = (cropRect = null) => {
    const stage = document.getElementById('stage');
    if (!stage) return '';
    const sr = stage.getBoundingClientRect();
    const out = document.createElement('canvas');
    const sx = cropRect ? Math.max(0, cropRect.x) : 0;
    const sy = cropRect ? Math.max(0, cropRect.y) : 0;
    const sw = cropRect ? Math.min(sr.width - sx, cropRect.w) : sr.width;
    const sh = cropRect ? Math.min(sr.height - sy, cropRect.h) : sr.height;

    out.width = Math.max(100, Math.round(sw));
    out.height = Math.max(80, Math.round(sh));
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, out.width, out.height);

    const layers = [
      ...document.querySelectorAll('#world canvas'),
      document.getElementById('hlCanvas'),
      document.getElementById('inkCanvas')
    ].filter(Boolean);

    layers.forEach(c => {
      try {
        const cr = c.getBoundingClientRect();
        if (!cr.width || !cr.height) return;
        const dx = (cr.left - sr.left) - sx;
        const dy = (cr.top - sr.top) - sy;
        ctx.drawImage(c, dx, dy, cr.width, cr.height);
      } catch {}
    });

    try {
      return out.toDataURL('image/png');
    } catch {
      return '';
    }
  };

  const openPipWithDataUrl = dataUrl => {
    let win = document.getElementById('ptPipWin');
    if (!win) {
      win = document.createElement('div');
      win.id = 'ptPipWin';
      win.innerHTML = `
        <div class="pt-pip-bar">
          <span>📌 Sabit Referans</span>
          <span style="flex:1"></span>
          <input type="range" id="ptPipOp" min="0.25" max="1" step="0.05" value="0.95" title="Saydamlık">
          <button type="button" class="pt-close" id="ptPipRefresh" title="Güncelle">🔄</button>
          <button type="button" class="pt-close" id="ptPipClose" title="Kapat">×</button>
        </div>
        <div class="pt-pip-body"><img id="ptPipImg" alt="Referans"></div>
      `;
      document.body.appendChild(win);

      const bar = win.querySelector('.pt-pip-bar');
      let dragging = false, sx = 0, sy = 0, ol = 0, ot = 0;
      bar.addEventListener('pointerdown', e => {
        if (e.target.closest('button, input')) return;
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        const r = win.getBoundingClientRect();
        ol = r.left;
        ot = r.top;
        bar.setPointerCapture?.(e.pointerId);
      });
      bar.addEventListener('pointermove', e => {
        if (!dragging) return;
        win.style.left = Math.max(4, ol + (e.clientX - sx)) + 'px';
        win.style.top = Math.max(4, ot + (e.clientY - sy)) + 'px';
        win.style.right = 'auto';
      });
      bar.addEventListener('pointerup', e => {
        dragging = false;
        try { bar.releasePointerCapture?.(e.pointerId); } catch {}
      });

      win.querySelector('#ptPipOp').addEventListener('input', e => {
        win.style.opacity = e.target.value;
      });
      win.querySelector('#ptPipRefresh').addEventListener('click', () => {
        const fresh = captureStageImage();
        if (fresh) win.querySelector('#ptPipImg').src = fresh;
      });
      win.querySelector('#ptPipClose').addEventListener('click', () => {
        win.hidden = true;
      });
    }
    const img = win.querySelector('#ptPipImg');
    if (img && dataUrl) img.src = dataUrl;
    win.hidden = false;
  };

  /* -------------------- KEMENT (LASSO) YAPAY ZEKA & GRAFİK -------------------- */
  const getLassoStageRect = () => {
    const stage = document.getElementById('stage');
    const live = document.getElementById('liveCanvas');
    const gz = document.getElementById('gizmoBar');
    if (!stage) return null;
    const sr = stage.getBoundingClientRect();

    if (live && live.width && live.height) {
      try {
        const ctx = live.getContext('2d');
        const img = ctx.getImageData(0, 0, live.width, live.height).data;
        let minX = live.width, minY = live.height, maxX = 0, maxY = 0, found = false;
        for (let y = 0; y < live.height; y += 3) {
          for (let x = 0; x < live.width; x += 3) {
            if (img[(y * live.width + x) * 4 + 3] > 20) {
              found = true;
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (found && maxX - minX > 16 && maxY - minY > 16) {
          const scaleX = sr.width / live.width;
          const scaleY = sr.height / live.height;
          return {
            x: Math.max(0, minX * scaleX - 14),
            y: Math.max(0, minY * scaleY - 14),
            w: Math.min(sr.width, (maxX - minX) * scaleX + 28),
            h: Math.min(sr.height, (maxY - minY) * scaleY + 28)
          };
        }
      } catch {}
    }

    if (gz && !gz.hidden) {
      const gr = gz.getBoundingClientRect();
      return {
        x: Math.max(0, (gr.left - sr.left) - 40),
        y: Math.max(0, (gr.bottom - sr.top) + 8),
        w: Math.min(sr.width, 320),
        h: Math.min(sr.height, 220)
      };
    }
    return { x: 40, y: 80, w: Math.min(340, sr.width - 80), h: Math.min(240, sr.height - 140) };
  };

  const askGeminiVision = async (base64Png, promptText) => {
    const key = getApiKey();
    if (!key) {
      toast('Önce Ayarlar\'dan Gemini API anahtarını gir');
      document.getElementById('openSettings')?.click();
      return null;
    }
    const model = getModelName();
    const cleanB64 = base64Png.replace(/^data:image\/\w+;base64,/, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: 'image/png', data: cleanB64 } }
          ]
        }]
      })
    });
    if (!res.ok) throw new Error(`API Hatası (${res.status})`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  };

  const spawnSolutionCard = ({ title, htmlBody, siText = '' }) => {
    const wt = document.getElementById('worldTop');
    if (!wt) return;
    const pos = getViewportCenterWorld();
    const card = document.createElement('div');
    card.className = 'pt-sol-card';
    card.style.left = pos.x + 'px';
    card.style.top = pos.y + 'px';

    card.innerHTML = `
      <div class="pt-sol-hdr">
        <span>${title}</span>
        <button type="button" class="pt-close" title="Kapat">×</button>
      </div>
      <div class="pt-sol-body">${htmlBody}</div>
      ${siText ? `<div class="pt-si-box"><b>SI Birim Kontrolü:</b> ${siText}</div>` : ''}
    `;

    card.querySelector('.pt-close').addEventListener('click', e => {
      e.stopPropagation();
      card.remove();
    });

    wt.appendChild(card);
    makeWidgetDraggable(card);
  };

  const openGraphWithFormula = expr => {
    const graphBtn = [...document.querySelectorAll('#top button')].find(b =>
      b.title?.toLowerCase().includes('grafik') || b.id?.toLowerCase().includes('graph')
    );
    if (graphBtn && !document.getElementById('onGraphWin')) {
      graphBtn.click();
    }
    setTimeout(() => {
      const win = document.getElementById('onGraphWin');
      if (!win) {
        toast('Grafik penceresi açılamadı');
        return;
      }
      win.hidden = false;
      const inp = win.querySelector('input[type="text"], input:not([type])');
      if (inp) {
        inp.value = expr;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const plotBtn = [...win.querySelectorAll('button')].find(b => /çiz|ekle|plot/i.test(b.textContent || ''));
        plotBtn?.click();
      }
    }, 120);
  };

  const enhanceGizmoBar = () => {
    const gz = document.getElementById('gizmoBar');
    if (!gz || gz.dataset.ptEnhanced === '1') return;
    gz.dataset.ptEnhanced = '1';

    const makeBtn = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', e => {
        e.stopPropagation();
        fn();
      });
      gz.appendChild(b);
    };

    makeBtn('∑ KaTeX', 'El yazısı denklemi KaTeX kartına çevir', async () => {
      const rect = getLassoStageRect();
      const img = captureStageImage(rect);
      if (!img) return;
      toast('Denklem okunuyor...');
      try {
        const latex = await askGeminiVision(
          img,
          'Görseldeki el yazısı matematik veya mühendislik denklemini yalnızca saf LaTeX formatında yaz. Açıklama ekleme, sadece LaTeX ifadesini ver.'
        );
        if (!latex) return;
        const clean = latex.replace(/```latex|```|\$\$/g, '').trim();
        let rendered = clean;
        if (window.katex?.renderToString) {
          try { rendered = window.katex.renderToString(clean, { displayMode: true, throwOnError: false }); } catch {}
        }
        spawnSolutionCard({ title: '∑ KaTeX Formül', htmlBody: rendered });
        toast('KaTeX kartı tuvale eklendi');
      } catch (err) {
        toast('Okuma hatası: ' + err.message);
      }
    });

    makeBtn('🧮 Çöz & Birim', 'Soruyu adım adım çöz ve SI birim kontrolü yap', async () => {
      const rect = getLassoStageRect();
      const img = captureStageImage(rect);
      if (!img) return;
      toast('Soru çözülüyor ve SI birimleri kontrol ediliyor...');
      try {
        const ans = await askGeminiVision(
          img,
          'Görseldeki mühendislik/fizik/kalkülüs sorusunu Türkçe olarak kısa ve net adımlarla çöz. En sona "SI_BIRIM:" etiketiyle kullanılan tüm büyüklüklerin SI birim ve boyut analizini (ör
