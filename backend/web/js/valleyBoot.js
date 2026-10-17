(function () {
const note = document.getElementById("note");
const noteText = document.getElementById("noteText");
const valley = document.getElementById("valley");
const input = document.getElementById("input");
const send = document.getElementById("send");
const canvas = document.getElementById("fx");
const tlabel = document.getElementById("tlabel");
const wpill = document.getElementById("wpill");
const plates = [document.getElementById("plateA"), document.getElementById("plateB")];
const shadeEl = document.getElementById("shade");
const glowEl = document.getElementById("glow");
let sessionId = "";
let sending = false;
let lastRole = "";
const opening = "我在这里。你想说什么都可以";
const hourNames = { dawn: "清晨了", noon: "午后了", dusk: "傍晚了", night: "夜里了" };
window.__echoBoot = 1;
const query = new URLSearchParams(location.search);
const previewPose = query.get("pose") === "write" ? "write" : "";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ?speed=720 plays a full day in two minutes; ?at=06:30 sets the starting clock.
const speed = Math.max(1, Number(query.get("speed")) || 1);
const realStart = Date.now();
const virtualStart = (() => {
  const at = query.get("at");
  if (!at || !/^\d{1,2}:\d{2}$/.test(at)) return realStart;
  const [h, m] = at.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
})();
const PHASE_MID = { dawn: 450, noon: 810, dusk: 1080, night: 1380 };

function clockMinute() {
  const forced = query.get("time");
  if (forced && PHASE_MID[forced] != null) return PHASE_MID[forced];
  const d = new Date(virtualStart + (Date.now() - realStart) * speed);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function hourScene(minute) {
  const m = minute == null ? clockMinute() : minute;
  if (m >= 300 && m < 600) return "dawn";
  if (m >= 600 && m < 1020) return "noon";
  if (m >= 1020 && m < 1140) return "dusk";
  return "night";
}

function valleyPeriod(minute) {
  const m = minute == null ? clockMinute() : minute;
  const h = Math.floor(m / 60) % 24;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "noon";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 19) return "dusk";
  if (h >= 19 && h < 23) return "night";
  return "late";
}

function paintValley() {
  const period = valleyPeriod();
  const sky = weather.sky || "clear";
  const rain = sky === "rain" || sky === "storm";
  const snow = sky === "snow";
  const evening = period === "dusk" || period === "night" || period === "late";
  let fire = evening ? (period === "late" ? "blaze" : period === "night" ? "full" : "small") : "none";
  if (snow) fire = period === "late" ? "blaze" : "full";
  if (rain && !evening) fire = "brazier";
  const ground = snow ? "snow" : (period === "afternoon" ? "gold" : "grass");
  const skyName = { dawn: "dawn", morning: "morning", noon: "noon", afternoon: "afternoon", dusk: "dusk", night: "night", late: "late" }[period];
  valley.dataset.sky = skyName;
  valley.dataset.ground = ground;
  valley.dataset.fire = fire;
  valley.dataset.wet = rain ? "rain" : snow ? "snow" : "";
  valley.dataset.camp = (fire === "small" || fire === "full" || fire === "blaze") ? "1" : "0";
  const names = { dawn: "清晨", morning: "上午", noon: "午后", afternoon: "下午", dusk: "黄昏", night: "夜晚", late: "深夜" };
  const skyNameText = { clear: "晴", partly: "阴", cloudy: "阴", fog: "阴", rain: "雨", storm: "雨", snow: "雪" }[sky] || "晴";
  const fallback = { dawn: 14, morning: 18, noon: 24, afternoon: 22, dusk: 17, night: 13, late: 9 };
  let tempN = typeof weather.temperature === "number" ? weather.temperature : fallback[period];
  if (typeof weather.temperature !== "number") {
    if (snow) tempN -= 8;
    else if (rain) tempN -= 3;
  }
  tlabel.textContent = names[period] + " · " + skyNameText + " · " + Math.round(tempN) + "°";
}

function tuantuan() {
  const el = document.createElement("img");
  el.className = "tuantuan";
  el.src = "/art/tuantuan/tuantuan-default.jpg?v=tuantuan";
  el.alt = "团团";
  return el;
}

function showNote() {
  note.classList.remove("away");
  note.style.animation = "none";
  void note.offsetWidth;
  note.style.animation = "";
}

let poseBusy = false;
const actor = document.getElementById("actor");
const still = actor.querySelector(".actor-still");
const stage = document.getElementById("actorStage");
const actorCtx = stage.getContext("2d");
const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d", { willReadFrequently: true });
const CLIP_OF = { idle: "idle", listen: "idle", think: "idle", look: "idle", write: "write" };
const ONCE = { write: 1 };
const mem = navigator.deviceMemory || 0;
const cores = navigator.hardwareConcurrency || 0;
const saveData = !!(navigator.connection && navigator.connection.saveData);
const staticMode = !previewPose && (reduceMotion || saveData || (mem > 0 && mem <= 2) || (cores > 0 && cores <= 2));
let clipWait = null;
let shown = null;
let outgoing = null;
let fadeAt = 0;

function clipEl(name) {
  return actor.querySelector('video[data-clip="' + name + '"]');
}

function waitEnded(video) {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("ended", done);
      if (clipWait === done) clipWait = null;
      resolve();
    };
    clipWait = done;
    video.addEventListener("ended", done);
  });
}

