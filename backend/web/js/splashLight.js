/**
 * 开屏光照系统：时段判断 → 光线渲染 → 天气质感叠加
 * 5 时段 × 5 天气 = 25 组合，全部由 MATRIX 配置表渲染。
 */

const SLOTS = {
  morning: { id: "morning", label: "清晨", range: "5–11", sampleHour: 8 },
  midday: { id: "midday", label: "中午", range: "11–14", sampleHour: 12 },
  afternoon: { id: "afternoon", label: "下午", range: "14–17", sampleHour: 15 },
  evening: { id: "evening", label: "晚上", range: "17–23", sampleHour: 20 },
  late: { id: "late", label: "深夜", range: "23–5", sampleHour: 1 },
};

/**
 * 夜段重绘底图：仅替换对应天气卡，禁止把晴/雨/风/雾都盖成阴图。
 * 阴→晚上、雾/阴→深夜；其它天气仍用各自天气卡 + 夜光滤镜。
 */
const PERIOD_BASE_ART = {
  evening_cloudy: "splash-09-evening.jpg",
  late_fog: "splash-10-late.jpg",
  late_cloudy: "splash-10-late.jpg",
};

function resolveArtFile(slot, weatherKey) {
  const key = `${slot}_${weatherKey}`;
  return PERIOD_BASE_ART[key] || WEATHERS[weatherKey].file;
}

/** 五天气卡：天气不改光源方向，只改光的质感 */
const WEATHERS = {
  clear: {
    id: "clear",
    label: "晴",
    file: "splash-01-sunny.jpg",
    soften: 0,
    satMul: 1,
    brightMul: 1,
    contrastMul: 1,
    veil: "none",
    scatter: 0,
    bloom: 0,
    motion: "none",
    lateOnly: false,
  },
  cloudy: {
    id: "cloudy",
    label: "阴",
    file: "splash-05-cloudy.jpg",
    soften: 0.5,
    satMul: 0.72,
    brightMul: 0.96,
    contrastMul: 0.92,
    veil: "soft",
    scatter: 0.15,
    bloom: 0,
    motion: "none",
    lateOnly: false,
  },
  rain: {
    id: "rain",
    label: "雨",
    file: "splash-02-rain.jpg",
    soften: 0.35,
    satMul: 0.78,
    brightMul: 0.92,
    contrastMul: 0.95,
    veil: "cold",
    scatter: 0.45,
    bloom: 0,
    motion: "rain",
    lateOnly: false,
  },
  wind: {
    id: "wind",
    label: "有风",
    file: "splash-04-wind.jpg",
    soften: 0,
    satMul: 1,
    brightMul: 1,
    contrastMul: 1,
    veil: "none",
    scatter: 0,
    bloom: 0,
    motion: "wind",
    lateOnly: false,
  },
  fog: {
    id: "fog",
    label: "雾",
    file: "splash-07-fog.jpg",
    soften: 0.65,
    satMul: 0.68,
    brightMul: 0.9,
    contrastMul: 0.88,
    veil: "mist",
    scatter: 0.7,
    bloom: 0,
    motion: "fog",
    lateOnly: true,
  },
};

/**
 * 时段光线基底
 * 明度锚点（背景主体）：清晨75% / 中午95% / 下午80% / 晚上45% / 深夜22%
 * 团团本体靠 bodyProtect 保亮，禁止纯黑纯白。
 */
