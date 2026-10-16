const app = getApp();
const { pickAnswer } = require("../../utils/answers");

Page({
  data: {
    revealed: false,
    flipping: false,
    answer: "",
  },

  onOpen() {
    if (this.data.flipping) return;
    this.setData({
      flipping: true,
      revealed: true,
      answer: pickAnswer(this.data.answer),
    });
    setTimeout(() => this.setData({ flipping: false }), 560);
  },

  onAgain() {
    if (this.data.flipping) return;
    this.setData({
      flipping: true,
      answer: pickAnswer(this.data.answer),
    });
    setTimeout(() => this.setData({ flipping: false }), 560);
  },

  onGoChat() {
    const answer = this.data.answer;
    if (!answer) return;
    app.globalData.pendingChat = {
      source: "answer-book",
      answer,
    };
    wx.switchTab({ url: "/pages/chat/chat" });
  },
});
