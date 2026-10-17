const app = getApp();
const OPENING = "我在这里。你想说什么都可以";
const { lookup } = require("../../utils/valleyScene");
const { pickSplash } = require("../../utils/splashScene");
const sound = require("../../utils/valleySound");
const { createActor, moodFor } = require("../../utils/tuantuanActor");
const { worldState } = require("../../utils/weatherWorld");
const { createWindowFx } = require("../../utils/windowFx");
const { createSplashRain } = require("../../utils/splashRain");

function lowPowerDevice() {
  try {
    const info = wx.getSystemInfoSync();
    return info.benchmarkLevel > 0 && info.benchmarkLevel < 15;
  } catch (e) {
    return false;
  }
}

/** VideoDecoder 失败时退回待机静帧（与网页 actor-still 同档） */
const OTTER_IDLE = "/images/tuantuan/tuantuan-wizard-idle.webp";

Page({
  data: {
    statusBar: 20,
    scene: lookup(new Date().getHours(), "clear"),
    campGround: "grass",
    campWet: "",
    plateA: "",
    plateB: "",
    plateOnA: false,
    plateOnB: false,
    worldShade: "transparent",
    worldGlow: "transparent",
    worldHaze: 0,
    phoneShade: "transparent",
    phoneGlow: "transparent",
    pose: "idle",
    otterSrc: OTTER_IDLE,
    actorLive: false,
    lowPower: false,
    draft: "",
    sending: false,
    focused: false,
    recording: false,
    recordSec: 0,
    motes: [],
    noteText: "",
    noteAway: true,
    noteTransform: "",
    soundOn: true,
    settingsOpen: false,
    splashShow: false,
    splashOn: false,
    splashLeave: false,
    splashSrc: "",
    splashKind: "clear",
    splashTone: "morning",
    splashCaption: "",
    splashLightClass: "",
    splashStyle: "",
    splashRainOn: false,
    splashRainLate: false,
  },

  onLoad() {
    const info = wx.getSystemInfoSync();
    const soundOn = wx.getStorageSync("vv_sound") !== "0";
    this.setData({
      statusBar: info.statusBarHeight || 20,
      lowPower: lowPowerDevice(),
      soundOn,
      otterSrc: OTTER_IDLE,
    });
    this.poseBusy = false;
    this.recordCancelled = false;
    this.plateFront = 0;
    this.currentPlate = "";
    this.noteSpoken = false;
    this.dragY = 0;
    this.fx = null;
    this.splashRain = null;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop((res) => this.finishRecord(res));
    this.recorder.onError(() => this.setData({ recording: false }));
    this.applyScene();
    this.loadWeather();
    // 与网页一致，每 30 分钟刷新天气
    this.weatherTimer = setInterval(() => this.loadWeather(true), 30 * 60 * 1000);
    this.hourTimer = setInterval(() => this.applyScene(), 60000);
    this.splashStarted = false;
    this.splashDone = false;
  },

  onReady() {
    this.mountActor();
    this.mountFx();
  },

  onShow() {
    this.consumePendingChat();
  },

  onUnload() {
    [this.hourTimer, this.weatherTimer, this.typeTimer, this.splashWait, this.splashHide, this.recordTimer].forEach((id) => {
      if (id) clearTimeout(id);
      if (id) clearInterval(id);
    });
    if (this.actor) {
      this.actor.destroy();
      this.actor = null;
    }
    if (this.fx) {
      this.fx.destroy();
      this.fx = null;
    }
    this.stopSplashRain();
    sound.stop();
  },

  mountActor() {
    if (this.actor) return;
    this.actor = createActor({
      onLive: (live) => {
        if (this.data.actorLive === live) return;
        this.setData({ actorLive: !!live });
      },
    });
    wx.createSelectorQuery()
      .in(this)
      .select("#otterStage")
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) {
          this.setData({ actorLive: false });
          return;
        }
        this.actor.mount(info.node, { width: info.width, height: info.height }).then((ok) => {
          if (!ok) this.setData({ actorLive: false });
          else this.actor.setPose("idle");
        });
      });
  },

  mountFx() {
    if (this.data.lowPower) return;
    this.fx = createWindowFx();
    wx.createSelectorQuery()
      .in(this)
      .select("#fxStage")
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !this.fx) return;
        this.fx.mount(info.node, { width: info.width, height: info.height });
        this.syncFxWeather();
      });
  },

  syncFxWeather() {
    if (!this.fx) return;
    const sky = this.sky || "clear";
    const wet = sky === "rain" || sky === "storm" || sky === "snow";
    const raw = this.weatherMeta && typeof this.weatherMeta.intensity === "number"
      ? this.weatherMeta.intensity
      : 0.45;
    const floor = sky === "storm" ? 0.7 : 0.35;
    this.fx.setWeather({
      sky,
      windy: !!(this.weatherMeta && this.weatherMeta.windy),
      intensity: wet ? Math.max(floor, raw || floor) : raw,
    });
  },

  noop() {},

  onStageTap() {
    sound.arm();
    this.syncSound();
  },

  setPose(pose, extra) {
    const patch = Object.assign({ pose, otterSrc: OTTER_IDLE }, extra || {});
    this.setData(patch);
    if (this.actor) return this.actor.setPose(pose);
    return Promise.resolve(false);
  },

  setPlate(src) {
    if (!src || src === this.currentPlate) return;
    this.currentPlate = src;
    if (this.plateFront === 0) {
      this.setData({ plateB: src, plateOnB: true, plateOnA: false });
      this.plateFront = 1;
    } else {
      this.setData({ plateA: src, plateOnA: true, plateOnB: false });
      this.plateFront = 0;
    }
  },

  applyScene() {
    const hour = new Date().getHours();
    const sky = this.sky || "clear";
    const scene = lookup(hour, sky);
    const campGround = scene.ground === "snow" || scene.ground === "gold" ? scene.ground : "grass";
    const campWet = scene.weather === "rain" || scene.weather === "storm"
      ? "rain"
      : scene.weather === "snow"
        ? "snow"
        : "";
    const world = worldState(hour, sky);
    this.setPlate(world.plateSrc);
    // 天气/时段刷新不打断角色姿态（与网页 paintValley 一致）
    this.setData({
      scene,
      campGround,
      campWet,
      worldShade: world.shade,
      worldGlow: world.glow,
      worldHaze: world.haze,
      phoneShade: world.shade,
      phoneGlow: world.glow,
    });
    this.syncFxWeather();
    if (this.data.splashShow && !this.splashDone) {
      this.applySplashPick(this.splashPick());
    }
    this.syncSound();
  },

  syncSound() {
    if (!this.data.soundOn) {
      sound.stop();
      return;
    }
    sound.play(this.data.scene.track, true);
  },

  loadWeather(silent) {
    const apply = (lat, lon) => {
      const q = lat != null ? `?lat=${lat}&lon=${lon}` : "";
      wx.request({
        url: `${app.globalData.apiBase}/api/weather${q}`,
        success: (res) => {
          const data = res.data || {};
          this.sky = data.sky || "clear";
          this.weatherMeta = {
            sky: this.sky,
            windy: !!data.windy,
            temperature: data.temperature,
            intensity: data.intensity,
          };
          this.applyScene();
          if (!silent) this.beginSplash();
        },
        fail: () => {
          if (!silent) this.beginSplash();
        },
      });
    };
    if (this._weatherLat != null) {
      apply(this._weatherLat, this._weatherLon);
      return;
    }
    wx.getLocation({
      type: "wgs84",
      success: (res) => {
        this._weatherLat = res.latitude;
        this._weatherLon = res.longitude;
        apply(res.latitude, res.longitude);
      },
      fail: () => apply(),
    });
  },

  splashPick() {
    return pickSplash(new Date().getHours(), {
      sky: this.sky || this.data.scene.weather || "clear",
      windy: !!(this.weatherMeta && this.weatherMeta.windy),
    });
  },

  applySplashPick(pick) {
    const wantRain = pick.weatherFx === "rain" || pick.weather === "rain";
    const late = pick.slot === "late" || pick.tone === "late";
    this.stopSplashRain();
    this.setData({
      splashKind: pick.kind,
      splashTone: pick.tone,
      splashCaption: pick.caption,
      splashLightClass: pick.lightClass,
      splashStyle: pick.splashStyle,
      splashSrc: `/images/tuantuan/splash/${pick.file}`,
      splashRainOn: !!wantRain,
      splashRainLate: !!late,
    });
    if (wantRain) {
      // 等开屏节点渲染后再挂 canvas 雨
      setTimeout(() => this.mountSplashRain(late), 50);
    }
  },

  mountSplashRain(late) {
    this.stopSplashRain();
    this.splashRain = createSplashRain();
    wx.createSelectorQuery()
      .in(this)
      .select("#splashRainCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node || !this.splashRain) return;
        this.splashRain.mount(info.node, { width: info.width, height: info.height }, {
          late: !!late,
          lowPower: !!this.data.lowPower,
        });
      });
  },

  stopSplashRain() {
    if (this.splashRain) {
      this.splashRain.destroy();
      this.splashRain = null;
    }
  },

  beginSplash() {
    if (this.splashStarted) return;
    if (!app.globalData.splashPending) {
      this.splashStarted = true;
      if (!this.noteSpoken && !this.splashDone) {
        this.splashDone = true;
        this.speak(OPENING, 200);
      }
      return;
    }
    this.splashStarted = true;
    if (this.splashWait) clearTimeout(this.splashWait);
    const pick = this.splashPick();
    // 先挂开屏节点，再绑 canvas 雨（否则 #splashRainCanvas 还不在树里）
    this.setData({ splashShow: true, splashOn: true }, () => {
      this.applySplashPick(pick);
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
    if (this.splashRainHero) clearInterval(this.splashRainHero);
    this.splashRainHero = null;
    this.setData({ splashLeave: true });
    setTimeout(() => {
      this.stopSplashRain();
      this.setData({ splashShow: false, splashRainOn: false });
      if (!this.noteSpoken) this.speak(OPENING, 200);
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

  /** 与网页一致：focus→listen；空→idle；有字→listen */
  onFocus() {
    this.setData({ focused: true });
    if (!this.poseBusy) this.setPose("listen");
  },

  onBlur() {
    this.setData({ focused: false });
    if (!this.poseBusy && !(this.data.draft || "").trim()) this.setPose("idle");
  },

  onInput(e) {
    const draft = e.detail.value;
    this.setData({ draft });
    if (this.poseBusy) return;
    this.setPose((draft || "").trim() ? "listen" : "idle");
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

  /** 5: 用户发言 → mote，不进气泡 */
  spawnMotes() {
    const list = [];
    for (let i = 0; i < 8; i += 1) {
      list.push({
        id: `${Date.now()}-${i}`,
        left: 40 + Math.round(Math.random() * 220),
        top: 520 + Math.round(Math.random() * 40),
        delay: (Math.random() * 0.25).toFixed(2),
      });
    }
    this.setData({ motes: list });
    setTimeout(() => this.setData({ motes: [] }), 1600);
  },

  onSend() {
    const message = (this.data.draft || "").trim();
    if (!message || this.data.sending || this.poseBusy) return;
    sound.arm();
    this.syncSound();
    this.setData({ draft: "" });
    this.releaseWords(message);
  },

  startRecord() {
    if (this.data.sending || this.poseBusy) return;
    sound.arm();
    this.recordCancelled = false;
    this.setPose("listen", { recording: true, recordSec: 0 });
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
    this.setPose("idle", { recording: false });
    this.recorder.stop();
  },

  finishRecord(res) {
    if (this.recordTimer) clearInterval(this.recordTimer);
    this.setData({ recording: false });
    if (this.recordCancelled) return;
    this.transcribe(res.tempFilePath).then((text) => {
      const heard = (text || "").trim();
      if (!heard) {
        this.setPose("idle");
        this.speak("风有点大，我没听清。你打字告诉我也一样。", 200);
        return;
      }
      this.releaseWords(heard);
    }).catch(() => {
      this.setPose("idle");
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

  /**
   * 与网页 chat() 对齐：
   * mote → think → (API) → write → look → 便签打字 → playPresence → look
   */
  releaseWords(message) {
    this.spawnMotes();
    this.poseBusy = true;
    this.setPose("think", { sending: true });
    wx.request({
      url: `${app.globalData.apiBase}/api/chat`,
      method: "POST",
      header: { "content-type": "application/json" },
      timeout: 360000,
      data: {
        session_id: app.globalData.sessionId,
        message,
        period: this.data.scene.period,
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          this.finishChatCycle((res.data && res.data.detail) || "请求失败", null);
          return;
        }
        app.globalData.sessionId = res.data.session_id;
        this.finishChatCycle(res.data.reply, res.data.presence || "listening");
      },
      fail: () => {
        this.finishChatCycle("暂时连不上。", null);
      },
    });
  },

  finishChatCycle(text, presence) {
    const run = async () => {
      try {
        if (presence != null) {
          await this.setPose("write");
          this.setPose("look");
          await this.speakAsync(text || "我在。");
          await this.playPresence(presence);
        } else {
          this.setPose("look");
          await this.speakAsync(text || "我在。");
        }
      } finally {
        this.poseBusy = false;
        this.setData({ sending: false });
        if (!(this.data.draft || "").trim()) this.setPose("look");
      }
    };
    run();
  },

  /** 网页 playPresence：无独立同意/安慰片，回 look */
  playPresence(presence) {
    this.setPose(moodFor(presence));
    return Promise.resolve();
  },

  speak(full, delay) {
    this.speakAsync(full, delay);
  },

  speakAsync(full, delay) {
    this.noteSpoken = true;
    if (this.typeTimer) clearInterval(this.typeTimer);
    this.setData({
      noteAway: false,
      noteText: "",
      noteTransform: "",
    });
    if (!this.poseBusy) this.setPose("look");
    const text = full || "";
    return new Promise((resolve) => {
      const start = () => {
        let i = 0;
        this.typeTimer = setInterval(() => {
          i += 1;
          this.setData({ noteText: text.slice(0, i) });
          if (i >= text.length) {
            clearInterval(this.typeTimer);
            this.typeTimer = null;
            if (!this.poseBusy && !this.data.sending && !(this.data.draft || "").trim()) {
              this.setPose("idle");
            }
            resolve();
          }
        }, 30);
      };
      if (delay) setTimeout(start, delay);
      else start();
    });
  },

  onNoteTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    this.dragY = e.touches[0].clientY;
  },

  onNoteTouchMove(e) {
    if (!this.dragY || !e.touches || !e.touches[0]) return;
    const dy = Math.max(0, e.touches[0].clientY - this.dragY);
    this.setData({ noteTransform: `translateY(${dy}px) rotate(-1.2deg)` });
  },

  onNoteTouchEnd(e) {
    if (!this.dragY) return;
    const y = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientY) || this.dragY;
    const dy = y - this.dragY;
    this.dragY = 0;
    if (dy > 72) {
      this.setData({ noteAway: true, noteTransform: "" });
    } else {
      this.setData({ noteTransform: "" });
    }
  },
});
