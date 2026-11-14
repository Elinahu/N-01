const STORAGE_KEY = 'fca.notes.v1';

export function initializeNotesEditor(svg, surface) {
  svg.setAttribute('role', 'group');
  const placeholder = [...svg.querySelectorAll('text')].find(text => text.textContent.includes('TYPE NOTE'));
  placeholder.setAttribute('visibility', 'hidden');
  const editor = document.createElement('textarea');
  editor.className = 'notes-editor';
  editor.setAttribute('aria-label', 'Notes — 支持中文与英文，自动保存');
  editor.placeholder = placeholder.textContent;
  editor.spellcheck = false;
  editor.style.left = (50.9 / 616.08 * 100) + '%';
  editor.style.top = (146 / 853 * 100) + '%';
  editor.style.width = (509.1 / 616.08 * 100) + '%';
  editor.style.height = (650 / 853 * 100) + '%';
  const notice = document.createElement('span');
  notice.className = 'notes-save-error';
  notice.setAttribute('role', 'status');
  notice.textContent = 'Notes could not be saved on this device.';
  notice.hidden = true;
  try { editor.value = localStorage.getItem(STORAGE_KEY) ?? ''; }
  catch { notice.hidden = false; }
  function save() {
    try {
      // 空字符串同样写入：玩家主动清空后，不恢复任何旧内容。
      localStorage.setItem(STORAGE_KEY, editor.value);
      notice.hidden = true;
    } catch { notice.hidden = false; }
  }
  editor.addEventListener('input', event => { if (!event.isComposing) save(); });
  editor.addEventListener('compositionend', save);
  editor.addEventListener('blur', save);
  window.addEventListener('pagehide', save);
  surface.append(editor, notice);
  // 原稿字号随整个便签等比缩放，输入使用原生textarea以支持中文输入法。
  const resize = new ResizeObserver(() => {
    if (surface.clientWidth) editor.style.fontSize = (27.26 * surface.clientWidth / 616.08) + 'px';
  });
  resize.observe(surface);
}
