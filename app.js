// AD'S UP — görselden videoya (Luna tarzı tek sayfa)
// Akış: görsel seç -> oran/süre/prompt -> Hugging Face ZeroGPU'da üret -> MP4 indir.
// Anahtar yalnızca bu tarayıcının localStorage'ında tutulur, hiçbir yere gönderilmez (HF dışında).

import { imageToVideo, MODELS, ASPECTS, DEFAULT_PROMPT } from "./i2v.js";

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = "adsup.hfToken";
const DRIVE = { clientId: "", folderId: "", scope: "https://www.googleapis.com/auth/drive.file" };

const state = {
  file: null,
  model: "wan",
  aspect: "yatay",
  duration: MODELS.wan.defaultDuration,
  steps: MODELS.wan.defaultSteps,
  seed: null,
  busy: false,
  token: localStorage.getItem(TOKEN_KEY) || "",
  driveToken: null
};

const drop = $("drop"), preview = $("preview"), fileInput = $("fileInput");
const btnOlustur = $("btnOlustur"), statusEl = $("status");
const bar = $("bar"), barFill = $("barFill");
const resultCard = $("resultCard"), videoEl = $("video"), dlBtn = $("dlBtn");
const historyEl = $("history"), logEl = $("log");

/* ---------------- durum / günlük ---------------- */

function setStatus(text, pct) {
  statusEl.textContent = text;
  if (pct != null) {
    bar.classList.add("on");
    barFill.style.width = Math.max(3, Math.min(100, pct)) + "%";
  }
}

function log(msg) {
  if (!logEl) return;
  logEl.hidden = false;
  logEl.textContent += msg + "\n";
  logEl.scrollTop = 1e9;
}

function clearLog() {
  if (logEl) { logEl.textContent = ""; logEl.hidden = true; }
}

/* ---------------- anahtar (token) ---------------- */

function tokenLabel() {
  const el = $("tokenState");
  if (!el) return;
  if (state.token) {
    el.textContent = "Anahtar kayıtlı (" + state.token.slice(0, 3) + "…" + state.token.slice(-4) + ") · günde 5 dk ücretsiz GPU";
    el.className = "tokenState ok";
  } else {
    el.textContent = "Anahtar yok · üretim başlatılamaz";
    el.className = "tokenState warn";
  }
}

function openSettings() {
  const dlg = $("dlgAyar");
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  $("tokenInput").value = "";
  tokenLabel();
}

function closeSettings() {
  const dlg = $("dlgAyar");
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

/* ---------------- dosya seçimi ---------------- */

function setFile(f) {
  if (!f || !f.type || !f.type.startsWith("image/")) {
    setStatus("Yalnızca PNG, JPG veya WebP görsel seçebilirsin.");
    return;
  }
  state.file = f;
  preview.src = URL.createObjectURL(f);
  preview.hidden = false;
  drop.classList.add("has-file");
  btnOlustur.disabled = state.busy;
  setStatus("Görsel hazır: " + f.name + " · " + Math.round(f.size / 1024) + " KB");
  log("Görsel seçildi: " + f.name);
  renderEstimates();
}

drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
["dragover", "dragenter"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "dragend"].forEach((ev) =>
  drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) setFile(f);
});

/* ---------------- seçenekler ---------------- */

