// 只移动窗口，不修改宽高；位置以1921单位桌面坐标保存，随整个游戏画布等比适配。
export function createWindowDragging({ desktop, workspace, lookup, getActive, isBlocked }) {
  let drag = null;

  function apply(state) {
    const { x, y } = state.position;
    state.motionElement.style.translate = state.maximized ? '0px 0px' : (x / 19.21) + 'cqw ' + (y / 19.21) + 'cqw';
    state.motionElement.dataset.windowX = String(x);
    state.motionElement.dataset.windowY = String(y);
  }

  function cancel() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (previous.handle.hasPointerCapture(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    desktop.classList.remove('is-dragging-window');
  }

  function getLimits(state, handle) {
    const scale = desktop.getBoundingClientRect().width / 1921;
    const area = workspace.getBoundingClientRect();
    const box = state.motionElement.getBoundingClientRect();
    const headerHeight = handle.getBoundingClientRect().height;
    const baseLeft = box.left - state.position.x * scale;
    const baseTop = box.top - state.position.y * scale;
    const visibleHeader = Math.min(160 * scale, box.width);
    // 窗体允许部分移出工作区，但至少保留一段可抓取的标题栏，且不覆盖任务栏。
    return {
      scale,
      minX: (area.left + visibleHeader - box.width - baseLeft) / scale,
      maxX: (area.right - visibleHeader - baseLeft) / scale,
      minY: (area.top - baseTop) / scale,
      maxY: (area.bottom - headerHeight - baseTop) / scale
    };
  }

  function move(state, limits, x, y) {
    state.position.x = Math.max(limits.minX, Math.min(limits.maxX, x));
    state.position.y = Math.max(limits.minY, Math.min(limits.maxY, y));
    apply(state);
  }

  function settleOpening(state) {
    // 若刚进场就抓取，先结束有限的展开动画，避免拖动过程中缩放动画改变大小。
    state.motionElement.getAnimations().forEach(animation => {
      if (Number.isFinite(animation.effect.getComputedTiming().endTime)) animation.finish();
    });
  }

  function bind(id, motionElement, handle, label) {
    if (handle.dataset.dragBound) return;
    handle.dataset.dragBound = 'true';
    handle.dataset.window = id;
    handle.tabIndex = 0;
    handle.setAttribute('role', 'group');
    handle.setAttribute('aria-label', label + '标题栏，按住拖动，方向键微调');
    handle.title = '按住标题栏拖动窗口';
    handle.classList.add('dashboard-window-drag');
    motionElement.classList.add('dashboard-draggable-window');

    handle.addEventListener('pointerdown', event => {
      const state = lookup(id);
      if (event.button !== 0 || !event.isPrimary || isBlocked() || getActive() !== id || !state || state.locked || state.maximized) return;
      if (event.target.closest('button, input, textarea, select, a')) return;
      event.preventDefault();
      cancel();
      settleOpening(state);
      handle.focus({ preventScroll: true });
      drag = {
        id, state, handle, pointerId: event.pointerId,
        clientX: event.clientX, clientY: event.clientY,
        x: state.position.x, y: state.position.y, limits: getLimits(state, handle)
      };
      handle.setPointerCapture(event.pointerId);
      desktop.classList.add('is-dragging-window');
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || drag.handle !== handle || drag.pointerId !== event.pointerId) return;
      if (!(event.buttons & 1) || isBlocked() || lookup(id) !== drag.state) { cancel(); return; }
      move(drag.state, drag.limits,
        drag.x + (event.clientX - drag.clientX) / drag.limits.scale,
        drag.y + (event.clientY - drag.clientY) / drag.limits.scale);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      handle.addEventListener(type, event => {
        if (drag?.handle === handle && drag.pointerId === event.pointerId) cancel();
      });
    });
    handle.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const direction = directions[event.key];
      const state = lookup(id);
      if (!direction || !state || state.locked || state.maximized || isBlocked() || getActive() !== id) return;
      event.preventDefault();
      settleOpening(state);
      const step = event.shiftKey ? 25 : 5;
      move(state, getLimits(state, handle), state.position.x + direction[0] * step, state.position.y + direction[1] * step);
    });
  }

  window.addEventListener('blur', cancel);
  window.addEventListener('resize', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  return { apply, bind, cancel };
}
