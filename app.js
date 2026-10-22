const $ = (id) => document.getElementById(id);
const drop = $("drop"), fileInput = $("file"), preview = $("preview");
const canvas = $("canvas"), ctx = canvas.getContext("2d", { alpha: false });
const createBtn = $("create"), previewBtn = $("previewBtn"), status = $("status");
const result = $("result"), empty = $("empty"), download = $("download"), progress = $("progress");
const state = { image: null, fileName: "", motion: "cinema", aspect: "wide", previewing: false, recording: false, raf: 0, started: 0, outputUrl: "" };
const formats = { wide: [16, 9], vertical: [9, 16], square: [1, 1] };

function setStatus(text, pct = null) { status.textContent = text; if (pct !== null) progress.style.width = `${Math.max(0, Math.min(100, pct))}%`; }
function chooseMime() { return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || ""; }
function canvasSize() { const q = Number($("quality").value); if (state.aspect === "wide") return q === 1080 ? [1920, 1080] : [1280, 720]; if (state.aspect === "vertical") return q === 1080 ? [1080, 1920] : [720, 1280]; return q === 1080 ? [1080, 1080] : [720, 720]; }
function resizeCanvas() { const [w, h] = canvasSize(); canvas.width = w; canvas.height = h; $("stage").style.aspectRatio = formats[state.aspect].join("/"); }
function coverRect(iw, ih, w, h, overscan = 1) { const scale = Math.max(w / iw, h / ih) * overscan, dw = iw * scale, dh = ih * scale; return [(w - dw) / 2, (h - dh) / 2, dw, dh]; }
function containRect(iw, ih, w, h, scale = .88) { const s = Math.min((w * scale) / iw, (h * scale) / ih), dw = iw * s, dh = ih * s; return [-dw / 2, -dh / 2, dw, dh]; }

function drawFrame(seconds) {
  if (!state.image) return;
  const w = canvas.width, h = canvas.height, img = state.image, p = (seconds % 10) / 10;
  const wave = Math.sin(p * Math.PI * 2), ease = .5 - .5 * Math.cos(p * Math.PI * 2);
  ctx.save(); ctx.fillStyle = "#091421"; ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${Math.round(Math.max(w, h) * .018)}px) brightness(.48) saturate(1.15)`;
  ctx.drawImage(img, ...coverRect(img.width, img.height, w, h, 1.12)); ctx.filter = "none";
  ctx.fillStyle = "rgba(3,10,18,.22)"; ctx.fillRect(0, 0, w, h);
  let zoom = 1, x = 0, y = 0, angle = 0;
  if (state.motion === "cinema") { zoom = 1 + .12 * ease; x = (p - .5) * w * .05; y = -ease * h * .025; }
  if (state.motion === "float") { zoom = 1.04 + .025 * wave; x = Math.cos(p * Math.PI * 2) * w * .018; y = wave * h * .035; angle = wave * .009; }
  if (state.motion === "tilt") { zoom = 1.03 + .035 * ease; x = wave * w * .035; y = Math.cos(p * Math.PI * 2) * h * .018; angle = wave * .035; }
  ctx.translate(w / 2 + x, h / 2 + y); ctx.rotate(angle); ctx.scale(zoom, zoom);
  const fg = containRect(img.width, img.height, w, h); ctx.shadowColor = "rgba(0,0,0,.48)"; ctx.shadowBlur = Math.max(w, h) * .045; ctx.shadowOffsetY = h * .018; ctx.drawImage(img, ...fg); ctx.restore();
}

function previewLoop(now) { if (!state.previewing || state.recording) return; if (!state.started) state.started = now; drawFrame((now - state.started) / 1000); state.raf = requestAnimationFrame(previewLoop); }
function startPreview() { if (!state.image || state.recording) return; result.hidden = true; canvas.hidden = false; empty.hidden = true; state.previewing = true; state.started = 0; cancelAnimationFrame(state.raf); state.raf = requestAnimationFrame(previewLoop); previewBtn.textContent = "⏸ Önizlemeyi durdur"; }
function stopPreview() { state.previewing = false; cancelAnimationFrame(state.raf); previewBtn.textContent = "▶ Önizlemeyi oynat"; }

async function loadFile(file) {
  if (!file?.type.startsWith("image/")) return setStatus("PNG, JPG veya WebP türünde bir görsel seçin.");
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { preview.src = url; preview.hidden = false; drop.classList.add("has"); state.image = img; state.fileName = file.name.replace(/\.[^.]+$/, "") || "adsup-animasyon"; resizeCanvas(); createBtn.disabled = false; previewBtn.disabled = false; setStatus(`Hazır: ${file.name} · Görsel cihazdan dışarı gönderilmeyecek.`, 0); startPreview(); };
  img.onerror = () => { URL.revokeObjectURL(url); setStatus("Görsel açılamadı. Başka bir dosya deneyin."); }; img.src = url;
}

async function createVideo() {
  if (!state.image || state.recording) return;
  if (!window.MediaRecorder || !canvas.captureStream) return setStatus("Bu tarayıcı video kaydını desteklemiyor. Güncel Chrome veya Edge kullanın.");
  stopPreview(); result.hidden = true; canvas.hidden = false; empty.hidden = true; resizeCanvas(); state.recording = true; createBtn.disabled = true; previewBtn.disabled = true;
  const duration = Number($("duration").value), stream = canvas.captureStream(30), mime = chooseMime(), chunks = [];
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: Number($("quality").value) === 1080 ? 10_000_000 : 6_000_000 } : undefined);
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); }; const done = new Promise((resolve) => { recorder.onstop = resolve; }); recorder.start(250); const began = performance.now(); setStatus("Video cihazınızda hazırlanıyor…", 1);
  await new Promise((resolve) => { function frame(now) { const elapsed = (now - began) / 1000; drawFrame(elapsed); setStatus(`Video hazırlanıyor: ${Math.min(duration, elapsed).toFixed(1)} / ${duration} sn`, elapsed / duration * 100); if (elapsed >= duration) resolve(); else requestAnimationFrame(frame); } requestAnimationFrame(frame); });
  recorder.stop(); await done; stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl); state.outputUrl = URL.createObjectURL(blob); result.src = state.outputUrl; result.hidden = false; canvas.hidden = true; result.play().catch(() => {}); download.href = state.outputUrl; download.download = `${state.fileName}-${state.motion}-${duration}sn.webm`; download.hidden = false; state.recording = false; createBtn.disabled = false; previewBtn.disabled = false; setStatus(`✓ Video hazır · ${(blob.size / 1024 / 1024).toFixed(1)} MB · kota kullanılmadı.`, 100);
}

drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
document.querySelectorAll("[data-motion]").forEach((button) => button.addEventListener("click", () => { state.motion = button.dataset.motion; document.querySelectorAll("[data-motion]").forEach((b) => b.classList.toggle("on", b === button)); startPreview(); }));
document.querySelectorAll("[data-aspect]").forEach((button) => button.addEventListener("click", () => { state.aspect = button.dataset.aspect; document.querySelectorAll("[data-aspect]").forEach((b) => b.classList.toggle("on", b === button)); resizeCanvas(); startPreview(); }));
$("quality").addEventListener("change", () => { resizeCanvas(); startPreview(); }); previewBtn.addEventListener("click", () => state.previewing ? stopPreview() : startPreview()); createBtn.addEventListener("click", createVideo);
