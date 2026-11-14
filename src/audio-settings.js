const KEY = 'fca.audio.v1';
const defaults = { bgm: 12, sfx: 100 };
const levels = { ...defaults };
const effects = new Map();
const bgm = document.querySelector('#game-bgm');

function percent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  for (const kind of Object.keys(defaults)) {
    if (Number.isFinite(saved?.[kind])) levels[kind] = percent(saved[kind]);
  }
} catch {
  // Use the built-in levels if storage is unavailable.
}
bgm.volume = levels.bgm / 100;

export function getAudioLevel(kind) {
  return levels[kind];
}

export function setAudioLevel(kind, value) {
  if (!Object.hasOwn(defaults, kind) || !Number.isFinite(value)) return;
  levels[kind] = percent(value);
  if (kind === 'bgm') bgm.volume = levels.bgm / 100;
  else for (const [audio, base] of effects) audio.volume = base * levels.sfx / 100;
  try {
    localStorage.setItem(KEY, JSON.stringify(levels));
  } catch (error) {
    console.warn('FCA音量设置无法保存', error);
  }
}

export function trackEffect(audio, base = 1) {
  effects.set(audio, base);
  audio.volume = base * levels.sfx / 100;
  return audio;
}

export function releaseEffect(audio) {
  effects.delete(audio);
}

export function playEffect(source) {
  const sound = trackEffect(source.cloneNode(true));
  const release = () => releaseEffect(sound);
  sound.addEventListener('ended', release, { once: true });
  sound.addEventListener('error', release, { once: true });
  return sound.play().catch(error => {
    release();
    throw error;
  });
}
