// Görsel -> video. Açık kaynak modeller, Hugging Face ZeroGPU alanlarında.
//
// Ölçülen gerçekler (22 Ekim 2026):
//  * Alanların /gradio_api/call/<ad> ucu hata gövdesini "data: null" diye yutuyor.
//    Çalışan yol: /gradio_api/queue/join + /gradio_api/queue/data?session_hash=
//  * Giriş yapılmamış (anahtarsız) çağrılarda ZeroGPU artık üretim yapmıyor:
//    "You have exceeded your ZeroGPU runs limit." Bu yüzden HF anahtarı gerekli.
//  * Ücretsiz HF hesabı: günde 5 dk GPU. PRO: 40 dk. Anahtar yalnızca tarayıcıda.

const SESSION_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export const MODELS = {
  wan: {
    id: "wan",
    label: "Wan 2.2 Lightning",
    short: "Kalite",
    note: "Açık kaynak, 4 adımlı hızlı sürüm · 1–10 saniye · 832×624'e kadar. Boş kuyrukta 3,5 saniyelik klip ~25 saniyede çıktı.",
    base: "https://saravutw-wan2-2-i2v-lightning-4-8step-custom.hf.space",
    apiName: "/generate_video",
    defaultDuration: 3.5,
    defaultSteps: 4,
    steps: [4, 6, 8],
    durations: [1, 2, 3.5, 5, 7, 10],
    maxDuration: 10
  },
  // DENEYSEL: Lightricks alanı 22 Ekim 2026'da anahtarla bile üretim yapmadı
  // (hata metnini "error: null" diye yutuyor). Arayüzde sunulmuyor; alan düzelirse
  // aşağıdaki kayıt hazır — tek yapılacak model düğmesini geri koymak.
  ltx: {
    id: "ltx",
    label: "LTX-Video",
    short: "Hız",
    note: "Yaklaşık 2 saniyelik kısa klip. Daha hızlı (30–60 sn).",
    base: "https://lightricks-ltx-video-distilled.hf.space",
    apiName: "/image_to_video",
    defaultDuration: 2,
    defaultSteps: 0,
    steps: [],
    durations: [2],
    maxDuration: 2
  }
};

export const ASPECTS = {
  yatay: { label: "Yatay", dims: { wan: [832, 624], ltx: [704, 512] } },
  dikey: { label: "Dikey", dims: { wan: [480, 832], ltx: [512, 704] } },
  kare: { label: "Kare", dims: { wan: [640, 640], ltx: [640, 640] } }
};

export const DEFAULT_PROMPT = "cinematic, natural subtle motion, soft light";
const DEFAULT_NEGATIVE =
  "blurry, low quality, distorted, deformed, watermark, text artifacts, shaky camera";

// Vekil (proxy) tabanı: doluysa istekler oraya gider ve anahtar sunucuda durur.
// Boşsa doğrudan Hugging Face'e gidilir ve tarayıcıdaki anahtar kullanılır.
let PROXY = "";

export function setProxyBase(url) {
  PROXY = (url || "").replace(/\/+$/, "");
}

export function proxyActive() {
  return !!PROXY;
}

function baseFor(model) {
  return PROXY ? PROXY + "/hf" : model.base;
}

function sessionHash() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += SESSION_CHARS[b % SESSION_CHARS.length];
  return s;
}

function authHeaders(token) {
  // Vekil kullanılıyorsa anahtar tarayıcıdan çıkmaz; vekil kendi sırrını ekler.
  if (PROXY) return {};
  return token ? { Authorization: "Bearer " + token } : {};
}

/** Görseli seçilen en-boy oranına kırpar ve modele uygun boyuta indirir. */
export async function prepareImage(file, aspect, model) {
  const dims = (ASPECTS[aspect] || ASPECTS.yatay).dims[model] || [832, 624];
  const [targetW, targetH] = dims;
  const bmp = await createImageBitmap(file);
  const srcAspect = bmp.width / bmp.height;
  const dstAspect = targetW / targetH;
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (srcAspect > dstAspect) {
    sw = Math.round(bmp.height * dstAspect);
    sx = Math.round((bmp.width - sw) / 2);
  } else if (srcAspect < dstAspect) {
    sh = Math.round(bmp.width / dstAspect);
    sy = Math.round((bmp.height - sh) / 2);
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, targetW, targetH);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  if (!blob) throw new Error("Görsel hazırlanamadı.");
  return new File([blob], "gorsel.jpg", { type: "image/jpeg" });
}

