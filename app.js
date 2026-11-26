/**
 * Odak Not — Ana Uygulama Denetleyicisi
 * S Pen yan tuş durum makinesi, getCoalescedEvents yüksek hassasiyetli örnekleme
 * ve pagehide/visibilitychange güvenli saveNow() kayıt mimarisi içerir.
 */
(async function () {
  const storage = new OdakStorage();
  const pdfEngine = new PdfEngine();
  const aiAssistant = new AiStudyAssistant();
  const quizContainerEl = document.getElementById('quiz-container');
  const quizManager = quizContainerEl ? new QuizManager(quizContainerEl) : null;

  const graphCanvasEl = document.getElementById('engineering-graph-canvas');
  const graphMetricsEl = document.getElementById('graph-metrics');
  const grapher = graphCanvasEl && graphMetricsEl ? new EngineeringGrapher(graphCanvasEl, graphMetricsEl) : null;

  const history = new CommandHistory((canUndo, canRedo) => {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  });

  const appState = {
    notebooks: [],
    activeNotebookId: null,
    activePageIndex: 0,
    tool: 'pen',
    previousToolBeforeBarrel: null,
    barrelEraserActive: false,
    color: '#38bdf8',
    width: 3,
    palmRejection: true,
    pageControllers: new Map(),
    selectedController: null,
    isDirty: false,
    isSaving: false,
    saveTimer: null,
    renderTimer: null
  };

  // Service Worker Kaydı (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function setStatusText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function createEmptyPage(index, template = 'grid', pdfPageNum = null) {
    return {
      id: 'pg_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 5),
      template,
      pdfPageNum,
      strokes: [],
      cards: []
    };
  }

  function createDefaultNotebook() {
    return {
      id: 'nb_' + Date.now(),
      title: 'Elektrik & Kalkülüs Notları',
      pdfId: null,
      pages: [
        {
          id: 'pg_welcome',
          template: 'engineering',
          pdfPageNum: null,
          strokes: [],
          cards: [
            {
              id: 'card_welcome_1',
              type: 'sticky',
              x: 44,
              y: 44,
              content: '📌 Hoş geldin Meriç! S Pen yan tuşuna basılı tutarak anında silgiye geçebilir, Kement (⬡) ile çizimlerini taşıyabilir veya üstten PDF yükleyebilirsin.'
            },
            {
              id: 'card_welcome_2',
              type: 'math',
              x: 420,
              y: 44,
              content: 'V_{out} = V_{in} \cdot \frac{R_2}{R_1 + R_2} \quad \text{(Gerilim Bölücü)}'
            }
          ]
        }
      ]
    };
  }

  function getActiveNotebook() {
    return appState.notebooks.find((n) => n.id === appState.activeNotebookId) || appState.notebooks[0];
  }

  function getActivePage() {
    const nb = getActiveNotebook();
    return nb.pages[appState.activePageIndex] || nb.pages[0];
  }

  // Güvenli ve kesintisiz kayıt yöneticisi (saveNow + debounced save)
  async function saveNow(force = false) {
    const nb = getActiveNotebook();
    if (!nb) return;
    if (!force && !appState.isDirty) return;
    if (appState.isSaving) {
      appState.isDirty = true;
      return;
    }

    if (appState.saveTimer) {
      clearTimeout(appState.saveTimer);
      appState.saveTimer = null;
    }

    appState.isSaving = true;
    appState.isDirty = false;
    setStatusText('status-storage-info', 'Kaydediliyor...');

    try {
      await storage.saveNotebook(nb);
      const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setStatusText('status-storage-info', `Kaydedildi (${timeStr})`);
    } catch (err) {
      appState.isDirty = true;
      setStatusText('status-storage-info', '⚠️ Kayıt hatası, tekrar deneniyor');
      console.error('saveNow hatası:', err);
    } finally {
      appState.isSaving = false;
      if (appState.isDirty) {
        scheduleSave(250);
      }
    }
  }

  function scheduleSave(delayMs = 350) {
    appState.isDirty = true;
    if (appState.saveTimer) clearTimeout(appState.saveTimer);
    appState.saveTimer = setTimeout(() => {
      saveNow(false);
    }, delayMs);
  }

  function scheduleRenderPages(delayMs = 16) {
    if (appState.renderTimer) {
      clearTimeout(appState.renderTimer);
      appState.renderTimer = null;
    }
    appState.renderTimer = setTimeout(() => {
      appState.renderTimer = null;
      renderPages();
    }, delayMs);
  }

  // Sekme gizlendiğinde, uygulama arka plana atıldığında veya sayfa kapanırken veriyi anında yaz
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveNow(true);
    }
  });
  window.addEventListener('pagehide', () => {
    saveNow(true);
  });
  window.addEventListener('beforeunload', () => {
    if (appState.isDirty) saveNow(true);
  });

  // S Pen Yan Tuş (Barrel Button) Durum Makinesi (Havada ve Temasta Senkronize)
  function setActiveToolUI(toolName) {
    appState.tool = toolName;
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === toolName);
    });
  }

  function syncBarrelButtonState(e) {
    if (e.pointerType !== 'pen') return;
    // W3C Pointer Events: S Pen yan tuşu basılıyken buttons bitmask 32 (veya 2) ya da button === 5 olur
    const isBarrelPressed = (e.buttons & 32) === 32 || (e.buttons & 2) === 2 || e.button === 5;

    if (isBarrelPressed && !appState.barrelEraserActive) {
      if (appState.tool !== 'eraser') {
        appState.previousToolBeforeBarrel = appState.tool;
        appState.barrelEraserActive = true;
        setActiveToolUI('eraser');
        setStatusText('status-spen-info', 'S Pen: Silgi Aktif (Yan Tuş)');
      }
    } else if (!isBarrelPressed && appState.barrelEraserActive) {
      appState.barrelEraserActive = false;
      const restoreTool = appState.previousToolBeforeBarrel || 'pen';
      appState.previousToolBeforeBarrel = null;
      setActiveToolUI(restoreTool);
      setStatusText('status-spen-info', 'S Pen: Kalem Hazır');
    }
  }

  window.addEventListener('pointermove', syncBarrelButtonState, { passive: true });
  window.addEventListener('pointerdown', syncBarrelButtonState, { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'pen') {
      syncBarrelButtonState(e);
    }
  }, { passive: true });

  // S Pen Yüksek Hassasiyetli Koordinat Örnekleme (getCoalescedEvents)
  function attachCoalescedSpenEnhancer(controller) {
    if (!controller || !controller.canvas) return;
    controller.getCoords = function (e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 820 / (rect.width || 820);
      const scaleY = 1120 / (rect.height || 1120);
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        p: e.pressure && e.pressure > 0 ? e.pressure : 0.5
      };
    };

    controller.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'pen' || !controller.isDrawing || !controller.currentStroke) return;
      if (typeof e.getCoalescedEvents === 'function') {
        const events = e.getCoalescedEvents();
        if (events && events.length > 1) {
          for (let i = 0; i < events.length - 1; i++) {
            controller.currentStroke.points.push(controller.getCoords(events[i]));
          }
        }
      }
    }, { capture: true, passive: true });
  }

  function renderSidebar() {
    const nbList = document.getElementById('notebook-list');
    const pgList = document.getElementById('page-list');
    if (!nbList || !pgList) return;

    nbList.innerHTML = '';
    pgList.innerHTML = '';

    const activeNb = getActiveNotebook();
    const titleEl = document.getElementById('active-notebook-title');
    if (titleEl) titleEl.textContent = activeNb.title;

    appState.notebooks.forEach((nb) => {
      const item = document.createElement('div');
      item.className = 'list-item' + (nb.id === activeNb.id ? ' active' : '');
      item.innerHTML = `<span>📓 ${nb.title}</span><small>${nb.pages.length}s</small>`;
      item.addEventListener('click', async () => {
        await saveNow(true);
        appState.activeNotebookId = nb.id;
        appState.activePageIndex = 0;
        await loadNotebookPdfIfAny(nb);
        renderSidebar();
        renderPages();
      });
      nbList.appendChild(item);
    });

    activeNb.pages.forEach((pg, idx) => {
      const item = document.createElement('div');
      item.className = 'list-item' + (idx === appState.activePageIndex ? ' active' : '');
      item.innerHTML = `<span>Sayfa ${idx + 1} ${pg.pdfPageNum ? '(PDF)' : ''}</span><small>${pg.strokes.length} çizim</small>`;
      item.addEventListener('click', () => {
        appState.activePageIndex = idx;
        renderSidebar();
        const el = document.querySelector(`[data-page-index="${idx}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
      pgList.appendChild(item);
    });
  }

  function renderCardElement(page, card, uiLayer) {
    const el = document.createElement('div');
    el.className = `page-card ${card.type}`;
    el.style.left = `${card.x}px`;
    el.style.top = `${card.y}px`;

    const bar = document.createElement('div');
    bar.className = 'card-toolbar';
    const delBtn = document.createElement('button');
    delBtn.className = 'card-delete';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      page.cards = page.cards.filter((c) => c.id !== card.id);
      el.remove();
      saveNow(true);
    });
    bar.appendChild(delBtn);
    el.appendChild(bar);

    const body = document.createElement('div');
    body.className = 'card-body';

    if (card.type === 'image-card') {
      const img = document.createElement('img');
      img.src = card.content;
      body.appendChild(img);
    } else if (card.type === 'math' && window.katex) {
      try {
        window.katex.render(card.content, body, { throwOnError: false, displayMode: true });
      } catch (_) {
        body.textContent = card.content;
      }
    } else {
      body.contentEditable = 'true';
      body.textContent = card.content;
      body.addEventListener('input', () => {
        card.content = body.textContent;
        scheduleSave(400);
      });
      body.addEventListener('blur', () => saveNow(true));
    }

    el.appendChild(body);

    let dragOffset = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target === delBtn || e.target === body) return;
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      dragOffset = { x: e.clientX - card.x, y: e.clientY - card.y };
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragOffset) return;
      card.x = Math.max(0, Math.min(640, e.clientX - dragOffset.x));
      card.y = Math.max(0, Math.min(1040, e.clientY - dragOffset.y));
      el.style.left = `${card.x}px`;
      el.style.top = `${card.y}px`;
    });
    el.addEventListener('pointerup', () => {
      if (dragOffset) {
        dragOffset = null;
        saveNow(true);
      }
    });

    uiLayer.appendChild(el);
  }

  let virtualObserver = null;

  function renderPages() {
    const scrollArea = document.getElementById('pages-scroll-area');
    if (!scrollArea) return;

    scrollArea.innerHTML = '';
    appState.pageControllers.clear();

    if (virtualObserver) virtualObserver.disconnect();

    const nb = getActiveNotebook();

    virtualObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageEl = entry.target;
          const idx = Number(pageEl.dataset.pageIndex);
          const pageData = nb.pages[idx];
          const pdfCanvas = pageEl.querySelector('.pdf-layer');

          if (entry.isIntersecting) {
            appState.activePageIndex = idx;
            setStatusText('status-page-info', `Sayfa ${idx + 1} / ${nb.pages.length}`);
            if (pageData?.pdfPageNum) {
              pdfEngine.renderPageToCanvas(pageData.pdfPageNum, pdfCanvas).catch(() => {});
            }
          } else if (pageData?.pdfPageNum) {
            pdfEngine.releaseCanvas(pdfCanvas);
          }
        });
      },
      { root: scrollArea, rootMargin: '600px 0px' }
    );

    nb.pages.forEach((page, idx) => {
      const pageEl = document.createElement('div');
      pageEl.className = `note-page tpl-${page.template || 'grid'}`;
      pageEl.dataset.pageIndex = String(idx);

      const badge = document.createElement('div');
      badge.className = 'page-badge';
      badge.textContent = `Sayfa ${idx + 1}`;
      pageEl.appendChild(badge);

      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.className = 'pdf-layer';
      pageEl.appendChild(pdfCanvas);

      const inkCanvas = document.createElement('canvas');
      inkCanvas.className = 'ink-layer';
      pageEl.appendChild(inkCanvas);

      const uiLayer = document.createElement('div');
      uiLayer.className = 'ui-layer';
      pageEl.appendChild(uiLayer);

      (page.cards || []).forEach((card) => renderCardElement(page, card, uiLayer));

      const controller = new PageCanvasController(page, inkCanvas, history, {
        getToolState: () => ({
          tool: appState.tool,
          color: appState.color,
          width: appState.width,
          palmRejection: appState.palmRejection
        }),
        onSave: () => {
          appState.isDirty = true;
          saveNow(true);
        },
        onSelectionChange: (ctrl) => {
          appState.selectedController = ctrl;
          const bar = document.getElementById('lasso-action-bar');
          if (bar) bar.classList.toggle('hidden', !ctrl);
        }
      });

      attachCoalescedSpenEnhancer(controller);
      appState.pageControllers.set(page.id, controller);
      scrollArea.appendChild(pageEl);
      virtualObserver.observe(pageEl);
    });
  }

  async function loadNotebookPdfIfAny(nb) {
    if (!nb.pdfId) {
      pdfEngine.pdfDoc = null;
      return;
    }
    const record = await storage.getPdfBlob(nb.pdfId);
    if (record?.arrayBuffer) {
      await pdfEngine.loadFromArrayBuffer(record.arrayBuffer);
    }
  }

  // Araç Çubuğu Etkileşimleri
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      appState.barrelEraserActive = false;
      appState.previousToolBeforeBarrel = null;

      if (tool === 'math') {
        openMathModal();
        return;
      }
      if (tool === 'sticky') {
        const page = getActivePage();
        page.cards.push({
          id: 'card_' + Date.now(),
          type: 'sticky',
          x: 80 + Math.random() * 120,
          y: 120 + Math.random() * 120,
          content: 'Yeni çalışma notu...'
        });
        scheduleRenderPages(10);
        saveNow(true);
        return;
      }
      setActiveToolUI(tool);
    });
  });

  document.querySelectorAll('.color-swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      appState.color = sw.dataset.color;
    });
  });

  document.getElementById('stroke-width')?.addEventListener('input', (e) => {
    appState.width = Number(e.target.value);
  });

  document.getElementById('btn-palm-rejection')?.addEventListener('click', (e) => {
    appState.palmRejection = !appState.palmRejection;
    e.currentTarget.classList.toggle('active', appState.palmRejection);
    e.currentTarget.textContent = appState.palmRejection ? '✍️ S Pen' : '👆 Dokunmatik';
  });

  document.getElementById('paper-template')?.addEventListener('change', (e) => {
    const page = getActivePage();
    page.template = e.target.value;
    scheduleRenderPages(10);
    saveNow(true);
  });

  document.getElementById('btn-undo')?.addEventListener('click', () => history.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => history.redo());
  document.getElementById('btn-save-now')?.addEventListener('click', () => saveNow(true));

  // Kement Aksiyonları
  document.getElementById('btn-lasso-delete')?.addEventListener('click', () => {
    appState.selectedController?.deleteSelected();
  });
  document.getElementById('btn-lasso-duplicate')?.addEventListener('click', () => {
    appState.selectedController?.duplicateSelected();
  });
  document.getElementById('btn-lasso-ai')?.addEventListener('click', () => {
    document.getElementById('ai-drawer')?.classList.remove('collapsed');
    triggerAiAction('explain', 'Seçili çizim bölgesindeki kavramı açıkla.');
  });

  // PDF Yükleme
  document.getElementById('pdf-upload-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const pdfId = 'pdf_' + Date.now();
    await storage.savePdfBlob(pdfId, buf, file.name);
    const numPages = await pdfEngine.loadFromArrayBuffer(buf);

    const nb = getActiveNotebook();
    nb.title = file.name.replace(/\.pdf$/i, '');
    nb.pdfId = pdfId;
    nb.pages = [];
    for (let i = 1; i <= numPages; i++) {
      nb.pages.push(createEmptyPage(i, 'blank', i));
    }
    appState.activePageIndex = 0;
    await saveNow(true);
    renderSidebar();
    renderPages();
  });

  // Defter & Sayfa Yönetimi
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    document.getElementById('left-sidebar')?.classList.toggle('collapsed');
  });

  document.getElementById('btn-new-notebook')?.addEventListener('click', async () => {
    await saveNow(true);
    const nb = {
      id: 'nb_' + Date.now(),
      title: 'Yeni Ders Defteri ' + (appState.notebooks.length + 1),
      pdfId: null,
      pages: [createEmptyPage(1, 'grid')]
    };
    appState.notebooks.unshift(nb);
    appState.activeNotebookId = nb.id;
    appState.activePageIndex = 0;
    await saveNow(true);
    renderSidebar();
    renderPages();
  });

  document.getElementById('btn-add-page')?.addEventListener('click', async () => {
    const nb = getActiveNotebook();
    const tpl = document.getElementById('paper-template')?.value || 'grid';
    nb.pages.push(createEmptyPage(nb.pages.length + 1, tpl));
    appState.activePageIndex = nb.pages.length - 1;
    await saveNow(true);
    renderSidebar();
    renderPages();
  });

  document.getElementById('active-notebook-title')?.addEventListener('blur', (e) => {
    const nb = getActiveNotebook();
    nb.title = e.target.textContent.trim() || 'İsimsiz Defter';
    renderSidebar();
    saveNow(true);
  });

  // Yedekleme
  document.getElementById('btn-export-backup')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(appState.notebooks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odak-not-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-backup-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = JSON.parse(text);
    if (Array.isArray(imported) && imported.length > 0) {
      for (const nb of imported) await storage.saveNotebook(nb);
      appState.notebooks = await storage.getAllNotebooks();
      appState.activeNotebookId = appState.notebooks[0].id;
      renderSidebar();
      renderPages();
    }
  });

  // Tema Değiştirici
  const themes = ['dark', 'light', 'sepia'];
  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'dark';
    const next = themes[(themes.indexOf(cur) + 1) % themes.length];
    document.documentElement.dataset.theme = next;
  });

  // Pomodoro Zamanlayıcı
  let pomoSeconds = 25 * 60;
  let pomoTimer = null;
  document.getElementById('btn-pomodoro')?.addEventListener('click', () => {
    if (pomoTimer) {
      clearInterval(pomoTimer);
      pomoTimer = null;
      return;
    }
    pomoTimer = setInterval(() => {
      pomoSeconds = pomoSeconds > 0 ? pomoSeconds - 1 : 25 * 60;
      const m = String(Math.floor(pomoSeconds / 60)).padStart(2, '0');
      const s = String(pomoSeconds % 60).padStart(2, '0');
      const disp = document.getElementById('pomodoro-display');
      if (disp) disp.textContent = `${m}:${s}`;
    }, 1000);
  });

  // Web Audio API Kahverengi Gürültü (DEHB Odak Sesi)
  let audioCtx = null;
  let brownNode = null;
  document.getElementById('btn-focus-sound')?.addEventListener('click', (e) => {
    if (brownNode) {
      brownNode.disconnect();
      brownNode = null;
      e.currentTarget.classList.remove('active');
      return;
    }
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = 4096;
    let lastOut = 0.0;
    brownNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    brownNode.onaudioprocess = (ev) => {
      const out = ev.outputBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        out[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = out[i];
        out[i] *= 0.18;
      }
    };
    brownNode.connect(audioCtx.destination);
    e.currentTarget.classList.add('active');
  });

  // Gemini AI Çekmecesi
  document.getElementById('btn-toggle-ai')?.addEventListener('click', () => {
    document.getElementById('ai-drawer')?.classList.toggle('collapsed');
  });
  document.getElementById('btn-close-ai')?.addEventListener('click', () => {
    document.getElementById('ai-drawer')?.classList.add('collapsed');
  });

  const apiKeyInput = document.getElementById('gemini-api-key');
  if (apiKeyInput) apiKeyInput.value = aiAssistant.apiKey;
  document.getElementById('btn-save-api-key')?.addEventListener('click', () => {
    if (apiKeyInput) aiAssistant.setApiKey(apiKeyInput.value);
    appendAiMsg('system', '🔑 Gemini API anahtarı tarayıcıya kaydedildi.');
  });

  function appendAiMsg(role, text) {
    const feed = document.getElementById('ai-output-feed');
    if (!feed) return;
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = text;
    feed.appendChild(div);
    if (window.renderMathInElement) {
      window.renderMathInElement(div, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
    feed.scrollTop = feed.scrollHeight;
  }

  async function collectCurrentPageContext() {
    const page = getActivePage();
    const cardTexts = (page.cards || []).map((c) => c.content).join('\n');
    const pdfText = page.pdfPageNum ? await pdfEngine.extractPageText(page.pdfPageNum) : '';
    return [cardTexts, pdfText].filter(Boolean).join('\n\n');
  }

  async function triggerAiAction(action, userQuestion = '') {
    if (userQuestion) appendAiMsg('user', userQuestion);
    appendAiMsg('assistant', '⏳ Sayfa içeriği analiz ediliyor...');
    const feed = document.getElementById('ai-output-feed');
    const loadingEl = feed?.lastElementChild;

    try {
      const ctx = await collectCurrentPageContext();
      const result = await aiAssistant.run(action, ctx, userQuestion);
      if (loadingEl) loadingEl.remove();

      if (action === 'make-quiz' && quizManager) {
        quizManager.render(result);
        document.getElementById('quiz-modal')?.classList.remove('hidden');
        appendAiMsg('assistant', '🎯 Aktif hatırlama testi hazırlandı ve ekranda açıldı!');
      } else {
        appendAiMsg('assistant', result);
      }
    } catch (err) {
      if (loadingEl) loadingEl.textContent = `⚠️ ${err.message}`;
    }
  }

  document.querySelectorAll('[data-ai-action]').forEach((btn) => {
    btn.addEventListener('click', () => triggerAiAction(btn.dataset.aiAction));
  });

  document.getElementById('ai-chat-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('ai-prompt-input');
    if (!input) return;
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    triggerAiAction('chat', q);
  });

  // Modallar (Grafik, Quiz, KaTeX)
  document.querySelectorAll('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.target)?.classList.add('hidden');
    });
  });

  document.getElementById('btn-open-graph')?.addEventListener('click', () => {
    document.getElementById('graph-modal')?.classList.remove('hidden');
    plotCurrentGraph();
  });

  function plotCurrentGraph() {
    if (!grapher) return;
    grapher.plot({
      expr: document.getElementById('graph-expr-input')?.value || 'Math.sin(x)',
      a: Number(document.getElementById('graph-a')?.value || 0),
      b: Number(document.getElementById('graph-b')?.value || 10),
      showDeriv: Boolean(document.getElementById('graph-show-deriv')?.checked),
      showIntegral: Boolean(document.getElementById('graph-show-integral')?.checked)
    });
  }

  document.getElementById('btn-plot-graph')?.addEventListener('click', plotCurrentGraph);
  document.getElementById('btn-insert-graph')?.addEventListener('click', () => {
    if (!grapher) return;
    const page = getActivePage();
    page.cards.push({
      id: 'card_' + Date.now(),
      type: 'image-card',
      x: 120,
      y: 260,
      content: grapher.toDataURL()
    });
    document.getElementById('graph-modal')?.classList.add('hidden');
    scheduleRenderPages(10);
    saveNow(true);
  });

  document.getElementById('btn-open-quiz')?.addEventListener('click', () => {
    triggerAiAction('make-quiz');
  });

  function openMathModal() {
    const modal = document.getElementById('math-modal');
    const input = document.getElementById('math-latex-input');
    const preview = document.getElementById('math-preview-box');
    if (!modal || !input || !preview) return;
    modal.classList.remove('hidden');
    const updatePreview = () => {
      if (window.katex) {
        window.katex.render(input.value, preview, { throwOnError: false, displayMode: true });
      } else {
        preview.textContent = input.value;
      }
    };
    input.oninput = updatePreview;
    updatePreview();
  }

  document.getElementById('btn-confirm-math')?.addEventListener('click', () => {
    const input = document.getElementById('math-latex-input');
    const val = input?.value.trim();
    if (!val) return;
    const page = getActivePage();
    page.cards.push({
      id: 'card_' + Date.now(),
      type: 'math',
      x: 140,
      y: 180,
      content: val
    });
    document.getElementById('math-modal')?.classList.add('hidden');
    scheduleRenderPages(10);
    saveNow(true);
  });

  // Klavye Kısayolları
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      history.undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      history.redo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveNow(true);
    }
  });

  // Başlatma
  const loaded = await storage.getAllNotebooks();
  if (loaded.length > 0) {
    appState.notebooks = loaded;
  } else {
    const def = createDefaultNotebook();
    appState.notebooks = [def];
    await storage.saveNotebook(def);
  }
  appState.activeNotebookId = appState.notebooks[0].id;
  await loadNotebookPdfIfAny(appState.notebooks[0]);
  renderSidebar();
  renderPages();
})();
