/**
 * 环境音。素材放在 /audio/{track}.mp3，例如 night-clear.mp3。
 * 没有文件时静音，不打断聊天。
 */
let ctx = null;
let current = "";
let armed = false;

function ensure() {
  if (ctx) return ctx;
  ctx = wx.createInnerAudioContext();
  ctx.loop = true;
  ctx.obeyMuteSwitch = true;
  ctx.onError(() => {
    current = "";
  });
  return ctx;
}

function arm() {
  armed = true;
}

function play(track, enabled) {
  if (!armed || !enabled || !track) return;
  const audio = ensure();
  const src = `/audio/${track}.mp3`;
  if (current === src) {
    audio.play();
    return;
  }
  current = src;
  audio.src = src;
  audio.play();
}

function stop() {
  if (!ctx) return;
  ctx.stop();
  current = "";
}

module.exports = { arm, play, stop };
