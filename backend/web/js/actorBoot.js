/**
 * 主内联脚本若未执行，仍启动待机动画 + 领口定点抠绿。
 */
(function () {
  if (window.__echoBoot) return;
  const valley = document.getElementById("valley");
  const actor = document.getElementById("actor");
  const stage = document.getElementById("actorStage");
  const splash = document.getElementById("openSplash");
  if (!valley || !actor || !stage) return;
  if (splash) {
    splash.hidden = true;
  }

  const still = actor.querySelector(".actor-still");
  const idle = actor.querySelector('video[data-clip="idle"]');
  if (!still || !idle) return;

  const ctx = stage.getContext("2d");
  const scratch = document.createElement("canvas");
  const sctx = scratch.getContext("2d", { willReadFrequently: true });
  let shown = idle;

  function isGreen(r, g, b) {
    return g > 140 && r < 96 && b < 96;
  }
  function isCloak(r, g, b) {
    if (g > r + 15 && g > b + 15) return false;
    if (r < 30 && g < 30 && b < 30) return false;
    return (b > 40 || r > 40) && (r + b) > g + 20 && g < 160;
  }

  function sealCollar(d, w, h) {
    const src = new Uint8ClampedArray(d);
    const bands = [
      [(w * 0.70) | 0, (w * 0.88) | 0, (h * 0.48) | 0, (h * 0.63) | 0],
      [(w * 0.62) | 0, (w * 0.90) | 0, (h * 0.45) | 0, (h * 0.66) | 0],
    ];
    for (const [x0, x1, y0, y1] of bands) {
      for (let y = Math.max(2, y0); y < Math.min(h - 2, y1); y++) {
        for (let x = Math.max(2, x0); x < Math.min(w - 2, x1); x++) {
          const i = (y * w + x) * 4;
          if (!isGreen(src[i], src[i + 1], src[i + 2])) continue;
          let sr = 0, sg = 0, sb = 0, n = 0;
          for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
              if (!dx && !dy) continue;
              const j = ((y + dy) * w + (x + dx)) * 4;
              if (isCloak(src[j], src[j + 1], src[j + 2])) {
                sr += src[j]; sg += src[j + 1]; sb += src[j + 2]; n++;
              }
            }
          }
          if (n >= 6) {
            d[i] = (sr / n) | 0;
            d[i + 1] = (sg / n) | 0;
            d[i + 2] = (sb / n) | 0;
          }
        }
      }
    }
  }

  function fillHoles(d, w, h) {
    for (let pass = 0; pass < 3; pass++) {
      const cur = new Uint8ClampedArray(d);
      let changed = 0;
      for (let y = 2; y < h - 2; y++) {
        for (let x = 2; x < w - 2; x++) {
          const i = (y * w + x) * 4;
          if (cur[i + 3] > 20) continue;
          let sr = 0, sg = 0, sb = 0, n = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (!dx && !dy) continue;
              const j = ((y + dy) * w + (x + dx)) * 4;
              if (cur[j + 3] < 180) continue;
              if (isGreen(cur[j], cur[j + 1], cur[j + 2])) continue;
              sr += cur[j]; sg += cur[j + 1]; sb += cur[j + 2]; n++;
            }
          }
          if (n >= 10) {
            d[i] = (sr / n) | 0;
            d[i + 1] = (sg / n) | 0;
            d[i + 2] = (sb / n) | 0;
            d[i + 3] = 255;
            changed++;
          }
        }
      }
      if (!changed) break;
    }
  }

  function keyOnto(video) {
    if (!video || video.readyState < 2) return false;
    const rect = still.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (w < 3 || h < 3) return false;
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
      stage.width = w;
      stage.height = h;
    }
    sctx.drawImage(video, 0, 0, w, h);
    const img = sctx.getImageData(0, 0, w, h);
    const d = img.data;
    sealCollar(d, w, h);
    sealCollar(d, w, h);
    sealCollar(d, w, h);
    const seen = new Uint8Array(w * h);
    const stack = [];
    function push(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (seen[p]) return;
      const i = p * 4;
      if (!isGreen(d[i], d[i + 1], d[i + 2])) return;
      seen[p] = 1;
      stack.push(p);
    }
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const p = stack.pop();
      d[p * 4 + 3] = 0;
      const x = p % w;
      const y = (p / w) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    fillHoles(d, w, h);
    sctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.drawImage(scratch, 0, 0);
    return true;
  }

  function paint() {
    let live = false;
    try { live = keyOnto(shown); } catch (e) { live = false; }
    still.style.opacity = live ? "0" : "1";
    requestAnimationFrame(paint);
  }

  idle.muted = true;
  idle.defaultMuted = true;
  idle.loop = true;
  idle.playsInline = true;
  idle.setAttribute("playsinline", "");
  idle.play().catch(() => {});
  valley.dataset.pose = "idle";
  requestAnimationFrame(paint);
})();
