/**
 * 团团视频角色：与网页 valleyBoot keyOnto 同款绿幕抠像。
 * VideoDecoder + canvas 2d；失败时退回静图。
 * CACHE_VER 变更时强制重拷 clips，避免 USER_DATA_PATH 旧缓存。
 */

const CACHE_VER = "v7";

const CLIPS = {
  idle: "/images/tuantuan/clips/idle.mp4",
  write: "/images/tuantuan/clips/write.mp4",
};

/** 与网页 valleyBoot CLIP_OF / moodFor 对齐；仅 idle + write */
const CLIP_OF = {
  idle: "idle",
  listen: "idle",
  think: "idle",
  look: "idle",
  write: "write",
};

const ONCE = {
  write: true,
};

function moodFor(presence) {
  return "look";
}

function isGreen(r, g, b) {
  return g > 140 && r < 96 && b < 96;
}

function isCloak(r, g, b) {
  if (g > r + 15 && g > b + 15) return false;
  if (r < 30 && g < 30 && b < 30) return false;
  return (b > 40 || r > 40) && r + b > g + 20 && g < 160;
}

/** 网页：领口绿缝只补绿像素，不动暗色（避免伤到眼睛）。 */
function sealGreenCracks(d, w, h) {
  const src = new Uint8ClampedArray(d);
  const y0 = (h * 0.24) | 0;
  const y1 = (h * 0.48) | 0;
  const x0 = (w * 0.45) | 0;
  const x1 = (w * 0.88) | 0;
  for (let y = Math.max(2, y0); y < Math.min(h - 2, y1); y += 1) {
    for (let x = Math.max(2, x0); x < Math.min(w - 2, x1); x += 1) {
      const i = (y * w + x) * 4;
      if (!isGreen(src[i], src[i + 1], src[i + 2])) continue;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (!dx && !dy) continue;
          const j = ((y + dy) * w + (x + dx)) * 4;
          if (isCloak(src[j], src[j + 1], src[j + 2])) {
            sr += src[j];
            sg += src[j + 1];
            sb += src[j + 2];
            n += 1;
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

/** 与网页 keyOnto 对齐：flood 抠绿 + 边缘去绿晕 */
function keyFrame(d, w, h) {
  sealGreenCracks(d, w, h);
  sealGreenCracks(d, w, h);
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
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        const i = p * 4;
        if (d[i + 3] === 0) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (!(g > r + 18 && g > b + 18 && g > 110)) continue;
        const edge =
          d[(p - 1) * 4 + 3] === 0 ||
          d[(p + 1) * 4 + 3] === 0 ||
          d[(p - w) * 4 + 3] === 0 ||
          d[(p + w) * 4 + 3] === 0;
        if (edge) d[i + 3] = 0;
        else d[i + 1] = Math.min(g, (r + b) >> 1);
      }
    }
  }
}

function resolveLocal(src) {
  return new Promise((resolve) => {
    const dest = `${wx.env.USER_DATA_PATH}/tt_${CACHE_VER}_${src.split("/").pop()}`;
    const fs = wx.getFileSystemManager();
    try {
      fs.accessSync(dest);
      resolve(dest);
      return;
    } catch (e) {
      /* need copy */
    }
    fs.copyFile({
      srcPath: src,
      destPath: dest,
      success: () => resolve(dest),
      fail: () => resolve(src),
    });
  });
}

function createActor(options) {
  const onLive = typeof options.onLive === "function" ? options.onLive : function () {};
  const cssW = options.width || 180;
  const cssH = options.height || 218;

  let canvas = null;
  let ctx = null;
  let scratch = null;
  let sctx = null;
  let decoder = null;
  let current = "";
  let once = false;
  let running = false;
  let dead = false;
  let raf = null;
  let workW = 0;
  let workH = 0;
  let starting = null;
  let fullCanvas = null;
  let fullCtx = null;

  function stopDecoder() {
    if (!decoder) return;
    try {
      decoder.stop();
    } catch (e) {
      /* ignore */
    }
    try {
      decoder.remove();
    } catch (e) {
      /* ignore */
    }
    decoder = null;
  }

  function ensureScratch(w, h) {
    if (!wx.createOffscreenCanvas) return false;
    if (!scratch || scratch.width !== w || scratch.height !== h) {
      scratch = wx.createOffscreenCanvas({ type: "2d", width: w, height: h });
      sctx = scratch.getContext("2d");
    }
    return !!sctx;
  }

  function paintFrame(buffer, fw, fh) {
    if (!ctx || !canvas) return false;
    const tw = workW || canvas.width;
    const th = workH || canvas.height;
    if (!ensureScratch(tw, th)) return false;

    if (!fullCanvas || fullCanvas.width !== fw || fullCanvas.height !== fh) {
      fullCanvas = wx.createOffscreenCanvas({ type: "2d", width: fw, height: fh });
      fullCtx = fullCanvas.getContext("2d");
    }
    const raw = fullCtx.createImageData(fw, fh);
    raw.data.set(new Uint8ClampedArray(buffer));
    fullCtx.putImageData(raw, 0, 0);
    // 缩到工作分辨率后再抠（与网页 drawImage→keyOnto 一致）；阈值已对齐网页去绿边
    sctx.clearRect(0, 0, tw, th);
    sctx.drawImage(fullCanvas, 0, 0, fw, fh, 0, 0, tw, th);
    const img = sctx.getImageData(0, 0, tw, th);
    keyFrame(img.data, tw, th);
    sctx.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(scratch, 0, 0);
    return true;
  }

  function tick() {
    if (!running || dead || !decoder) return;
    try {
      const frame = decoder.getFrameData();
      if (frame && frame.data && frame.width && frame.height) {
        if (paintFrame(frame.data, frame.width, frame.height)) onLive(true);
      }
    } catch (e) {
      /* 空帧 */
    }
    raf = setTimeout(tick, 40);
  }

  function startClip(name, playOnce) {
    if (dead) return Promise.resolve(false);
    if (!wx.createVideoDecoder) {
      dead = true;
      onLive(false);
      return Promise.resolve(false);
    }
    const pack = CLIPS[name] || CLIPS.idle;
    current = name;
    once = !!playOnce;
    if (raf) {
      clearTimeout(raf);
      raf = null;
    }
    stopDecoder();
    if (starting) {
      /* 串行换片 */
    }
    starting = resolveLocal(pack).then((source) => new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        starting = null;
        resolve(ok);
      };
      try {
        decoder = wx.createVideoDecoder();
      } catch (e) {
        dead = true;
        onLive(false);
        finish(false);
        return;
      }
      decoder.on("start", () => {
        running = true;
        tick();
        finish(true);
      });
      decoder.on("ended", () => {
        if (once) {
          startClip("idle", false);
        } else if (decoder) {
          try {
            decoder.seek(0);
          } catch (e) {
            startClip(current, false);
          }
        }
      });
      decoder.on("stop", () => {
        running = false;
      });
      decoder.on("error", (err) => {
        console.warn("[tuantuanActor]", err);
        dead = true;
        running = false;
        onLive(false);
        finish(false);
      });
      try {
        decoder.start({
          source,
          mode: 1,
        });
      } catch (e) {
        dead = true;
        onLive(false);
        finish(false);
      }
      setTimeout(() => finish(!!decoder && !dead), 1500);
    }));
    return starting;
  }

  function setPose(pose) {
    const clip = CLIP_OF[pose] || "idle";
    const playOnce = !!ONCE[pose] || !!ONCE[clip];
    if (clip === current && !playOnce && running) return Promise.resolve(true);
    return startClip(clip, playOnce);
  }

  function mount(canvasNode, size) {
    canvas = canvasNode;
    const dpr = Math.min(2, (wx.getSystemInfoSync().pixelRatio || 1));
    const w = Math.max(2, Math.round((size && size.width ? size.width : cssW) * dpr));
    const h = Math.max(2, Math.round((size && size.height ? size.height : cssH) * dpr));
    // 抠像分辨率封顶，保证眨眼流畅
    const scale = Math.min(1, 320 / Math.max(w, h));
    workW = Math.max(2, Math.round(w * scale));
    workH = Math.max(2, Math.round(h * scale));
    canvas.width = workW;
    canvas.height = workH;
    ctx = canvas.getContext("2d");
    ensureScratch(workW, workH);
    return startClip("idle", false);
  }

  function destroy() {
    running = false;
    dead = true;
    if (raf) clearTimeout(raf);
    raf = null;
    stopDecoder();
  }

  return {
    mount,
    setPose,
    destroy,
  };
}

module.exports = {
  createActor,
  moodFor,
  CLIPS,
  CLIP_OF,
  ONCE,
};
