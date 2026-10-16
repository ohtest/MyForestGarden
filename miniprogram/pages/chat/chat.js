const app = getApp();
const OPENING = "我在这里。你想说什么都可以";
const HOUR_NAMES = { dawn: "清晨了", noon: "午后了", dusk: "傍晚了", night: "夜里了" };
const PLATE_OF = { clear: "clear", partly: "clear", cloudy: "cloudy", fog: "cloudy", rain: "rain", storm: "rain", snow: "snow" };
const SKY_GLYPH = { clear: "☀\uFE0E", partly: "☁\uFE0E", cloudy: "☁\uFE0E", fog: "≋", rain: "☂\uFE0E", storm: "ϟ", snow: "❄\uFE0E" };

function weatherGlyph(sky, hour) {
  if (hour === "night" && (sky === "clear" || sky === "partly")) return "☾";
  return SKY_GLYPH[sky] || SKY_GLYPH.clear;
}

function weatherKind(sky, hour) {
  if (hour === "night" && (sky === "clear" || sky === "partly")) return "moon";
  return SKY_GLYPH[sky] ? sky : "clear";
}

function hourScene() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return "dawn";
  if (h >= 10 && h < 17) return "noon";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

Page({
  data: {
    messages: [],
    draft: "",
    sending: false,
    modelOk: false,
    scene: "autumn",
    sky: "clear",
    windy: false,
    plates: ["", ""],
    front: 0,
    hour: "dusk",
    hourLabel: "傍晚了",
    weatherIcon: "",
    weatherKind: "clear",
    temperature: null,
    splashShow: false,
    splashOn: false,
    splashLeave: false,
    splashSrc: "",
    splashKind: "sunny",
    nextId: 1,
    lastRole: "",
    anchor: "",
  },

  onLoad() {
    this.refreshHealth();
    this.applyHour();
    this.loadWeather();
    this.hourTimer = setInterval(() => this.applyHour(), 60000);
    this.splashStarted = false;
    this.splashDone = false;
    this.splashWait = setTimeout(() => this.beginSplash(), 900);
  },

  onShow() {
    this.consumePendingChat();
  },

  onUnload() {
    if (this.hourTimer) clearInterval(this.hourTimer);
    if (this.typeTimer) clearInterval(this.typeTimer);
    if (this.splashWait) clearTimeout(this.splashWait);
    if (this.splashHide) clearTimeout(this.splashHide);
  },

  consumePendingChat() {
    const pending = app.globalData.pendingChat;
    if (!pending) return;
    app.globalData.pendingChat = null;
    if (pending.source === "answer-book" && pending.answer) {
      const line = `你翻到：「${pending.answer}」\n\n想从这里说说吗？我在。`;
      this.speak(line, 200);
    }
  },

  applyHour() {
    const hour = hourScene();
    const { weatherIcon, sky } = this.data;
    this.setData({
      hour,
      hourLabel: HOUR_NAMES[hour],
      weatherIcon: weatherIcon ? weatherGlyph(sky, hour) : "",
      weatherKind: weatherKind(sky, hour),
    });
    this.setPlate();
  },

  setPlate() {
    const { hour, sky, plates, front } = this.data;
    const src = `${app.globalData.apiBase}/art/weather/${hour}-${PLATE_OF[sky] || "clear"}.jpg?v=tuantuan`;
    if (plates[front] === src) return;
    const next = 1 - front;
    const updated = plates.slice();
    updated[next] = src;
    this.setData({ plates: updated, front: next });
  },

  onPlateError(e) {
    const index = Number(e.currentTarget.dataset.index);
    const updated = this.data.plates.slice();
    updated[index] = `/images/sky-${this.data.hour}.png`;
    this.setData({ plates: updated });
  },

  onInput(e) {
    this.setData({ draft: e.detail.value });
  },

  refreshHealth() {
    wx.request({
      url: `${app.globalData.apiBase}/api/health`,
      success: (res) => {
        const data = res.data || {};
        const status = data[data.provider];
        this.setData({ modelOk: !!(status && status.ok) });
      },
      fail: () => this.setData({ modelOk: false }),
    });
  },

  loadWeather() {
    const apply = (lat, lon) => {
      const q = lat != null ? `?lat=${lat}&lon=${lon}` : "";
      wx.request({
        url: `${app.globalData.apiBase}/api/weather${q}`,
        success: (res) => {
          const data = res.data || {};
          const legacy = { rain: "rain", snow: "snow" }[data.scene] || "clear";
          const sky = PLATE_OF[data.sky] ? data.sky : legacy;
          this.setData({
            scene: data.scene || "autumn",
            sky,
            windy: !!data.windy,
            temperature: typeof data.temperature === "number" ? data.temperature : null,
            weatherIcon: weatherGlyph(sky, this.data.hour),
            weatherKind: weatherKind(sky, this.data.hour),
          });
          this.setPlate();
          this.beginSplash();
        },
      });
    };
    wx.getLocation({
      type: "wgs84",
      success: (res) => apply(res.latitude, res.longitude),
      fail: () => apply(),
    });
  },

  splashFile() {
    const { sky, windy, temperature, hour } = this.data;
    if (sky === "storm" || (hour === "night" && sky === "rain")) return ["storm", "splash-06-storm.jpg"];
    if (sky === "snow") return ["snow", "splash-03-snow.jpg"];
    if (sky === "rain") return ["rain", "splash-02-rain.jpg"];
    if (sky === "fog") return ["fog", "splash-07-fog.jpg"];
    if (windy) return ["wind", "splash-04-wind.jpg"];
    if (sky === "cloudy") return ["cloudy", "splash-05-cloudy.jpg"];
    if (typeof temperature === "number" && temperature >= 32 && hour === "noon") return ["heat", "splash-08-heat.jpg"];
    return ["sunny", "splash-01-sunny.jpg"];
  },

  beginSplash() {
    if (this.splashStarted) return;
    if (!app.globalData.splashPending) {
      if (!this.data.messages.length && !this.splashDone) {
        this.splashDone = true;
        this.speak(OPENING, 200);
      }
      return;
    }
    this.splashStarted = true;
    if (this.splashWait) clearTimeout(this.splashWait);
    const [kind, file] = this.splashFile();
    this.setData({
      splashShow: true,
      splashOn: true,
      splashKind: kind,
      splashSrc: `/images/tuantuan/splash/${file}`,
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

  onSend() {
    const message = (this.data.draft || "").trim();
    if (!message || this.data.sending) return;
    this.push("user", message);
    const waitId = this.push("ai", "", true);
    this.setData({ draft: "", sending: true });

    wx.request({
      url: `${app.globalData.apiBase}/api/chat`,
      method: "POST",
      header: { "content-type": "application/json" },
      timeout: 360000,
      data: {
        session_id: app.globalData.sessionId,
        message,
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          const detail = (res.data && res.data.detail) || "请求失败";
          this.typeInto(waitId, detail);
          return;
        }
        app.globalData.sessionId = res.data.session_id;
        this.typeInto(waitId, res.data.reply);
      },
      fail: () => this.typeInto(waitId, "暂时连不上。"),
      complete: () => this.setData({ sending: false }),
    });
  },

  speak(full, delay) {
    const id = this.push("ai", "", true);
    setTimeout(() => this.typeInto(id, full), delay || 0);
  },

  push(role, text, typing) {
    const id = this.data.nextId;
    const switched = this.data.lastRole && this.data.lastRole !== role;
    this.setData({
      messages: this.data.messages.concat({
        id,
        role,
        text: text || "",
        typing: !!typing,
        switch: switched,
      }),
      nextId: id + 1,
      lastRole: role,
      anchor: `m-${id}`,
    });
    return id;
  },

  typeInto(id, full) {
    if (this.typeTimer) clearInterval(this.typeTimer);
    let i = 0;
    const messages = this.data.messages.map((item) =>
      item.id === id ? { ...item, typing: false, text: "" } : item
    );
    this.setData({ messages });
    this.typeTimer = setInterval(() => {
      i += 1;
      const next = this.data.messages.map((item) =>
        item.id === id ? { ...item, text: full.slice(0, i) } : item
      );
      this.setData({ messages: next, anchor: `m-${id}` });
      if (i >= full.length) {
        clearInterval(this.typeTimer);
        this.typeTimer = null;
      }
    }, 30);
  },
});