function isGreen(r, g, b) {
  return g > 140 && r < 96 && b < 96;
}

function isCloak(r, g, b) {
  if (g > r + 15 && g > b + 15) return false;
  if (r < 30 && g < 30 && b < 30) return false;
  return (b > 40 || r > 40) && (r + b) > g + 20 && g < 160;
}

// 领口绿缝只补绿像素，不动暗色（避免伤到眼睛）。
function sealGreenCracks(d, w, h) {
  const src = new Uint8ClampedArray(d);
  const y0 = (h * 0.24) | 0, y1 = (h * 0.48) | 0;
  const x0 = (w * 0.45) | 0, x1 = (w * 0.88) | 0;
  for (let y = Math.max(2, y0); y < Math.min(h - 2, y1); y++) {
    for (let x = Math.max(2, x0); x < Math.min(w - 2, x1); x++) {
      const i = (y * w + x) * 4;
      if (!isGreen(src[i], src[i + 1], src[i + 2])) continue;
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
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

function keyOnto(video, alpha) {
  if (!video || video.readyState < 2 || video.dataset.dead === "1") return false;
  const w = scratch.width;
  const h = scratch.height;
  sctx.drawImage(video, 0, 0, w, h);
  const img = sctx.getImageData(0, 0, w, h);
  const d = img.data;
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
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        const i = p * 4;
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (!(g > r + 18 && g > b + 18 && g > 110)) continue;
        const edge = d[(p - 1) * 4 + 3] === 0 || d[(p + 1) * 4 + 3] === 0 || d[(p - w) * 4 + 3] === 0 || d[(p + w) * 4 + 3] === 0;
        if (edge) d[i + 3] = 0;
        else d[i + 1] = Math.min(g, (r + b) >> 1);
      }
    }
  }
  if (alpha < 0.99) {
    for (let i = 3; i < d.length; i += 4) d[i] = (d[i] * alpha) | 0;
  }
  sctx.putImageData(img, 0, 0);
  actorCtx.drawImage(scratch, 0, 0);
  return true;
}

function paintActor() {
  if (!staticMode && !document.hidden) {
    const rect = still.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));
    if (w > 2 && h > 2 && (scratch.width !== w || scratch.height !== h)) {
      scratch.width = w;
      scratch.height = h;
      stage.width = w;
      stage.height = h;
    }
    actorCtx.clearRect(0, 0, stage.width, stage.height);
    const fade = outgoing ? Math.min(1, (performance.now() - fadeAt) / 200) : 1;
    let live = false;
    try {
      if (outgoing && fade < 1) live = keyOnto(outgoing, 1 - fade) || live;
      if (shown) live = keyOnto(shown, outgoing ? fade : 1) || live;
    } catch (e) {
      live = false;
    }
    if (outgoing && fade >= 1) {
      if (outgoing !== shown) outgoing.pause();
      outgoing = null;
    }
    still.style.opacity = live ? "0" : "1";
  }
  requestAnimationFrame(paintActor);
}

function arm(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
}

function startVideo(next) {
  arm(next);
  const begin = () => {
    if (shown !== next) return;
    try { next.currentTime = 0; } catch (e) { /* 片段还没就绪 */ }
    const pending = next.play();
    if (pending && pending.catch) {
      pending.catch((err) => {
        if (shown !== next) return;
        if (err && err.name === "AbortError") {
          next.play().catch(() => {});
          return;
        }
        next.dataset.dead = "1";
        shown = null;
      });
    }
  };
  if (next.readyState >= 2) {
    begin();
    return;
  }
  next.preload = "auto";
  next.addEventListener("loadeddata", begin, { once: true });
  try { next.load(); } catch (e) { /* 已经在加载 */ }
}

function playClip(name, once) {
  try {
    if (clipWait) {
      const finish = clipWait;
      clipWait = null;
      finish();
    }
    if (staticMode) return Promise.resolve();
    const next = clipEl(name);
    if (!next || next.dataset.dead === "1" || next.error) {
      if (next) next.dataset.dead = "1";
      return Promise.resolve();
    }
    if (shown === next) {
      if (next.paused && !document.hidden) startVideo(next);
      return once ? waitEnded(next) : Promise.resolve();
    }
    if (outgoing && outgoing !== next) outgoing.pause();
    outgoing = shown;
    fadeAt = performance.now();
    shown = next;
    startVideo(next);
    next.classList.add("on");
    if (outgoing) outgoing.classList.remove("on");
    return once ? waitEnded(next) : Promise.resolve();
  } catch (e) {
    return Promise.resolve();
  }
}

