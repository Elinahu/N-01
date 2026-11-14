import { trackEffect } from './audio-settings.js';
import { assetUrl } from './assets.js';

// 共用单条音轨；连续打字不反复叠加声音，停笔、隐藏或结束时停止。
const sound = trackEffect(new Audio(assetUrl('audio/keyboard-typing.mp3')), 0.35);
sound.id = 'keyboard-typing-audio';
sound.preload = 'auto';
sound.loop = true;
sound.hidden = true;
document.body.append(sound);
const sources = new Set();
let pulseTimer;
function synchronize() {
  if (sources.size && !document.hidden) {
    if (sound.paused) sound.play().catch(() => {});
  } else sound.pause();
}
export function setTypingSound(source, active) {
  const wasActive = sources.has(source);
  if (active) sources.add(source);
  else sources.delete(source);
  if (wasActive !== active) synchronize();
}
export function pulseTypingSound() {
  window.clearTimeout(pulseTimer);
  setTypingSound('player', true);
  // 点击也是一次有效用户手势，可恢复此前被自动播放策略阻止的音轨。
  synchronize();
  pulseTimer = window.setTimeout(() => setTypingSound('player', false), 160);
}
document.addEventListener('visibilitychange', synchronize);
