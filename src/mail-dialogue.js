import { mailFollowUp, secondMailDialogue } from './mail-content.js';
import { pulseTypingSound, setTypingSound } from './typing-audio.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createMailConversation(svg, { onDownloadComplete, templates, initialDialogue=null, npcName='0-S-4986', npcAvatar, soundSource='mail-npc' } = {}) {
  svg.setAttribute('role', 'group');
  const history = svg.querySelector('[id$="-message-history"]');
  const parts = [...history.children];
  function template(indexes) {
    const group = document.createElementNS(SVG_NS, 'g');
    indexes.forEach(index => group.append(parts[index]));
    return group;
  }
  const npcTemplate = templates?.npc.cloneNode(true) ?? template([0, 1, 2, 3, 4, 21]);
  const playerTemplate = templates?.player.cloneNode(true) ?? template([5, 6, 7, 8, 20, 23]);
  const fileTemplate = templates?.file.cloneNode(true) ?? template([9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 22]);
  [npcTemplate,fileTemplate].forEach(row=>{
    [...row.querySelectorAll('text')].filter(text=>text.textContent.trim()==='0-S-4986').forEach(text=>text.querySelector('tspan').textContent=npcName);
    if(npcAvatar)row.querySelectorAll('image').forEach(image=>image.setAttribute('href',npcAvatar));
  });
  const bodyOf = group => [...group.querySelectorAll('text')].at(-1);
  const originalText = group => [...bodyOf(group).querySelectorAll('tspan')].map(span => span.textContent).join('');
  let steps = initialDialogue ?? [
    { speaker: 'npc', text: originalText(npcTemplate) },
    { speaker: 'player', text: originalText(playerTemplate) },
    ...mailFollowUp
  ];
  const stampOf = row => [...row.querySelectorAll('text')].find(text => /^\d{2}\.\d{2} \d{2}:\d{2}$/.test(text.textContent.trim()));
  function stampMessage(row, time) {
    const now = new Date(typeof time === 'string' ? time : Date.now());
    if (!Number.isFinite(now.getTime())) return stampMessage(row);
    const pad=value=>String(value).padStart(2,'0');
    stampOf(row).querySelector('tspan').textContent = `${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    row.dataset.sentAt=now.toISOString();
    return row.dataset.sentAt;
  }
  function node(tag, attrs = {}, parent = svg) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.append(element);
    return element;
  }
  const clip = node('clipPath', { id: svg.id + '-mail-history-clip', clipPathUnits: 'userSpaceOnUse' }, svg.querySelector('defs'));
  node('rect', { x: 318, y: 158.5, width: 634, height: 415.5 }, clip);
  const viewport = node('g', { 'clip-path': `url(#${clip.id})`, tabindex: 0, role: 'log', 'aria-label': 'Conversation history' }, history);
  node('rect', { x: 318, y: 158.5, width: 634, height: 415.5, fill: 'transparent', 'pointer-events': 'all' }, viewport);
  const thread = node('g', { class: 'mail-message-thread' }, viewport);
  const scrollbar = templates?.scrollbar.cloneNode(true) ?? parts[18];
  history.replaceChildren(viewport, scrollbar);
  scrollbar.setAttribute('pointer-events', 'none');
  scrollbar.setAttribute('visibility', 'hidden');

  const placeholder = [...svg.querySelectorAll('text')].find(text => text.textContent.includes('TYPE TRANSMISSION'));
  const cursor = [...svg.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === '319.04');
  cursor.classList.add('mail-input-cursor');
  const sendRect = [...svg.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === '1110.94');
  const sendText = [...svg.querySelectorAll('text')].find(text => text.textContent.includes('SEND'));
  const send = document.createElementNS(SVG_NS, 'g');
  sendRect.before(send);
  send.append(sendRect, sendText);
  send.classList.add('mail-preview-send');
  send.setAttribute('role', 'button');
  send.setAttribute('tabindex', '0');
  send.setAttribute('aria-label', 'Send reply');
  const preview = node('text', { x: 318.17, y: 646.18, fill: '#cbb28a', 'font-family': 'Consolas, monospace', 'font-size': 13, 'pointer-events': 'none' });
  const composer = node('rect', { x: 307, y: 623.72, width: 783.71, height: 76.22, fill: 'transparent', 'pointer-events': 'all', tabindex: 0, role: 'button', 'aria-label': 'Compose the prepared reply' });
  composer.classList.add('mail-preview-composer');
  // 首次显示后才测量原文字样式，避免隐藏SVG的零字宽。
  const measure = bodyOf(npcTemplate).cloneNode(false);
  measure.setAttribute('visibility', 'hidden');
  measure.setAttribute('aria-hidden', 'true');
  svg.append(measure);
  function wrap(text, maxWidth) {
    const lines = [];
    text.split('\n').forEach(paragraph=>{
      let line = '';
      paragraph.split(/\s+/).forEach(word => {
        const candidate = line ? line + ' ' + word : word;
        measure.textContent = candidate;
        if (line && measure.getComputedTextLength() > maxWidth) {
          lines.push(line + ' ');
          line = word;
        } else line = candidate;
      });
      lines.push(line);
    });
    return lines;
  }
  function setTextLines(text, lines, x = 0, y = 0, spacing = 15.6) {
    text.replaceChildren();
    return lines.map((line, index) => {
      const span = node('tspan', { x, y: y + index * spacing }, text);
      span.textContent = line;
      return span;
    });
  }
  function reveal(lines, nodes, length) {
    let remaining = length;
    lines.forEach((line, index) => {
      nodes[index].textContent = line.slice(0, Math.max(0, remaining));
      remaining -= line.length;
    });
  }
  let phase = 'waiting';
  let stepIndex = -1;
  let count = 0;
  let elapsed = 0;
  let lastTime = 0;
  let nextTop = 168.3;
  let lastBottom = 168.3;
  let scrollOffset = 0;
  let currentNpc;
  let preparedLines = [];
  let preparedSpans = [];
  let preparedLength = 0;
  let download;
  let fileNumber = 1;
  let scriptActive=false;
  let scriptComplete;
  let dialogueId='';
  let finalReplyDelay=750;
  const messages = [];
  function maxScroll() { return Math.max(0, lastBottom - 574); }
  function scrollTo(offset) {
    scrollOffset = Math.max(0, Math.min(maxScroll(), offset));
    thread.setAttribute('transform', `translate(0 ${-scrollOffset})`);
    svg.dataset.conversationScroll = String(scrollOffset);
    if (maxScroll() > 0) {
      const height = Math.max(38, 396 * 415.5 / (415.5 + maxScroll()));
      const top = 167.4 + (396 - height) * scrollOffset / maxScroll();
      scrollbar.setAttribute('d', `M959.68,${top}v${height}`);
      scrollbar.setAttribute('visibility', 'visible');
    }
  }
  viewport.addEventListener('wheel', event => {
    if (!maxScroll()) return;
    event.preventDefault();
    const scale = svg.getBoundingClientRect().height / svg.viewBox.baseVal.height;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 415.5 : 1 / scale);
    scrollTo(scrollOffset + delta);
  }, { passive: false });
  viewport.addEventListener('keydown', event => {
    const offsets = { ArrowUp: -40, ArrowDown: 40, PageUp: -300, PageDown: 300, Home: -Infinity, End: Infinity };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    scrollTo(scrollOffset + offsets[event.key]);
  });
  function setPhase(value) {
    setTypingSound(soundSource, false);
    phase = value;
    elapsed = 0;
    svg.dataset.conversation = phase;
    svg.dataset.dialogueStep = String(stepIndex);
    send.setAttribute('aria-disabled', String(phase !== 'ready'));
    composer.setAttribute('aria-disabled', String(!['composing', 'ready'].includes(phase)));
    send.classList.toggle('is-ready', phase === 'ready');
    cursor.classList.toggle('is-awaiting-input', phase === 'composing' && count === 0);
    cursor.setAttribute('visibility', phase === 'composing' && count === 0 ? 'visible' : 'hidden');
  }
  function appendMessage(step, time) {
    const npc = step.speaker === 'npc';
    const row = (npc ? npcTemplate : playerTemplate).cloneNode(true);
    row.dataset.message = fileNumber === 1 && stepIndex === 0 ? 'npc-intro' : fileNumber === 1 && stepIndex === 1 ? 'player-reply' : `${step.speaker}-message`;
    row.dataset.dialogueStep = String(stepIndex);
    row.dataset.fileNumber = String(fileNumber);
    if(dialogueId)row.dataset.dialogueChapter=dialogueId;
    messages.push({ kind: 'message', step, index: stepIndex, fileNumber, dialogueId, time: stampMessage(row, time) });
    const body = bodyOf(row);
    const lines = wrap(step.text, npc ? 405 : 434);
    const spans = setTextLines(body, lines);
    const bubble = [...row.querySelectorAll('rect')].find(rect => Number(rect.getAttribute('width')) > 400);
    const height = Number(bubble.getAttribute('height')) + Math.max(0, lines.length - 2) * 15.6;
    bubble.setAttribute('height', String(height));
    const origin = npc ? 168.3 : 269.05;
    const bottom = Math.max(origin + 59.81, Number(bubble.getAttribute('y')) + height);
    const position = node('g', { transform: `translate(0 ${nextTop - origin})` }, thread);
    row.classList.add('mail-message-arriving');
    position.append(row);
    lastBottom = nextTop + bottom - origin;
    nextTop = lastBottom + 30;
    scrollTo(maxScroll());
    return { row, lines, spans, length: lines.join('').length };
  }
  function bindPress(button, enabled, activate) {
    const release = () => button.classList.remove('is-pressed');
    button.addEventListener('click', () => { if (enabled()) activate(); });
    button.addEventListener('pointerdown', event => {
      if (!enabled() || event.button !== 0) return;
      button.classList.add('is-pressed');
      button.setPointerCapture(event.pointerId);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'keyup'].forEach(type => button.addEventListener(type, release));
    button.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!enabled() || event.repeat) return;
      button.classList.add('is-pressed');
      activate();
    });
  }
  function appendFile(time) {
    // 每张附件捕获自己的编号与完成状态，第二段聊天不会改写第一张附件的入口。
    const attachmentNumber = fileNumber;
    const row = fileTemplate.cloneNode(true);
    row.dataset.message = 'npc-file';
    row.dataset.fileNumber = String(attachmentNumber);
    const title = [...row.querySelectorAll('tspan')].find(span => span.textContent.includes('Investigation File 1'));
    title.textContent = `Investigation File ${attachmentNumber}`;
    const entry = { kind: 'file', fileNumber, time: stampMessage(row, time), complete: false };
    messages.push(entry);
    const position = node('g', { transform: `translate(0 ${nextTop - 421.85})` }, thread);
    row.classList.add('mail-message-arriving');
    position.append(row);
    lastBottom = nextTop + 94.48;
    nextTop = lastBottom + 30;
    const frame = [...row.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === '733.07');
    const arrow = [...row.querySelectorAll('path')].find(path => path.getAttribute('d').startsWith('M752.64'));
    const button = node('g', { class: 'mail-download-button', role: 'button', tabindex: 0, 'aria-label': `Download Investigation File ${attachmentNumber}` }, row);
    button.append(frame, arrow);
    frame.classList.add('mail-download-frame');
    frame.setAttribute('pointer-events', 'all');
    const fill = node('rect', { x: 733.07, y: 463.87, width: 38.24, height: 0, fill: '#ee922d', opacity: .32, 'pointer-events': 'none', 'data-download-fill': '' }, button);
    button.prepend(fill);
    const percent = node('text', { x: 752.19, y: 511.5, fill: '#ee922d', 'font-family': 'Consolas, monospace', 'font-size': 10, 'text-anchor': 'middle', 'pointer-events': 'none' }, row);
    const attachment = { button, fill, percent, number: attachmentNumber, entry };
    download = attachment;
    bindPress(button, () => entry.complete || (download === attachment && phase === 'file-ready'), () => {
      if (entry.complete) { onDownloadComplete?.(attachment.number); return; }
      button.setAttribute('aria-disabled', 'true');
      setPhase('downloading');
    });
    scrollTo(maxScroll());
    setPhase('file-ready');
  }
  function appendReport(report, time) {
    const position = node('g', { transform: `translate(0 ${nextTop - 421.85})` }, thread);
    const row = node('g', { 'data-message': 'player-report', 'data-file-number': report.number || 1 }, position);
    row.classList.add('mail-message-arriving');
    const card = fileTemplate.cloneNode(true);
    card.querySelectorAll('image').forEach(image => image.remove());
    [...card.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === '331.42')?.remove();
    [...card.querySelectorAll('text')].filter(text => text.textContent === '0-S-4986' || /^\d{2}\.\d{2}/.test(text.textContent)).forEach(text => text.remove());
    const title = [...card.querySelectorAll('tspan')].find(span => span.textContent.includes('Investigation File 1'));
    title.textContent = report.title;
    const detail = [...card.querySelectorAll('tspan')].find(span => span.textContent.includes('214 MB'));
    detail.textContent = `REPORT // CASE#2126-${String(report.number || 1).padStart(2,'0')}`;
    [...card.querySelectorAll('rect')].find(rect => rect.getAttribute('x') === '733.07')?.remove();
    [...card.querySelectorAll('path')].find(path => path.getAttribute('d').startsWith('M752.64'))?.remove();
    card.setAttribute('transform', 'translate(82.79 0)');
    row.append(card);
    const header = node('g', { transform: 'translate(0 152.8)' }, row);
    [...playerTemplate.children].filter(element => element.localName === 'image' || (element.localName === 'rect' && element.getAttribute('x') === '885.97') || (element.localName === 'text' && (element.textContent === 'YOU' || /^\d{2}\.\d{2}/.test(element.textContent)))).forEach(element => header.append(element.cloneNode(true)));
    messages.push({ kind: 'report', report, time: stampMessage(row, time) });
    node('title', {}, row).textContent = report.text;
    lastBottom = nextTop + 94.48;
    nextTop = lastBottom + 30;
    scrollTo(maxScroll());
  }
  function appendMedia({title,detail,onOpen}, time){
    const row=fileTemplate.cloneNode(true);
    row.dataset.message='story-collection';
    [...row.querySelectorAll('tspan')].find(span=>span.textContent.includes('Investigation File 1')).textContent=title;
    [...row.querySelectorAll('tspan')].find(span=>span.textContent.includes('214 MB')).textContent=detail;
    messages.push({ kind: 'media', title, detail, time: stampMessage(row, time) });
    const position=node('g',{transform:`translate(0 ${nextTop-421.85})`},thread);position.append(row);
    row.classList.add('mail-message-arriving');
    const frame=[...row.querySelectorAll('rect')].find(e=>e.getAttribute('x')==='733.07');
    const arrow=[...row.querySelectorAll('path')].find(e=>e.getAttribute('d').startsWith('M752.64'));
    arrow.setAttribute('d','M746,472.5L759,481.5L746,490.5Z');arrow.setAttribute('fill','#cbb28a');
    const button=node('g',{class:'mail-download-button',role:'button',tabindex:0,'aria-label':'Play story collection'},row);button.append(frame,arrow);
    frame.classList.add('mail-download-frame');frame.setAttribute('pointer-events','all');bindPress(button,()=>true,onOpen);
    lastBottom=nextTop+94.48;nextTop=lastBottom+30;scrollTo(maxScroll());
  }
  function prepareReply(step) {
    count = 0;
    svg.dataset.composedCharacters = '0';
    preparedLines = wrap(step.text, 760);
    preparedLength = preparedLines.join('').length;
    preparedSpans = setTextLines(preview, preparedLines, 318.17, 646.18, 16);
    reveal(preparedLines, preparedSpans, 0);
    placeholder.setAttribute('visibility', 'visible');
    setPhase('composing');
  }
  function advance() {
    stepIndex++;
    if (stepIndex >= steps.length) {
      if(scriptActive){scriptActive=false;setPhase('complete');const done=scriptComplete;scriptComplete=null;done?.();}
      else appendFile();
      return;
    }
    const step = steps[stepIndex];
    if (step.speaker === 'npc') {
      currentNpc = appendMessage(step);
      reveal(currentNpc.lines, currentNpc.spans, 0);
      setPhase('npc-speaking');
    } else prepareReply(step);
  }
  function revealReply(characters) {
    count = Math.min(preparedLength, characters);
    placeholder.setAttribute('visibility', 'hidden');
    cursor.setAttribute('visibility', 'hidden');
    cursor.classList.remove('is-awaiting-input');
    reveal(preparedLines, preparedSpans, count);
    svg.dataset.composedCharacters = String(count);
    if (count === preparedLength) setPhase('ready');
  }
  function compose() {
    if (phase !== 'composing') return;
    pulseTypingSound();
    revealReply(count + 6);
  }
  function showDownload(attachment, progress) {
    attachment.fill.setAttribute('height', String(35.57 * progress));
    attachment.percent.textContent = Math.floor(progress * 100) + '%';
    attachment.button.setAttribute('aria-disabled', String(progress !== 1));
    attachment.button.setAttribute('aria-label', progress === 1
      ? `Open Investigation File ${attachment.number}`
      : `Downloading Investigation File ${attachment.number}: ${Math.floor(progress * 100)}%.`);
    svg.dataset.downloadProgress = String(progress);
  }
  function transmit() {
    appendMessage(steps[stepIndex]);
    preview.replaceChildren();
    placeholder.setAttribute('visibility', 'visible');
    setPhase('npc-pending');
  }
  composer.addEventListener('click', compose);
  composer.addEventListener('keydown', event => {
    if (event.key.length === 1 || event.key === 'Enter') { event.preventDefault(); compose(); }
  });
  bindPress(send, () => phase === 'ready', transmit);
  setPhase(initialDialogue===null?'waiting':'idle');
  return {
    templates:{npc:npcTemplate,player:playerTemplate,file:fileTemplate,scrollbar},
    appendMedia,
    snapshot() {
      const timed = ['npc-speaking', 'npc-hold', 'npc-pending', 'downloading', 'download-finished'];
      return {
        messages, steps, phase, stepIndex, fileNumber, scriptActive, dialogueId, finalReplyDelay,
        count, elapsed: timed.includes(phase) ? Math.round(elapsed) : 0, scrollOffset
      };
    },
    restore(saved, { onComplete, onMedia } = {}) {
      if (!Array.isArray(saved?.messages) || !Array.isArray(saved.steps)) return;
      for (const item of saved.messages) {
        if (item.kind === 'message' && typeof item.step?.text === 'string') {
          ({ index: stepIndex, fileNumber, dialogueId } = item);
          const message = appendMessage(item.step, item.time);
          if (item.step.speaker === 'npc') currentNpc = message;
        } else if (item.kind === 'file' && [1, 2, 3].includes(item.fileNumber)) {
          fileNumber = item.fileNumber;
          appendFile(item.time);
          if (item.complete) {
            download.entry.complete = true;
            showDownload(download, 1);
          }
        } else if (item.kind === 'report' && typeof item.report?.title === 'string') {
          appendReport(item.report, item.time);
        } else if (item.kind === 'media' && onMedia) {
          appendMedia({ ...item, onOpen: onMedia }, item.time);
        }
      }
      ({ steps, stepIndex, fileNumber, scriptActive, dialogueId, finalReplyDelay } = saved);
      scriptComplete = onComplete;
      svg.dataset.dialogueChapter = dialogueId;
      if (fileNumber > 1) {
        svg.dataset.mailChapter = String(fileNumber);
        svg.dataset.reportSent = 'true';
        if (fileNumber > 2) svg.dataset.reportTwoSent = 'true';
      }
      if (['composing', 'ready'].includes(saved.phase) && typeof steps[stepIndex]?.text === 'string') {
        prepareReply(steps[stepIndex]);
        if (saved.count > 0) revealReply(saved.count);
      } else if (saved.phase !== 'npc-speaking' || currentNpc) {
        setPhase(saved.phase);
        elapsed = Math.max(0, Number(saved.elapsed) || 0);
        if (phase === 'npc-speaking') reveal(currentNpc.lines, currentNpc.spans, Math.floor(elapsed / 18));
        if (phase === 'downloading' && download) showDownload(download, Math.min(1, elapsed / 1800));
        if (phase === 'download-finished' && download) showDownload(download, 1);
      }
      thread.querySelectorAll('.mail-message-arriving').forEach(row => row.classList.remove('mail-message-arriving'));
      scrollTo(Number(saved.scrollOffset) || 0);
    },
    startDialogue(dialogue,{onComplete,id='',lastReplyDelay=750,interrupt=false}={}){
      if(!interrupt&&(!['idle','complete'].includes(phase)||scriptActive))return false;
      if(interrupt){
        if(phase==='npc-speaking')reveal(currentNpc.lines,currentNpc.spans,currentNpc.length);
        preview.replaceChildren();placeholder.setAttribute('visibility','visible');
        setTypingSound(soundSource,false);
      }
      steps=dialogue;stepIndex=-1;lastTime=0;scriptActive=true;scriptComplete=onComplete;dialogueId=id;finalReplyDelay=lastReplyDelay;
      svg.dataset.dialogueChapter=id;setPhase('waiting');return true;
    },
    submitReport(report) {
      if (report.number === 2) {
        if (fileNumber !== 2 || phase !== 'complete' || svg.dataset.reportTwoSent === 'true') return false;
        appendReport(report);
        svg.dataset.reportTwoSent = 'true';
        steps = [{ speaker: 'npc', text: 'ok.' }];
        fileNumber = 3;
        stepIndex = -1;
        lastTime = 0;
        svg.dataset.mailChapter = '3';
        setPhase('npc-pending');
        return true;
      }
      if (fileNumber !== 1 || phase !== 'complete') return false;
      appendReport(report);
      steps = secondMailDialogue;
      fileNumber = 2;
      stepIndex = -1;
      lastTime = 0;
      svg.dataset.mailChapter = '2';
      svg.dataset.reportSent = 'true';
      setPhase('npc-pending');
      return true;
    },
    pause() {
      lastTime = 0;
      setTypingSound(soundSource, false);
    },
    render(now) {
      const delta = lastTime ? Math.min(now - lastTime, 60) : 0;
      lastTime = now;
      elapsed += delta;
      if (phase === 'waiting') advance();
      else if (phase === 'npc-speaking') {
        setTypingSound(soundSource, true);
        const length = Math.min(currentNpc.length, Math.floor(elapsed / 18));
        reveal(currentNpc.lines, currentNpc.spans, length);
        if (length === currentNpc.length) setPhase('npc-hold');
      } else if ((phase === 'npc-hold' && elapsed >= 600) || (phase === 'npc-pending' && elapsed >= (scriptActive&&stepIndex===steps.length-1?finalReplyDelay:750))) advance();
      else if (phase === 'downloading') {
        const progress = Math.min(1, elapsed / 1800);
        showDownload(download, progress);
        if (progress === 1) {
          setPhase('download-finished');
        }
      } else if (phase === 'download-finished' && elapsed >= 300) {
        download.entry.complete = true;
        setPhase('complete');
        onDownloadComplete?.(download.number);
      }
    }
  };
}
