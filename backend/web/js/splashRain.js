/**
 * 开屏三层视差雨丝（canvas）
 * 禁止 repeating-linear-gradient 条纹；深夜整层透明度 ≤ 0.25。
 */
(function (global) {
  const LAYERS = [
    { id: "far", count: 32, blur: 2, alpha: [0.12, 0.15], speed: [0.35, 0.55], lenMul: 1, z: 1 },
    { id: "mid", count: 30, blur: 0.5, alpha: [0.2, 0.25], speed: [0.7, 1.0], lenMul: 1, z: 2 },
    { id: "near", count: 26, blur: 0, alpha: [0.28, 0.32], speed: [1.25, 1.7], lenMul: 1.8, z: 3 },
  ];

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function makeDrop(w, h, layer) {
    const angle = rand(8, 14) * (Math.PI / 180);
    const len = rand(40, 90) * layer.lenMul;
    return {
      x: rand(-40, w + 40),
      y: rand(-h, h),
      len,
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

    // 伞区压暗：角色/伞大致在画面中部偏上
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

  /**
   * @param {HTMLElement} stage .splash-stage
   * @param {{ late?: boolean }} opts
   */
  function mount(stage, opts) {
    if (!stage) return null;
    const host = stage.querySelector(".splash-weather-fx");
    if (!host) return null;
    unmount(stage);

    const late = !!(opts && opts.late);
    const wrap = document.createElement("div");
    wrap.className = "splash-rain" + (late ? " splash-rain--late" : "");
    wrap.setAttribute("data-splash-rain", "1");

    const mist = document.createElement("div");
    mist.className = "splash-rain-mist";
    const ground = document.createElement("div");
    ground.className = "splash-rain-ground";
    const canvas = document.createElement("canvas");
    canvas.className = "splash-rain-canvas";
    wrap.appendChild(ground);
    wrap.appendChild(mist);
    wrap.appendChild(canvas);
    host.appendChild(wrap);
    host.style.opacity = "1";
    host.style.background = "none";
    host.style.animation = "none";

    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let layers = [];
    let raf = 0;
    let heroAt = performance.now() + rand(6000, 10000);
    let running = true;

    function resize() {
      const r = stage.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layers = LAYERS.map((layer) => ({
        ...layer,
        drops: Array.from({ length: layer.count }, () => makeDrop(w, h, layer)),
      }));
    }

    const umbrella = {
      cx: () => w * 0.5,
      cy: () => h * 0.42,
      rx: () => w * 0.28,
      ry: () => h * 0.16,
    };

    function tick(now) {
      if (!running) return;
      if (!canvas.isConnected) {
        running = false;
        cancelAnimationFrame(raf);
        return;
      }
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);

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
        cx: umbrella.cx(),
        cy: umbrella.cy(),
        rx: umbrella.rx(),
        ry: umbrella.ry(),
      };

      for (const layer of layers) {
        ctx.save();
        if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`;
        for (const d of layer.drops) {
          d.y += d.speed * (d.hero ? 14 : 9);
          d.x += Math.sin(d.angle) * d.speed * 2.2;
          if (d.y > h + 40) {
            d.y = rand(-h * 0.3, -20);
            d.x = rand(-40, w + 40);
            d.angle = rand(8, 14) * (Math.PI / 180);
            d.len = rand(40, 90) * layer.lenMul;
            d.thick = rand(1, 2);
            d.alpha = rand(layer.alpha[0], layer.alpha[1]);
            d.sway = rand(1, 3);
          }
          if (d.x > w + 50) d.x = -30;
          paintDrop(ctx, d, t, umb);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    }

    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage);
    raf = requestAnimationFrame(tick);

    stage._splashRain = {
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        wrap.remove();
        host.style.opacity = "";
        host.style.background = "";
        host.style.animation = "";
        stage._splashRain = null;
      },
    };
    return stage._splashRain;
  }

  function unmount(stage) {
    if (stage && stage._splashRain) stage._splashRain.stop();
  }

  function mountAll(root) {
    const scope = root || document;
    scope.querySelectorAll(".splash-stage.fx-weather-rain").forEach((stage) => {
      const late = stage.classList.contains("light-late");
      mount(stage, { late });
    });
  }

  global.SplashRain = { mount, unmount, mountAll };
})(typeof window !== "undefined" ? window : globalThis);
