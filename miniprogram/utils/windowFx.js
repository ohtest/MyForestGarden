/**
 * 窗外粒子：网页 #fx 的轻量版（雨/雪/叶），挂在身后天气层上。
 */

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function createWindowFx() {
  let canvas = null;
  let ctx = null;
  let W = 0;
  let H = 0;
  let timer = null;
  let sky = "clear";
  let windy = false;
  let intensity = 0.45;
  let parts = null;
  let last = 0;
  let running = false;

  function build() {
    const k = intensity;
    const wet = sky === "rain" || sky === "storm";
    const p = { streaks: [], flakes: [], leaves: [] };
    if (wet) {
      const n = Math.round(40 + 80 * k);
      for (let i = 0; i < n; i += 1) {
        p.streaks.push({ x: Math.random(), y: Math.random(), z: rand(0.4, 1) });
      }
    }
    if (sky === "snow") {
      const n = Math.round(50 + 70 * k);
      for (let i = 0; i < n; i += 1) {
        p.flakes.push({ x: Math.random(), y: Math.random(), z: rand(0.3, 1), ph: rand(0, 6.28) });
      }
    }
    if (windy && sky !== "snow") {
      for (let i = 0; i < 10; i += 1) {
        p.leaves.push({
          x: Math.random(),
          y: Math.random(),
          v: rand(0.6, 1.4),
          rot: rand(0, 6.28),
          spin: rand(-0.004, 0.004),
          color: Math.random() < 0.5 ? [226, 150, 80] : [204, 112, 64],
        });
      }
    }
    parts = p;
  }

  function paint(now) {
    if (!ctx || !parts || !running) return;
    const dt = last ? Math.min(40, now - last) : 16;
    last = now;
    ctx.clearRect(0, 0, W, H);

    if (parts.streaks.length) {
      ctx.strokeStyle = "rgba(230,240,255,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < parts.streaks.length; i += 1) {
        const s = parts.streaks[i];
        s.y += (0.018 + 0.02 * s.z) * (dt / 16);
        if (s.y > 1.1) {
          s.y = -0.1;
          s.x = Math.random();
        }
        const x = s.x * W;
        const y = s.y * H;
        const len = 10 + 16 * s.z;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4 * s.z, y + len);
      }
      ctx.stroke();
    }

    if (parts.flakes.length) {
      for (let i = 0; i < parts.flakes.length; i += 1) {
        const f = parts.flakes[i];
        f.y += (0.004 + 0.008 * f.z) * (dt / 16);
        f.x += Math.sin(now * 0.001 + f.ph) * 0.0008 * f.z * dt;
        if (f.y > 1.1) {
          f.y = -0.05;
          f.x = Math.random();
        }
        const r = 1.2 + 1.8 * f.z;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(f.x * W, f.y * H, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (parts.leaves.length) {
      for (let i = 0; i < parts.leaves.length; i += 1) {
        const L = parts.leaves[i];
        L.x += 0.0012 * L.v * dt;
        L.y += 0.0004 * L.v * dt;
        L.rot += L.spin * dt;
        if (L.x > 1.2) {
          L.x = -0.1;
          L.y = Math.random();
        }
        const c = L.color;
        ctx.save();
        ctx.translate(L.x * W, L.y * H);
        ctx.rotate(L.rot);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.75)`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function tick() {
    if (!running) return;
    paint(Date.now());
    timer = setTimeout(tick, 40);
  }

  function mount(canvasNode, size) {
    canvas = canvasNode;
    const dpr = Math.min(2, (wx.getSystemInfoSync().pixelRatio || 1));
    W = Math.max(2, Math.round((size && size.width) || 300));
    H = Math.max(2, Math.round((size && size.height) || 500));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    build();
    running = true;
    last = 0;
    if (timer) clearTimeout(timer);
    tick();
  }

  function setWeather(next) {
    sky = next.sky || "clear";
    windy = !!next.windy;
    let nextIntensity = typeof next.intensity === "number" ? next.intensity : 0.45;
    if (sky === "storm") nextIntensity = Math.max(0.7, nextIntensity || 0.7);
    if (sky === "fog") nextIntensity = Math.max(0.2, nextIntensity || 0.3);
    intensity = nextIntensity;
    build();
  }

  function destroy() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = null;
    canvas = null;
    ctx = null;
    parts = null;
  }

  return { mount, setWeather, destroy };
}

module.exports = { createWindowFx };
