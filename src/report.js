import { pulseTypingSound } from './typing-audio.js';

export function bindReportButton(button, enabled, activate) {
  button.classList.add('report-action');
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', [...button.querySelectorAll('text')].map(text=>text.textContent.trim()).join(' '));
  button.addEventListener('click', event => {
    event.stopPropagation();
    if (enabled()) activate();
  });
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !enabled()) return;
    button.classList.add('is-pressed');
    button.setPointerCapture(event.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'keyup'].forEach(type => {
    button.addEventListener(type, () => button.classList.remove('is-pressed'));
  });
  button.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat && enabled()) {
      button.classList.add('is-pressed');
      activate();
    }
  });
}

export function initializeReportDraft(svg, { onSubmit, number = 1 } = {}) {
  const body = [...svg.querySelectorAll('text')].find(text => text.getAttribute('transform') === 'translate(79.41 430.62)');
  // 资源42将左侧文件图标也放在_线索1里；只隐藏第一个Submit组。
  const submit = svg.querySelector('[id$="-_线索1"]').firstElementChild;
  submit.classList.add('report-submit');
  submit.setAttribute('hidden', '');
  submit.setAttribute('aria-disabled', 'true');
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const leaves = [];
  while (walker.nextNode()) leaves.push({ node: walker.currentNode, text: walker.currentNode.textContent });
  const report = { number, title: `Investigation Report ${number}`, text: leaves.map(leaf => leaf.text).join('') };
  const total = report.text.length;
  let count = 0;
  let submitted = false;
  leaves.forEach(leaf => { leaf.node.textContent = ''; });
  body.classList.add('report-body');
  body.setAttribute('aria-hidden', 'true');
  const input = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ x: 65, y: 405, width: 660, height: 215, fill: 'transparent', 'pointer-events': 'all', tabindex: '0', role: 'button', 'aria-label': 'Compose the investigation report' }).forEach(([key,value])=>input.setAttribute(key,value));
  input.classList.add('report-compose');
  svg.append(input);
  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ x: 79.41, y: 417, width: 8, height: 15, fill: '#ee842b', 'pointer-events': 'none', class: 'report-caret' }).forEach(([key,value])=>caret.setAttribute(key,value));
  svg.append(caret);
  svg.dataset.reportPhase = 'composing';
  svg.dataset.reportCharacters = '0';
  function reveal(characters) {
    count = Math.max(0, Math.min(total, characters));
    let remaining = count;
    leaves.forEach(leaf => {
      leaf.node.textContent = leaf.text.slice(0, Math.max(0, remaining));
      remaining -= leaf.text.length;
    });
    svg.dataset.reportCharacters = String(count);
    caret.setAttribute('visibility', 'hidden');
    if (count === total) {
      svg.dataset.reportPhase = 'ready';
      submit.removeAttribute('hidden');
      submit.setAttribute('aria-disabled', 'false');
      input.setAttribute('aria-disabled', 'true');
      body.removeAttribute('aria-hidden');
    }
  }
  function compose() {
    if (count === total || submitted) return;
    pulseTypingSound();
    reveal(count + 6);
  }
  input.addEventListener('click', compose);
  input.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (event.key.length === 1 || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      compose();
    }
  });
  function markSubmitted() {
    submitted = true;
    svg.dataset.reportPhase = 'submitted';
    submit.setAttribute('aria-disabled', 'true');
  }
  bindReportButton(submit, () => count === total && !submitted, () => {
    markSubmitted();
    onSubmit?.(report);
  });
  return {
    get count() { return count; },
    restore(characters) { if (Number.isInteger(characters) && characters > 0) reveal(characters); },
    restoreSubmitted() { reveal(total); markSubmitted(); },
    focus() { (count === total ? submit : input).focus({ preventScroll: true }); }
  };
}