const PERIOD_LIGHT = {
  morning: {
    // 背景锚点 ~75%：暖白晨光，不过曝
    stageBg: "linear-gradient(180deg, #d8cfc0 0%, #cfc4b0 45%, #c4b6a0 100%)",
    keyGrad:
      "linear-gradient(135deg, rgba(255,244,220,0.48) 0%, rgba(255,226,180,0.18) 28%, transparent 55%)",
    keyBlend: "soft-light",
    keyOpacity: 0.72,
    rimGrad:
      "radial-gradient(ellipse 52% 48% at 28% 42%, rgba(255,208,120,0.55) 0%, rgba(255,220,160,0.16) 42%, transparent 72%)",
    rimOpacity: 0.78,
    shadowGrad:
      "radial-gradient(ellipse 48% 55% at 72% 66%, rgba(70,52,36,0.28) 0%, transparent 72%)",
    shadowOpacity: 0.42,
    fillGrad:
      "linear-gradient(180deg, rgba(255,248,235,0.1) 0%, transparent 42%, rgba(232,210,180,0.1) 100%)",
    fillOpacity: 0.55,
    fillBlend: "soft-light",
    shadeGrad: "none",
    shadeOpacity: 0,
    liftGrad: "none",
    liftOpacity: 0,
    bodyProtect:
      "radial-gradient(ellipse 58% 52% at 50% 58%, rgba(255,246,230,0.22) 0%, transparent 68%)",
    bodyOpacity: 0.35,
    bodyBlend: "soft-light",
    hiCompress:
      "radial-gradient(ellipse 90% 60% at 40% 18%, rgba(210,200,185,0.18) 0%, transparent 60%)",
    hiOpacity: 0.25,
    brightness: 1.02,
    saturate: 1.05,
    contrast: 1.0,
    sepia: 0.05,
    hue: 0,
    periodFx: "mist",
  },
  midday: {
    // 背景锚点 ~95%：顶光最亮，高光压到约 235
    stageBg: "linear-gradient(180deg, #e8e2d4 0%, #ddd4c2 50%, #d2c6b0 100%)",
    keyGrad:
      "linear-gradient(180deg, rgba(255,250,235,0.42) 0%, rgba(255,240,210,0.14) 22%, transparent 48%)",
    keyBlend: "soft-light",
    keyOpacity: 0.55,
    rimGrad:
      "radial-gradient(ellipse 58% 36% at 50% 28%, rgba(255,248,230,0.32) 0%, rgba(255,236,200,0.12) 40%, transparent 68%)",
    rimOpacity: 0.5,
    shadowGrad:
      "radial-gradient(ellipse 36% 28% at 52% 78%, rgba(50,40,28,0.38) 0%, transparent 70%)",
    shadowOpacity: 0.55,
    fillGrad:
      "radial-gradient(ellipse 70% 50% at 50% 18%, rgba(255,220,150,0.14), transparent 70%)",
    fillOpacity: 0.45,
    fillBlend: "soft-light",
    shadeGrad: "none",
    shadeOpacity: 0,
    liftGrad: "none",
    liftOpacity: 0,
    bodyProtect:
      "radial-gradient(ellipse 58% 52% at 50% 58%, rgba(255,248,235,0.12) 0%, transparent 68%)",
    bodyOpacity: 0.2,
    bodyBlend: "soft-light",
    hiCompress:
      "radial-gradient(ellipse 100% 55% at 50% 12%, rgba(200,195,180,0.28) 0%, transparent 65%)",
    hiOpacity: 0.4,
    brightness: 1.06,
    saturate: 1.18,
    contrast: 1.04,
    sepia: 0.03,
    hue: -3,
    periodFx: "heat",
  },
  afternoon: {
    // 背景锚点 ~80%：蜂蜜斜阳
    stageBg: "linear-gradient(200deg, #d4c0a0 0%, #c8ae88 50%, #b89878 100%)",
    keyGrad:
      "linear-gradient(225deg, rgba(255,196,120,0.5) 0%, rgba(255,168,80,0.2) 30%, transparent 58%)",
    keyBlend: "soft-light",
    keyOpacity: 0.75,
    rimGrad:
      "radial-gradient(ellipse 50% 48% at 72% 40%, rgba(255,168,70,0.55) 0%, rgba(255,140,60,0.16) 40%, transparent 72%)",
    rimOpacity: 0.8,
    shadowGrad:
      "radial-gradient(ellipse 58% 60% at 28% 78%, rgba(70,40,22,0.32) 0%, transparent 75%)",
    shadowOpacity: 0.55,
    fillGrad:
      "linear-gradient(200deg, rgba(255,180,100,0.12) 0%, transparent 50%, rgba(190,110,70,0.12) 100%)",
    fillOpacity: 0.55,
    fillBlend: "soft-light",
    shadeGrad: "none",
    shadeOpacity: 0,
    liftGrad: "none",
    liftOpacity: 0,
    bodyProtect:
      "radial-gradient(ellipse 58% 52% at 50% 58%, rgba(255,230,200,0.2) 0%, transparent 68%)",
    bodyOpacity: 0.3,
    bodyBlend: "soft-light",
    hiCompress:
      "radial-gradient(ellipse 70% 50% at 75% 20%, rgba(200,160,120,0.16) 0%, transparent 60%)",
    hiOpacity: 0.22,
    brightness: 1.0,
    saturate: 1.12,
    contrast: 1.02,
    sepia: 0.14,
    hue: 6,
    periodFx: "leaves",
  },
  evening: {
    // 背景锚点 ~45%：蓝紫天 + 篝火侧暖；角色区挖空暗化，本体不过暗
    // filter: brightness(0.95) contrast(0.95) — 高光靠 hi + shade 压
    stageBg: "linear-gradient(180deg, #3a3a68 0%, #2e2e58 40%, #252448 100%)",
    keyGrad:
      "radial-gradient(ellipse 65% 50% at 68% 82%, rgba(255,150,70,0.38) 0%, rgba(220,100,40,0.14) 38%, transparent 68%)",
    keyBlend: "soft-light",
    keyOpacity: 0.65,
    rimGrad:
      "radial-gradient(ellipse 48% 52% at 66% 68%, rgba(255,150,80,0.48) 0%, rgba(255,120,50,0.12) 45%, transparent 72%)",
    rimOpacity: 0.7,
    shadowGrad:
      "radial-gradient(ellipse 55% 60% at 28% 48%, rgba(36,42,78,0.32) 0%, rgba(28,32,60,0.16) 50%, transparent 75%)",
    shadowOpacity: 0.4,
    fillGrad:
      "linear-gradient(180deg, rgba(48,52,130,0.72) 0%, rgba(40,44,110,0.58) 40%, rgba(34,32,78,0.65) 100%)",
    fillOpacity: 0.72,
    fillBlend: "multiply",
    // 角色区透明挖空：只压背景到 ~45%，团团本体保持
    shadeGrad:
      "radial-gradient(ellipse 56% 50% at 50% 58%, rgba(40,38,72,0) 0%, rgba(40,38,72,0.04) 42%, rgba(34,36,70,0.48) 72%, rgba(30,32,64,0.65) 100%)",
    shadeOpacity: 0.75,
    liftGrad: "none",
    liftOpacity: 0,
    bodyProtect:
      "radial-gradient(ellipse 52% 46% at 52% 60%, rgba(255,220,180,0.48) 0%, rgba(255,170,110,0.16) 45%, transparent 70%)",
    bodyOpacity: 0.78,
    bodyBlend: "soft-light",
    hiCompress:
      "linear-gradient(180deg, rgba(64,70,140,0.55) 0%, rgba(52,58,120,0.32) 28%, transparent 58%)",
    hiOpacity: 0.55,
    brightness: 0.9,
    saturate: 1.12,
    contrast: 0.95,
    sepia: 0.03,
    hue: -2,
    periodFx: "fireface",
  },
  late: {
    // 背景锚点 ~22%：深靛蓝 #141430→#232048，最暗 #1c1c38
    // 整图几乎不压暗；靠 shade 挖空 + body screen 提亮角色
    stageBg: "linear-gradient(180deg, #232048 0%, #1c1c38 48%, #141430 100%)",
    keyGrad:
      "radial-gradient(ellipse 85% 48% at 50% 0%, rgba(150,180,255,0.36) 0%, transparent 55%)",
    keyBlend: "soft-light",
    keyOpacity: 0.65,
    rimGrad:
      "radial-gradient(ellipse 50% 48% at 48% 56%, transparent 46%, rgba(180,210,255,0.85) 56%, rgba(150,185,250,0.35) 70%, transparent 84%), radial-gradient(ellipse 24% 20% at 60% 74%, rgba(255,170,90,0.65) 0%, transparent 70%)",
    rimOpacity: 1,
    shadowGrad:
      "radial-gradient(ellipse 90% 80% at 50% 40%, transparent 48%, rgba(28,28,56,0.22) 82%, rgba(28,28,56,0.3) 100%)",
    shadowOpacity: 0.35,
    fillGrad:
      "linear-gradient(180deg, rgba(40,38,80,0.42) 0%, rgba(32,32,64,0.32) 45%, rgba(36,34,76,0.45) 100%)",
    fillOpacity: 0.42,
    fillBlend: "multiply",
    // 中心也保留靛蓝压暗（禁止挖空过透导致晴天卡出现白晕），角色靠 body 轻提
    shadeGrad:
      "radial-gradient(ellipse 54% 48% at 50% 58%, rgba(28,28,56,0.38) 0%, rgba(28,28,56,0.5) 40%, rgba(24,24,52,0.68) 68%, rgba(20,20,48,0.8) 100%)",
    shadeOpacity: 0.9,
    liftGrad:
      "radial-gradient(ellipse 48% 42% at 50% 58%, rgba(90,110,170,0.28) 0%, rgba(50,65,130,0.1) 55%, transparent 78%)",
    liftOpacity: 0.45,
    bodyProtect:
      "radial-gradient(ellipse 42% 38% at 50% 58%, rgba(200,215,245,0.4) 0%, rgba(150,175,230,0.12) 50%, transparent 72%)",
    bodyOpacity: 0.6,
    bodyBlend: "soft-light",
    hiCompress: "none",
    hiOpacity: 0,
    brightness: 0.88,
    saturate: 1.12,
    contrast: 1.05,
    sepia: 0.02,
    hue: 6,
    periodFx: "embers",
  },
};

