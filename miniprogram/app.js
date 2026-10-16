App({
  globalData: {
    apiBase: "http://127.0.0.1:8000",
    sessionId: "",
    pendingChat: null,
    /** 冷启动只播一次天气开屏 */
    splashPending: true,
  },
});
