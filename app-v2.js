(() => {
  "use strict";

  const FUN_MESSAGES = [
    "Renkli küpler sıraya giriyor…",
    "Görselindeki ayrıntılar keşfediliyor…",
    "3B atölyesinin ışıkları açılıyor…",
    "Modelin görünmeyen yüzleri tasarlanıyor…",
    "Dokular ve renkler yerine yerleşiyor…",
    "Son rötuşlar yapılıyor — S.O.S.'a devam!"
  ];

  document.addEventListener("DOMContentLoaded", () => {
    initFriendlyStatus();
    initSosGame();
  });

  function initFriendlyStatus() {
    const source = document.getElementById("status");
    const friendly = document.getElementById("fun-status");
    if (!source || !friendly) return;
    let messageIndex = 0;

    const render = () => {
      const raw = source.textContent || "";
      let message = "Görselini seç; 3B maceran başlasın!";
      if (/hazır|ready/i.test(raw)) message = "Atölye hazır! Görselini seçip sihirli düğmeye bas.";
      if (/örnek/i.test(raw)) message = "Örnek sandalye hazır — şimdi 3B'ye dönüştürelim!";
      if (/load|indir|weight|model/i.test(raw)) message = FUN_MESSAGES[messageIndex++ % FUN_MESSAGES.length];
      if (/ön plan|preprocess|görsel/i.test(raw) && !/seç/i.test(raw)) message = "Görselin şekli ve renkleri dikkatle inceleniyor…";
      if (/infer|mesh|3b|üret/i.test(raw) && !/hazır|tamam|model üret/i.test(raw)) message = FUN_MESSAGES[messageIndex++ % FUN_MESSAGES.length];
      if (/tamam|hazır.*glb/i.test(raw)) message = "🎉 Harika! Renkli 3B modelin hazır.";
      if (/error|hata|desteklemiyor/i.test(raw)) message = "Bir şey yolunda gitmedi. Sayfayı yenileyip tekrar deneyelim.";
      friendly.textContent = message;
    };
    new MutationObserver(render).observe(source, { childList: true, characterData: true, subtree: true });
    render();
  }

  function initSosGame() {
    const boardEl = document.getElementById("sos-board");
    if (!boardEl) return;
    const size = 5;
    const board = Array(size * size).fill("");
    const cells = [];
    const lines = buildLines(size);
    const ui = {
      player: document.getElementById("player-score"), ai: document.getElementById("ai-score"),
      status: document.getElementById("game-status"), pickS: document.getElementById("pick-s"),
      pickO: document.getElementById("pick-o"), newGame: document.getElementById("new-game"),
      totalPlayer: document.getElementById("total-player"), totalAi: document.getElementById("total-ai"),
      totalDraw: document.getElementById("total-draw")
    };
    let chosen = "S";
    let playerScore = 0;
    let aiScore = 0;
    let locked = false;
    let totals = loadTotals();

    for (let i = 0; i < board.length; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sos-cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${Math.floor(i / size) + 1}. satır ${i % size + 1}. sütun`);
      cell.addEventListener("click", () => playerMove(i));
      boardEl.appendChild(cell);
      cells.push(cell);
    }

    ui.pickS.addEventListener("click", () => selectLetter("S"));
    ui.pickO.addEventListener("click", () => selectLetter("O"));
    ui.newGame.addEventListener("click", resetRound);
    updateTotals();

    function selectLetter(letter) {
      chosen = letter;
      ui.pickS.classList.toggle("active", letter === "S");
      ui.pickO.classList.toggle("active", letter === "O");
    }

    function playerMove(index) {
      if (locked || board[index]) return;
      const points = place(index, chosen, "human");
      if (finishIfFull()) return;
      if (points) {
        ui.status.textContent = `S.O.S.! +${points} puan, tekrar senin sıran.`;
        return;
      }
      locked = true;
      ui.status.textContent = "Expert bilgisayar düşünüyor…";
      setTimeout(aiMove, 360);
    }

    function aiMove() {
      const move = chooseExpertMove(board, lines);
      if (!move) return finishIfFull();
      const points = place(move.index, move.letter, "ai");
      if (finishIfFull()) return;
      if (points) {
        ui.status.textContent = `Bilgisayar ${points} puan aldı ve tekrar düşünüyor…`;
        setTimeout(aiMove, 430);
      } else {
        locked = false;
        ui.status.textContent = "Sıra sende — akıllı bir hamle yap!";
      }
    }

    function place(index, letter, owner) {
      board[index] = letter;
      cells[index].textContent = letter;
      cells[index].classList.toggle("o", letter === "O");
      cells[index].disabled = true;
      const completed = completedLines(board, lines, index);
      const points = completed.length;
      if (owner === "human") playerScore += points; else aiScore += points;
      ui.player.textContent = playerScore;
      ui.ai.textContent = aiScore;
      const hitCells = new Set(completed.flat());
      hitCells.forEach(i => {
        cells[i].classList.remove("hit");
        requestAnimationFrame(() => cells[i].classList.add("hit"));
      });
      return points;
    }

    function finishIfFull() {
      if (board.some(v => !v)) return false;
      locked = true;
      if (playerScore > aiScore) {
        totals.player++;
        ui.status.textContent = "🏆 Tebrikler, Expert bilgisayarı yendin!";
      } else if (aiScore > playerScore) {
        totals.ai++;
        ui.status.textContent = "Bilgisayar kazandı. Rövanşa ne dersin?";
      } else {
        totals.draw++;
        ui.status.textContent = "🤝 Berabere! Çok iyi mücadele.";
      }
      saveTotals(totals);
      updateTotals();
      return true;
    }

    function resetRound() {
      board.fill("");
      cells.forEach(cell => { cell.textContent = ""; cell.disabled = false; cell.className = "sos-cell"; });
      playerScore = 0;
      aiScore = 0;
      ui.player.textContent = "0";
      ui.ai.textContent = "0";
      ui.status.textContent = "Yeni oyun başladı — sıra sende!";
      locked = false;
      selectLetter("S");
    }

    function updateTotals() {
      ui.totalPlayer.textContent = totals.player;
      ui.totalAi.textContent = totals.ai;
      ui.totalDraw.textContent = totals.draw;
    }
  }

  function buildLines(size) {
    const lines = [];
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of dirs) {
      const r2 = r + dr * 2, c2 = c + dc * 2;
      if (r2 >= 0 && r2 < size && c2 >= 0 && c2 < size) lines.push([r * size + c, (r + dr) * size + c + dc, r2 * size + c2]);
    }
    return lines;
  }

  function completedLines(board, lines, index) {
    return lines.filter(line => line.includes(index) && line.map(i => board[i]).join("") === "SOS");
  }

  function scoreMove(board, lines, index, letter) {
    board[index] = letter;
    const score = completedLines(board, lines, index).length;
    board[index] = "";
    return score;
  }

  function candidateMoves(board, lines, turn, limit = 14) {
    const moves = [];
    for (let i = 0; i < board.length; i++) if (!board[i]) for (const letter of ["S", "O"]) {
      const gain = scoreMove(board, lines, i, letter);
      board[i] = letter;
      let danger = 0;
      if (!gain) {
        for (let j = 0; j < board.length; j++) if (!board[j]) danger = Math.max(danger, scoreMove(board, lines, j, "S"), scoreMove(board, lines, j, "O"));
      }
      const potential = lines.filter(line => line.includes(i) && line.some(k => !board[k])).length;
      board[i] = "";
      moves.push({ index: i, letter, gain, rank: gain * 100 - danger * 38 + potential + (turn === "ai" ? Math.random() * .01 : 0) });
    }
    return moves.sort((a, b) => b.rank - a.rank).slice(0, limit);
  }

  function chooseExpertMove(board, lines) {
    const moves = candidateMoves(board, lines, "ai", 16);
    let best = null;
    let bestValue = -Infinity;
    for (const move of moves) {
      board[move.index] = move.letter;
      const value = search(board, lines, move.gain ? "ai" : "human", 3, move.gain, 0, -Infinity, Infinity);
      board[move.index] = "";
      if (value > bestValue) { bestValue = value; best = move; }
    }
    return best;
  }

  function search(board, lines, turn, depth, aiPoints, humanPoints, alpha, beta) {
    if (!depth || board.every(Boolean)) return (aiPoints - humanPoints) * 100;
    const moves = candidateMoves(board, lines, turn, 10);
    if (turn === "ai") {
      let value = -Infinity;
      for (const move of moves) {
        board[move.index] = move.letter;
        value = Math.max(value, search(board, lines, move.gain ? "ai" : "human", depth - 1, aiPoints + move.gain, humanPoints, alpha, beta));
        board[move.index] = "";
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    }
    let value = Infinity;
    for (const move of moves) {
      board[move.index] = move.letter;
      value = Math.min(value, search(board, lines, move.gain ? "human" : "ai", depth - 1, aiPoints, humanPoints + move.gain, alpha, beta));
      board[move.index] = "";
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  function loadTotals() {
    try { return { player: 0, ai: 0, draw: 0, ...JSON.parse(localStorage.getItem("adsup-sos-totals") || "{}") }; }
    catch { return { player: 0, ai: 0, draw: 0 }; }
  }
  function saveTotals(totals) { try { localStorage.setItem("adsup-sos-totals", JSON.stringify(totals)); } catch {} }

  document.addEventListener("click", event => {
    const button = event.target.closest?.("#video-btn");
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    recordMp4(button);
  }, true);

  async function recordMp4(button) {
    const viewer = document.getElementById("model-viewer");
    const source = viewer?.shadowRoot?.querySelector("canvas");
    const friendly = document.getElementById("fun-status");
    if (!source?.captureStream || !window.MediaRecorder) {
      friendly.textContent = "Bu tarayıcı video kaydını desteklemiyor. Güncel Chrome veya Edge ile tekrar dene.";
      return;
    }
    const mimeType = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      friendly.textContent = "MP4 kaydı için Chrome veya Edge tarayıcını güncellemen gerekiyor.";
      return;
    }

    button.disabled = true;
    button.textContent = "🎬 MP4 hazırlanıyor…";
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 720;
    const ctx = canvas.getContext("2d", { alpha: false });
    const logo = new Image();
    logo.src = "./bilfen-logo.png";
    await logo.decode();
    const stream = canvas.captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "adsup-bilfen-3d.mp4";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      button.disabled = false;
      button.textContent = "🎬 MP4 video indir";
      friendly.textContent = "🎉 Bilfen logolu MP4 videon hazır ve indirildi!";
    };

    const duration = 10_000;
    const started = performance.now();
    recorder.start(250);
    friendly.textContent = "Kamera dönüyor, Bilfen logolu MP4 videon hazırlanıyor…";

    const draw = now => {
      const progress = Math.min(1, (now - started) / duration);
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#eef8fc");
      gradient.addColorStop(.55, "#ffffff");
      gradient.addColorStop(1, "#fff3df");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      viewer.cameraOrbit = `${progress * 360}deg 75deg auto`;
      viewer.jumpCameraToGoal?.();
      const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
      const width = source.width * scale, height = source.height * scale;
      ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      const logoWidth = 205, logoHeight = logoWidth * logo.height / logo.width;
      roundedRect(ctx, canvas.width - logoWidth - 28, 24, logoWidth + 16, logoHeight + 12, 12);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fill();
      ctx.drawImage(logo, canvas.width - logoWidth - 20, 30, logoWidth, logoHeight);
      if (progress < 1) requestAnimationFrame(draw); else recorder.stop();
    };
    requestAnimationFrame(draw);
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, width, height, radius) : ctx.rect(x, y, width, height);
  }
})();
