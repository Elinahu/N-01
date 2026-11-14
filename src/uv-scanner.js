import { evidenceLighting } from './evidence-lighting.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export function createUvScanner(svg, root, blue, workspaceClipId, { onProgress } = {}) {
  const defs = svg.querySelector('defs');
  const entries = [];
  let active = false;
  let enabled = false;
  let toolDrag;
  const dockedLens = blue.querySelector('image');
  dockedLens.dataset.dockedLens = '';
  function node(tag, attrs = {}, parent = defs) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.append(element);
    return element;
  }
  const prefix = svg.id + '-uv';
  const bloom = node('radialGradient', { id: prefix + '-bloom' });
  [[0, '#f5ffff', 1], [.12, '#d6fbff', 1], [.45, '#29bcff', .85], [.74, '#147bff', .48], [1, '#0967e8', 0]].forEach(([offset, color, opacity]) => node('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, bloom));
  const soft = node('filter', { id: prefix + '-soft', x: '-60%', y: '-60%', width: '220%', height: '220%', 'color-interpolation-filters': 'sRGB' });
  node('feGaussianBlur', { stdDeviation: 1.6 }, soft);
  const lens = node('g', { class: 'uv-scanner-lens', 'pointer-events': 'none', 'clip-path': `url(#${workspaceClipId})` }, root);
  const cursor = node('g', {}, lens);
  const glass = node('radialGradient', { id: prefix + '-glass', cx: '.34', cy: '.26', r: '.8' });
  [[0, '#c4f7ff', .08], [.65, '#288ed4', .025], [1, '#67cbff', .12]].forEach(([offset, color, opacity]) => node('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, glass));
  node('circle', { r: 72, fill: `url(#${glass.id})`, stroke: '#b3eaff', 'stroke-width': 1.5, opacity: .88 }, cursor);
  node('circle', { r: 68.5, fill: 'none', stroke: '#448fbc', 'stroke-width': .65, opacity: .55 }, cursor);
  node('path', { d: 'M-58,-29A65,65 0 0 1 21,-61', fill: 'none', stroke: '#e1fbff', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: .62 }, cursor);
  node('path', { d: 'M-52,-24A58,58 0 0 1-33,-48', fill: 'none', stroke: '#c0f2ff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .14 }, cursor);
  blue.setAttribute('role', 'button');
  blue.setAttribute('tabindex', '0');
  blue.setAttribute('aria-label', 'Pick up the blue lens. Move it over photos, then click its empty base to put it back.');
  blue.setAttribute('aria-pressed', 'false');
  blue.setAttribute('aria-disabled', 'true');
  const title = node('title', {}, blue);
  title.textContent = 'Pick up the lens and move it over the photos. Click the empty base to put it back.';
  function clearLight() {
    // 已发现的光源属于照片线索，收起镜片或离开照片不能擦除。
    entries.forEach(entry => entry.emitters.forEach(emitter => {
      if (!emitter.revealed) emitter.group.style.opacity = '0';
    }));
    lens.classList.remove('is-visible');
  }
  function setActive(value) {
    active = enabled && value;
    svg.classList.toggle('is-uv-active', active);
    svg.dataset.uvActive = String(active);
    blue.setAttribute('aria-pressed', String(active));
    blue.classList.toggle('is-empty', active);
    dockedLens.style.visibility = active ? 'hidden' : '';
    svg.dataset.lensState = active ? 'held' : enabled ? 'docked' : 'locked';
    blue.setAttribute('aria-label', active ? 'Put the blue lens back into its empty base.' : 'Pick up the blue lens. Move it over photos, then click its empty base to put it back.');
    clearLight();
  }
  function releaseDrag() {
    if (!toolDrag) return;
    const previous = toolDrag;
    toolDrag = null;
    if (blue.hasPointerCapture(previous.pointerId)) blue.releasePointerCapture(previous.pointerId);
  }
  function stop() {
    const wasActive = active;
    setActive(false);
    releaseDrag();
    return wasActive;
  }
  function suspend() {
    releaseDrag();
    clearLight();
  }
  function overBase(event) {
    const location = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return location.x >= 1306.32 && location.x <= 1435.25 && location.y >= 703.9 && location.y <= 832.83;
  }
  function revealEmitter(emitter) {
    emitter.revealed = true;
    emitter.group.dataset.revealed = 'true';
    emitter.group.style.opacity = '1';
  }
  function reportProgress() {
    const emitters = entries.flatMap(entry => entry.emitters);
    const found = emitters.filter(emitter => emitter.revealed).length;
    svg.dataset.scannedLights = String(found);
    onProgress?.({ found, total: emitters.length, complete: found === emitters.length });
  }
  function scan(event) {
    if (!active) return;
    const world = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    if (world.y < 92 || world.y > 875 || world.x < 18 || world.x > 1498.77) { clearLight(); return; }
    cursor.setAttribute('transform', `translate(${world.x} ${world.y})`);
    lens.classList.add('is-visible');
    // 指针捕获在道具上时仍按真实命中位置判断，不能透过上层照片照亮下层。
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.evidence-photo');
    let discovered = false;
    entries.forEach(entry => {
      const selected = target === entry.wrapper;
      if (!selected) {
        entry.emitters.forEach(emitter => { if (!emitter.revealed) emitter.group.style.opacity = '0'; });
        return;
      }
      const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(entry.image.getScreenCTM().inverse());
      entry.emitters.forEach(emitter => {
        if (emitter.revealed) return;
        const distance = Math.hypot(local.x - emitter.phone.x, local.y - emitter.phone.y);
        const strength = Math.pow(Math.max(0, 1 - distance / 95), .65);
        if (distance <= 48) {
          revealEmitter(emitter);
          discovered = true;
        } else emitter.group.style.opacity = String(strength);
      });
    });
    if (discovered) reportProgress();
  }
  function addPhoto({ id, image, border, card, wrapper, clipId }) {
    const config = evidenceLighting[id];
    if (!config?.emitters.length) return;
    const x = Number(border.getAttribute('x')), y = Number(border.getAttribute('y'));
    const width = Number(border.getAttribute('width')), height = Number(border.getAttribute('height'));
    const [sourceWidth, sourceHeight] = config.source;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropX = x + (width - sourceWidth * scale) / 2;
    const cropY = y + (height - sourceHeight * scale) / 2;
    const map = point => ({ x: cropX + point[0] * sourceWidth * scale, y: cropY + point[1] * sourceHeight * scale });
    const clipped = node('g', { transform: border.getAttribute('transform') || '', 'clip-path': `url(#${clipId})`, 'pointer-events': 'none', class: 'photo-uv-light', 'data-uv-photo': id }, card);
    image.after(clipped);
    // 光束本身已限定手机/脸部范围，并由照片边界裁切；不用移动遮罩裁掉已发现的线索。
    const overlay = node('g', { style: 'mix-blend-mode:screen' }, clipped);
    const emitters = config.emitters.map((emitter, index) => {
      const phone = map(emitter.phone);
      const radius = Math.min(width, height) * .075;
      const group = node('g', { 'data-uv-emitter': index, 'data-phone-x': phone.x, 'data-phone-y': phone.y, opacity: 0 }, overlay);
      if (emitter.face) {
        const face = map(emitter.face);
        const vx = face.x - phone.x, vy = face.y - phone.y, length = Math.hypot(vx, vy);
        const nx = -vy / length, ny = vx / length;
        const a = radius * .38, b = radius * 1.6;
        const beam = node('linearGradient', { id: prefix + '-' + id + '-beam-' + index, gradientUnits: 'userSpaceOnUse', x1: phone.x, y1: phone.y, x2: face.x, y2: face.y });
        [[0, .85], [.45, .5], [1, .06]].forEach(([offset, opacity]) => node('stop', { offset, 'stop-color': '#279fff', 'stop-opacity': opacity }, beam));
        node('path', { d: `M${phone.x + nx * a},${phone.y + ny * a}L${face.x + nx * b},${face.y + ny * b}Q${face.x},${face.y - 5} ${face.x - nx * b},${face.y - ny * b}L${phone.x - nx * a},${phone.y - ny * a}Z`, fill: `url(#${beam.id})`, filter: `url(#${soft.id})` }, group);
        node('ellipse', { cx: face.x, cy: face.y, rx: radius * 1.7, ry: radius * 1.95, fill: `url(#${bloom.id})`, opacity: .72 }, group);
      }
      node('ellipse', { cx: phone.x, cy: phone.y, rx: radius * 2, ry: radius * 1.15, fill: `url(#${bloom.id})` }, group);
      node('ellipse', { cx: phone.x, cy: phone.y, rx: radius * .72, ry: radius * .23, fill: '#e9ffff', transform: `rotate(${emitter.angle || 0} ${phone.x} ${phone.y})`, filter: `url(#${soft.id})` }, group);
      node('ellipse', { cx: phone.x, cy: phone.y, rx: radius * .3, ry: radius * .1, fill: '#f3ffff', opacity: .95, transform: `rotate(${emitter.angle || 0} ${phone.x} ${phone.y})` }, group);
      return { phone, group, revealed: false };
    });
    entries.push({ id, image, wrapper, emitters });
  }
  svg.addEventListener('pointermove', scan);
  svg.addEventListener('pointerleave', () => { if (!toolDrag) clearLight(); });
  blue.addEventListener('pointerdown', event => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    blue.focus({ preventScroll: true });
    toolDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pickedUp: !active, moved: false };
    if (!active) setActive(true);
    blue.setPointerCapture(event.pointerId);
    scan(event);
  });
  blue.addEventListener('pointermove', event => {
    if (!toolDrag || toolDrag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - toolDrag.x, event.clientY - toolDrag.y) > 4) {
      toolDrag.moved = true;
      scan(event);
    }
  });
  blue.addEventListener('pointerup', event => {
    if (!toolDrag || toolDrag.pointerId !== event.pointerId) return;
    const previous = toolDrag;
    releaseDrag();
    // 松开鼠标仍然拿着镜片；只有在底座上完成放回操作才回到底座。
    if ((!previous.pickedUp || previous.moved) && overBase(event)) stop();
  });
  ['pointercancel', 'lostpointercapture'].forEach(type => blue.addEventListener(type, () => { if (toolDrag) suspend(); }));
  blue.addEventListener('keydown', event => {
    if (enabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (!event.repeat) setActive(!active); }
  });
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  setActive(false);
  return {
    addPhoto, stop,
    isHolding: () => active,
    enable() { enabled = true; blue.setAttribute('aria-disabled', 'false'); setActive(false); },
    bringToFront() { root.append(lens); },
    snapshot() {
      return Object.fromEntries(entries.map(({ id, emitters }) => [id, emitters.flatMap((emitter, index) => emitter.revealed ? [index] : [])]));
    },
    restore(saved) {
      for (const { id, emitters } of entries) {
        if (!Array.isArray(saved?.[id])) continue;
        emitters.forEach((emitter, index) => { if (saved[id].includes(index)) revealEmitter(emitter); });
      }
      reportProgress();
    }
  };
}
