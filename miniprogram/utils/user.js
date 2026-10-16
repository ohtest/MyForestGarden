/**
 * 绑定用户读取（波次 3 登录接入后写入即可生效）
 * - app.globalData.userId
 * - 或 wx.setStorageSync('vv_user_id', openid/userId)
 */
function getBoundUserId() {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.userId) {
      return String(app.globalData.userId);
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const id = wx.getStorageSync("vv_user_id");
    return id ? String(id) : "";
  } catch (e) {
    return "";
  }
}

function isBound() {
  return !!getBoundUserId();
}

module.exports = {
  getBoundUserId,
  isBound,
};