function setPose(name) {
  valley.dataset.pose = name;
  return playClip(CLIP_OF[name] || "idle", !!ONCE[name]);
}

if (!staticMode) {
  actor.querySelectorAll("video").forEach((video) => {
    video.addEventListener("error", () => {
      video.dataset.dead = "1";
      video.classList.remove("on");
      if (shown === video) shown = null;
    });
  });
  if (!previewPose) setPose("idle");
  requestAnimationFrame(paintActor);
  document.addEventListener("visibilitychange", () => {
    actor.querySelectorAll("video").forEach((video) => {
      if (document.hidden) video.pause();
      else if (video === shown) video.play().catch(() => {});
    });
  });
}

function releaseWords() {
  const layer = document.getElementById("motes");
  const phone = valley.getBoundingClientRect();
  const box = document.getElementById("composer").getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const mote = document.createElement("i");
    mote.className = "mote";
    mote.style.left = (box.left - phone.left + Math.random() * box.width) + "px";
    mote.style.top = (box.top - phone.top) + "px";
    layer.appendChild(mote);
    setTimeout(() => mote.remove(), 1600);
  }
}

function moodFor(presence) {
  return "look";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function typewrite(el, text) {
  el.textContent = "";
  showNote();
  for (const ch of text) {
    el.textContent += ch;
    await sleep(30);
  }
}

async function speak(text, delay) {
  if (!previewPose) setPose("look");
  if (delay) await sleep(delay);
  await typewrite(noteText, text);
  if (!previewPose && !poseBusy && !input.value.trim()) setPose("idle");
}

const PLATE_OF = { clear: "clear", partly: "clear", cloudy: "cloudy", fog: "cloudy", rain: "rain", storm: "rain", snow: "snow" };
const NEXT_PHASE = { dawn: "noon", noon: "dusk", dusk: "night", night: "dawn" };
const weather = { sky: "clear", windy: false, intensity: 0, temperature: null };

// Light grade per phase: [minute, shade rgba, glow rgba]. Night minutes run past 1440.
const GRADE = {
  dawn: [
    [300, [40, 52, 96, 0.26], [255, 190, 160, 0]],
    [420, [70, 66, 110, 0.08], [255, 196, 160, 0.12]],
    [600, [0, 0, 0, 0], [255, 236, 210, 0.05]],
  ],
  noon: [
    [600, [0, 0, 0, 0], [255, 240, 220, 0.04]],
    [810, [0, 0, 0, 0], [255, 252, 240, 0.02]],
    [1020, [0, 0, 0, 0], [255, 206, 150, 0.1]],
  ],
  dusk: [
    [1020, [0, 0, 0, 0], [255, 214, 160, 0.06]],
    [1100, [96, 52, 90, 0.06], [255, 160, 100, 0.1]],
    [1140, [46, 40, 96, 0.3], [255, 140, 100, 0]],
  ],
  night: [
    [1140, [30, 34, 70, 0.06], [255, 170, 110, 0.05]],
    [1560, [24, 28, 60, 0.22], [0, 0, 0, 0]],
    [1740, [50, 56, 100, 0.1], [255, 190, 170, 0.04]],
  ],
};
// [extra grey shade, share of glow kept]
const DIM = {
  clear: [0, 1], partly: [0.02, 0.8], cloudy: [0.08, 0.45], fog: [0.06, 0.4],
  rain: [0.12, 0.3], storm: [0.18, 0.2], snow: [0.04, 0.55],
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const rgba = (c) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, c[3]).toFixed(3)})`;
const rand = (a, b) => a + Math.random() * (b - a);
const count = (n) => Math.round(n * (reduceMotion ? 0.3 : 1));

function gradeAt(minute, phase) {
  const keys = GRADE[phase];
  const m = phase === "night" && minute < 300 ? minute + 1440 : minute;
  let shade = keys[keys.length - 1][1];
  let glow = keys[keys.length - 1][2];
  if (m <= keys[0][0]) [shade, glow] = [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    if (m > keys[i - 1][0] && m <= keys[i][0]) {
      const t = (m - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      const e = t * t * (3 - 2 * t);
      shade = mix(keys[i - 1][1], keys[i][1], e);
      glow = mix(keys[i - 1][2], keys[i][2], e);
      break;
    }
  }
  const [extra, keep] = DIM[weather.sky];
  if (extra) {
    const total = shade[3] + extra;
    shade = mix(shade, [86, 94, 110, 0], extra / total);
    shade[3] = total;
  }
  glow = glow.slice();
  glow[3] *= keep;
  return [shade, glow];
}

let currentPhase = "";
let currentSrc = "";
let front = 0;
const preloaded = new Set();

function plateSrc(phase) {
  return "/art/weather/" + phase + "-" + PLATE_OF[weather.sky] + ".jpg?v=tuantuan";
}

function preload(src) {
  if (preloaded.has(src)) return;
  preloaded.add(src);
  new Image().src = src;
}

function setPlate(src) {
  if (src === currentSrc) return;
  currentSrc = src;
  const img = new Image();
  img.onload = () => {
    if (currentSrc !== src) return;
    const next = plates[1 - front];
    next.style.backgroundImage = `url("${src}")`;
    next.classList.add("on");
    plates[front].classList.remove("on");
    front = 1 - front;
  };
  img.src = src;
}

function tick() {
  const minute = clockMinute();
  const phase = hourScene(minute);
  if (phase !== currentPhase) {
    const first = !currentPhase;
    currentPhase = phase;
    if (first) {
      tlabel.textContent = hourNames[phase];
    } else {
      tlabel.classList.add("swap");
      setTimeout(() => {
        tlabel.textContent = hourNames[phase];
        tlabel.classList.remove("swap");
      }, 800);
    }
    if (!wpill.hidden) renderWeatherPill();
  }
  document.body.className = phase + " " + weather.sky + (weather.windy ? " windy" : "");
  setPlate(plateSrc(phase));
  preload(plateSrc(NEXT_PHASE[phase]));
  const [shade, glow] = gradeAt(minute, phase);
  shadeEl.style.backgroundColor = rgba(shade);
  glowEl.style.backgroundColor = rgba(glow);
  document.body.style.setProperty("--phone-shade", rgba([shade[0], shade[1], shade[2], shade[3] * 0.5]));
  document.body.style.setProperty("--phone-glow", rgba(glow));
  fx.minute = minute;
  fx.phase = phase;
  paintValley();
}

const ctx = canvas.getContext("2d");
const fx = { minute: 0, phase: "dusk", W: 0, H: 0, seed: "", parts: null, last: 0, nextFlash: 0, flashAt: -1e9 };
// Window glass in each plate, as fractions of the 576×1024 artwork.
const WINDOW = { dawn: [0, 0, 0.6, 0.66], noon: [0, 0, 0.6, 0.67], dusk: [0, 0, 0.5, 0.66], night: [0, 0, 0.58, 0.68] };
const LAMP = { dusk: [0.86, 0.42], night: [0.84, 0.52] };
const BEAM = { dawn: [255, 214, 170, 0.34], noon: [255, 246, 214, 0.22], dusk: [255, 176, 104, 0.3] };

function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  fx.W = innerWidth;
  fx.H = innerHeight;
  canvas.width = fx.W * dpr;
  canvas.height = fx.H * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cover() {
  const s = Math.max(fx.W / 576, fx.H / 1024);
  const w = 576 * s;
  const h = 1024 * s;
  return { x: (fx.W - w) * 0.5, y: (fx.H - h) * 0.42, w, h };
}

function windowRect(c) {
  const r = WINDOW[fx.phase];
  return { x: c.x + r[0] * c.w, y: c.y + r[1] * c.h, w: (r[2] - r[0]) * c.w, h: (r[3] - r[1]) * c.h };
}

function leafColor() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 4) return [248, 204, 214];
  if (month >= 5 && month <= 8) return [150, 182, 112];
  if (month >= 9 && month <= 11) return Math.random() < 0.5 ? [226, 150, 80] : [204, 112, 64];
  return [176, 136, 96];
}

function newDrop(anywhere) {
  return { x: Math.random(), y: anywhere ? Math.random() : rand(-0.05, 0.4), r: rand(1.4, 3.4), vy: 0, hold: rand(800, 9000), trail: [] };
}

function buildParts() {
  const k = weather.intensity || 0.5;
  const wet = weather.sky === "rain" || weather.sky === "storm";
  const p = { streaks: [], drops: [], flakes: [], leaves: [], dust: [], sparks: [], clouds: [], fog: [] };
  if (wet) {
    for (let i = 0; i < count(50 + 110 * k); i++) p.streaks.push({ x: Math.random(), y: Math.random(), z: rand(0.4, 1) });
    for (let i = 0; i < count(22); i++) p.drops.push(newDrop(true));
  }
  if (weather.sky === "snow") {
    for (let i = 0; i < count(60 + 90 * k); i++) p.flakes.push({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), ph: rand(0, 6.28) });
  }
  if (weather.windy && weather.sky !== "snow") {
    for (let i = 0; i < count(12); i++) {
      p.leaves.push({ x: Math.random(), y: Math.random(), v: rand(0.6, 1.4), rot: rand(0, 6.28), spin: rand(-0.004, 0.004), ph: rand(0, 6.28), color: leafColor() });
    }
  }
  for (let i = 0; i < count(36); i++) {
    p.dust.push({ x: rand(0.1, 0.95), y: rand(0.1, 0.85), r: rand(0.6, 1.8), ph: rand(0, 6.28), v: rand(0.5, 1.2) });
  }
  for (let i = 0; i < count(16); i++) p.sparks.push({ x: rand(0.04, 0.96), y: rand(0.04, 0.6), ph: rand(0, 6.28), sp: rand(0.0006, 0.0014) });
  for (let i = 0; i < 3; i++) p.clouds.push({ x: rand(-0.3, 1.1), y: rand(-0.1, 0.7), r: rand(0.35, 0.6), v: rand(0.6, 1.2) });
  for (let i = 0; i < 4; i++) p.fog.push({ x: rand(-0.5, 1), y: rand(0.2, 0.95), w: rand(0.6, 1.1), v: rand(0.3, 0.7) });
  return p;
}

function sunAngle(minute) {
  const t = Math.min(1, Math.max(0, (minute - 330) / (1110 - 330)));
  return (18 + 46 * Math.sin(Math.PI * t)) * Math.PI / 180;
}

function sunShare() {
  if (fx.phase === "night") return 0;
  return weather.sky === "clear" ? 1 : weather.sky === "partly" ? 0.55 : 0;
}

function drawBeams(t, c, win) {
  const keep = sunShare();
  if (!keep) return;
  const [r, g, b, a0] = BEAM[fx.phase];
  const ang = sunAngle(fx.minute);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const len = Math.hypot(fx.W, fx.H) * 0.9;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i++) {
    const ox = win.x + win.w * (0.25 + 0.17 * i);
    const oy = win.y + win.h * (0.15 + 0.12 * i);
    const w0 = c.w * 0.02;
    const w1 = c.w * (0.1 + 0.03 * i);
    const breathe = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t / 4200 + i * 1.7);
    const alpha = a0 * keep * breathe * (0.35 + 0.13 * (i % 3));
    const ex = ox + dx * len;
    const ey = oy + dy * len;
    const grad = ctx.createLinearGradient(ox, oy, ex, ey);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.35})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(ox - dy * w0, oy + dx * w0);
    ctx.lineTo(ox + dy * w0, oy - dx * w0);
    ctx.lineTo(ex + dy * w1, ey - dx * w1);
    ctx.lineTo(ex - dy * w1, ey + dx * w1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDust(t, dt, c, p) {
  const keep = sunShare();
  if (!keep) return;
  const [r, g, b] = BEAM[fx.phase];
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  p.dust.forEach((d) => {
    d.y -= 0.000006 * d.v * dt;
    d.x += Math.sin(t / 3000 + d.ph) * 0.000004 * dt;
    if (d.y < 0.08) { d.y = 0.85; d.x = rand(0.1, 0.95); }
    const a = keep * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t / 900 + d.ph)));
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.beginPath();
    ctx.arc(c.x + d.x * c.w, c.y + d.y * c.h, d.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawCloudShadows(dt, c, p) {
  if (fx.phase === "night") return;
  const a = { partly: 0.16, cloudy: 0.1, fog: 0.06 }[weather.sky];
  if (!a) return;
  const wind = weather.windy ? 2.4 : 1;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  p.clouds.forEach((cl) => {
    cl.x += 0.0000045 * cl.v * wind * dt;
    if (cl.x - cl.r > 1.2) { cl.x = -0.6; cl.y = rand(-0.1, 0.7); }
    const cx = c.x + cl.x * c.w;
    const cy = c.y + cl.y * c.h;
    const rad = cl.r * c.w;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(70,78,96,${a})`);
    grad.addColorStop(1, "rgba(70,78,96,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  });
  ctx.restore();
}