/** API sky → 五天气（表驱动，无分支链） */
const SKY_TO_WEATHER = {
  clear: "clear",
  sunny: "clear",
  heat: "clear",
  partly: "cloudy",
  cloudy: "cloudy",
  rain: "rain",
  storm: "rain",
  snow: "rain",
  fog: "fog",
  mist: "fog",
  wind: "wind",
};

function splashSlotOf(hour) {
  const h = typeof hour === "number" ? hour : new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "midday";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 23) return "evening";
  return "late";
}

function normalizeWeather(slot, weather) {
  const sky = (weather && weather.sky) || "clear";
  let key = SKY_TO_WEATHER[sky] || "clear";
  if (weather && weather.windy && (key === "clear" || key === "cloudy")) {
    key = "wind";
  }
  // 雾仅深夜；其它时段雾 → 阴
  if (WEATHERS[key].lateOnly && slot !== "late") {
    key = "cloudy";
  }
  return key;
}

function buildEntry(slot, weatherKey) {
  const period = SLOTS[slot];
  const base = PERIOD_LIGHT[slot];
  const w = WEATHERS[weatherKey];
  const soft = w.soften;
  const file = resolveArtFile(slot, weatherKey);
  const bakedNight = Object.values(PERIOD_BASE_ART).indexOf(file) !== -1;

  let brightness;
  let contrast;
  let saturate;
  let keyOpacity;
  let rimOpacity;
  let shadowOpacity;
  let fillOpacity;
  let hiOpacity;
  let bodyOpacity;
  let liftOpacity;
  let shadeOpacity;
  let bloom;

  if (bakedNight) {
    // 夜段底图已按锚点绘制：滤镜接近中性，天气只微调质感与动效
    brightness = +(1 * (1 - soft * 0.04)).toFixed(3);
    contrast = +(1 * (1 - soft * 0.03)).toFixed(3);
    saturate = +(1 * Math.max(w.satMul, 0.88)).toFixed(3);
    keyOpacity = +(0.12 * (1 - soft * 0.4)).toFixed(3);
    rimOpacity = +(0.18 * (1 - soft * 0.3)).toFixed(3);
    shadowOpacity = +(0.1 * (1 - soft * 0.3)).toFixed(3);
    fillOpacity = +(0.08 + soft * 0.12).toFixed(3);
    hiOpacity = +(soft * 0.12).toFixed(3);
    bodyOpacity = 0.08;
    liftOpacity = 0.06;
    shadeOpacity = +(0.06 + soft * 0.08).toFixed(3);
    bloom = 0; // 深夜光圈一律关闭
  } else {
    brightness = +(base.brightness * w.brightMul * (1 - soft * 0.12)).toFixed(3);
    contrast = +(base.contrast * w.contrastMul * (1 - soft * 0.08)).toFixed(3);
    saturate = +(base.saturate * w.satMul).toFixed(3);
    keyOpacity = +(base.keyOpacity * (1 - soft * 0.5)).toFixed(3);
    rimOpacity = slot === "late" ? 0 : +(base.rimOpacity * (1 - soft * 0.35)).toFixed(3);
    shadowOpacity = +(base.shadowOpacity * (1 - soft * 0.4) * (1 + w.scatter * 0.15)).toFixed(3);
    fillOpacity = +(base.fillOpacity * (0.85 + soft * 0.2)).toFixed(3);
    hiOpacity = +(base.hiOpacity * (1 + soft * 0.35)).toFixed(3);
    bodyOpacity = +(base.bodyOpacity * (1 - soft * 0.15)).toFixed(3);
    liftOpacity = +(base.liftOpacity).toFixed(3);
    shadeOpacity = +(base.shadeOpacity || 0);
    bloom = 0; // 深夜光圈一律关闭
  }
  if (slot === "late") {
    bloom = 0;
    rimOpacity = 0;
  }

  const artFilter = bakedNight
    ? [
        `brightness(${brightness})`,
        `saturate(${saturate})`,
        `contrast(${contrast})`,
      ].join(" ")
    : [
        `brightness(${brightness})`,
        `saturate(${saturate})`,
        `contrast(${contrast})`,
        `sepia(${base.sepia})`,
        `hue-rotate(${base.hue}deg)`,
      ].join(" ");

  return {
    slot,
    slotLabel: period.label,
    range: period.range,
    sampleHour: period.sampleHour,
    weather: weatherKey,
    weatherLabel: w.label,
    kind: weatherKey,
    file,
    caption: `${period.label} · ${w.label}`,
    periodFx: base.periodFx,
    weatherFx: w.motion,
    veil: w.veil,
    bloom,
    scatter: w.scatter,
    bakedNight,
    // 供 WXML / HTML 绑定
    lightClass: `light-${slot} weather-${weatherKey} fx-period-${base.periodFx} fx-weather-${w.motion} veil-${w.veil}${bakedNight ? " baked-night" : ""}`,
    cssVars: {
      "--art-filter": artFilter,
      "--stage-bg": base.stageBg,
      "--key-grad": base.keyGrad,
      "--key-blend": base.keyBlend,
      "--key-opacity": String(keyOpacity),
      "--rim-grad": base.rimGrad,
      "--rim-opacity": String(rimOpacity),
      "--shadow-grad": base.shadowGrad,
      "--shadow-opacity": String(shadowOpacity),
      "--fill-grad": base.fillGrad,
      "--fill-blend": base.fillBlend || "multiply",
      "--fill-opacity": String(fillOpacity),
      "--shade-grad": base.shadeGrad || "none",
      "--shade-opacity": String(shadeOpacity),
      "--lift-grad": base.liftGrad,
      "--lift-opacity": String(liftOpacity),
      "--body-protect": base.bodyProtect,
      "--body-opacity": String(bodyOpacity),
      "--body-blend": base.bodyBlend || "soft-light",
      "--hi-compress": base.hiCompress,
      "--hi-opacity": String(hiOpacity),
      "--bloom-opacity": String(bloom),
      "--scatter": String(w.scatter),
    },
  };
}

