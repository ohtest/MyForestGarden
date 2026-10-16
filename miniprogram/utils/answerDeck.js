/**
 * 答案之书抽牌：不放回抽样
 * - 游客：本机记录已抽过的条目，耗尽后才重新洗牌
 * - 已绑定：365 天内不重复；若库内全部落在一年窗内，则取最早抽过的一条（极低频兜底）
 *
 * 绑定后写入 vv_user_id / globalData.userId 即自动切到「一年不重复」
 */
const { ANSWERS } = require("./answers");
const { getBoundUserId } = require("./user");

const GUEST_KEY = "vv_answer_book_guest";
const USER_KEY_PREFIX = "vv_answer_book_user_";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const STORAGE_VERSION = 1;

function _userKey(userId) {
  return `${USER_KEY_PREFIX}${userId}`;
}

function _load(key) {
  try {
    const raw = wx.getStorageSync(key);
    if (!raw || typeof raw !== "object") {
      return { v: STORAGE_VERSION, used: {} };
    }
    if (!raw.used || typeof raw.used !== "object") {
      return { v: STORAGE_VERSION, used: {} };
    }
    return { v: STORAGE_VERSION, used: raw.used };
  } catch (e) {
    return { v: STORAGE_VERSION, used: {} };
  }
}

function _save(key, state) {
  try {
    wx.setStorageSync(key, state);
  } catch (e) {
    /* 存储满时忽略，本轮仍返回答案 */
  }
}

/** 清理一年窗外的已用记录（仅绑定用户） */
function _pruneYear(used, now) {
  const next = {};
  Object.keys(used).forEach((id) => {
    const at = Number(used[id]) || 0;
    if (now - at <= YEAR_MS) next[id] = at;
  });
  return next;
}

/**
 * 绑定成功时可调用：把游客本机已抽记录合并进账号（避免刚绑定立刻抽到刚看过的）
 */
function mergeGuestIntoUser(userId) {
  if (!userId) return;
  const guest = _load(GUEST_KEY);
  const key = _userKey(userId);
  const user = _load(key);
  const now = Date.now();
  Object.keys(guest.used).forEach((id) => {
    const gAt = Number(guest.used[id]) || 0;
    const uAt = Number(user.used[id]) || 0;
    user.used[id] = Math.max(gAt, uAt, now);
  });
  user.used = _pruneYear(user.used, now);
  _save(key, user);
}

/**
 * 抽取下一条答案（写入已用记录）
 * @returns {{ text: string, index: number, remaining: number, bound: boolean }}
 */
function drawAnswer() {
  const pool = ANSWERS;
  if (!pool.length) {
    return { text: "", index: -1, remaining: 0, bound: false };
  }

  const userId = getBoundUserId();
  const bound = !!userId;
  const key = bound ? _userKey(userId) : GUEST_KEY;
  const now = Date.now();
  let state = _load(key);

  if (bound) {
    state.used = _pruneYear(state.used, now);
  }

  const available = [];
  for (let i = 0; i < pool.length; i += 1) {
    if (!(String(i) in state.used)) available.push(i);
  }

  let index;
  if (available.length) {
    index = available[Math.floor(Math.random() * available.length)];
  } else if (bound) {
    // 一年内库已抽尽：取最早那条，保证流程不中断
    const ids = Object.keys(state.used).sort(
      (a, b) => (Number(state.used[a]) || 0) - (Number(state.used[b]) || 0)
    );
    index = Number(ids[0]) || 0;
  } else {
    // 游客耗尽：整库重洗
    state.used = {};
    index = Math.floor(Math.random() * pool.length);
  }

  state.used[String(index)] = now;
  _save(key, state);

  const remaining = bound
    ? pool.length - Object.keys(_pruneYear(state.used, now)).length
    : pool.length - Object.keys(state.used).length;

  return {
    text: pool[index],
    index,
    remaining: Math.max(0, remaining),
    bound,
  };
}

module.exports = {
  drawAnswer,
  mergeGuestIntoUser,
  YEAR_MS,
  GUEST_KEY,
};
