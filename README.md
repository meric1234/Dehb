# Odak Not

DEHB dostu, tablette kalemle el yazısı için tasarlanmış, mühendislik ve sayısal derslere odaklı not uygulaması. Samsung Notes / GoodNotes ergonomisi, 100+ sayfalık PDF'leri takılmadan açan sanal kaydırma ve Gemini destekli çalışma asistanı.

- Kurulum gerektirmez: statik bir site, GitHub Pages'te ücretsiz çalışır.
- Tablete uygulama gibi kurulur, ilk açılıştan sonra internet olmadan da çalışır.
- Tüm veriler kullanıcının kendi cihazında (IndexedDB, gzip ile sıkıştırılmış) durur.
- Gemini API anahtarı koda **yazılmaz**; her kullanıcı kendi anahtarını Ayarlar'dan girer.

---

## Bölüm 1 — GitHub Pages'te yayına alma

Güncelleme yapıyorsan **3. adıma** geç.

1. **Repo oluştur:** github.com → sağ üst **+** → **New repository** → ad: `odak-not` → **Public** → **Create repository**.
2. **Dosyaları yükle:** **uploading an existing file** → zip'ten çıkan klasörün **içindekilerin hepsini** sürükle (`index.html` reponun en üst seviyesinde olmalı) → **Commit changes**.
3. **Güncelleme (eski sürüm yüklüyse):** Repoda **Add file → Upload files** → yeni dosyaların hepsini sürükle → **Commit changes**. Eski `index.html` ve `sw.js` üzerine yazılır; yeni dosyalar (`style.css`, `storage.js`, `canvas-tools.js`, `pdf-engine.js`, `ai-study.js`, `app.js`) eklenir.
4. **Pages'i aç (ilk kurulumda):** **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main`, `/ (root)` → **Save**. 1–2 dakika sonra link görünür: `https://KULLANICI-ADI.github.io/odak-not/`.

> Önceki sürümdeki notlar silinmez: aynı adreste açıldığında yeni yapıya **otomatik taşınır**. Eski PDF sayfaları görsel olarak, el yazısı çizgi olarak gelir.

---

## Bölüm 2 — Kullanım

### İlk adımlar
1. Tablette Chrome veya Samsung Internet ile linki aç → menü (⋮) → **Ana ekrana ekle**.
2. Ayarlar (sol panel altta dişli) → Gemini anahtarını yapıştır (ücretsiz: aistudio.google.com/apikey) → **Bağlantıyı test et**.
3. **Yeni defter** → boş defter (A4 dikey/yatay veya sınırsız tuval, şablon, kâğıt rengi) ya da **PDF'den oluştur**.

