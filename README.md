# Bilfen AD'S UP — Renkli Gerçek 3B ve Video

**Canlı site:** https://bilfen.github.io/adsup-video/

Tek bir fotoğraf veya çizimden ön, yan ve arka yüzleri bulunan, renkli dokulu gerçek bir 3B model üretir. Model tarayıcıda döndürülebilir, GLB olarak indirilebilir ve 10 saniyelik video olarak kaydedilebilir.

## Özellikler

- Gerçek üç boyutlu, renkli ve dokulu GLB üretimi.
- API anahtarı, token, kullanıcı hesabı veya günlük kota yoktur.
- Üretim öğrencinin ekran kartında WebGPU ile gerçekleşir.
- Görsel üretim sırasında başka bir sunucuya yüklenmez.
- 3B model fareyle her yönden incelenebilir.
- Dönen model WebM video olarak kaydedilebilir.

## Gereksinimler

- WebGPU destekli güncel Chrome veya Edge.
- En az 8 GB sistem belleği; güçlü tümleşik veya ayrı ekran kartı önerilir.
- İlk kullanımda yaklaşık 2,1 GB açık model ağırlığı indirilir ve tarayıcı önbelleğine alınır.
- Üretim süresi bilgisayara göre yaklaşık 30 saniye ile birkaç dakika arasında değişebilir.

Telefonlar, eski bilgisayarlar veya WebGPU kapalı tarayıcılar bu modeli çalıştıramayabilir.

## Nasıl çalışır?

Uygulama [SF3D WebGPU](https://github.com/lyonsno/sf3d-webgpu) motorunu kullanır. Model ağırlıkları ilk çalıştırmada [BasinShapers/sf3d-webgpu-weights](https://huggingface.co/BasinShapers/sf3d-webgpu-weights) deposundan indirilir. İndirme doğrudan açık dosyadır; API anahtarı veya hesap gerekmez.

Model ağırlıkları Stability AI Community License kapsamındadır. Eğitim, araştırma ve yıllık geliri 1 milyon ABD dolarının altındaki ticari kullanımlar için ücretsizdir.

## Kullanım

1. Sade arka planlı, tek nesneli bir PNG/JPG seçin.
2. **Gerçek 3B Model Üret** düğmesine basın.
3. İlk kullanımda model indirmesinin tamamlanmasını bekleyin.
4. Renkli modeli fareyle döndürün.
5. **GLB indir** veya **10 sn video kaydet** seçeneğini kullanın.

Bu sürüm Tencent/Hunyuan, ücretli API, erişim tokenı veya bulut üretim kotası kullanmaz.

## Neden Pixal3D veya FloorplanToBlender3d değil?

- **Pixal3D**, Python, PyTorch, CUDA, NATTEN ve TRELLIS.2 kurulumu gerektirir. Statik GitHub Pages sayfasında öğrencinin tarayıcısında çalışmaz; çevrimiçi çalıştırmak için GPU sunucusu gerekir.
- **FloorplanToBlender3d**, genel nesne/fotoğraf dönüşümü için değil, kat planlarını Blender sahnesine çevirmek içindir. Blender, Python veya Docker çalışan bir sunucu gerektirir.

Bu nedenle öğrencilere gerçekten anahtarsız ve kredisiz sunulabilen tarayıcı tarafı seçenek olarak **SF3D WebGPU** kullanılmıştır. Hesap veya kullanım kotası yoktur; karşılığı, ilk kullanımda büyük model indirmesi ve güçlü bir bilgisayar gerektirmesidir.
