(() => {
  /* =========================================================
     1. BİLDİRİM ROZETİ
     ========================================================= */
  const toast = document.createElement("div");
  toast.id = "os-status-toast";
  document.body.appendChild(toast);

  let toastTimer = null;
  function showToast(msg, duration = 2200) {
    toast.textContent = msg;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    if (duration > 0) {
      toastTimer = setTimeout(() => toast.classList.remove("visible"), duration);
    }
  }

  /* =========================================================
     2. S PEN YAN TUŞU İLE OTOMATİK SİLGİ GEÇİŞİ
     ========================================================= */
  let barrelEraserActive = false;
  let previousToolBtn = null;

  function findEraserButton() {
    return (
      document.querySelector('[data-tool="eraser"]') ||
      document.querySelector('#eraserBtn, #tool-eraser') ||
      Array.from(document.querySelectorAll("button")).find((b) =>
        /silgi|eraser/i.test(b.title || b.getAttribute("aria-label") || b.textContent)
      )
    );
  }

  function findCurrentActiveToolButton() {
    return (
      document.querySelector('[data-tool].active') ||
      document.querySelector('.tool-btn.active') ||
      document.querySelector('[data-tool="pen"]')
    );
  }

  function isSPenBarrelPressed(e) {
    if (e.pointerType !== "pen" && e.pointerType !== "eraser") return false;
    return (e.buttons & 32) !== 0 || (e.buttons & 2) !== 0 || e.button === 5 || e.pointerType === "eraser";
  }

  window.addEventListener("pointerdown", (e) => {
    if (isSPenBarrelPressed(e) && !barrelEraserActive) {
      const eraserBtn = findEraserButton();
      if (eraserBtn) {
        previousToolBtn = findCurrentActiveToolButton();
        if (previousToolBtn === eraserBtn) previousToolBtn = null;
        eraserBtn.click();
        barrelEraserActive = true;
        showToast("S Pen Tuşu: Silgi Modu", 0);
      }
    }
  }, true);

  window.addEventListener("pointermove", (e) => {
    if (barrelEraserActive && e.pointerType === "pen" && !isSPenBarrelPressed(e)) {
      restorePreviousPen();
    }
  }, true);

  window.addEventListener("pointerup", () => {
    if (barrelEraserActive) restorePreviousPen();
  }, true);

  function restorePreviousPen() {
    barrelEraserActive = false;
    toast.classList.remove("visible");
    if (previousToolBtn) {
      previousToolBtn.click();
      previousToolBtn = null;
    }
  }

  /* =========================================================
     3. GERİ SAYIM (MM:SS) + KRONOMETRE + FOCUS SES MOTORU
     ========================================================= */
  const dock = document.createElement("div");
  dock.id = "odak-studio-dock";
  dock.innerHTML = `
    <div class="os-tabs">
      <button class="os-tab active" data-os-mode="countdown">Sayaç</button>
      <button class="os-tab" data-os-mode="stopwatch">Kronometre</button>
    </div>
    <span id="os-time-readout">25:00</span>
    <button class="os-btn" id="os-minus-btn" title="5 dk azalt">-5d</button>
    <button class="os-btn" id="os-plus-btn" title="5 dk artır">+5d</button>
    <button class="os-btn primary" id="os-start-btn">Başlat</button>
    <button class="os-btn" id="os-reset-btn">Sıfırla</button>
    <div class="os-divider"></div>
    <select id="os-sound-select" title="Odak Sesi">
      <option value="off">Ses: Kapalı</option>
      <option value="brown">Brown Noise (Derin)</option>
      <option value="gamma">40 Hz Gamma Odak</option>
      <option value="rain">Yumuşak Yağmur</option>
      <option value="local">Kendi MP3 Dosyan...</option>
    </select>
    <input type="file" id="os-local-audio" accept="audio/*" hidden />
  `;
  document.body.appendChild(dock);

  const readout = document.getElementById("os-time-readout");
  const startBtn = document.getElementById("os-start-btn");
  const resetBtn = document.getElementById("os-reset-btn");
  const minusBtn = document.getElementById("os-minus-btn");
  const plusBtn = document.getElementById("os-plus-btn");

  let mode = "countdown"; // "countdown" | "stopwatch"
  let isRunning = false;
  let intervalId = null;
  let targetDurationMs = 25 * 60 * 1000;
  let remainingMs = targetDurationMs;
  let elapsedMs = 0;
  let lastTick = 0;

  function formatMMSS(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const mm = String(mins).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function renderClock() {
    if (mode === "countdown") {
      readout.textContent = formatMMSS(remainingMs);
    } else {
      const totalSec = Math.floor(elapsedMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      readout.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    readout.classList.toggle("is-running", isRunning);
    startBtn.textContent = isRunning ? "Duraklat" : "Başlat";
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(528, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.4);
    } catch (_) {}
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (mode === "countdown") {
      remainingMs -= delta;
      if (remainingMs <= 0) {
        remainingMs = 0;
        stopTimer();
        playChime();
        showToast("Odak süresi tamamlandı!", 4000);
      }
    } else {
      elapsedMs += delta;
    }
    renderClock();
  }

  function startTimer() {
    if (isRunning) return;
    if (mode === "countdown" && remainingMs <= 0) remainingMs = targetDurationMs;
    isRunning = true;
    lastTick = Date.now();
    intervalId = setInterval(tick, 250);
    renderClock();
  }

  function stopTimer() {
    isRunning = false;
    clearInterval(intervalId);
    renderClock();
  }

  startBtn.addEventListener("click", () => (isRunning ? stopTimer() : startTimer()));

  resetBtn.addEventListener("click", () => {
    stopTimer();
    remainingMs = targetDurationMs;
    elapsedMs = 0;
    renderClock();
  });

  minusBtn.addEventListener("click", () => {
    stopTimer();
    targetDurationMs = Math.max(5 * 60 * 1000, targetDurationMs - 5 * 60 * 1000);
    remainingMs = targetDurationMs;
    renderClock();
  });

  plusBtn.addEventListener("click", () => {
    stopTimer();
    targetDurationMs = Math.min(180 * 60 * 1000, targetDurationMs + 5 * 60 * 1000);
    remainingMs = targetDurationMs;
    renderClock();
  });

  dock.querySelectorAll(".os-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      stopTimer();
      dock.querySelectorAll(".os-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      mode = tab.dataset.osMode;
      minusBtn.style.display = mode === "countdown" ? "inline-block" : "none";
      plusBtn.style.display = mode === "countdown" ? "inline-block" : "none";
      renderClock();
    });
  });

  /* Web Audio API Focus Sesleri */
  let audioCtx = null;
  let activeAudioNodes = [];
  const localAudioEl = new Audio();
  localAudioEl.loop = true;

  function stopFocusSound() {
    localAudioEl.pause();
    activeAudioNodes.forEach((node) => {
      try { node.stop?.(); node.disconnect?.(); } catch (_) {}
    });
    activeAudioNodes = [];
  }

  function startSynthSound(type) {
    stopFocusSound();
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.14;
    masterGain.connect(audioCtx.destination);
    activeAudioNodes.push(masterGain);

    if (type === "gamma") {
      const merger = audioCtx.createChannelMerger(2);
      const oscL = audioCtx.createOscillator();
      const oscR = audioCtx.createOscillator();
      oscL.frequency.value = 200;
      oscR.frequency.value = 240; // 40 Hz Gamma farkı
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(masterGain);
      oscL.start();
      oscR.start();
      activeAudioNodes.push(oscL, oscR, merger);
      return;
    }

    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "brown") {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      } else {
        data[i] = white * 0.45;
      }
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = type === "brown" ? "lowpass" : "bandpass";
    filter.frequency.value = type === "brown" ? 280 : 950;

    noise.connect(filter).connect(masterGain);
    noise.start();
    activeAudioNodes.push(noise, filter);
  }

  const soundSelect = document.getElementById("os-sound-select");
  const fileInput = document.getElementById("os-local-audio");

  soundSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "off") {
      stopFocusSound();
    } else if (val === "local") {
      fileInput.click();
    } else {
      startSynthSound(val);
      showToast("Odak sesi başlatıldı");
    }
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopFocusSound();
    localAudioEl.src = URL.createObjectURL(file);
    localAudioEl.volume = 0.45;
    localAudioEl.play();
    showToast(`Çalınıyor: ${file.name}`);
  });

  /* =========================================================
     4. GEMINI API KOTA (429) OTOMATİK MODEL YEDEKLEME ZİNCİRİ
     ========================================================= */
  const FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ];

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const urlStr = typeof input === "string" ? input : input?.url || "";
    const isGeminiCall = urlStr.includes("generativelanguage.googleapis.com") && urlStr.includes(":generateContent");

    if (!isGeminiCall) {
      return originalFetch(input, init);
    }

    let response = await originalFetch(input, init);
    if (response.status !== 429 && response.status !== 503) {
      return response;
    }

    for (const model of FALLBACK_MODELS) {
      const nextUrl = urlStr.replace(/\/models\/[^:]+:generateContent/, `/models/${model}:generateContent`);
      if (nextUrl === urlStr) continue;

      showToast(`Kota aşıldı, yedek modele geçiliyor: ${model}`, 2500);
      response = await originalFetch(nextUrl, init);
      if (response.ok) return response;
      if (response.status !== 429 && response.status !== 503) return response;
    }

    return response;
  };
})();