### Kalem ve jestler
| Ne | Nasıl |
|---|---|
| Yaz | S Pen ile. Parmak çizmez; sadece kaydırır ve yakınlaştırır (avuç içi koruması). |
| Kaydır / yakınlaştır | Bir parmakla sürükle, iki parmakla sıkıştır. |
| Geri al / yinele | **İki parmakla dokun** = geri al, **üç parmakla dokun** = yinele. |
| Silgi | S Pen **yan tuşunu basılı tut** → anında silgi; bırakınca kaleme döner. |
| Düzgün şekil | Şekli çiz, bitirince kalemi **0,5 sn sabit tut**: çizgi, ok, dikdörtgen, daire/elips, üçgen, koordinat ekseni. |
| Kalem türü | Kalem düğmesine tekrar dokun: Dolma (basınç + hız), Tükenmez, Kurşun (dokulu). |
| Renk | 5 favori renk; bir renge **uzun bas** → değiştir. Palet simgesi = tüm renkler. |
| Kalınlık | 3 hızlı ön ayar; araç düğmesine tekrar dokunarak ince ayar. |
| Silgi modları | Kısmi (dokunduğu yeri), Çizgi (tamamını), "Sadece fosforluyu sil". |
| Kement | Etrafını çiz → köşelerden ölçekle, üst tutamaçtan döndür (0/90/180/270°'ye mıknatıslanır), içinden sürükle. Alt çubuk: Renk, Çoğalt, Sil, **Gemini'ye gönder**. |
| Lazer | Sunum için; iz 1,5 sn'de kaybolur, kaydedilmez. |
| Ekle | Metin kutusu (T) ve görsel. Kement aracıyla taşı/boyutlandır. |

### PDF ile çalışma
- **Metin seç** aracı (I simgesi) ile PDF metnini seç → menü: Türkçeye çevir, Özetle, Açıkla (LaTeX), Kopyala, 4 renk fosforlu vurgu.
- Sol panel: **Sayfalar** (önizlemeler, sayfa ekle/sil), **İçindekiler** (PDF'in kendi bölümleri), **Ara** (tüm kitapta arama, eşleşmeler sarı kutuyla gösterilir).
- Kâğıt menüsünden **PDF'yi koyu göster** açılıp kapanır.

### Odak araçları
- **Sessiz odak sayacı** (saat simgesi): 15 / 25 / 45 dk. Ses yok; üstte ince bir ilerleme çizgisi, bitince "Mola".
- **Zen modu** (ay simgesi veya `Z`): her şey gizlenir, sadece sayfa ve kalem kalır. `Esc` ile çık.
- **Mini harita** (sağ alt): dokun ve sürükle. **Son yazılan yere dön** düğmesi, uzaklaşınca belirir.

### Asistan ve çalışma özeti
- **Asistan**: sayfayı veya kementle seçilen bölgeyi Gemini'ye gönderir (dijitale çevir, çözümü kontrol et, adım adım çöz, özet). Yanıtın altındaki **Tuvale sabitle** ile yanıt; sürüklenebilir, boyutlandırılabilir, katlanabilir, 4 temalı ve formül destekli bir **yapışkan kart** olur.
- **Çalışma özeti** (kitap simgesi): tüm fosforlu vurguları (serbest vurguların altındaki PDF metni dahil) ve kartları sayfa sırasıyla toplar. Renge/türe göre filtre, tıklayınca o yere atlama, Markdown kopyalama, deftere özet sayfası ekleme ve **sınav soruları üretme**.

### Dışa aktarma ve yedekleme
- **PDF olarak dışa aktar** (indirme simgesi): bu sayfa / tüm defter / tüm ders. PDF sayfaları, çizimler ve kartlar tek PDF'te birleştirilir. "Yazdırma dostu" koyu kâğıdı beyaza çevirir.
- **Ayarlar → Yedek al (.odaknot)**: tüm defterler, PDF'ler ve görseller tek dosyada. **Yedekten yükle** ile başka cihaza taşı.

### Klavye (bağlıysa)
`P` kalem · `H` fosforlu · `E` silgi · `L` kement · `S` metin seç · `T` metin kutusu · `Z` zen · `Ctrl+Z / Ctrl+Y` · `+ / − / 0` yakınlaştırma · `Del` seçimi sil · `Esc` kapat.

---

## Sorun giderme

| Durum | Çözüm |
|---|---|
| "Önizleme penceresinin içinde açılmış" | Linki Chrome'da kendi sekmesinde aç. |
| "API anahtarı geçersiz" | AI Studio'dan anahtarı yeniden kopyala. |
| "Gemini şu an çok yoğun" | Uygulama zaten 3 kez dener ve yedek modele geçer; 1-2 dk sonra tekrar dene. |
| PDF açılmıyor | İlk kullanımda internet gerekir (PDF okuyucu indirilir). Şifreli PDF'ler açılmaz. |
| Eski sürüm görünüyor | Uygulamayı tamamen kapatıp aç; gerekirse sayfayı bir kez yenile. |
| Depolama doldu uyarısı | Ayarlar → "Kullanılmayan PDF'leri temizle", ardından yedek al. |

**Notlar nerede?** Cihazın tarayıcısında. Başka cihaza geçmek için yedek dosyasını kullan. Tarayıcı verilerini silmek notları da siler; düzenli yedek al.

---

## Teknik mimari (geliştirici için)

| Dosya | İçerik |
|---|---|
| `index.html` | Arayüz iskeleti; CDN kütüphaneleri: pdf.js 3.11.174, jsPDF 2.5.1, KaTeX 0.16.9 + auto-render, html2canvas 1.4.1. |
| `style.css` | Tasarım sistemi (#03010D / #472399 türevleri), katmanlar, pdf.js metin katmanı stilleri. |
| `storage.js` | IndexedDB v2: `pdfs` (SHA-256 tekilleştirme), `notebooks`, `pages` (`[notebookId, pageIndex]`), `thumbnails`, `pdf_text_cache`, `assets`. Ramer–Douglas–Peucker (ε = 0,3), `Float32Array` paketleme, `CompressionStream('gzip')`, `navigator.storage.persist()`, sahipsiz veri temizliği, `.odaknot` yedek, v1 göçü. |
| `canvas-tools.js` | AABB broad phase + `pointToSegmentDistSq` / `segmentsIntersect` / `isPointInPolygon` dar faz, `Affine2D`, basınçlı dış hat (Path2D) kalem motoru, Hold-to-Snap şekil tanıma, kısmi/vektör silgi, `HistoryManager` (Add/Erase/Transform/Recolor komutları, `maxHistory = 60`, `permanentlyRemove`), `TouchGestureRecognizer` (12 px eşik, 280 ms dokunuş, 150 ms avuç koruması), `SelectionGizmo`, kâğıt şablonları. |
| `pdf-engine.js` | `PDFEngine`, `PDFPageVirtualizer` (IntersectionObserver `rootMargin: '120% 0px'`, en fazla 4 aktif sayfa, `renderTask.cancel()` + `canvas.width = 0`, yakınlaştırmadan 180 ms sonra HiDPI), `ThumbnailGenerator` (tek 160 px tuval, `toBlob('image/jpeg', 0.78)`, `requestIdleCallback`, kalem aktifken duraklar), `PDFOutlineAndSearch` (`getOutline`, `_resolveDestinationPage`, 5'erli indeksleme). |
| `ai-study.js` | Gemini istemcisi (3 deneme + yedek model), Asistan paneli, Markdown + KaTeX, `StickyCardManager`, `StudyGuideBuilder`. |
| `app.js` | Kamera, çift katmanlı çizim (fosforlu katmanı `mix-blend-mode: multiply`), giriş yönetimi, araç çubuğu, kenar paneli, sayaç, zen, mini harita, `jsPDF` ile birleştirilmiş dışa aktarma, ayarlar. |
| `sw.js` | Çevrimdışı önbellek (uygulama + CDN). Gemini isteklerine dokunmaz. Yeni sürümde `VERSION` artırılır. |

Yerelde denemek için: klasörde `python3 -m http.server 8000` → `http://localhost:8000`.

**Güvenlik:** API anahtarını asla repoya yazma. Repo public; anahtar yalnızca Ayarlar ekranından girilir ve cihazda kalır.