async function uploadImage(model, file, token) {
  const fd = new FormData();
  fd.append("files", file, file.name || "gorsel.jpg");
  const r = await fetch(baseFor(model) + "/gradio_api/upload", {
    method: "POST",
    body: fd,
    headers: authHeaders(token)
  });
  if (!r.ok) throw new Error("Görsel yüklenemedi (HTTP " + r.status + ").");
  const j = await r.json();
  const item = Array.isArray(j) ? j[0] : j;
  const path = typeof item === "string" ? item : item && item.path;
  if (!path) throw new Error("Yükleme adresi alınamadı.");
  return path;
}

function fileData(path, file) {
  return {
    path,
    orig_name: file.name || "gorsel.jpg",
    mime_type: file.type || "image/jpeg",
    meta: { _type: "gradio.FileData" }
  };
}

function buildPayload(model, imagePath, file, opts) {
  const aspect = ASPECTS[opts.aspect] || ASPECTS.yatay;
  const [w, h] = aspect.dims[model.id] || [832, 624];
  const seed = Number.isFinite(opts.seed) ? opts.seed : 42;
  const source = fileData(imagePath, file);
  if (model.id === "wan") {
    return [
      source,
      null,
      opts.prompt,
      opts.steps || model.defaultSteps,
      opts.negative,
      opts.duration || model.defaultDuration,
      1,
      1,
      seed,
      true,
      5,
      "UniPCMultistep",
      3,
      16,
      false,
      true
    ];
  }
  return [
    opts.prompt,
    opts.negative,
    source,
    null,
    h,
    w,
    "image-to-video",
    opts.duration || model.defaultDuration,
    9,
    seed,
    true,
    1,
    true
  ];
}

export function errorText(raw, hasToken) {
  const s = String(raw || "");
  if (/runs limit|quota|ZeroGPU should be used|exceeded your/i.test(s)) {
    return hasToken
      ? "Bu hesabın günlük ücretsiz GPU hakkı doldu. Hak 24 saat içinde yenilenir."
      : "Günlük ücretsiz GPU hakkı doldu. Ayarlar'dan kendi Hugging Face anahtarını ekle: hak kendi hesabına geçer ve hemen yenilenir.";
  }
  if (/token|401|403|authenticat|unauthorized/i.test(s)) {
    return "Hugging Face anahtarı geçersiz veya süresi dolmuş. Ayarlar'dan yeni bir anahtar gir.";
  }
  if (/queue is full|busy|503|No GPU|aborted/i.test(s)) {
    return "Video servisi şu an meşgul. Bir-iki dakika sonra yeniden dene.";
  }
  if (/Could not load image|input_image|invalid image/i.test(s)) {
    return "Görsel servise ulaşmadı. Başka bir görselle yeniden dene.";
  }
  const clean = s.replace(/\s+/g, " ").trim();
  // LTX alanı hatayı "error: null, title: Error" diye yutuyor: metin gelmez.
  if (!clean || /^(null|undefined|error|hata)$/i.test(clean)) {
    return hasToken
      ? "Video üretilemedi (servis ayrıntı vermedi). Bir-iki dakika sonra yeniden dene."
      : "Video üretilemedi. Günlük ücretsiz GPU hakkı dolmuş olabilir — Ayarlar'dan Hugging Face anahtarını ekleyip yeniden dene.";
  }
  return clean.slice(0, 220);
}

function findVideo(node, base) {
  const urls = [];
  const paths = [];
  const walk = (n) => {
    if (!n) return;
    if (typeof n === "string") {
      if (/^https?:/i.test(n) && /\.(mp4|webm)(\?|$)/i.test(n)) urls.push(n);
      else if (n.startsWith("/tmp/") && /\.(mp4|webm)(\?|$)/i.test(n)) paths.push(n.split("?")[0]);
      return;
    }
    if (Array.isArray(n)) return n.forEach(walk);
    if (typeof n === "object") {
      const path = typeof n.path === "string" ? n.path : "";
      const mime = String(n.mime_type || "");
      if (path && /\.(mp4|webm)$/i.test(path) && /video/i.test(mime + path)) {
        if (typeof n.url === "string" && /^https?:/i.test(n.url)) urls.push(n.url);
        else paths.push(path.split("?")[0]);
      }
      Object.keys(n).forEach((k) => walk(n[k]));
    }
  };
  walk(node);
  if (urls.length) return urls[urls.length - 1];
  if (paths.length) return base + "/gradio_api/file=" + paths[paths.length - 1];
  return null;
}

