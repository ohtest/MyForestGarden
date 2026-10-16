const app = getApp();
const OPENING = "我在这里。你想说什么都可以";
const { lookup } = require("../../utils/valleyScene");
const sound = require("../../utils/valleySound");

function spots(count, kind) {
  const list = [];
  const n = Math.min(count, 24);
  for (let i = 0; i < n; i += 1) {
    list.push({
      id: i,
      left: Math.round(Math.random() * 100),
      top: Math.round(Math.random() * 46),
      delay: (Math.random() * 3).toFixed(2),
      duration: (kind === "snow" ? 5 + Math.random() * 3 : 0.8 + Math.random() * 0.5).toFixed(2),
    });
  }
  return list;
}

function lowPowerDevice() {
  try {
    const info = wx.getSystemInfoSync();
    return info.benchmarkLevel > 0 && info.benchmarkLevel < 15;
  } catch (e) {
    return false;
  }
}

Page({
  data: {
    statusBar: 20,
    scene: lookup(new Date().getHours(), "clear"),
    pose: "listen",
    lowPower: false,
    fireBoost: false,
    messages: [],
    draft: "",
    sending: false,
    focused: false,
    recording: false,
    recordSec: 0,
    ghost: null,
    motes: spots(8, "snow"),
    drops: [],
    sparks: spots(6, "snow"),
    stars: spots(12, "snow"),
    soundOn: true,
    settingsOpen: false,
    splashShow: false,
    splashOn: false,
    splashLeave: false,
    splashSrc: "",
    splashKind: "sunny",
    nextId: 1,
    anchor: "",
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    const soundOn = wx.getStorageSync("vv_sound") !== "0";
    this.setData({
      statusBar: info.statusBarHeight || 20,
      lowPower: lowPowerDevice(),
      soundOn,
    });
    this.comfortStreak = 0;
    this.replyQueue = null;
    this.recordCancelled = false;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop((res) => this.finishRecord(res));
    this.recorder.onError(() => this.setData({ recording: false }));
    this.applyScene();
    this.loadWeather();
    this.hourTimer = setInterval(() => this.applyScene(), 60000);
    this.splashStarted = false;
    this.splashDone = false;
    this.splashWait = setTimeout(() => this.beginSplash(), 900);
    this.scheduleNod();
  },

  onShow() {
    this.consumePendingChat();
  },

  onUnload() {
    [this.hourTimer, this.nodTimer, this.typeTimer, this.splashWait, this.splashHide, this.ghostTimer, this.recordTimer, this.poseTimer].forEach((id) => {
      if (id) clearTimeout(id);
      if (id) clearInterval(id);
    });
    sound.stop();
  },

  noop() {},

  onStageTap() {
    sound.arm();
    this.syncSound();
  },

  applyScene() {
    const scene = lookup(new Date().getHours(), this.sky || "clear");
    const pose = scene.period === "noon" && !this.data.focused && !this.data.sending ? "nap" : this.data.pose;
    const drops = this.data.lowPower ? [] : spots(scene.particles === "snow" ? 16 : 22, scene.particles);
    this.setData({ scene, drops, pose: this.data.pose === "think" ? "think" : pose });
    this.syncSound();
  },

  syncSound() {
    if (!this.data.soundOn) {
      sound.stop();
      return;
    }
    sound.play(this.data.scene.track, true);
  },

  loadWeather() {
    const apply = (lat, lon) => {
      const q = lat != null ? `?lat=${lat}&lon=${lon}` : "";
      wx.request({
        url: `${app.globalData.apiBase}/api/weather${q}`,
        success: (res) => {
          const data = res.data || {};
          this.sky = data.sky || "clear";
          this.applyScene();
          this.beginSplash();
        },
        fail: () => this.beginSplash(),
      });
    };
    wx.getLocation({
      type: "wgs84",
      success: (res) => apply(res.latitude, res.longitude),
      fail: () => apply(),
    });
  },

  splashFile() {
    const scene = this.data.scene;
    if (scene.weather === "snow") return ["snow", "splash-03-snow.jpg"];
    if (scene.weather === "rain" && (scene.period === "night" || scene.period === "late")) return ["storm", "splash-06-storm.jpg"];
    if (scene.weather === "rain") return ["rain", "splash-02-rain.jpg"];
    if (scene.weather === "cloudy") return ["cloudy", "splash-05-cloudy.jpg"];
    return ["sunny", "splash-01-sunny.jpg"];
  },

  beginSplash() {
    if (this.splashStarted) return;
    if (!app.globalData.splashPending) {
      this.splashStarted = true;
      if (!this.data.messages.length && !this.splashDone) {
        this.splashDone = true;
        this.speak(OPENING, 200);
      }
      return;
    }
    this.splashStarted = true;
    if (this.splashWait) clearTimeout(this.splashWait);
    const pair = this.splashFile();
    this.setData({
      splashShow: true,
      splashOn: true,
      splashKind: pair[0],
      splashSrc: `/images/tuantuan/splash/${pair[1]}`,
    });
    if (wx.vibrateShort) wx.vibrateShort({ type: "light" });
    this.splashHide = setTimeout(() => this.finishSplash(), 4200);
  },

  skipSplash() {
    this.finishSplash();
  },

  finishSplash() {
    if (this.splashDone) return;
    this.splashDone = true;
    app.globalData.splashPending = false;
    if (this.splashHide) clearTimeout(this.splashHide);
    this.setData({ splashLeave: true });
    setTimeout(() => {
      this.setData({ splashShow: false });
      if (!this.data.messages.length) this.speak(OPENING, 200);
    }, 460);
  },

  consumePendingChat() {
    const pending = app.globalData.pendingChat;
    if (!pending) return;
    app.globalData.pendingChat = null;
    if (pending.source === "answer-book" && pending.answer) {
      this.speak(`你翻到：「${pending.answer}」\n\n想从这里说说吗？我在。`, 200);
    }
  },

  scheduleNod() {
    const wait = 5000 + Math.round(Math.random() * 3000);
    this.nodTimer = setTimeout(() => {
      const idle = !this.data.sending && !this.data.focused && !this.data.recording;
      if (idle && (this.data.pose === "listen" || this.data.pose === "nap")) {
        this.setData({ pose: "nod" });
        this.poseTimer = setTimeout(() => {
          if (this.data.pose === "nod") {
            this.setData({ pose: this.data.scene.period === "noon" ? "nap" : "listen" });
          }
        }, 800);
      }
      this.scheduleNod();
    }, wait);
  },

  wakeOtter() {
    if (this.data.scene.period !== "noon") return;
    this.setData({ pose: "wake" });
    this.poseTimer = setTimeout(() => this.setData({ pose: "listen" }), 900);
  },

  onFocus() {
    this.setData({ pose: "lean", focused: true });
  },

  onBlur() {
    this.setData({ focused: false });
    if (!this.data.sending) this.setData({ pose: "listen" });
  },

  onInput(e) {
    this.setData({ draft: e.detail.value, pose: "lean" });
  },

  openSettings() {
    this.setData({ settingsOpen: true });
  },

  closeSettings() {
    this.setData({ settingsOpen: false });
  },

  onSoundChange(e) {
    const soundOn = !!e.detail.value;
    wx.setStorageSync("vv_sound", soundOn ? "1" : "0");
    this.setData({ soundOn });
    sound.arm();
    this.syncSound();
  },

  onSend() {
    const message = (this.data.draft || "").trim();
    if (!message || this.data.sending || this.data.ghost) return;
    sound.arm();
    this.syncSound();
    this.setData({ draft: "" });
    this.releaseWords(message, false, false);
  },

  startRecord() {
    if (this.data.sending || this.data.ghost) return;
    sound.arm();
    this.recordCancelled = false;
    this.setData({ recording: true, recordSec: 0, pose: "lean" });
    this.recordTimer = setInterval(() => {
      const next = this.data.recordSec + 1;
      this.setData({ recordSec: next });
      if (next >= 60) this.stopRecord();
    }, 1000);
    this.recorder.start({ duration: 60000, format: "mp3" });
  },

  stopRecord() {
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.recorder.stop();
  },

  cancelRecord() {
    this.recordCancelled = true;
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.setData({ recording: false, pose: "listen" });
    this.recorder.stop();
  },

  finishRecord(res) {
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.setData({ recording: false });
    if (this.recordCancelled) return;
    const longVoice = (res.duration || 0) > 30000;
    this.setData({ ghost: { phase: "show", text: "", wave: true } });
    this.transcribe(res.tempFilePath).then((text) => {
      const heard = (text || "").trim();
      if (!heard) {
        this.setData({ ghost: null, pose: "listen" });
        this.speak("风有点大，我没听清。你打字告诉我也一样。", 200);
        return;
      }
      this.setData({ ghost: { phase: "show", text: heard, wave: false } });
      this.releaseWords(heard, true, longVoice);
    }).catch(() => {
      this.setData({ ghost: null, pose: "listen" });
      this.speak("风有点大，我没听清。你打字告诉我也一样。", 200);
    });
  },

  transcribe(filePath) {
    return new Promise((resolve, reject) => {
      let plugin = null;
      try {
        plugin = requirePlugin("WechatSI");
      } catch (e) {
        plugin = null;
      }
      if (!plugin || !plugin.translateVoice) {
        reject(new Error("no-asr"));
        return;
      }
      plugin.translateVoice({
        lfrom: "zh_CN",
        lto: "zh_CN",
        filePath,
        success: (res) => resolve(res.result || ""),
        fail: reject,
      });
    });
  },

  releaseWords(message, alreadyShown, longVoice) {
    if (!alreadyShown) this.setData({ ghost: { phase: "show", text: message, wave: false } });
    this.setData({ sending: true, pose: "lean" });
    const started = Date.now();
    this.ghostTimer = setTimeout(() => {
      this.setData({ pose: longVoice ? "hold" : "think", ghost: Object.assign({}, this.data.ghost, { phase: "scatter" }) });
    }, 2500);
    wx.request({
      url: `${app.globalData.apiBase}/api/chat`,
      method: "POST",
      header: { "content-type": "application/json" },
      timeout: 360000,
      data: {
        session_id: app.globalData.sessionId,
        message,
        long_voice: !!longVoice,
        period: this.data.scene.period,
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          this.replyQueue = { text: (res.data && res.data.detail) || "请求失败", presence: "listen" };
          return;
        }
        app.globalData.sessionId = res.data.session_id;
        let presence = res.data.presence || "listening";
        if (presence === "comfort") this.comfortStreak += 1;
        else if (presence !== "warmth") this.comfortStreak = 0;
        if (this.comfortStreak >= 2) presence = "warmth";
        this.replyQueue = { text: res.data.reply, presence };
      },
      fail: () => {
        this.replyQueue = { text: "暂时连不上。", presence: "listening" };
      },
      complete: () => {
        const wait = Math.max(0, 4500 - (Date.now() - started));
        setTimeout(() => this.showReply(), wait);
      },
    });
  },

  showReply() {
    const queued = this.replyQueue || { text: "我在。", presence: "listening" };
    this.replyQueue = null;
    this.setData({ ghost: null, sending: false });
    this.applyPresence(queued.presence);
    this.speak(queued.text, queued.presence === "hold" ? 500 : 200);
  },

  applyPresence(presence) {
    const pose = presence === "listening" ? "listen" : presence;
    this.setData({ pose, fireBoost: presence === "warmth" });
    if (this.poseTimer) clearTimeout(this.poseTimer);
    const back = presence === "comfort" ? 2600 : 1800;
    this.poseTimer = setTimeout(() => {
      if (!this.data.sending && !this.data.focused) {
        this.setData({
          pose: this.data.scene.period === "noon" ? "nap" : "listen",
          fireBoost: false,
        });
      }
    }, back);
  },

  speak(full, delay) {
    const id = this.data.nextId;
    this.setData({
      messages: this.data.messages.concat({ id, text: "", typing: true }),
      nextId: id + 1,
      anchor: `m-${id}`,
    });
    setTimeout(() => this.typeInto(id, full), delay || 0);
  },

  typeInto(id, full) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 1;
      const messages = this.data.messages.map((item) => (
        item.id === id ? Object.assign({}, item, { typing: false, text: full.slice(0, i) }) : item
      ));
      this.setData({ messages, anchor: `m-${id}` });
      if (i >= full.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
      }
    }, 30);
  },
});