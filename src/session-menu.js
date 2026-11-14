import { getAudioLevel, setAudioLevel } from './audio-settings.js';
import { startNewGame } from './checkpoint.js';

export function initializeSessionMenu(container, { loadArtwork }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'fca-ending-net-menu';
  dialog.className = 'fca-ending-net-menu';
  dialog.setAttribute('aria-label', 'FCA 会话设置');
  dialog.setAttribute('autofocus', '');
  dialog.innerHTML = `
    <div class="fca-ending-net-controls">
      <button class="session-control" type="button" data-action="continue">Continue</button>
      <button class="session-control" type="button" data-action="new" aria-describedby="fca-new-game-warning">New Game</button>
      <label class="session-control" data-volume="bgm"><span>BGM Volume</span><input type="range" min="0" max="100" data-channel="bgm"><output aria-hidden="true"></output></label>
      <label class="session-control" data-volume="sfx"><span>SFX Volume</span><input type="range" min="0" max="100" data-channel="sfx"><output aria-hidden="true"></output></label>
    </div>
    <span id="fca-new-game-warning" hidden>Current progress will be lost.</span>
    <p class="fca-ending-net-error" role="status" hidden>无法开始新游戏，请重试。</p>`;
  container.append(dialog);

  const button = action => dialog.querySelector(`[data-action="${action}"]`);
  const errorNotice = dialog.querySelector('.fca-ending-net-error');
  const sliders = [...dialog.querySelectorAll('input[type="range"]')];
  const sliderArtwork = new Map();
  let opener;
  let onClose;

  loadArtwork().then(panel => {
    for (const slider of sliders) {
      const group = panel.querySelector(`[data-session-art="${slider.dataset.channel}"]`);
      const track = Array.from(group.querySelector('[data-volume-track]').points);
      const fill = group.querySelector('[data-volume-fill]');
      const thumb = group.querySelector('[data-volume-thumb]');
      const percent = group.querySelector('[data-volume-percent]');
      sliderArtwork.set(slider, { track, fill, thumb, percent });
      updateSlider(slider);
    }
    dialog.prepend(panel);
    dialog.classList.add('has-session-artwork');
  }).catch(error => console.warn('FCA 会话设置素材无法载入', error));

  function updateSlider(slider) {
    const label = slider.value + '%';
    slider.nextElementSibling.value = label;
    const art = sliderArtwork.get(slider);
    if (!art) return;
    const fraction = slider.valueAsNumber / 100;
    const [topRight, topLeft, bottomLeft, bottomRight] = art.track;
    const topX = topLeft.x + (topRight.x - topLeft.x) * fraction;
    const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * fraction;
    art.fill.setAttribute('points', `${topX},${topRight.y} ${topLeft.x},${topLeft.y} ${bottomLeft.x},${bottomLeft.y} ${bottomX},${bottomRight.y}`);
    // The original slanted thumb travels between the same centers as the native range.
    art.thumb.setAttribute('transform', `translate(${278.6 + (483.615 - 278.6) * fraction} 0)`);
    art.percent.textContent = label;
  }
  for (const slider of sliders) {
    slider.value = getAudioLevel(slider.dataset.channel);
    updateSlider(slider);
    slider.addEventListener('input', () => {
      setAudioLevel(slider.dataset.channel, slider.valueAsNumber);
      updateSlider(slider);
    });
  }

  function open(trigger, onDismiss) {
    if (dialog.open) return false;
    opener = trigger;
    onClose = onDismiss;
    for (const slider of sliders) {
      slider.value = getAudioLevel(slider.dataset.channel);
      updateSlider(slider);
    }
    errorNotice.hidden = true;
    dialog.showModal();
    return true;
  }
  button('continue').addEventListener('click', () => dialog.close());
  button('new').addEventListener('click', () => {
    try { startNewGame(); }
    catch (error) {
      errorNotice.hidden = false;
      console.warn('FCA新游戏无法启动', error);
    }
  });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    const trigger = opener;
    const onDismiss = onClose;
    opener = undefined;
    onClose = undefined;
    trigger?.focus({ preventScroll: true });
    onDismiss?.();
  });

  return {
    open,
    get isOpen() { return dialog.open; },
    ownsEvent: event => event.composedPath().includes(dialog)
  };
}
