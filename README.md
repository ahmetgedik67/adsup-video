# Bilfen AD'S UP — Görselden Videoya

**Yayında:** https://bilfen.github.io/adsup-video/ — repoya her push'ta GitHub Pages kendiliğinden güncellenir.

Bir görseli yükle; açık kaynak bir video modeli onu hareketli bir klibe çevirsin, sonuç MP4 olarak
bilgisayara insin. Arayüz [lunaai.video](https://lunaai.video/tr/app) gibi tek sayfadır: solda görsel +
hareket cümlesi + oran/süre, sağda sonuç sahnesi.

## Model

**Wan 2.2 Lightning** (Alibaba, Apache-2.0) — GitHub'da herkese açık, en yeni nesil açık kaynak
görselden-video modelinin 4 adımlı hızlı sürümü. Hugging Face ZeroGPU'da çalışır:
1–10 saniye, 832×624 (yatay) / 480×832 (dikey) / 640×640 (kare), 16 fps.

Model ağırlıkları 14–28 GB olduğu için bu bilgisayarda çalışmaz; üretim Hugging Face'in ücretsiz
GPU kuyruğunda yapılır, tarayıcı yalnızca görseli yükler ve MP4'ü indirir.

> LTX-Video da kodda hazır (`i2v.js` → `MODELS.ltx`) ama 22 Ekim 2026'da alan anahtarla bile üretim
yapmadı; hata metnini `error: null` diye yuttuğu için arayüzde sunulmuyor.

## Önce: ücretsiz Hugging Face anahtarı (tek seferlik)

ZeroGPU, 2026 Ekim itibarıyla **giriş yapılmadan üretim yapmıyor**. Anahtarsız denemede servis şunu
döndürüyor (ölçüldü):

> You have exceeded your ZeroGPU runs limit. Authenticate with a Hugging Face token for more quota

Kurulum:

1. [huggingface.co/join](https://huggingface.co/join) adresinde ücretsiz hesap aç (e-posta doğrula).
2. [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → **New token** → tip **Read**.
3. Sayfadaki **⚙ Ayarlar** düğmesine bas, anahtarı (`hf_...`) yapıştır, **Kaydet**.

Anahtar yalnızca o tarayıcının `localStorage`'ında durur; sunucuya, repoya veya başka birine gitmez.
Okul bilgisayarında ortak kullanılıyorsa her öğrenci kendi anahtarını girer.

**Kota:** ücretsiz hesap **günde 5 dk GPU**, PRO 40 dk, giriş yapılmamış 2 dk. Bir klip kabaca
10–20 saniye kota harcar → günde yaklaşık 15–30 klip. Kota 24 saat sonra yenilenir.

## Kullanım

1. Görseli sürükle-bırak (PNG/JPG/WebP).
2. İstersen hareket cümlesi yaz (İngilizce daha iyi çalışır): `hair moves gently, camera pushes in slowly`.
3. En-boy oranı ve süreyi seç. **Gelişmiş ayarlar** altında negatif cümle, adım ve seed var.
4. **✨ Video üret** → kuyruk sırası ve tahmini süre yazılır, bitince video sahnede oynar ve iner.
5. **↻ Tekrar üret** yeni bir seed ile aynı ayarları yeniden dener; **⬇ İndir** dosyayı tekrar kaydeder.

## Ölçülen sınırlar (22 Ekim 2026)

- Çıktı en uzun kenarı **832 piksel** (Wan) — Luna'nın 1280×768'inin altında. Daha büyük çıktı bu
  alanlarda yok.
- Wan alanı kare girişi 640×640'a, dikey girişi 480×832'ye kırpıyor; uygulama görseli önden kırpıp
  gönderdiği için sonuç seçilen oranla birebir uyumlu.
- 16 fps; 10 sn üstü desteklenmiyor.
- Ölçülen üretim süresi: 3,5 sn'lik klip **21–27 saniye** (kare ve yatay). Kuyruk boşken ilk kare
  ~38 sn tahmin edildi; yoğun saatlerde daha uzun olabilir.
- Ölçülen çıktı: 640×640, 3,56 sn, 64–255 KB MP4.
- Aynı okul ağındaki herkes aynı IP'yi paylaşır; anahtarsız kullanımda kota tek kişilik.
- Görsel Hugging Face'e gider, sonuç MP4 cihazda oluşur. Anahtar dışında hiçbir kimlik bilgisi yok.

## Sınıf için daha fazla klip gerekirse

Ücretsiz kota bir sınıfa yetmezse iki yol var:

1. **Her öğrenci kendi HF hesabını açar** — 30 öğrenci × 5 dk/gün ≈ 4,5 saat GPU. Ücretsiz, kurulum yok.
2. **Ücretli API** — fal.ai / Replicate üzerinde Wan 2.2 I2V yaklaşık **0,05 $ / 5 sn klip**
   (720p ~0,10 $). 100 klip ≈ 5 $. Bu durumda anahtar statik sayfaya konmaz; araya küçük bir proxy
   (Cloudflare Worker) girer.

## GitHub Pages ile yayınlama

Site `bilfen/adsup-video` reposundan yayınlanıyor:

1. Depoyu güncelle: `git push` (repo → **Settings → Pages** → *Deploy from a branch* → `main` / `/(root)`).
2. 1–2 dakika sonra `https://bilfen.github.io/adsup-video/` güncellenir.
3. Herkes açabilir; anahtar tarayıcıda girilir, repoya yazılmaz.

`.env`, `serve.ps1` ve `dev-server.js` yalnızca yerel test içindir; yüklenmese de olur.

## Yerel test

Bu bilgisayarda Node/Bun/Python yoksa:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

`http://localhost:8080` adresini aç. Dosyayı çift tıklayarak açma; tarayıcı modülleri `file://`
adresinde çalışmaz.

## İsteğe bağlı özellikler

- **Gemini ile renk canlandırma:** yalnızca yerel sunucuda görünür. `.env` içine `GEMINI_API_KEY=`
  yazılır; anahtar tarayıcıya gitmez. Video yine ZeroGPU'da üretilir.
- **Drive'a kaydet:** `app.js` başındaki `DRIVE.clientId` alanına Google OAuth Client ID yazılır
  (ayrıntı: eski sürüm README'si / Google Cloud konsolu). Boşsa düğme uyarı verir.

## Teknoloji

- Saf HTML/CSS/JS, framework yok.
- `i2v.js`: Gradio `queue/join` + `queue/data` akışı. Not: alanların `/gradio_api/call/...` ucu
  hatayı `data: null` diye yuttuğu için o yol kullanılmıyor.
- Model: [Wan 2.2](https://github.com/Wan-Video/Wan2.2) — kod ve ağırlıklar Apache-2.0.
- Anahtar yalnızca `localStorage`'da (`adsup.hfToken`); `.env`, repo veya sunucuya yazılmaz.
