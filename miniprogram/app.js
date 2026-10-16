App({
  globalData: {
    apiBase: "http://127.0.0.1:8000",
    sessionId: "",
    /** 绑定后写入；答案之书据此启用「一年不重复」 */
    userId: "",
    pendingChat: null,
    /** 冷启动只播一次天气开屏 */
    splashPending: true,
  },
});