function renderModel() {
  document.querySelectorAll("[data-model]").forEach((b) => {
    const on = b.dataset.model === state.model;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const m = MODELS[state.model];
  $("modelNote").textContent = m.note;
  // süre seçenekleri
  state.duration = m.defaultDuration;
  state.steps = m.defaultSteps;
  const dur = $("duration");
  dur.min = m.durations[0];
  dur.max = m.durations[m.durations.length - 1];
  dur.value = state.duration;
  dur.step = state.model === "wan" ? 0.5 : 1;
  $("durField").hidden = m.durations.length < 2;
  $("stepsField").hidden = m.steps.length === 0;
  $("steps").innerHTML = m.steps.map((s) => `<option value="${s}">${s} adım${s === 4 ? " (hızlı)" : s === 8 ? " (en iyi)" : ""}</option>`).join("");
  renderDuration();
  renderEstimates();
}

function renderDuration() {
  const d = Number($("duration").value);
  state.duration = d;
  $("durOut").textContent = d.toFixed(d % 1 ? 1 : 0).replace(".", ",") + " sn";
  renderEstimates();
}

function renderAspect() {
  document.querySelectorAll("[data-aspect]").forEach((b) => {
    const on = b.dataset.aspect === state.aspect;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderEstimates();
}

function renderEstimates() {
  const m = MODELS[state.model];
  const dims = (ASPECTS[state.aspect] || ASPECTS.yatay).dims[m.id];
  const clips = Math.max(1, Math.floor(300 / (10 * Math.max(1, state.duration / 3.5))));
  $("estimate").innerHTML =
    `<span>` + dims[0] + " × " + dims[1] + ` piksel</span>` +
    `<span>Ücretsiz hak: günde ~5 dk ≈ ~${clips} klip</span>`;
}

document.querySelectorAll("[data-model]").forEach((b) =>
  b.addEventListener("click", () => { if (state.busy) return; state.model = b.dataset.model; renderModel(); }));
document.querySelectorAll("[data-aspect]").forEach((b) =>
  b.addEventListener("click", () => { if (state.busy) return; state.aspect = b.dataset.aspect; renderAspect(); }));
$("duration").addEventListener("input", renderDuration);
$("steps").addEventListener("change", () => { state.steps = Number($("steps").value); });

/* ---------------- Gemini (yalnızca yerel sunucu) ---------------- */

let geminiOk = false;

async function shrinkForGemini(src) {
  const bmp = await createImageBitmap(src);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("Görsel küçültülemedi");
  return new File([blob], "gorsel.jpg", { type: "image/jpeg" });
}

async function enhanceWithGemini(src) {
  const small = await shrinkForGemini(src);
  const buf = new Uint8Array(await small.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  const r = await fetch("/api/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mime: small.type || "image/jpeg", data: btoa(bin) })
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 180) || ("HTTP " + r.status));
  const blob = await r.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Gemini görsel döndürmedi");
  return new File([blob], "renkli.png", { type: blob.type });
}

async function probeGemini() {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return;
    const j = await r.json();
    geminiOk = !!j.gemini;
    const row = $("geminiRow");
    if (row) row.hidden = !geminiOk;
  } catch { /* statik sayfa: Gemini yok */ }
}

/* ---------------- Google Drive ---------------- */

function driveClientReady() {
  return typeof google !== "undefined" && google.accounts && google.accounts.oauth2;
}

function getDriveToken() {
  return new Promise((resolve, reject) => {
    if (!driveClientReady()) return reject(new Error("Google modülü yüklenemedi"));
    const client = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE.clientId,
      scope: DRIVE.scope,
      callback: (resp) => resp.error ? reject(new Error("Google oturumu reddedildi: " + resp.error)) : resolve(resp.access_token),
      error_callback: (err) => reject(new Error(err.message || "Google oturumu açılamadı"))
    });
    client.requestAccessToken({ prompt: "" });
  });
}

async function driveUpload(token, blob, name, mime) {
  const boundary = "ADSUP" + Math.random().toString(36).slice(2);
  const meta = { name, mimeType: mime };
  if (DRIVE.folderId) meta.parents = [DRIVE.folderId];
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--\r\n`
  ], { type: "multipart/related; boundary=" + boundary });
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { state.driveToken = null; throw new Error("Oturum yenilenmeli (401)"); }
  if (!r.ok) throw new Error("Drive hatası: " + ((j.error && j.error.message) || r.status));
  return j;
}

async function saveToDrive(blob, btn) {
  const original = btn.innerHTML;
  try {
    if (!DRIVE.clientId) {
      btn.textContent = "☁ Ayarlar";
      setStatus("Drive'a kaydetmek için öğretmenin Google Client ID ayarı gerekli (README).");
      return;
    }
    btn.disabled = true;
    btn.textContent = "☁ Yükleniyor…";
    let token = state.driveToken || await getDriveToken();
    let res;
    try { res = await driveUpload(token, blob, "adsup-video.mp4", blob.type || "video/mp4"); }
    catch (e) {
      if (!/401|yenilenmeli/.test(e.message)) throw e;
      token = await getDriveToken();
      res = await driveUpload(token, blob, "adsup-video.mp4", blob.type || "video/mp4");
    }
    state.driveToken = token;
    btn.textContent = "✔ Drive'da";
    setStatus("✔ Google Drive'a kaydedildi: " + res.name);
    log("Drive'a yüklendi: " + res.id);
  } catch (err) {
    btn.textContent = "⚠ Drive hatası";
    setStatus("Drive'a kaydetme hatası: " + err.message);
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.innerHTML = original; }, 3500);
  }
}

/* ---------------- üretim ---------------- */

function addHistory(url, meta) {
  const item = document.createElement("figure");
  item.className = "hItem";
  item.innerHTML =
    `<video src="${url}" muted loop playsinline preload="metadata"></video>
     <figcaption>${meta.model} · ${meta.duration} sn · ${meta.seconds ? meta.seconds + " sn üretim" : ""}</figcaption>`;
  item.querySelector("video").addEventListener("mouseenter", (e) => e.target.play().catch(() => {}));
  item.querySelector("video").addEventListener("mouseleave", (e) => { e.target.pause(); });
  item.addEventListener("click", () => showResult(url, meta));
  historyEl.prepend(item);
  $("historyCard").hidden = false;
  while (historyEl.children.length > 6) historyEl.lastChild.remove();
}

function showResult(url, meta) {
  const empty = $("emptyStage");
  if (empty) empty.hidden = true;
  videoEl.src = url;
  videoEl.play().catch(() => {});
  dlBtn.href = url;
  dlBtn.download = "adsup-video-" + Date.now() + ".mp4";
  resultCard.hidden = false;
  $("resultMeta").textContent =
    MODELS[meta.model].label + " · " + meta.duration + " sn · " +
    meta.aspect + " · " + Math.round(meta.kb) + " KB" +
    (meta.seconds ? " · " + meta.seconds + " sn üretim" : "");
  $("btnAgain").dataset.url = url;
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function run() {
  if (state.busy) return;
  if (!state.file) { setStatus("Önce bir görsel seç."); return; }
  if (!state.token) {
    setStatus("Üretim için Hugging Face anahtarı gerekiyor.");
    openSettings();
    return;
  }
  state.busy = true;
  btnOlustur.disabled = true;
  btnOlustur.classList.add("busy");
  clearLog();
  const t0 = Date.now();
  try {
    let work = state.file;
    if (geminiOk && $("geminiOn") && $("geminiOn").checked) {
      setStatus("Gemini renkleri canlandırıyor…", 4);
      try { work = await enhanceWithGemini(state.file); log("Gemini renkli görsel hazır"); }
      catch (e) { log("Gemini atlandı: " + e.message); }
    }
    const seedRaw = ($("seed").value || "").trim();
    const result = await imageToVideo({
      file: work,
      model: state.model,
      aspect: state.aspect,
      duration: Number($("duration").value),
      steps: state.steps,
      seed: seedRaw ? Number(seedRaw) : Math.floor(Math.random() * 1e6),
      prompt: ($("prompt").value || "").trim(),
      negative: ($("negative").value || "").trim(),
      token: state.token,
      onStatus: setStatus
    });
    setStatus("✔ Video hazır · " + result.ms + " sn", 100);
    const url = URL.createObjectURL(result.blob);
    const meta = {
      model: state.model,
      aspect: ASPECTS[state.aspect].label,
      duration: Number($("duration").value),
      kb: result.blob.size / 1024,
      seconds: result.ms
    };
    showResult(url, meta);
    addHistory(url, meta);
    log("Video hazır: " + Math.round(meta.kb) + " KB, " + result.ms + " sn");
    saveLocal(result.blob);
  } catch (err) {
    setStatus("Hata: " + (err && err.message ? err.message : err));
    log("Hata: " + (err && err.message ? err.message : err));
    bar.classList.remove("on");
  } finally {
    state.busy = false;
    btnOlustur.disabled = false;
    btnOlustur.classList.remove("busy");
    void t0;
  }
}

function saveLocal(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "adsup-video-" + Date.now() + ".mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- olaylar ---------------- */

btnOlustur.addEventListener("click", run);
$("btnAyar").addEventListener("click", openSettings);
$("btnAyarKapat").addEventListener("click", closeSettings);
$("dlgAyar").addEventListener("click", (e) => { if (e.target.id === "dlgAyar") closeSettings(); });
$("btnTokenKaydet").addEventListener("click", () => {
  const v = ($("tokenInput").value || "").trim();
  if (!/^hf_[A-Za-z0-9]{20,}$/.test(v)) {
    $("tokenMsg").textContent = "Anahtar hf_ ile başlamalı. Hugging Face → Settings → Access Tokens.";
    return;
  }
  state.token = v;
  localStorage.setItem(TOKEN_KEY, v);
  $("tokenMsg").textContent = "Anahtar kaydedildi. Bu tarayıcıda kalır, başka yere gitmez.";
  $("tokenInput").value = "";
  tokenLabel();
});
$("btnTokenSil").addEventListener("click", () => {
  state.token = "";
  localStorage.removeItem(TOKEN_KEY);
  $("tokenMsg").textContent = "Anahtar silindi.";
  tokenLabel();
});
$("btnAgain").addEventListener("click", run);
$("dlBtn").addEventListener("click", () => {
  const url = videoEl.src;
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = "adsup-video-" + Date.now() + ".mp4";
  document.body.appendChild(a);
  a.click();
  a.remove();
});
$("btnDrive").addEventListener("click", (e) => {
  fetch(videoEl.src).then((r) => r.blob()).then((b) => saveToDrive(b, e.currentTarget)).catch(() => {});
});

/* ---------------- başlangıç ---------------- */

$("prompt").value = "";
$("prompt").placeholder = DEFAULT_PROMPT + " — ör. hair moves gently, camera pushes in slowly";
renderModel();
renderAspect();
tokenLabel();
probeGemini();
if (!state.token) setTimeout(() => { setStatus("Başlamak için Ayarlar'dan ücretsiz Hugging Face anahtarını ekle."); }, 600);

window.__adsup = { state, setFile, run, openSettings };
