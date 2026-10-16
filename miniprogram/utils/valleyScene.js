/**
 * 山谷场景：时段 × 天气。
 * 页面只查 COMBOS，天气覆盖时段的规则都在 mergeRules 里。
 */

const OUTFITS = {
  cocoa: { scarf: true, cocoa: true },
  bare: {},
  hatAside: { strawHat: true },
  notes: { notesOpen: true },
  wizard: { wizardHat: true, cloak: true },
  lantern: { wizardHat: true, lantern: true },
  sleep: { nightcap: true, blanket: true },
  cloak: { rainCloak: true },
  umbrella: { umbrella: true },
  knit: { knitHat: true, scarf: true },
};

const PERIODS = [
  {
    id: "dawn",
    label: "清晨",
    hours: [5, 8],
    scene: "stream",
    sky: "dawn",
    sunAngle: 18,
    ground: "bank",
    baseOutfit: "cocoa",
    sounds: ["birds", "stream"],
  },
  {
    id: "morning",
    label: "上午",
    hours: [8, 11],
    scene: "meadow",
    sky: "morning",
    sunAngle: 42,
    ground: "grass",
    baseOutfit: "bare",
    sounds: ["breeze", "insects"],
  },
  {
    id: "noon",
    label: "午后",
    hours: [11, 14],
    scene: "meadow",
    sky: "noon",
    sunAngle: 72,
    ground: "shade",
    baseOutfit: "hatAside",
    sounds: ["leaves"],
  },
  {
    id: "afternoon",
    label: "下午",
    hours: [14, 17],
    scene: "meadow",
    sky: "afternoon",
    sunAngle: 28,
    ground: "gold",
    baseOutfit: "notes",
    sounds: ["breeze", "far-birds"],
  },
  {
    id: "dusk",
    label: "黄昏",
    hours: [17, 19],
    scene: "valley",
    sky: "dusk",
    sunAngle: 8,
    ground: "camp",
    baseOutfit: "wizard",
    sounds: ["fire-start", "evening-wind"],
  },
  {
    id: "night",
    label: "夜晚",
    hours: [19, 23],
    scene: "camp",
    sky: "night",
    sunAngle: 0,
    ground: "camp",
    baseOutfit: "lantern",
    sounds: ["fire", "crickets"],
  },
  {
    id: "late",
    label: "深夜",
    hours: [23, 5],
    scene: "camp",
    sky: "late",
    sunAngle: 0,
    ground: "camp",
    baseOutfit: "sleep",
    sounds: ["fire", "owl"],
  },
];

const WEATHERS = [
  { id: "clear", tint: "none", tintOpacity: 0, particles: "none", sounds: [], outfitOverride: "", campfireOverride: "" },
  { id: "rain", tint: "rain", tintOpacity: 0.32, particles: "rain", sounds: ["rain"], outfitOverride: "umbrella", campfireOverride: "" },
  { id: "snow", tint: "snow", tintOpacity: 0.3, particles: "snow", sounds: ["wind"], outfitOverride: "knit", campfireOverride: "full" },
  { id: "cloudy", tint: "cloud", tintOpacity: 0.26, particles: "none", sounds: [], outfitOverride: "", campfireOverride: "" },
];

const RAIN_SHELTER = {
  dawn: "tree",
  morning: "canopy",
  noon: "canopy",
  afternoon: "canopy",
  dusk: "shed",
  night: "shed",
  late: "shed",
};

const PERIOD_FIRE = {
  dawn: "none",
  morning: "none",
  noon: "none",
  afternoon: "none",
  dusk: "small",
  night: "full",
  late: "blaze",
};

function mergeRules(period, weather) {
  const evening = period.id === "dusk" || period.id === "night" || period.id === "late";
  let campfire = PERIOD_FIRE[period.id];
  let shelter = "";
  let outfit = period.baseOutfit;
  let lightSource = evening ? "fire" : "sun";

  if (weather.id === "snow") {
    campfire = period.id === "late" ? "blaze" : "full";
    outfit = weather.outfitOverride || outfit;
  }

  if (weather.id === "rain") {
    shelter = RAIN_SHELTER[period.id];
    if (!evening) campfire = "brazier";
    outfit = shelter ? "cloak" : (weather.outfitOverride || "umbrella");
  }

  if (weather.campfireOverride && weather.id !== "rain") {
    if (campfire === "none" || campfire === "small") campfire = weather.campfireOverride;
  }

  if (campfire !== "none" && evening) lightSource = "fire";

  const layers = Object.assign({ notebook: true, quill: true }, OUTFITS[outfit] || {});
  return {
    period: period.id,
    label: period.label,
    weather: weather.id,
    scene: period.scene,
    sky: period.sky,
    sunAngle: period.sunAngle,
    ground: weather.id === "snow" ? "snow" : period.ground,
    lightSource,
    campfire,
    shelter,
    outfit,
    layers,
    tint: weather.tint,
    tintOpacity: weather.tintOpacity,
    particles: weather.particles,
    track: period.id + "-" + weather.id,
    sounds: period.sounds.concat(weather.sounds),
  };
}

const COMBOS = {};
PERIODS.forEach((period) => {
  COMBOS[period.id] = {};
  WEATHERS.forEach((weather) => {
    COMBOS[period.id][weather.id] = mergeRules(period, weather);
  });
});

function periodOf(hour) {
  const h = typeof hour === "number" ? hour : new Date().getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 11) return "morning";
  if (h >= 11 && h < 14) return "noon";
  if (h >= 14 && h < 17) return "afternoon";
  if (h >= 17 && h < 19) return "dusk";
  if (h >= 19 && h < 23) return "night";
  return "late";
}

function weatherKeyOf(sky) {
  if (sky === "snow") return "snow";
  if (sky === "rain" || sky === "storm") return "rain";
  if (sky === "cloudy" || sky === "fog" || sky === "partly") return "cloudy";
  return "clear";
}

function lookup(hour, sky) {
  const period = periodOf(hour);
  const weather = weatherKeyOf(sky);
  return COMBOS[period][weather];
}

module.exports = {
  COMBOS,
  PERIODS,
  WEATHERS,
  periodOf,
  weatherKeyOf,
  lookup,
};