function drawLamp(t, c) {
  const pos = LAMP[fx.phase];
  if (!pos) return;
  const cx = c.x + pos[0] * c.w;
  const cy = c.y + pos[1] * c.h;
  const rad = c.w * 0.45;
  const flicker = reduceMotion ? 0 : 0.025 * Math.sin(t / 2300) + 0.008 * Math.sin(t / 170);
  const a = 0.1 + flicker;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  grad.addColorStop(0, `rgba(255,176,96,${a})`);
  grad.addColorStop(1, "rgba(255,176,96,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();
}

function drawSparks(t, win, p) {
  if (fx.phase !== "night" || !(weather.sky === "clear" || weather.sky === "partly")) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  p.sparks.forEach((s) => {
    const a = Math.pow(Math.max(0, Math.sin(t * s.sp + s.ph)), 3) * 0.85;
    if (a < 0.02) return;
    const x = win.x + s.x * win.w;
    const y = win.y + s.y * win.h;
    ctx.strokeStyle = `rgba(255,248,226,${a})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,252,240,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawFog(dt, win, p) {
  if (weather.sky !== "fog") return;
  p.fog.forEach((f) => {
    f.x += 0.0000035 * f.v * dt;
    if (f.x > 1.4) f.x = -0.9;
    const cx = win.x + f.x * win.w;
    const cy = win.y + f.y * win.h;
    const rx = f.w * win.w;
    const ry = win.h * 0.12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, "rgba(236,238,242,0.3)");
    grad.addColorStop(1, "rgba(236,238,242,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  });
}

function drawRain(dt, win, p) {
  if (!p.streaks.length) return;
  const night = fx.phase === "night";
  const slant = weather.windy ? 0.32 : 0.1;
  ctx.lineWidth = 1;
  p.streaks.forEach((s) => {
    s.y += 0.0016 * s.z * dt;
    s.x += 0.0016 * s.z * slant * dt;
    if (s.y > 1.05) { s.y = -0.08; s.x = Math.random() * 1.1 - 0.1; }
    if (s.x > 1.05) s.x -= 1.1;
    const x = win.x + s.x * win.w;
    const y = win.y + s.y * win.h;
    const l = 0.05 * s.z * win.h;
    ctx.strokeStyle = night ? `rgba(190,200,222,${0.16 * s.z})` : `rgba(228,234,242,${0.22 * s.z})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l * slant, y + l);
    ctx.stroke();
  });
  const hi = night || fx.phase === "dusk" ? "255,214,160" : "255,255,255";
  p.drops.forEach((d, i) => {
    if (d.hold > 0) {
      d.hold -= dt;
    } else {
      d.vy = Math.min(0.00016, d.vy + 0.0000004 * dt);
      d.y += d.vy * dt;
      d.trail.push(d.y);
      if (d.trail.length > 40) d.trail.shift();
    }
    if (d.y > 1.03) { p.drops[i] = newDrop(false); return; }
    const x = win.x + d.x * win.w;
    const y = win.y + d.y * win.h;
    if (d.trail.length > 1) {
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = d.r * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, win.y + d.trail[0] * win.h);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.strokeStyle = "rgba(40,50,62,0.18)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(${hi},0.65)`;
    ctx.beginPath();
    ctx.arc(x - d.r * 0.3, y - d.r * 0.32, d.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawSnow(t, dt, win, p) {
  if (!p.flakes.length) return;
  const tint = fx.phase === "night" ? "232,238,255" : "255,255,255";
  const wind = weather.windy ? 0.00012 : 0.00002;
  p.flakes.forEach((f) => {
    f.y += 0.00005 * (0.5 + f.z) * dt;
    f.x += (Math.sin(t / 1600 + f.ph) * 0.00004 + wind * f.z) * dt;
    if (f.y > 1.04) { f.y = -0.04; f.x = Math.random(); }
    if (f.x > 1.04) f.x -= 1.08;
    const x = win.x + f.x * win.w;
    const y = win.y + f.y * win.h;
    const r = 0.8 + 2.4 * f.z;
    if (f.z > 0.85) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.8);
      grad.addColorStop(0, `rgba(${tint},0.85)`);
      grad.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    } else {
      ctx.fillStyle = `rgba(${tint},${0.85 * f.z})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawLeaves(t, dt, win, p) {
  p.leaves.forEach((l) => {
    l.x += 0.00018 * l.v * dt;
    l.y += Math.sin(t / 700 + l.ph) * 0.00008 * dt + 0.00003 * dt;
    l.rot += l.spin * dt;
    if (l.x > 1.08 || l.y > 1.08) { l.x = -0.08; l.y = rand(0, 0.8); }
    const [r, g, b] = l.color;
    ctx.save();
    ctx.translate(win.x + l.x * win.w, win.y + l.y * win.h);
    ctx.rotate(l.rot);
    ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function flashLevel(t) {
  const e = t - fx.flashAt;
  if (e < 0 || e > 1200) return 0;
  if (e < 80) return 0.9;
  if (e < 160) return 0.1;
  if (e < 300) return 0.6;
  return 0.6 * Math.exp(-(e - 300) / 260);
}

function drawFlash(t, win) {
  if (weather.sky !== "storm" || reduceMotion) return;
  if (!fx.nextFlash) fx.nextFlash = t + 3000;
  if (t > fx.nextFlash) {
    fx.flashAt = t;
    fx.nextFlash = t + rand(7000, 18000);
  }
  const f = flashLevel(t);
  if (!f) return;
  ctx.fillStyle = `rgba(236,240,255,${f * 0.18})`;
  ctx.fillRect(0, 0, fx.W, fx.H);
  ctx.fillStyle = `rgba(242,246,255,${f * 0.5})`;
  ctx.fillRect(win.x, win.y, win.w, win.h);
}

function frame(t) {
  const dt = Math.min(64, t - (fx.last || t));
  fx.last = t;
  const key = weather.sky + weather.windy + weather.intensity;
  if (fx.seed !== key) {
    fx.seed = key;
    fx.parts = buildParts();
  }
  const p = fx.parts;
  const c = cover();
  const win = windowRect(c);
  ctx.clearRect(0, 0, fx.W, fx.H);
  drawCloudShadows(dt, c, p);
  drawBeams(t, c, win);
  drawDust(t, dt, c, p);
  drawLamp(t, c);
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  ctx.clip();
  drawSparks(t, win, p);
  drawFog(dt, win, p);
  drawRain(dt, win, p);
  drawSnow(t, dt, win, p);
  drawLeaves(t, dt, win, p);
  ctx.restore();
  drawFlash(t, win);
  requestAnimationFrame(frame);
}

function applyWeather(data) {
  const legacy = { rain: "rain", snow: "snow" }[data.scene] || "clear";
  weather.sky = PLATE_OF[data.sky] ? data.sky : legacy;
  weather.windy = !!data.windy || data.scene === "wind";
  const wet = ["rain", "storm", "snow"].includes(weather.sky);
  weather.intensity = Number(data.intensity) || (wet ? 0.5 : 0);
  weather.temperature = typeof data.temperature === "number" ? data.temperature : weather.temperature;
  tick();
  beginSplash();
  renderWeatherPill();
}

const SKY_NAME = { clear: "晴", partly: "多云", cloudy: "阴", fog: "雾", rain: "雨", storm: "雷雨", snow: "雪" };
const ICON_PATH = {
  sun: '<circle class="wi-core" cx="12" cy="12" r="4"/><g class="wi-rays"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></g>',
  moon: '<path class="wi-moon" d="M18 14.5A7 7 0 1 1 9.5 5a5.5 5.5 0 0 0 8.5 9.5z"/><path class="wi-star" d="M19 3.5v3M17.5 5h3"/><path class="wi-star wi-d2" d="M21 10v1.6M20.2 10.8h1.6"/>',
  partly: '<g class="wi-rays wi-rays-sm"><path d="M8 5.5V4M3.5 10H2M4.8 6.8L3.8 5.8M12.2 6.8l1-1"/></g><path d="M5.2 11.5a3.5 3.5 0 0 1 6.3-2.6"/><g class="wi-drift"><path d="M8 20h9a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 8 20z"/></g>',
  cloud: '<g class="wi-drift"><path d="M7 19h10a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6 11.5 3.8 3.8 0 0 0 7 19z"/></g>',
  fog: '<path class="wi-fog" d="M4 9h16"/><path class="wi-fog wi-d2" d="M3 13h18"/><path class="wi-fog wi-d3" d="M5 17h14"/>',
  rain: '<g class="wi-drift"><path d="M7 15h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.6 9 3.2 3.2 0 0 0 7 15z"/></g><path class="wi-drop" d="M9 18l-1 2.5"/><path class="wi-drop wi-d2" d="M13 18l-1 2.5"/><path class="wi-drop wi-d3" d="M17 18l-1 2.5"/>',
  storm: '<g class="wi-drift"><path d="M7 14h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.6 8 3.2 3.2 0 0 0 7 14z"/></g><path class="wi-bolt" d="M12.5 15l-2 3.5h3l-2 3.5"/>',
  snow: '<g class="wi-drift"><path d="M7 14h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.6 8 3.2 3.2 0 0 0 7 14z"/></g><path class="wi-flake" d="M9 17.5h.01"/><path class="wi-flake wi-d2" d="M13 17.5h.01"/><path class="wi-flake wi-d3" d="M11 19h.01"/><path class="wi-flake wi-d4" d="M15 19h.01"/>',
};

function weatherIcon() {
  const night = hourScene() === "night";
  const key = { clear: night ? "moon" : "sun", partly: night ? "moon" : "partly", cloudy: "cloud" }[weather.sky] || weather.sky;
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATH[key] || ICON_PATH.sun}</svg>`;
}

function renderWeatherPill() {
  wpill.hidden = true;
}

async function loadWeather() {
  const forcedSky = query.get("sky");
  const forcedScene = query.get("scene");
  if (forcedSky || forcedScene) {
    applyWeather({
      sky: forcedSky,
      scene: forcedScene,
      windy: query.get("wind") === "1",
      intensity: Number(query.get("rain")) || 0,
    });
    return;
  }
  const fetchAt = async (lat, lon) => {
    try {
      const q = lat != null ? "?lat=" + lat + "&lon=" + lon : "";
      const res = await fetch("/api/weather" + q);
      applyWeather(await res.json());
    } catch {
      applyWeather({ sky: "clear" });
    }
  };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchAt(pos.coords.latitude, pos.coords.longitude),
      () => fetchAt(),
      { timeout: 4000 }
    );
  } else {
    fetchAt();
  }
}

async function chat() {
  const message = input.value.trim();
  if (!message || sending) return;
  sending = true;
  input.value = "";
  resize();
  releaseWords();
  poseBusy = true;
  setPose("think");
  send.disabled = true;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message, period: valleyPeriod() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "请求失败");
    sessionId = data.session_id;
    await setPose("write");
    setPose("look");
    await typewrite(noteText, data.reply);
    await playPresence(data.presence);
  } catch (err) {
    setPose("look");
    await typewrite(noteText, err.message);
  } finally {
    poseBusy = false;
    sending = false;
    send.disabled = false;
    if (!input.value.trim()) setPose("look");
  }
}

async function playPresence(presence) {
  setPose(moodFor(presence));
}

function resize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 110) + "px";
}

