/**
 * 开屏三层视差雨丝（canvas）——对齐网页 splashRain.js
 * 禁止条纹渐变；深夜整层透明度 ≤ 0.25。
 */

const LAYERS = [
  { id: "far", count: 32, blur: 2, alpha: [0.12, 0.15], speed: [0.35, 0.55], lenMul: 1 },
  { id: "mid", count: 30, blur: 0.5, alpha: [0.2, 0.25], speed: [0.7, 1.0], lenMul: 1 },
  { id: "near", count: 26, blur: 0, alpha: [0.28, 0.32], speed: [1.25, 1.7], lenMul: 1.8 },
];

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function makeDrop(w, h, layer) {
  const angle = rand(8, 14) * (Math.PI / 180);
  return {
    x: rand(-40, w + 40),
    y: rand(-h, h),
    len: rand(40, 90) * layer.lenMul,
    thick: rand(1, 2),
    angle,
    speed: rand(layer.speed[0], layer.speed[1]),
    alpha: rand(layer.alpha[0], layer.alpha[1]),
    sway: rand(1, 3),
    swayPhase: rand(0, Math.PI * 2),
    swayFreq: rand(1.2, 2.4),
    hero: false,
  };
}

function paintDrop(ctx, d, t, umbrella) {
  const swayX = Math.sin(t * d.swayFreq + d.swayPhase) * d.sway;
  const x1 = d.x + swayX;
  const y1 = d.y;
  const x2 = x1 + Math.sin(d.angle) * d.len;
  const y2 = y1 + Math.cos(d.angle) * d.len;

  let a = d.alpha;
  if (umbrella) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = (mx - umbrella.cx) / umbrella.rx;
    const dy = (my - umbrella.cy) / umbrella.ry;
    if (dx * dx + dy * dy < 1) a = Math.min(a, 0.08);
  }
  if (d.hero) a = Math.min(0.55, a * 2.2);

  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.45, `rgba(255,255,255,${a})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = d.hero ? d.thick + 0.6 : d.thick;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function createSplashRain() {
  let canvas = null;
  let ctx = null;
  let w = 0;
  let h = 0;
  let layers = [];
  let timer = null;
  let running = false;
  let late = false;
  let lowPower = false;
  let heroAt = 0;

  function rebuild() {
    const specs = LAYERS.map((layer) => {
      const count = lowPower ? Math.round(layer.count * 0.55) : layer.count;
      return Object.assign({}, layer, { count });
    });
    layers = specs.map((layer) => ({
      id: layer.id,
      blur: layer.blur,
      speed: layer.speed,
      drops: Array.from({ length: layer.count }, () => makeDrop(w, h, layer)),
    }));
  }

  function tick() {
    if (!running || !ctx) return;
    const now = Date.now();
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = late ? 0.65 : 1;

    if (now >= heroAt) {
      const near = layers[2];
      if (near && near.drops.length) {
        const d = near.drops[Math.floor(Math.random() * near.drops.length)];
        d.hero = true;
        d.y = -40;
        d.x = rand(0, w);
        d.speed = rand(2.2, 2.8);
        setTimeout(() => {
          d.hero = false;
          d.speed = rand(near.speed[0], near.speed[1]);
        }, 900);
      }
      heroAt = now + rand(6000, 10000);
    }

    const umb = {
      cx: w * 0.5,
      cy: h * 0.42,
      rx: w * 0.28,
      ry: h * 0.16,
    };

    for (let li = 0; li < layers.length; li += 1) {
      const layer = layers[li];
      ctx.save();
      // 小程序 2d 部分机型无 filter，用降低透明度近似远层模糊
      if (layer.blur > 0) ctx.globalAlpha = (late ? 0.65 : 1) * 0.75;
      for (let i = 0; i < layer.drops.length; i += 1) {
        const d = layer.drops[i];
        d.y += d.speed * (d.hero ? 14 : 9);
        d.x += Math.sin(d.angle) * d.speed * 2.2;
        if (d.y > h + 40) {
          d.y = rand(-h * 0.3, -20);
          d.x = rand(-40, w + 40);
          d.angle = rand(8, 14) * (Math.PI / 180);
          d.len = rand(40, 90) * (layer.id === "near" ? 1.8 : 1);
          d.thick = rand(1, 2);
          d.alpha = rand(0.12, 0.32);
          d.sway = rand(1, 3);
        }
        if (d.x > w + 50) d.x = -30;
        paintDrop(ctx, d, t, umb);
      }
      ctx.restore();
      ctx.globalAlpha = late ? 0.65 : 1;
    }

    timer = setTimeout(tick, 40);
  }

  function mount(canvasNode, size, opts) {
    destroy();
    canvas = canvasNode;
    late = !!(opts && opts.late);
    lowPower = !!(opts && opts.lowPower);
    const dpr = Math.min(2, (wx.getSystemInfoSync().pixelRatio || 1));
    w = Math.max(2, Math.round((size && size.width) || 300));
    h = Math.max(2, Math.round((size && size.height) || 500));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    rebuild();
    running = true;
    heroAt = Date.now() + rand(6000, 10000);
    tick();
  }

  function destroy() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    canvas = null;
    ctx = null;
    layers = [];
  }

  return { mount, destroy };
}

module.exports = { createSplashRain };
