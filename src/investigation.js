import { createUvScanner } from './uv-scanner.js';
import { bindReportButton } from './report.js';
import { assetUrl } from './assets.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

export function initializeInvestigation(svg, { onUnlocked, draftButton, onDraftReport } = {}) {
  svg.setAttribute('role', 'group');
  const find = id => svg.querySelector(`[id$="-${id}"]`);
  const root = find('_线索1').firstElementChild;
  const paper = find('folder-body').parentElement;
  const blue = svg.querySelector('image[id$="-investigation-blue-signal"]').parentElement;
  blue.classList.add('investigation-blue');
  blue.setAttribute('aria-hidden', 'true');
  svg.dataset.keyUnlocked = 'false';
  function node(tag, attributes = {}, parent = root) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.append(element);
    return element;
  }
  const photoClip = node('clipPath', { id: svg.id + '-photo-workspace-clip', clipPathUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
  node('rect', { x: 18, y: 92, width: 1480.77, height: 783 }, photoClip);
  const photoLayer = node('g', { class: 'investigation-photos', 'clip-path': `url(#${photoClip.id})` });
  const photoPositions = new Map();
  // 整个任务桌面均可摆放照片，照片可以移到右侧档案上方。
  root.append(photoLayer);
  let allScanned = false;
  if (draftButton) {
    draftButton.setAttribute('x', String((1516.77 - 168.62) / 2));
    draftButton.setAttribute('y', '824');
    draftButton.setAttribute('width', '168.62');
    draftButton.setAttribute('height', '42.09');
    draftButton.classList.add('investigation-draft-button');
    draftButton.setAttribute('hidden', '');
    root.append(draftButton);
    bindReportButton(draftButton, () => allScanned, () => { uv.stop(); onDraftReport?.(); });
  }
  const uv = createUvScanner(svg, root, blue, photoClip.id, {
    onProgress({ complete }) {
      if (!complete || allScanned) return;
      allScanned = true;
      svg.dataset.allScanned = 'true';
      draftButton?.removeAttribute('hidden');
      onUnlocked?.();
    }
  });
  svg.dataset.scannedLights = '0';
  svg.dataset.allScanned = 'false';
  const photos = [
    ['fridge', '118.12', 'evidence-fridge.png'],
    ['man', '88.97', 'evidence-man.png'],
    ['cafe', '220.31', 'evidence-cafe.png'],
    ['commuters', '395.21', 'evidence-commuters.png'],
    ['desk', '423.69', 'evidence-desk.png'],
    ['girl', '589.87', 'evidence-girl.png'],
    ['table', '269.18', 'evidence-table.png']
  ];
  let gesture;
  function point(event) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  }
  function update(state) {
    state.wrapper.setAttribute('transform', `translate(${state.x} ${state.y}) rotate(${state.angle} ${state.cx} ${state.cy})`);
    state.wrapper.dataset.x = String(state.x);
    state.wrapper.dataset.y = String(state.y);
    state.wrapper.dataset.angle = String(state.angle);
  }
  function cancel() {
    if (!gesture) return;
    const previous = gesture;
    gesture = null;
    previous.state.wrapper.classList.remove('is-manipulating');
    if (previous.state.wrapper.hasPointerCapture(previous.pointerId)) previous.state.wrapper.releasePointerCapture(previous.pointerId);
  }
  photos.forEach(([id, xValue, filename]) => {
    const border = [...root.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === xValue);
    let card = border.parentElement;
    if (card === root) {
      card = document.createElementNS(SVG_NS, 'g');
      border.before(card);
      card.append(border);
    }
    card.querySelectorAll('image').forEach(image => image.remove());
    const x = Number(border.getAttribute('x'));
    const y = Number(border.getAttribute('y'));
    const width = Number(border.getAttribute('width'));
    const height = Number(border.getAttribute('height'));
    const transform = border.getAttribute('transform') || '';
    const clip = node('clipPath', { id: svg.id + '-photo-' + id + '-clip', clipPathUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
    node('rect', { x, y, width, height }, clip);
    const image = node('image', {
      x, y, width, height, transform,
      href: assetUrl('images/' + filename),
      preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${clip.id})`, 'pointer-events': 'none'
    }, card);
    card.prepend(image);
    border.classList.add('evidence-frame');
    border.setAttribute('pointer-events', 'all');
    const wrapper = node('g', { class: 'evidence-photo', 'data-photo': id, tabindex: 0, role: 'group', 'aria-label': `Evidence photo: ${id}. Drag to move; use the circular handle to rotate.` }, photoLayer);
    wrapper.append(card);
    const title = node('title', {}, wrapper);
    title.textContent = 'Drag photo to move. Drag the round handle or outer edge to rotate. Arrow keys move; [ and ] rotate.';
    let matrix = new DOMMatrix();
    for (const part of border.transform.baseVal) matrix = matrix.multiply(part.matrix);
    const center = new DOMPoint(x + width / 2, y + height / 2).matrixTransform(matrix);
    const state = { wrapper, x: 0, y: 0, angle: 0, cx: center.x, cy: center.y };
    photoPositions.set(id, state);
    const hint = node('g', { class: 'evidence-rotation-hint', transform }, wrapper);
    node('rect', { x: x - 13, y: y - 13, width: width + 26, height: height + 26, fill: 'none', stroke: 'transparent', 'stroke-width': 22, 'pointer-events': 'stroke', 'data-rotate': '', class: 'photo-rotate-zone' }, hint);
    node('path', { d: `M${x + width / 2},${y}v-16`, stroke: '#e9bc87', 'stroke-width': 1.5, 'pointer-events': 'none' }, hint);
    const handle = node('g', { class: 'photo-rotate-handle', 'data-rotate': '' }, hint);
    node('circle', { cx: x + width / 2, cy: y - 27, r: 11, fill: '#11100b', stroke: '#e9bc87', 'stroke-width': 1.5, 'pointer-events': 'all' }, handle);
    node('path', { d: `M${x + width / 2 + 5},${y - 29}a5.5,5.5 0 1 0 0,5M${x + width / 2 + 5},${y - 33}v5h-5`, fill: 'none', stroke: '#ffc58c', 'stroke-width': 1.5, 'pointer-events': 'none' }, handle);
    wrapper.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (uv.isHolding()) return;
      cancel();
      // 提前结束窗口展开，避免抓取中窗口的比例继续变化。
      svg.parentElement.getAnimations().forEach(animation => {
        if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
      });
      photoLayer.querySelectorAll('.is-selected').forEach(photo => photo.classList.remove('is-selected'));
      photoLayer.append(wrapper);
      wrapper.classList.add('is-selected', 'is-manipulating');
      wrapper.focus({ preventScroll: true });
      const start = point(event);
      gesture = { state, pointerId: event.pointerId, rotate: Boolean(event.target.closest('[data-rotate]')), start, x: state.x, y: state.y,
        previousAngle: Math.atan2(start.y - state.cy - state.y, start.x - state.cx - state.x) };
      wrapper.setPointerCapture(event.pointerId);
    });
    wrapper.addEventListener('pointermove', event => {
      if (!gesture || gesture.state !== state || gesture.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1)) { cancel(); return; }
      const current = point(event);
      if (gesture.rotate) {
        const angle = Math.atan2(current.y - state.cy - state.y, current.x - state.cx - state.x);
        const change = Math.atan2(Math.sin(angle - gesture.previousAngle), Math.cos(angle - gesture.previousAngle));
        state.angle += change * 180 / Math.PI;
        gesture.previousAngle = angle;
      } else {
        state.x = Math.max(48 - state.cx, Math.min(1468.77 - state.cx, gesture.x + current.x - gesture.start.x));
        state.y = Math.max(125 - state.cy, Math.min(840 - state.cy, gesture.y + current.y - gesture.start.y));
      }
      update(state);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => wrapper.addEventListener(type, event => { if (gesture?.pointerId === event.pointerId) cancel(); }));
    wrapper.addEventListener('keydown', event => {
      if (uv.isHolding()) return;
      const step = event.shiftKey ? 12 : 4;
      const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (event.key in directions) {
        event.preventDefault();
        const [dx, dy] = directions[event.key];
        state.x = Math.max(48 - state.cx, Math.min(1468.77 - state.cx, state.x + dx));
        state.y = Math.max(125 - state.cy, Math.min(840 - state.cy, state.y + dy));
      } else if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        state.angle += (event.key === '[' ? -1 : 1) * (event.shiftKey ? 15 : 5);
      } else return;
      wrapper.classList.add('is-selected');
      update(state);
    });
    update(state);
    uv.addPhoto({ id, image, border, card, wrapper, clipId: clip.id });
  });
  root.append(blue);
  const placeholder = [...paper.querySelectorAll('text')].find(text => text.textContent.includes('TYPE KEY'));
  placeholder.setAttribute('visibility', 'hidden');
  const foreign = node('foreignObject', { x: 0, y: 0, width: 194, height: 32, transform: 'translate(908.78 414.4) rotate(7.22)' }, paper);
  const input = document.createElementNS(XHTML_NS, 'input');
  input.className = 'investigation-key';
  input.setAttribute('aria-label', 'File access key');
  input.setAttribute('placeholder', placeholder.textContent);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  foreign.append(input);
  function unlock() {
    if (svg.dataset.keyUnlocked === 'true' || input.value.trim().toLowerCase() !== 'opuim') return;
    svg.dataset.keyUnlocked = 'true';
    blue.setAttribute('aria-hidden', 'false');
    blue.classList.add('is-revealing');
    onUnlocked?.();
    const fx = node('g', { class: 'investigation-unlock-fx', 'pointer-events': 'none' });
    root.insertBefore(fx, blue);
    for (let index = 0; index < 3; index++) {
      const ring = node('circle', { cx: 1370.78, cy: 768.36, r: 68 + index * 20, fill: 'none', stroke: index === 1 ? '#ed9d4d' : '#78dfff', 'stroke-width': 2 - index * .35, class: 'investigation-unlock-ring' }, fx);
      ring.style.animationDelay = (index * .16) + 's';
    }
    blue.addEventListener('animationend', event => {
      if (event.animationName !== 'investigation-blue-reveal') return;
      blue.classList.remove('is-revealing');
      blue.classList.add('is-visible');
      uv.enable();
      fx.remove();
    }, { once: true });
  }
  input.addEventListener('input', event => { if (!event.isComposing) unlock(); });
  input.addEventListener('compositionend', unlock);
  uv.bringToFront();
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  return {
    cancel() { cancel(); uv.stop(); },
    stopScanning: uv.stop,
    snapshot() {
      const photos = [...photoLayer.children].map(({ dataset: { photo: id } }) => {
        const { x, y, angle } = photoPositions.get(id);
        return { id, x, y, angle };
      });
      return {
        unlocked: svg.dataset.keyUnlocked === 'true',
        lights: uv.snapshot(), photos
      };
    },
    restore(saved) {
      for (const { id, x, y, angle } of Array.isArray(saved.photos) ? saved.photos : []) {
        const state = photoPositions.get(id);
        if (!state || ![x, y, angle].every(Number.isFinite)) continue;
        Object.assign(state, { x, y, angle });
        photoLayer.append(state.wrapper);
        update(state);
      }
      if (!saved.unlocked) return;
      svg.dataset.keyUnlocked = 'true';
      input.value = 'opuim';
      blue.setAttribute('aria-hidden', 'false');
      blue.classList.add('is-visible');
      uv.enable();
      uv.restore(saved.lights);
    }
  };
}
