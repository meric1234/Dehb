/**
 * OdakStorage — Gzip Sıkıştırmalı, Ramer-Douglas-Peucker Sadeleştirmeli
 * ve Float32Array Paketlemeli Dayanıklı IndexedDB Depolama Motoru
 */
class StrokePacker {
  // Ramer-Douglas-Peucker çizgi sadeleştirme algoritması
  static simplifyPoints(points, epsilon = 0.65) {
    if (!Array.isArray(points) || points.length <= 2) return points;

    const perpDist = (pt, lineStart, lineEnd) => {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      if (dx === 0 && dy === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
      const t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (dx * dx + dy * dy);
      const projX = lineStart.x + t * dx;
      const projY = lineStart.y + t * dy;
      return Math.hypot(pt.x - projX, pt.y - projY);
    };

    let maxDist = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = perpDist(points[i], points[0], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this.simplifyPoints(points.slice(0, index + 1), epsilon);
      const right = this.simplifyPoints(points.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [points[0], points[end]];
  }

  static packStroke(stroke) {
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) return stroke;
    const simplified = this.simplifyPoints(stroke.points, 0.55);
    const flat = new Float32Array(simplified.length * 3);
    for (let i = 0; i < simplified.length; i++) {
      flat[i * 3] = Math.round(simplified[i].x * 10) / 10;
      flat[i * 3 + 1] = Math.round(simplified[i].y * 10) / 10;
      flat[i * 3 + 2] = Math.round((simplified[i].p ?? 0.5) * 100) / 100;
    }
    return {
      ...stroke,
      points: undefined,
      packedPoints: Array.from(flat)
    };
  }

  static unpackStroke(stroke) {
    if (Array.isArray(stroke.points)) return stroke;
    if (!Array.isArray(stroke.packedPoints)) return { ...stroke, points: [] };
    const flat = stroke.packedPoints;
    const points = [];
    for (let i = 0; i < flat.length; i += 3) {
      points.push({ x: flat[i], y: flat[i + 1], p: flat[i + 2] ?? 0.5 });
    }
    const unpacked = { ...stroke, points };
    delete unpacked.packedPoints;
    return unpacked;
  }
}

class OdakStorage {
  constructor() {
    this.dbName = 'OdakNotDB_v2';
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notebooks')) {
          db.createObjectStore('notebooks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pdfs')) {
          db.createObjectStore('pdfs', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
          this.initPromise = null;
        };
        resolve(this.db);
      };
      req.onerror = () => {
        this.initPromise = null;
        reject(req.error);
      };
    });

    return this.initPromise;
  }

  prepareForStorage(notebook) {
    const clone = JSON.parse(JSON.stringify(notebook));
    if (Array.isArray(clone.pages)) {
      for (const page of clone.pages) {
        if (Array.isArray(page.strokes)) {
          page.strokes = page.strokes.map((s) => StrokePacker.packStroke(s));
        }
      }
    }
    return clone;
  }

  restoreFromStorage(notebook) {
    if (!notebook || !Array.isArray(notebook.pages)) return notebook;
    for (const page of notebook.pages) {
      if (Array.isArray(page.strokes)) {
        page.strokes = page.strokes.map((s) => StrokePacker.unpackStroke(s));
      }
    }
    return notebook;
  }

  async compressJSON(obj) {
    const jsonStr = JSON.stringify(obj);
    if (typeof CompressionStream === 'undefined') {
      return { compressed: false, payload: jsonStr };
    }
    try {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = await new Response(stream).arrayBuffer();
      return { compressed: true, payload: buf };
    } catch (_) {
      return { compressed: false, payload: jsonStr };
    }
  }

  async decompressJSON(record) {
    if (!record) return null;
    try {
      if (!record.compressed || typeof DecompressionStream === 'undefined') {
        const parsed = typeof record.payload === 'string' ? JSON.parse(record.payload) : record;
        return this.restoreFromStorage(parsed);
      }
      const stream = new Blob([record.payload]).stream().pipeThrough(new DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      return this.restoreFromStorage(JSON.parse(text));
    } catch (err) {
      console.error('Kayıt açma hatası:', err);
      return null;
    }
  }

  async saveNotebook(notebook) {
    if (!notebook || !notebook.id) return false;
    await this.init();
    const compactNotebook = this.prepareForStorage(notebook);
    const packed = await this.compressJSON(compactNotebook);

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('notebooks', 'readwrite');
        const store = tx.objectStore('notebooks');
        store.put({
          id: notebook.id,
          title: notebook.title,
          updatedAt: Date.now(),
          ...packed
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB işlemi iptal edildi.'));
      } catch (err) {
        reject(err);
      }
    });
  }

  async getAllNotebooks() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notebooks', 'readonly');
      const req = tx.objectStore('notebooks').getAll();
      req.onsuccess = async () => {
        const list = [];
        for (const row of req.result || []) {
          const data = await this.decompressJSON(row);
          if (data) list.push(data);
        }
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async savePdfBlob(pdfId, arrayBuffer, fileName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('pdfs', 'readwrite');
      tx.objectStore('pdfs').put({ id: pdfId, arrayBuffer, fileName, savedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPdfBlob(pdfId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('pdfs', 'readonly');
      const req = tx.objectStore('pdfs').get(pdfId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
}

window.StrokePacker = StrokePacker;
window.OdakStorage = OdakStorage;