async function readQueue(model, session, token, onStatus, signal) {
  const r = await fetch(baseFor(model) + "/gradio_api/queue/data?session_hash=" + encodeURIComponent(session), {
    headers: Object.assign({ Accept: "text/event-stream" }, authHeaders(token)),
    signal
  });
  if (!r.ok || !r.body) throw new Error("Kuyruk akışı açılmadı (HTTP " + r.status + ").");
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // Alan iki ayrı ilerleme akışı gönderiyor (gürültü giderme + VAE); çubuk geriye sıçramasın.
  let lastPct = 0;
  const push = (text, pct) => {
    lastPct = Math.max(lastPct, Math.min(99, pct));
    onStatus(text, lastPct);
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!dataLine || dataLine === "null") continue;
      let msg;
      try { msg = JSON.parse(dataLine); } catch { continue; }
      if (!msg || !msg.msg) continue;

      if (msg.msg === "estimation") {
        const eta = Math.max(0, Math.round(msg.rank_eta || 0));
        const pos = (msg.rank || 0) + 1;
        push(
          pos > 1
            ? "Sıradasın: " + pos + ". sıra · tahmini " + eta + " sn"
            : "GPU ayrılıyor · tahmini " + eta + " sn",
          30
        );
      } else if (msg.msg === "process_starts") {
        push("Model çalışıyor · kareler üretiliyor…", 45);
      } else if (msg.msg === "progress" && msg.progress_data && msg.progress_data[0] && msg.progress_data[0].length) {
        const p = msg.progress_data[0];
        const pct = Math.min(92, 45 + Math.round(40 * ((p.index || 0) / p.length)));
        push("Kare " + (p.index || 0) + "/" + p.length + " · video oluşuyor…", pct);
      } else if (msg.msg === "process_completed") {
        if (!msg.success) {
          const out = msg.output || {};
          throw new Error(errorText(out.error || out.title || msg.title, !!token));
        }
        return msg.output;
      } else if (msg.msg === "unexpected_error" || msg.msg === "error") {
        throw new Error(errorText(msg.message || msg.title, !!token));
      } else if (msg.msg === "close_stream") {
        throw new Error("Video servisi bağlantıyı kapattı. Yeniden dene.");
      }
    }
  }
  throw new Error("Video servisi yanıtı yarıda kesti. Yeniden dene.");
}

async function downloadVideo(url, token, signal) {
  let r = await fetch(url, { headers: authHeaders(token), signal });
  if (!r.ok) throw new Error("Video indirilemedi (HTTP " + r.status + ").");
  const blob = await r.blob();
  if (blob.size < 4000) throw new Error("Gelen dosya video değil.");
  const head = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const ascii = String.fromCharCode.apply(null, head);
  if (!/ftyp|webm/.test(ascii)) throw new Error("Gelen dosya MP4 değil.");
  return new Blob([blob], { type: "video/mp4" });
}

/**
 * Görseli videoya çevirir.
 * @returns {Promise<{blob: Blob, ms: number}>}
 */
export async function imageToVideo(opts) {
  const model = MODELS[opts.model] || MODELS.wan;
  const token = (opts.token || "").trim();
  const onStatus = opts.onStatus || (() => {});
  const ctrl = new AbortController();
  const outer = opts.signal;
  if (outer) outer.addEventListener("abort", () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), 15 * 60 * 1000);
  const t0 = performance.now();

  try {
    onStatus("Görsel kırpılıyor ve hazırlanıyor…", 8);
    const prepared = await prepareImage(opts.file, opts.aspect, model.id);

    onStatus("Görsel buluta yükleniyor…", 16);
    const path = await uploadImage(model, prepared, token);

    onStatus("Kuyruğa giriliyor…", 24);
    const session = sessionHash();
    const body = {
      data: buildPayload(model, path, prepared, {
        prompt: (opts.prompt || "").trim() || DEFAULT_PROMPT,
        negative: (opts.negative || "").trim() || DEFAULT_NEGATIVE,
        aspect: opts.aspect,
        duration: opts.duration,
        steps: opts.steps,
        seed: opts.seed
      }),
      event_data: null,
      fn_index: 0,
      session_hash: session,
      trigger_id: Math.floor(Math.random() * 1e6) + 1,
      api_name: model.apiName
    };
    const joinRes = await fetch(baseFor(model) + "/gradio_api/queue/join", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(token)),
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const joinText = await joinRes.text();
    if (!joinRes.ok || !/"event_id"/.test(joinText)) {
      throw new Error(errorText(joinText, !!token) || "Kuyruğa girilemedi.");
    }

    const output = await readQueue(model, session, token, onStatus, ctrl.signal);
    const videoUrl = findVideo(output, baseFor(model));
    if (!videoUrl) throw new Error("Video dosyasının adresi gelmedi.");

    onStatus("Video indiriliyor…", 95);
    const blob = await downloadVideo(videoUrl, token, ctrl.signal);
    return { blob, ms: Math.round((performance.now() - t0) / 1000) };
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error("Video zaman aşımına uğradı. Servis meşgul olabilir, yeniden dene.");
    }
    if (e instanceof TypeError) {
      throw new Error("Video servisine bağlanılamadı. İnterneti kontrol et.");
    }
    throw e instanceof Error ? e : new Error(errorText(e, !!token));
  } finally {
    clearTimeout(timer);
  }
}
