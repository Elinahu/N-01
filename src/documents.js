const SVG_NS = 'http://www.w3.org/2000/svg';

export function initializeDocumentsFiles(svg, { getReportArtwork = () => null } = {}) {
  svg.setAttribute('role', 'group');
  const find = id => svg.querySelector(`[id$="-${id}"]`);
  const report = find('report-01');
  const results = find('results-panel');
  const documentPanel = find('result-document');
  const root = find('_文档管理').firstElementChild;
  const paragraphs = [...root.children].filter(element => element.localName === 'text');
  const fields = {
    title: report.querySelector('text'),
    subtitle: report.querySelectorAll('text')[1],
    caseId: report.querySelectorAll('text')[2],
    resultsTitle: results.querySelectorAll('text')[1],
    documentTitle: documentPanel.querySelector('text'),
    reportId: [...documentPanel.querySelectorAll('text')].find(text => text.getAttribute('transform') === 'translate(925.11 307.98)'),
    summary: paragraphs.at(-2),
    body: paragraphs.at(-1)
  };
  const originals = Object.fromEntries(Object.entries(fields).map(([key, element]) => [key, [...element.childNodes].map(child => child.cloneNode(true))]));
  const originalRight = [results, documentPanel, documentPanel.nextElementSibling, fields.body];
  const archiveSlot = document.createElementNS(SVG_NS, 'g');
  archiveSlot.dataset.archivedReport = '';
  root.append(archiveSlot);
  // 只给前面的正文卡面着色，保留三个文件夹原层级，不遮住其他页签。
  const selectedBody = document.createElementNS(SVG_NS, 'path');
  selectedBody.setAttribute('d', 'M31.79,62.46H341.9V782.02H39.32L31.79,774.5Z');
  selectedBody.setAttribute('stroke-width', '1.6');
  selectedBody.classList.add('documents-selected-body');
  report.before(selectedBody);
  const palettes = [
    { body: '#312515', tab: '#312515', label: '#ffb46c' },
    { body: '#332a1b', tab: '#ead0a2', label: '#6e3511' },
    { body: '#292016', tab: '#5b3c20', label: '#ffd09b' }
  ];
  const tabs = ['folder-front-3', 'folder-front-2', 'folder-front'].map((id, index) => {
    const shape = find(id);
    const group = shape.parentElement;
    const label = group.querySelector('text');
    const labelShift = document.createElementNS(SVG_NS, 'g');
    label.before(labelShift);
    labelShift.append(label);
    labelShift.classList.add('documents-file-label');
    shape.classList.add('documents-file-shape');
    shape.setAttribute('pointer-events', 'all');
    group.classList.add('documents-file-tab');
    group.dataset.file = String(index + 1);
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', `Select Investigation File ${index + 1}`);
    const original = shape.getAttribute('d');
    const expanded = original.replace('l65.78,22.82', 'l79.78,22.82').replace('l-65.78,24.16', 'l-79.78,24.16');
    group.addEventListener('click', () => select(index + 1));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(index + 1); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = (index + (event.key === 'ArrowDown' ? 1 : 2)) % 3;
        select(next + 1);
        tabs[next].group.focus({ preventScroll: true });
      }
    });
    group.addEventListener('pointerdown', event => { if (event.button === 0) group.classList.add('is-pressed'); });
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(type => group.addEventListener(type, () => group.classList.remove('is-pressed')));
    return { group, shape, label, original, expanded };
  });
  function text(key, lines) {
    fields[key].replaceChildren();
    lines.forEach((line, index) => {
      const span = document.createElementNS(SVG_NS, 'tspan');
      span.setAttribute('x', '0');
      span.setAttribute('y', String(index * 18.68));
      span.textContent = line;
      fields[key].append(span);
    });
  }
  function select(file) {
    svg.dataset.selectedFile = String(file);
    selectedBody.style.fill = palettes[file - 1].body;
    selectedBody.style.stroke = 'none';
    tabs.forEach((tab, index) => {
      const active = file === index + 1;
      tab.group.classList.toggle('is-selected', active);
      tab.group.setAttribute('aria-pressed', String(active));
      tab.shape.style.d = `path("${active ? tab.expanded : tab.original}")`;
      tab.shape.style.fill = active ? palettes[index].tab : '';
      tab.shape.style.stroke = active ? '#ee922d' : '';
      tab.shape.style.strokeWidth = active ? '2.2px' : '';
      tab.label.style.opacity = active ? '1' : '.69';
      tab.label.style.fill = active ? palettes[index].label : '';
    });
    if (file === 1) {
      Object.entries(fields).forEach(([key, element]) => element.replaceChildren(...originals[key].map(child => child.cloneNode(true))));
    } else {
      text('title', [`Investigation File ${file}`]);
      text('subtitle', ['Investigation Record']);
      text('caseId', [`CASE#2126-${String(file).padStart(2,'0')}`]);
      text('resultsTitle', [`/// File ${file} Results`]);
      text('documentTitle', [`INVESTIGATION FILE ${file}`]);
      text('reportId', [`FILE ${file}`]);
      text('summary', ['No findings have been recorded yet.']);
      text('body', [`Investigation File ${file}.`, 'No findings have been recorded yet.']);
    }
    const archived = getReportArtwork(file);
    originalRight.forEach(element => element.toggleAttribute('hidden', Boolean(archived)));
    archiveSlot.replaceChildren();
    archiveSlot.dataset.archivedReport = archived ? String(file) : '';
    if (archived) {
      text('caseId', [`CASE#2126-${String(file).padStart(2,'0')}`]);
      text('summary', [file===3?'Investigation record unlocked.':'Investigation report submitted.', 'Full findings are available in', 'the results panel.']);
      const panel = archived.cloneNode(true);
      // 报告及第三份档案与原DOCUMENT右侧面板同尺寸，仅平移至原面板坐标。
      Object.entries({ x: 500.65, y: 61.64, width: 781.27, height: 721.28 }).forEach(([key,value])=>panel.setAttribute(key,String(value)));
      archiveSlot.append(panel);
    }
  }
  select(1);
  return { select, get selectedFile() { return Number(svg.dataset.selectedFile || 1); }, refresh() { select(this.selectedFile); } };
}
