/**
 * 身后天气底图：与网页 valleyBoot plate / grade 对齐。
 */

const PLATE_OF = {
  clear: "clear",
  partly: "clear",
  cloudy: "cloudy",
  fog: "cloudy",
  rain: "rain",
  storm: "rain",
  snow: "snow",
};

const DIM = {
  clear: [0, 1],
  partly: [0.02, 0.8],
  cloudy: [0.08, 0.45],
  fog: [0.06, 0.4],
  rain: [0.12, 0.3],
  storm: [0.18, 0.2],
  snow: [0.04, 0.55],
};

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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(a, b, t) {
  return a.map((v, i) => lerp(v, b[i], t));
}

function rgba(c) {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, c[3]).toFixed(3)})`;
}

/** 身后板用粗时段：dawn / noon / dusk / night */
function platePhase(hour) {
  const h = typeof hour === "number" ? hour : new Date().getHours();
  if (h >= 5 && h < 11) return "dawn";
  if (h >= 11 && h < 17) return "noon";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

function plateSrc(phase, sky) {
  const plate = PLATE_OF[sky] || "clear";
  return `/images/weather/${phase}-${plate}.jpg`;
}

function clockMinute() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function gradeAt(minute, phase, sky) {
  const keys = GRADE[phase] || GRADE.noon;
  const m = phase === "night" && minute < 300 ? minute + 1440 : minute;
  let shade = keys[keys.length - 1][1];
  let glow = keys[keys.length - 1][2];
  if (m <= keys[0][0]) {
    shade = keys[0][1];
    glow = keys[0][2];
  }
  for (let i = 1; i < keys.length; i += 1) {
    if (m > keys[i - 1][0] && m <= keys[i][0]) {
      const t = (m - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      const e = t * t * (3 - 2 * t);
      shade = mix(keys[i - 1][1], keys[i][1], e);
      glow = mix(keys[i - 1][2], keys[i][2], e);
      break;
    }
  }
  const dim = DIM[sky] || DIM.clear;
  const extra = dim[0];
  const keep = dim[1];
  if (extra) {
    const total = shade[3] + extra;
    shade = mix(shade, [86, 94, 110, 0], extra / total);
    shade[3] = total;
  }
  glow = glow.slice();
  glow[3] *= keep;
  return {
    shade: rgba(shade),
    glow: rgba(glow),
    haze: sky === "fog" ? (phase === "night" ? 0.35 : 1) : 0,
  };
}

function worldState(hour, sky) {
  const phase = platePhase(hour);
  const minute = clockMinute();
  const grade = gradeAt(minute, phase, sky || "clear");
  return {
    phase,
    plateSrc: plateSrc(phase, sky || "clear"),
    shade: grade.shade,
    glow: grade.glow,
    haze: grade.haze,
  };
}

module.exports = {
  PLATE_OF,
  platePhase,
  plateSrc,
  worldState,
  gradeAt,
  clockMinute,
};