/** 25 组合配置表：渲染只查表 */
const MATRIX = {};
Object.keys(PERIOD_LIGHT).forEach((slot) => {
  Object.keys(WEATHERS).forEach((weatherKey) => {
    MATRIX[`${slot}_${weatherKey}`] = buildEntry(slot, weatherKey);
  });
});

function cssVarsToStyle(vars) {
  return Object.keys(vars)
    .map((k) => `${k}:${vars[k]}`)
    .join(";");
}

/**
 * @param {number} hour
 * @param {{ sky?: string, windy?: boolean }} weather
 */
function pickSplash(hour, weather) {
  const slot = splashSlotOf(hour);
  const weatherKey = normalizeWeather(slot, weather || {});
  const entry = MATRIX[`${slot}_${weatherKey}`] || MATRIX[`${slot}_clear`];
  return {
    ...entry,
    tone: slot,
    splashStyle: cssVarsToStyle(entry.cssVars),
  };
}

/** 演示/验收：指定时段×天气查表 */
function pickSplashByKey(slot, weatherKey) {
  const key = WEATHERS[weatherKey] ? weatherKey : "clear";
  const s = PERIOD_LIGHT[slot] ? slot : "morning";
  const entry = MATRIX[`${s}_${key}`];
  return {
    ...entry,
    tone: s,
    splashStyle: cssVarsToStyle(entry.cssVars),
  };
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * 三层视差雨丝（小程序 view 渲染）
 * @param {boolean} late 深夜降透明度
 * @param {boolean} lowPower 减粒子
 */
function buildSplashRain(late, lowPower) {
  const specs = [
    { id: "far", count: lowPower ? 16 : 30, alpha: [0.12, 0.15], dur: [2.8, 3.8], lenMul: 1, blur: 2 },
    { id: "mid", count: lowPower ? 16 : 28, alpha: [0.2, 0.25], dur: [1.6, 2.3], lenMul: 1, blur: 0.5 },
    { id: "near", count: lowPower ? 12 : 24, alpha: [0.28, 0.32], dur: [0.9, 1.35], lenMul: 1.8, blur: 0 },
  ];
  const layers = specs.map((spec) => {
    const drops = [];
    for (let i = 0; i < spec.count; i += 1) {
      drops.push({
        id: `${spec.id}-${i}`,
        left: +rand(-5, 105).toFixed(2),
        top: +rand(-30, 100).toFixed(2),
        len: Math.round(rand(40, 90) * spec.lenMul),
        thick: +rand(1, 2).toFixed(1),
        angle: +rand(8, 14).toFixed(1),
        alpha: +rand(spec.alpha[0], spec.alpha[1]).toFixed(3),
        dur: +rand(spec.dur[0], spec.dur[1]).toFixed(2),
        delay: +(-rand(0, 3)).toFixed(2),
        sway: +rand(1, 3).toFixed(1),
        hero: false,
      });
    }
    // 近层预留一根可点亮的主雨丝位
    if (spec.id === "near" && drops.length) {
      drops[0].heroReady = true;
    }
    return { id: spec.id, blur: spec.blur, drops };
  });
  return {
    show: true,
    late: !!late,
    layers,
  };
}


window.SplashLight = {
  SLOTS, WEATHERS, PERIOD_BASE_ART, PERIOD_LIGHT, MATRIX, SKY_TO_WEATHER,
  splashSlotOf, normalizeWeather, resolveArtFile, pickSplash, pickSplashByKey, cssVarsToStyle, buildSplashRain,
};
