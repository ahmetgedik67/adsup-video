# Bilfen AD'S UP — Sınırsız Animasyon Videosu

**Canlı site:** https://bilfen.github.io/adsup-video/

Bir fotoğrafı veya çizimi tarayıcı içinde hareketli videoya dönüştürür. Sistem tamamen statiktir ve öğrencinin cihazında çalışır.

## Özellikler

- API anahtarı, token, hesap veya oturum gerekmez.
- Günlük kota, kredi, sıra ve ücret yoktur.
- Görsel herhangi bir sunucuya yüklenmez.
- Sinematik yakınlaşma, süzülme ve 3B eğim hareketleri.
- Yatay, dikey ve kare video.
- 5, 10 veya 15 saniye; HD ve Full HD seçenekleri.
- Sonuç WebM olarak indirilir.

## Nasıl çalışır?

Canvas her kareyi öğrencinin tarayıcısında çizer. `canvas.captureStream()` ve `MediaRecorder` bu kareleri video dosyasına dönüştürür. Bulut yapay zekâ modeli veya harici GPU kullanılmadığı için token ve kullanım limiti yoktur.

Bu sürüm yeni görüntüler üreten bir yapay zekâ video modeli değildir. Yüklenen görseli sinematik kamera ve katman hareketleriyle animasyonlaştırır. Bu ayrım arayüzde açıkça belirtilir.

## Tarayıcı desteği

Güncel Chrome veya Edge önerilir. Full HD kayıt eski cihazlarda yavaş olabilir; bu durumda HD 720p seçilmelidir.

## Yayınlama

Repo GitHub Pages üzerinde `main` dalının kök klasöründen yayınlanır. Saf HTML, CSS ve JavaScript kullanır; derleme adımı yoktur.