send.addEventListener("click", () => chat());
input.addEventListener("input", () => {
  resize();
  if (poseBusy) return;
  setPose(input.value.trim() ? "listen" : "idle");
});
input.addEventListener("focus", () => { if (!poseBusy) setPose("listen"); });
input.addEventListener("blur", () => { if (!poseBusy && !input.value.trim()) setPose("idle"); });
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chat();
  }
});

document.getElementById("back").addEventListener("click", () => history.back());
document.getElementById("sound").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", on ? "true" : "false");
  e.currentTarget.style.opacity = on ? "1" : "0.45";
});
let dragY = 0;
note.addEventListener("pointerdown", (e) => {
  dragY = e.clientY;
  note.setPointerCapture(e.pointerId);
});
note.addEventListener("pointermove", (e) => {
  if (!dragY) return;
  const dy = Math.max(0, e.clientY - dragY);
  note.style.transform = "translateY(" + dy + "px) rotate(-1.2deg)";
});
note.addEventListener("pointerup", (e) => {
  if (!dragY) return;
  const dy = e.clientY - dragY;
  dragY = 0;
  if (dy > 72) note.classList.add("away");
  note.style.transform = "";
});

const openSplash = document.getElementById("openSplash");
const openArt = document.getElementById("openArt");
let splashStarted = false;

