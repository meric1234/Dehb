/* =====================================================================
   Odak Not — quiz.js (İnteraktif Sınav, S Pen Karalama & Akıllı Tekrar)
   ===================================================================== */
'use strict';
(() => {
  const ON = window.ON;
  if (!ON || !ON.StudyGuideBuilder) return;

  const $ = id => document.getElementById(id);
  const esc = ON.esc || (s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])));

  function injectStyles() {
    if ($('on-quiz-style')) return;
    const st = document.createElement('style');
    st.id = 'on-quiz-style';
    st.textContent = `
      #studyDlg .card.wide { max-height: 88dvh; overflow-y: auto; }
      #sgQuizOut { white-space: normal !important; max-height: none !important; padding: 0 !important; background: transparent !important; border: none !important; overflow: visible !important; }
      #onQuizApp { margin-top: 10px; display: flex; flex-direction: column; gap: 12px; color: #F2EFFB; font-family: inherit; }
      .qz-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); }
      .qz-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; font-weight: 600; }
      .qz-badge { padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(123,82,219,.22); color: #CBB7FF; border: 1px solid rgba(123,82,219,.4); font-variant-numeric: tabular-nums; }
      .qz-badge.ok { background: rgba(46,204,113,.16); color: #7EE8A8; border-color: rgba(46,204,113,.35); }
      .qz-badge.bad { background: rgba(255,90,126,.16); color: #FF9BB0; border-color: rgba(255,90,126,.35); }
      .qz-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .qz-pill { padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; background: rgba(255,255,255,.06); color: #E2DCF5; border: 1px solid rgba(255,255,255,.1); cursor: pointer; transition: .15s; }
      .qz-pill:hover:not(:disabled) { background: rgba(255,255,255,.12); }
      .qz-pill.on { background: #7B52DB; color: #fff; border-color: #9B7BFF; }
      .qz-dots { display: flex; flex-wrap: wrap; gap: 6px; }
      .qz-dot { width: 28px; height: 28px; border-radius: 8px; font-size: 12px; font-weight: 700; display: grid; place-items: center; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: #D8D1EC; cursor: pointer; }
      .qz-dot.cur { outline: 2px solid #9B7BFF; outline-offset: 1px; }
      .qz-dot.correct { background: rgba(46,204,113,.22); border-color: #2ECC71; color: #9CF5BE; }
      .qz-dot.wrong { background: rgba(255,90,126,.22); border-color: #FF5A7E; color: #FFADC0; }
      .qz-card { padding: 14px 16px; border-radius: 14px; background: rgba(18,15,29,.9); border: 1px solid rgba(255,255,255,.1); display: flex; flex-direction: column; gap: 11px; }
      .qz-qhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .qz-qnum { font-size: 12px; font-weight: 700; color: #A89BC9; text-transform: uppercase; letter-spacing: .04em; }
      .qz-diff { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(255,255,255,.06); color: #BFB5DA; }
      .qz-qtext { font-size: 15px; line-height: 1.55; font-weight: 500; color: #F5F2FC; }
      .qz-opts { display: flex; flex-direction: column; gap: 8px; }
      .qz-opt { display: flex; align-items: flex-start; gap: 10px; text-align: left; padding: 10px 12px; border-radius: 11px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.11); color: #ECE7FA; font-size: 14px; line-height: 1.45; cursor: pointer; transition: .15s; }
      .qz-opt:hover:not(:disabled) { background: rgba(123,82,219,.16); border-color: rgba(155,123,255,.45); }
      .qz-opt:disabled { cursor: default; }
      .qz-opt .key { flex: 0 0 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.08); color: #D7CFF0; }
      .qz-opt.correct { background: rgba(46,204,113,.16); border-color: #2ECC71; color: #E8FFF1; }
      .qz-opt.correct .key { background: #2ECC71; color: #082414; }
      .qz-opt.wrong { background: rgba(255,90,126,.16); border-color: #FF5A7E; color: #FFE8EE; }
      .qz-opt.wrong .key { background: #FF5A7E; color: #2B0610; }
      .qz-hint-box { padding: 9px 12px; border-radius: 10px; background: rgba(255,184,107,.1); border: 1px solid rgba(255,184,107,.3); color: #FFD8A8; font-size: 13px; line-height: 1.45; }
      .qz-exp { padding: 11px 13px; border-radius: 11px; background: rgba(95,211,198,.09); border: 1px solid rgba(95,211,198,.28); color: #D8F7F3; font-size: 13.5px; line-height: 1.55; }
      .qz-exp b { color: #7EECE0; display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
      .qz-scratch { border-radius: 10px; border: 1px dashed rgba(155,123,255,.4); background: #12101C; overflow: hidden; }
      .qz-scratch-bar { display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: rgba(255,255,255,.04); font-size: 11px; color: #BFB5DA; }
      .qz-scratch canvas { display: block; width: 100%; height: 150px; touch-action: none; cursor: crosshair; }
      .qz-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
      .qz-summary { padding: 14px 16px; border-radius: 14px; background: linear-gradient(135deg, rgba(123,82,219,.22), rgba(95,211,198,.12)); border: 1px solid rgba(155,123,255,.35); display: flex; flex-direction: column; gap: 10px; }
      .qz-summary-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .qz-loading { padding: 18px; text-align: center; border-radius: 12px; background: rgba(255,255,255,.03); border: 1px dashed rgba(255,255,255,.15); font-size: 13.5px; color: #CBB7FF; }
    `;
    document.head.appendChild(st);
  }

  function formatRichText(raw) {
    let html = esc(String(raw || ''));
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    if (window.katex) {
      html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
        try { return window.katex.renderToString(tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), { displayMode: true, throwOnError: false }); }
        catch { return `$$${tex}$$`; }
      });
      html = html.replace(/\$([^$\n]+?)\$/g, (_, tex) => {
        try { return window.katex.renderToString(tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), { displayMode: false, throwOnError: false }); }
        catch { return `$${tex}$`; }
      });
    } else if (window.prettifyMathText) {
      html = window.prettifyMathText(html);
    }
    return html;
  }

  function renderMathIn(el) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch {}
    }
  }

  function getQuizMount() {
    const box = $('sgQuiz');
    const out = $('sgQuizOut');
    if (box) box.hidden = false;
    if (out) {
      out.innerHTML = '';
      const mount = document.createElement('div');
      mount.id = 'onQuizApp';
      out.appendChild(mount);
      return mount;
    }
    return null;
  }

  async function gatherSourceContext(guideInstance) {
    const app = ON.app;
    const chunks = [];

    const existingGuide = guideInstance.md || guideInstance.guide || guideInstance.summary || guideInstance.content || '';
    if (existingGuide && existingGuide.trim().length > 30) {
      chunks.push('Çalışma Rehberi Özeti:\n' + existingGuide.trim().slice(0, 8000));
    } else {
      const listTxt = $('sgList')?.innerText?.trim();
      if (listTxt && listTxt.length > 30) {
        chunks.push('Çalışma Özeti Maddeleri:\n' + listTxt.slice(0, 8000));
      }
    }

    if (app.nb) {
      const cardTexts = (app.nb.cards || []).map(c => `- ${c.title}: ${c.md}`).join('\n');
      if (cardTexts) chunks.push('Sabitlenmiş Bilgi Kartları:\n' + cardTexts.slice(0, 3000));

      const objTexts = (app.nb.objects || []).filter(o => o.type === 'text' && o.text?.trim()).map(o => o.text.trim()).join('\n');
      if (objTexts) chunks.push('Sayfa Metin Kutuları:\n' + objTexts.slice(0, 3000));

      if (app.search && typeof app.search.pageText === 'function') {
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
    if (chunks.join('').length < 250 && app.contextImage) {
      try {
        const img = await app.contextImage();
        if (img && img.b64) {
          imgPart = { inlineData: { mimeType: img.mime || 'image/jpeg', data: img.b64 } };
        }
      } catch {}
    }

    return { text: chunks.join('\n\n'), imgPart };
  }

  function parseQuizJSON(raw) {
    const s = String(raw || '').trim();
    const start = s.indexOf('[');
    const end = s.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    const jsonStr = s.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr) || !arr.length) return null;

    return arr.map((item, idx) => {
      const opts = Array.isArray(item.options) ? item.options.slice(0, 4).map(o => String(o).replace(/^[A-Da-d][).:\-]\s*/, '').trim()) : [];
      while (opts.length < 4) opts.push('—');
      let ans = Number(item.answer);
      if (!Number.isInteger(ans) || ans < 0 || ans > 3) ans = 0;
      return {
        id: idx,
        q: String(item.q || item.question || '').trim(),
        options: opts,
        answer: ans,
        hint: String(item.hint || '').trim(),
        explanation: String(item.explanation || item.solution || 'Açıklama belirtilmedi.').trim(),
        difficulty: String(item.difficulty || 'Orta').trim()
      };
    }).filter(x => x.q);
  }

  function questionsToMarkdown(questions, includeAnswers = true) {
    const letters = ['A', 'B', 'C', 'D'];
    const body = questions.map((item, i) => {
      const opts = item.options.map((o, oi) => `   ${letters[oi]}) ${o}`).join('\n');
      return `${i + 1}. [${item.difficulty}] ${item.q}\n${opts}`;
    }).join('\n\n');

    if (!includeAnswers) return `## Çalışma Soruları\n\n${body}`;

    const key = questions.map((item, i) => `${i + 1}) **${letters[item.answer]}** — ${item.explanation}`).join('\n');
    return `## Sınav Soruları\n\n${body}\n\n---\n### Cevap Anahtarı ve Çözümler\n${key}`;
  }

  /* ================= S Pen Karalama Alanı ================= */
  function bindScratchpad(canvas, savedDataUrl, onSave) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(260, Math.round(rect.width || 520));
    const h = 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#9B7BFF';

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
      ctx.lineWidth = isErase ? 14 : (e.pointerType === 'pen' && e.pressure > 0 ? 1.2 + e.pressure * 2 : 2);
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

  /* ================= StudyGuideBuilder.makeQuiz ================= */
  ON.StudyGuideBuilder.prototype.makeQuiz = async function (opts = {}) {
    injectStyles();
    const mount = getQuizMount();
    if (!mount) return;

    const count = opts.count || 5;
    const level = opts.level || 'karma (temel, orta ve sınav düzeyi)';
    const s = ON.settings;

    if (!s || !s.key) {
      ON.app.toast('Önce Ayarlar bölümünden Gemini API anahtarını eklemelisin.');
      ON.app.openSettings && ON.app.openSettings();
      return;
    }

    mount.innerHTML = `<div class="qz-loading">Notların analiz ediliyor ve ${count} adet interaktif sınav sorusu hazırlanıyor…</div>`;
    mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const ctx = await gatherSourceContext(this);
      if (!ctx.text && !ctx.imgPart) {
        mount.innerHTML = `<div class="qz-loading">Soru üretmek için sayfada yeterli metin veya çizim bulunamadı.</div>`;
        return;
      }

      const prompt = [
        `Aşağıdaki ders içeriğine dayanarak Türkçe, öğretici ve sınav kalitesinde ${count} adet çoktan seçmeli soru üret.`,
        `Zorluk dağılımı: ${level}.`,
        `Kurallar:`,
        `- SADECE geçerli bir JSON dizisi (array) döndür; başına veya sonuna açıklama yazma.`,
        `- Matematiksel ifadeler ve formüller için LaTeX kullan ($...$ veya $$...$$).`,
        `- Her eleman şu şemaya birebir uymalı:`,
        `[{"q":"Soru metni","options":["Şık 1","Şık 2","Şık 3","Şık 4"],"answer":0,"hint":"Kısa ipucu veya ilgili formül","explanation":"Adım adım çözüm açıklaması","difficulty":"Temel|Orta|Zor"}]`,
        `- "answer" alanı doğru şıkkın 0 tabanlı indeksidir (0, 1, 2 veya 3).`,
        ctx.text ? `\nDers İçeriği:\n${ctx.text}` : '\nEkli sayfa görüntüsündeki notları analiz et.'
      ].join('\n');

      const parts = [{ text: prompt }];
      if (ctx.imgPart) parts.push(ctx.imgPart);

      const res = await ON.gemini(s, parts, status => {
        const ld = mount.querySelector('.qz-loading');
        if (ld && status) ld.textContent = status;
      });

      const rawText = typeof res === 'string' ? res : (res?.text || '');
      const questions = parseQuizJSON(rawText);

      if (!questions || !questions.length) {
        this.quiz = rawText;
        mount.innerHTML = `<div class="qz-card"><div class="qz-qtext">${formatRichText(rawText)}</div></div>`;
        return;
      }

      this.quizData = questions;
      this.quiz = questionsToMarkdown(questions, true);
      renderInteractiveQuiz(this, mount, questions);
    } catch (err) {
      mount.innerHTML = `<div class="qz-loading" style="color:#FF9BB0">Soru üretilemedi: ${esc(err.message || err)}</div>`;
    }
  };

  function renderInteractiveQuiz(guideInstance, mount, allQuestions) {
    const state = {
      questions: allQuestions.slice(),
      answers: new Map(),
      hintsOpen: new Set(),
      scratchOpen: new Set(),
      scratchData: new Map(),
      mode: 'single',
      curIdx: 0,
      startedAt: Date.now()
    };
    const letters = ['A', 'B', 'C', 'D'];

    function elapsedStr() {
      const sec = Math.floor((Date.now() - state.startedAt) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    function metrics() {
      let correct = 0, wrong = 0;
      for (const q of state.questions) {
        if (!state.answers.has(q.id)) continue;
        if (state.answers.get(q.id) === q.answer) correct++;
        else wrong++;
      }
      return { correct, wrong, answered: correct + wrong, total: state.questions.length };
    }

    function renderQuestionCard(q, idx, showNav) {
      const chosen = state.answers.has(q.id) ? state.answers.get(q.id) : null;
      const isSolved = chosen !== null;
      const hintVisible = state.hintsOpen.has(q.id);
      const scratchVisible = state.scratchOpen.has(q.id);

      const optsHtml = q.options.map((opt, oi) => {
        let cls = 'qz-opt';
        if (isSolved) {
          if (oi === q.answer) cls += ' correct';
          else if (oi === chosen) cls += ' wrong';
        }
        return `<button type="button" class="${cls}" data-qid="${q.id}" data-oi="${oi}" ${isSolved ? 'disabled' : ''}>
          <span class="key">${letters[oi]}</span>
          <span>${formatRichText(opt)}</span>
        </button>`;
      }).join('');

      return `
        <div class="qz-card">
          <div class="qz-qhead">
            <span class="qz-qnum">Soru ${idx + 1} / ${state.questions.length}</span>
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
                <button type="button" class="qz-pill" style="padding:2px 8px;font-size:11px" data-scratch-clear="${q.id}">Temizle</button>
              </div>
              <canvas data-scratch-cv="${q.id}"></canvas>
            </div>
          ` : ''}
          ${hintVisible && !isSolved && q.hint ? `<div class="qz-hint-box"><strong>İpucu:</strong> ${formatRichText(q.hint)}</div>` : ''}
          <div class="qz-opts">${optsHtml}</div>
          ${isSolved ? `<div class="qz-exp"><b>${chosen === q.answer ? 'Doğru Cevap ✓' : `Yanlış — Doğru Şık: ${letters[q.answer]}`} · Adım Adım Çözüm</b>${formatRichText(q.explanation)}</div>` : ''}
          ${showNav ? `
            <div class="qz-nav">
              <button type="button" class="qz-pill" data-nav="-1" ${idx === 0 ? 'disabled style="opacity:.4"' : ''}>← Önceki</button>
              <button type="button" class="qz-pill on" data-nav="1" ${idx >= state.questions.length - 1 ? 'disabled style="opacity:.4"' : ''}>Sonraki Soru →</button>
            </div>
          ` : ''}
        </div>
      `;
    }

    function draw() {
      const m = metrics();
      const finished = m.answered === m.total && m.total > 0;
      const pct = m.total ? Math.round((m.correct / m.total) * 100) : 0;

      const dotsHtml = state.questions.map((q, i) => {
        const has = state.answers.has(q.id);
        const ok = has && state.answers.get(q.id) === q.answer;
        const cls = 'qz-dot' + (state.mode === 'single' && i === state.curIdx ? ' cur' : '') + (has ? (ok ? ' correct' : ' wrong') : '');
        return `<button type="button" class="${cls}" data-jump="${i}">${i + 1}</button>`;
      }).join('');

      const bodyHtml = state.mode === 'single'
        ? renderQuestionCard(state.questions[state.curIdx], state.curIdx, true)
        : state.questions.map((q, i) => renderQuestionCard(q, i, false)).join('');

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

      renderMathIn(mount);
      mount.querySelectorAll('[data-scratch-cv]').forEach(cv => {
        const qid = Number(cv.dataset.scratchCv);
        bindScratchpad(cv, state.scratchData.get(qid), dataUrl => state.scratchData.set(qid, dataUrl));
      });
    }

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
        if (!state.answers.has(qid)) {
          state.answers.set(qid, oi);
          draw();
        }
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
        guideInstance.makeQuiz({ count: Number(regenBtn.dataset.regen) || 5 });
        return;
      }

      if (e.target.closest('#qzRetryWrong')) {
        const wrongQs = state.questions.filter(q => state.answers.get(q.id) !== q.answer);
        if (wrongQs.length) {
          state.questions = wrongQs;
          state.answers.clear();
          state.hintsOpen.clear();
          state.curIdx = 0;
          state.startedAt = Date.now();
          draw();
        }
        return;
      }

      if (e.target.closest('#qzResetAll')) {
        state.questions = allQuestions.slice();
        state.answers.clear();
        state.hintsOpen.clear();
        state.curIdx = 0;
        state.startedAt = Date.now();
        draw();
        return;
      }

      if (e.target.closest('#qzToWorksheet')) {
        if (ON.app.addSummaryPage) {
          await ON.app.addSummaryPage(questionsToMarkdown(state.questions, true));
          ON.app.closeModal('studyDlg');
        }
        return;
      }

      if (e.target.closest('#qzPinWrong')) {
        const wrongQs = state.questions.filter(q => state.answers.get(q.id) !== q.answer);
        if (wrongQs.length && ON.cards) {
          ON.cards.create(questionsToMarkdown(wrongQs, true), ON.app.viewAnchor());
          ON.app.closeModal('studyDlg');
          ON.app.toast(`${wrongQs.length} yanlış soru tuvale kart olarak sabitlendi`);
        }
      }
    };

    draw();
  }
})();
