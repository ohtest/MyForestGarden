const app = getApp();
const { pickBlurSnippet } = require("../../utils/answers");
const { drawAnswer } = require("../../utils/answerDeck");

/** 翻页张数：先快后慢 */
const FLIP_COUNT = 5;
/** 基准时长（ms），会再叠加随机抖动 */
const FLIP_DURATIONS = [260, 320, 400, 520, 700];
/** 基准间隔（ms），略短于时长以形成连翻 */
const FLIP_GAPS = [220, 270, 340, 450, 620];
/** 缓动手感 class（避免 cubic-bezier 逗号破坏内联 style） */
const FLIP_EASE_CLASSES = ["ease-a", "ease-b", "ease-c", "ease-d"];

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** 生成带轻微随机性的单页翻页参数 */
function buildFlipPage(index) {
  const baseDur = FLIP_DURATIONS[index] || 400;
  const baseGap = FLIP_GAPS[index] || 320;
  const duration = Math.round(baseDur + randBetween(-45, 55));
  const gap = Math.round(baseGap + randBetween(-35, 40));
  // 终角略有差异，避免每页翻到同一位置
  const endAngle = Math.round(randBetween(-186, -168));
  // 过半时的角度：略早/略晚过垂直面
  const midAngle = Math.round(randBetween(-102, -86));
  // 轻微纸张扭曲
  const curl = randBetween(-1.2, 1.2).toFixed(2);
  // 翻起时的抬升感
  const lift = Math.round(randBetween(14, 28));
  const easeClass = FLIP_EASE_CLASSES[Math.floor(Math.random() * FLIP_EASE_CLASSES.length)];
  return {
    id: index,
    text: pickBlurSnippet(),
    duration,
    gap,
    endAngle,
    midAngle,
    curl,
    lift,
    easeClass,
  };
}

Page({
  data: {
    // idle | awakening | flipping | result
    phase: "idle",
    particles: [],
    flipPages: [],
    flipIndex: -1,
    answer: "",
    chars: [],
    revealedCount: 0,
  },

  _timers: null,

  onLoad() {
    this._timers = [];
    this.setData({ particles: this._buildParticles(28) });
  },

  onUnload() {
    this._clearTimers();
  },

  /** 生成克制数量的微光粒子配置 */
  _buildParticles(count) {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      list.push({
        id: i,
        left: Math.round(Math.random() * 100),
        top: Math.round(Math.random() * 100),
        size: 2 + Math.round(Math.random() * 3),
        delay: Math.round(Math.random() * 4000),
        duration: 5000 + Math.round(Math.random() * 5000),
        opacity: (0.25 + Math.random() * 0.55).toFixed(2),
      });
    }
    return list;
  },

  _clearTimers() {
    if (!this._timers) return;
    this._timers.forEach((id) => clearTimeout(id));
    this._timers = [];
  },

  _later(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  },

  /** 点击书本：心跳反馈 → 翻页检索 → 揭晓答案 */
  onTapBook() {
    if (this.data.phase !== "idle") return;

    // 轻柔触觉反馈（真机有效；开发者工具可能无感）
    try {
      wx.vibrateShort({ type: "medium" });
    } catch (e) {
      /* ignore */
    }

    // 不放回抽牌：游客本机不重复；绑定用户 365 天内不重复
    const drawn = drawAnswer();
    const answer = drawn.text;
    const flipPages = [];
    for (let i = 0; i < FLIP_COUNT; i += 1) {
      flipPages.push(buildFlipPage(i));
    }

    this.setData({
      phase: "awakening",
      answer,
      flipPages,
      flipIndex: -1,
      chars: [],
      revealedCount: 0,
    });

    // 发光放大短暂停留后进入翻页
    this._later(() => {
      this.setData({ phase: "flipping", flipIndex: 0 });
      this._runFlipSequence(0);
    }, 480);
  },

  /** 连续翻过若干页：整体先快后慢，单页带随机速度差 */
  _runFlipSequence(index) {
    if (index >= FLIP_COUNT) {
      this._later(() => this._showResult(), 220);
      return;
    }
    this.setData({ flipIndex: index });
    const page = this.data.flipPages[index];
    const delay = (page && page.gap) || 320;
    this._later(() => this._runFlipSequence(index + 1), delay);
  },

  /** 结果展示：书页展开 + 逐字淡入 */
  _showResult() {
    const chars = Array.from(this.data.answer || "");
    this.setData({
      phase: "result",
      chars,
      revealedCount: 0,
    });

    let i = 0;
    const step = () => {
      if (i >= chars.length) return;
      i += 1;
      this.setData({ revealedCount: i });
      this._later(step, 70);
    };
    // 略晚于海獭入场，由它「揭晓」文字
    this._later(step, 420);
  },

  /** 再问一次：回到初始悬浮态 */
  onAgain() {
    if (this.data.phase !== "result") return;
    this._clearTimers();
    this.setData({
      phase: "idle",
      flipPages: [],
      flipIndex: -1,
      chars: [],
      revealedCount: 0,
    });
  },

  /** 带着答案去聊聊（产品链路保留） */
  onGoChat() {
    const answer = this.data.answer;
    if (!answer || this.data.phase !== "result") return;
    app.globalData.pendingChat = {
      source: "answer-book",
      answer,
    };
    wx.switchTab({ url: "/pages/chat/chat" });
  },
});