function splashPick() {
  const h = Math.floor(clockMinute() / 60) % 24;
  const forcedSky = query.get("sky");
  return window.SplashLight.pickSplash(h, {
    sky: forcedSky || weather.sky || "clear",
    windy: !!weather.windy || query.get("wind") === "1",
  });
}

function applyOpenSplash(pick) {
  if (window.SplashRain) window.SplashRain.unmount(openSplash);
  openArt.src = "/art/tuantuan/splash/" + pick.file + "?v=light";
  openSplash.className = "open-splash splash-stage play " + pick.lightClass;
  openSplash.setAttribute("style", pick.splashStyle);
  const captionEl = document.getElementById("openCaption");
  if (captionEl) captionEl.textContent = pick.caption;
  if (pick.weather === "rain" && window.SplashRain) {
    requestAnimationFrame(() => {
      window.SplashRain.mount(openSplash, { late: pick.slot === "late" });
    });
  }
}

function finishSplash() {
  if (!splashStarted || openSplash.classList.contains("leave")) return;
  openSplash.classList.add("leave");
  if (window.SplashRain) window.SplashRain.unmount(openSplash);
  setTimeout(() => {
    openSplash.hidden = true;
    speak(opening, 200);
  }, 460);
}

function beginSplash() {
  if (splashStarted) return;
  splashStarted = true;
  if (previewPose) {
    openSplash.hidden = true;
    poseBusy = true;
    setPose(previewPose).then(() => {
      poseBusy = false;
      if (!input.value.trim()) setPose("idle");
    });
    return;
  }
  const pick = splashPick();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  applyOpenSplash(pick);
  openSplash.hidden = false;
  try { navigator.vibrate(12); } catch (e) { /* 网页里轻震不一定可用 */ }
  openSplash.addEventListener("click", finishSplash, { once: true });
  if (query.get("look") !== "1") setTimeout(finishSplash, reduce ? 700 : 4200);
}

if (speed > 1) {
  plates.forEach((el) => { el.style.transitionDuration = "2.4s"; });
  shadeEl.style.transitionDuration = "0.4s";
  glowEl.style.transitionDuration = "0.4s";
  document.documentElement.style.setProperty("--fade", "0.4s");
}
window.addEventListener("resize", sizeCanvas);
sizeCanvas();
tick();
setInterval(tick, speed > 1 ? 250 : 10000);
requestAnimationFrame(frame);
loadWeather();
setInterval(loadWeather, 30 * 60 * 1000);
setTimeout(beginSplash, previewPose ? 0 : 900);

})();
