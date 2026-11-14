import { createWindowDragging } from './window-drag.js';
import { welcomeLines, afterWelcomeLines, afterTaskLines } from './desktop-content.js';
import { createMailConversation } from './mail-dialogue.js';
import { initializeDocumentsFiles } from './documents.js';
import { initializeNotesEditor } from './notes.js';
import { initializeInvestigation } from './investigation.js';
import { initializeReportDraft } from './report.js';
import { initializeFacialAnalysis } from './facial-analysis.js';
import { initializeFileThreeFolders, initializeRestrictedFolder } from './file3.js';
import { initializeMailContacts, playSurvivorIntrusion } from './mail-contacts.js';
import { initializeSurvivorDialogue } from './survivor-dialogue.js';
import { initializeNetSearch } from './net.js';
import { initializeEndings } from './endings.js';
import { initializeSessionMenu } from './session-menu.js';
import { setTypingSound } from './typing-audio.js';
import { writeCheckpoint } from './checkpoint.js';
import { playEffect, trackEffect } from './audio-settings.js';

const page = document.querySelector('#system-dashboard');
const source = document.querySelector('#dashboard-source');
const taskSource = document.querySelector('#task-dossier-source');
const taskPage = document.querySelector('#dashboard-task');
const taskSurface = document.querySelector('#task-dossier-surface');
const taskClose = document.querySelector('#task-dossier-close');
const taskMinimize = document.querySelector('#task-dossier-minimize');
const taskMaximize = document.querySelector('#task-dossier-maximize');
const mailSource = document.querySelector('#mail-source');
const documentsSource = document.querySelector('#documents-source');
const notesSource = document.querySelector('#notes-source');
const investigationSource = document.querySelector('#investigation-source');
const investigationTwoSource = document.querySelector('#investigation-two-source');
const draftReportSource = document.querySelector('#draft-report-source');
const reportSource = document.querySelector('#report-source');
const reportTwoSource = document.querySelector('#report-two-source');
const recordThreeSource = document.querySelector('#file-three-report-source');
const evaluateSource = document.querySelector('#evaluate-source');
const windowHost = document.querySelector('#dashboard-windows');
const exampleTemplate = document.querySelector('#dashboard-example-template');
const SVG_NS = 'http://www.w3.org/2000/svg';
const modules = [
  ['Shortcut_Tasks', 'task', '任务卷宗', 'TASKS'],
  ['Shortcut_Mail', 'mailbox', '邮箱', 'MAIL'],
  ['Shortcut_This_PC', 'computer', '此电脑', 'THIS PC'],
  ['Shortcut_FCA_Net', 'browser', 'FCA网络', 'FCA NET'],
  ['Shortcut_Document_Archive', 'documents', '文档管理', 'DOCUMENT'],
  ['Shortcut_Notes', 'note', '备忘录', 'NOTES']
];
const shortcuts = new Map();
const openWindows = new Map();
const taskbarSlots = [];
let taskArtwork;
let mailArtwork;
let mailPage;
let mailSurface;
let mailDialogue;
let mailContacts;
let survivorStory;
let survivorArtworkReady;
let netWindow;
let endings;
let sessionMenu;
let taskbarViewport,taskbarFrame,taskbarBounds,taskbarWidth,taskbarStride;
let survivorClueUnlocked=false;
let documentsArtwork;
let documentsPage;
let documentsSurface;
let documentsInteraction;
const submittedReports = new Map();
const fileThreeWindows = new Map();
const fileThreeModules = new Map();
let investigationModule;
let notesArtwork;
let notesPage;
let notesSurface;
let investigationArtwork;
let investigationPage;
let investigationSurface;
let investigationInteraction;
let investigationTwo;
let investigationTwoModule;
const reportDrafts = new Map();
let entered = false;
let ready = false;
let restoring = false;
let checkpointAvailable = true;
let artworkSequence = 0;
let taskProjection;
let closingModule = false;
let activeModule = null;
let desktopClock;
let welcomeTyping;
let welcomeSvg;
let welcomePanel;
let taskbarStart = 0;
let taskbarGroup;
let desktopSelection;
let windowOrder = 0;
const windowDragging = createWindowDragging({
  desktop: page, workspace: windowHost,
  lookup: id => openWindows.get(id),
  getActive: () => activeModule,
  isBlocked: () => closingModule
});

// 原素材的所有定义一并保留，使渐变、描边和嵌入图像沿用AI输出。
function artwork(document, elements, bounds) {
  const svg = window.document.createElementNS(SVG_NS, 'svg');
  const scope = `fca-artwork-${++artworkSequence}`;
  svg.id = scope;
  svg.setAttribute('viewBox', bounds.join(' '));
  svg.setAttribute('aria-hidden', 'true');
  svg.append(window.document.importNode(document.querySelector('defs'), true));
  elements.forEach((element) => svg.append(window.document.importNode(element, true)));
  // AI导出的不同SVG会重复使用cls-1和渐变ID：为每一片独立命名，避免互相污染。
  const ids = new Map();
  svg.querySelectorAll('[id]').forEach((element) => {
    const originalId = element.id;
    const newId = `${scope}-${originalId}`;
    ids.set(originalId, newId);
    element.id = newId;
  });
  svg.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name === 'id') return;
      let value = attribute.value.replace(/url\(#([^)]*)\)/g, (_match, id) => `url(#${ids.get(id) || id})`);
      if (value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      // 内联后相对图片地址不再以原SVG为基准，需先解析为本地绝对URL。
      if (element.localName === 'image' && attribute.localName === 'href' && !value.startsWith('#')) {
        value = new URL(value, document.baseURI).href;
      }
      attribute.value = value;
    });
  });
  svg.querySelectorAll('style').forEach((style) => {
    style.textContent = style.textContent
      .replace(/url\(#([^)]*)\)/g, (_match, id) => `url(#${ids.get(id) || id})`)
      .replace(/\.cls-\d+/g, selector => `.${scope}-${selector.slice(1)}`);
  });
  // 内嵌按钮SVG也是另一份AI导出稿，祖先SVG的同名cls不能穿透污染它。
  svg.querySelectorAll('[class]').forEach(element => {
    element.setAttribute('class', element.getAttribute('class').split(/\s+/).map(name => /^cls-\d+$/.test(name) ? `${scope}-${name}` : name).join(' '));
  });
  return svg;
}

function mountSvgWindow(svgDocument, rootId, surface, buttons, label, options = {}) {
  const content = svgDocument?.querySelector(rootId);
  if (!content) return null;
  const bounds = svgDocument.documentElement.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  const svg = artwork(svgDocument, [content], bounds);
  surface.style.aspectRatio = bounds[2] + ' / ' + bounds[3];
  surface.style.setProperty('--window-aspect', bounds[2] / bounds[3]);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.removeAttribute('aria-hidden');
  surface.prepend(svg);
  useLocalFonts(svg);
  const frame = findArt(svg, options.frameId || 'window-frame');
  const header = options.headerId ? findArt(svg, options.headerId) : frame.querySelector(':scope > g');
  // 外框左侧描边的外缘是x=0；标题底板与它齐平，避免内凹暴露后面的斜接缝。
  const titlePlate = header.querySelector('path');
  if (options.alignLeft !== false) titlePlate.setAttribute('d', titlePlate.getAttribute('d').replace(/^M[\d.]+,/, 'M0,').replace(/H[\d.]+V([\d.]+)Z$/, 'H0V$1Z'));
  const lockIcon = options.lockSelector ? svg.querySelector(options.lockSelector) : [...header.querySelectorAll('path')].find(path => path.getAttribute('d').match(/M/g)?.length === 2);
  const lock = document.createElement('button');
  lock.className = 'task-window-control window-lock-button';
  lock.setAttribute('aria-pressed', 'false');
  lock.setAttribute('aria-label', '锁定窗口位置');
  lock.title = '锁定窗口位置';
  surface.append(lock);
  buttons.lock = lock;
  // 原稿的窗口符号合并在四个M子路径里：横线、方框和两条叉线。
  const controls = options.controlsSelector ? svg.querySelector(options.controlsSelector) : [...header.querySelectorAll('path')].find(path => path.getAttribute('d').match(/M/g)?.length === 4);
  const [minimize, fixedSize, ...close] = controls.getAttribute('d').match(/M[^M]*/g);
  const icons = new Map();
  icons.set(lock, lockIcon);
  [[buttons.minimize, minimize], [buttons.size, fixedSize], [buttons.close, close.join('')]].forEach(([button, data]) => {
    const icon = controls.cloneNode(true);
    icon.setAttribute('d', data);
    controls.before(icon);
    icons.set(button, icon);
  });
  controls.remove();
  buttons.size.disabled = false;
  buttons.size.setAttribute('aria-disabled', 'false');
  buttons.size.setAttribute('aria-pressed', 'false');
  buttons.size.setAttribute('aria-label', '最大化窗口');
  buttons.size.title = '最大化窗口';

  const dragHandle = document.createElement('div');
  dragHandle.className = 'dashboard-window-drag';
  surface.append(dragHandle);
  const headerShape = header.querySelector('path');
  const outline = frame.querySelector(':scope > path').getAttribute('d') + ' ' + headerShape.getAttribute('d');
  return { svg, bounds, surface, buttons, icons, dragHandle, headerShape, outline };
}

function initializeTaskArtwork() {
  if (taskArtwork) return true;
  taskArtwork = mountSvgWindow(taskSource.contentDocument, '#_002', taskSurface, {
    minimize: taskMinimize, size: taskMaximize, close: taskClose
  }, 'CASE 2126-01：N-01异常事件调查任务卷宗');
  if (!taskArtwork) return false;
  taskProjection = createTaskProjection(taskArtwork.svg, taskArtwork.outline);
  return true;
}

function initializeMailArtwork() {
  if (mailArtwork) return true;
  if (!mailSource.contentDocument?.querySelector('#_003')) return false;
  mailPage = document.createElement('section');
  mailPage.id = 'dashboard-mail';
  mailPage.className = 'dashboard-svg-window';
  mailPage.hidden = true;
  mailPage.setAttribute('role', 'dialog');
  mailPage.setAttribute('aria-label', 'FCA通讯窗口');
  mailSurface = document.createElement('div');
  mailSurface.id = 'mail-window-surface';
  mailSurface.className = 'desktop-svg-surface';
  const buttons = {};
  [['minimize', '收起通讯窗口'], ['size', '窗口大小固定'], ['close', '关闭通讯窗口']].forEach(([action, label]) => {
    const button = document.createElement('button');
    button.id = 'mail-window-' + action;
    button.className = 'task-window-control';
    button.setAttribute('aria-label', label);
    button.title = label;
    mailSurface.append(button);
    buttons[action] = button;
  });
  mailPage.append(mailSurface);
  windowHost.append(mailPage);
  mailArtwork = mountSvgWindow(mailSource.contentDocument, '#_003', mailSurface, buttons, 'COMM-LINK：FCA内部通讯');
  initializeMailWave(mailArtwork.svg);
  mailDialogue = createMailConversation(mailArtwork.svg, { onDownloadComplete: openInvestigationPreview });
  const survivorSource=document.querySelector('#survivor-mail-source');
  const storiesSource=document.querySelector('#stories-source');
  survivorArtworkReady = Promise.all([waitForArtwork(survivorSource,'#survivor-mail-root'),waitForArtwork(storiesSource,'#_备忘录')]).then(()=>{
    const survivor=artwork(survivorSource.contentDocument,[survivorSource.contentDocument.querySelector('#survivor-mail-root')],mailArtwork.bounds);
    survivor.setAttribute('aria-label','COMM-LINK: SURVIVOR');useLocalFonts(survivor);
    mailSurface.append(survivor);initializeMailWave(survivor);
    mailContacts=initializeMailContacts(mailArtwork.svg,survivor,{
      isUnlocked:()=>survivorClueUnlocked,
      onChannelChange:channel=>{mailDialogue.pause();survivorStory?.select(channel)},
      onAdded:()=>{
        playSurvivorIntrusion(page);
        const sound=trackEffect(document.querySelector('#survivor-intrusion-audio'));
        sound.currentTime=0;
        sound.play().catch(error=>console.warn('SURVIVOR入侵音效未能播放',error));
        survivorStory.start();
      }
    });
    const storyDocument=storiesSource.contentDocument;
    const storyArt=artwork(storyDocument,[storyDocument.querySelector('#_备忘录')],[0,0,616.08,853.75]);useLocalFonts(storyArt);
    survivorStory=initializeSurvivorDialogue(survivor,{
      partnerSvg:mailArtwork.svg,partnerDialogue:mailDialogue,contacts:mailContacts,page,onPreviewOpen:playOpenSound,storyArtwork:storyArt,onScreeningComplete:()=>endings.showEpilogue()
    });
  }).catch(error=>console.error('SURVIVOR通讯素材加载失败',error));
  buttons.minimize.addEventListener('click', () => {
    if (activeModule === 'mailbox' && !closingModule) minimizeWindow();
  });
  buttons.close.addEventListener('click', () => closeWindow('mailbox'));
  return true;
}

function initializeMailWave(svg) {
  // 仅参考soundwave.txt（Uiverse/Vosoone）的0.8s缓动与错峰节奏；不引入播放器或蓝色样式。
  const details = findArt(svg, 'contact-details');
  const bars = [...details.querySelectorAll('path')].filter(path => /^M[\d.]+,[\d.]+v[\d.]+$/.test(path.getAttribute('d')));
  bars.forEach((bar, index) => {
    const [, x, y, height] = bar.getAttribute('d').match(/^M([\d.]+),([\d.]+)v([\d.]+)$/);
    bar.classList.add('mail-soundwave-bar');
    bar.style.transformOrigin = x + 'px ' + (Number(y) + Number(height) / 2) + 'px';
    bar.style.animationDelay = (-index * .1) + 's';
    bar.style.animationDuration = (.8 + (index % 5) * .07) + 's';
  });
}

function initializeNetArtwork(){
  if(netWindow)return true;
  const source=document.querySelector('#net-source');
  if(!source.contentDocument?.querySelector('#net'))return false;
  const surface=document.createElement('section');surface.id='dashboard-net';surface.className='dashboard-svg-window';surface.hidden=true;
  surface.setAttribute('role','dialog');surface.setAttribute('aria-label','FCA NET');
  const motionElement=document.createElement('div');motionElement.id='net-window-surface';motionElement.className='desktop-svg-surface';
  const buttons={};
  [['minimize','收起窗口'],['size','最大化窗口'],['close','关闭窗口']].forEach(([key,label])=>{
    const button=document.createElement('button');button.id='net-window-'+key;button.className='task-window-control';button.setAttribute('aria-label',label);motionElement.append(button);buttons[key]=button;
  });
  surface.append(motionElement);windowHost.append(surface);
  const art=mountSvgWindow(source.contentDocument,'#net',motionElement,buttons,'FCA NET',{alignLeft:false});
  netWindow={surface,motionElement,art,interaction:initializeNetSearch(art.svg,{onWaitInterrupted:async()=>{
    await closeWindow('browser');
    openModule(shortcuts.get('mailbox'));
    survivorStory?.screeningInterrupted();
  },onWaitComplete:()=>endings.showTransmission()})};
  buttons.minimize.addEventListener('click',()=>{if(activeModule==='browser'&&!closingModule)minimizeWindow()});
  buttons.close.addEventListener('click',()=>closeWindow('browser'));return true;
}

function initializeDocumentsArtwork() {
  if (documentsArtwork) return true;
  if (!documentsSource.contentDocument?.querySelector('#_文档管理')) return false;
  documentsPage = document.createElement('section');
  documentsPage.id = 'dashboard-documents';
  documentsPage.className = 'dashboard-svg-window';
  documentsPage.hidden = true;
  documentsPage.setAttribute('role', 'dialog');
  documentsPage.setAttribute('aria-label', 'FCA文档管理');
  documentsSurface = document.createElement('div');
  documentsSurface.id = 'documents-window-surface';
  documentsSurface.className = 'desktop-svg-surface';
  const buttons = {};
  [['minimize', '收起文档窗口'], ['size', '窗口大小固定'], ['close', '关闭文档窗口']].forEach(([action, label]) => {
    const button = document.createElement('button');
    button.id = 'documents-window-' + action;
    button.className = 'task-window-control';
    button.setAttribute('aria-label', label);
    button.title = label;
    documentsSurface.append(button);
    buttons[action] = button;
  });
  documentsPage.append(documentsSurface);
  windowHost.append(documentsPage);
  documentsArtwork = mountSvgWindow(documentsSource.contentDocument, '#_文档管理', documentsSurface, buttons, 'DOCUMENT：Collected Clues');
  documentsInteraction = initializeDocumentsFiles(documentsArtwork.svg, { getReportArtwork: number => submittedReports.get(number) });
  buttons.minimize.addEventListener('click', () => {
    if (activeModule === 'documents' && !closingModule) minimizeWindow();
  });
  buttons.close.addEventListener('click', () => closeWindow('documents'));
  return true;
}

function layoutSvgControls(art) {
  const [originX, originY, width, height] = art.bounds;
  // display:none内的路径返回零边界，因此只在窗口已经显示后测量。
  const header = art.headerShape.getBBox();
  art.icons.forEach((icon, button) => {
    const box = icon.getBBox();
    button.style.left = ((box.x - originX - 8) / width * 100) + '%';
    const hitHeight = Math.max(box.height + 12, header.height * .55);
    button.style.top = ((box.y - originY + box.height / 2 - hitHeight / 2) / height * 100) + '%';
    button.style.width = ((box.width + 16) / width * 100) + '%';
    button.style.height = (hitHeight / height * 100) + '%';
  });
  const firstControl = art.icons.get(art.buttons.minimize).getBBox();
  art.dragHandle.style.left = ((header.x - originX) / width * 100) + '%';
  art.dragHandle.style.top = ((header.y - originY) / height * 100) + '%';
  art.dragHandle.style.width = ((firstControl.x - 12 - header.x) / width * 100) + '%';
  art.dragHandle.style.height = (header.height / height * 100) + '%';
}

function initializeNotesArtwork() {
  if (notesArtwork) return true;
  if (!notesSource.contentDocument?.querySelector('#_备忘录')) return false;
  notesPage = document.createElement('section');
  notesPage.id = 'dashboard-notes';
  notesPage.className = 'dashboard-svg-window';
  notesPage.hidden = true;
  notesPage.setAttribute('role', 'dialog');
  notesPage.setAttribute('aria-label', 'FCA便签');
  notesSurface = document.createElement('div');
  notesSurface.id = 'notes-window-surface';
  notesSurface.className = 'desktop-svg-surface';
  const buttons = {};
  [['minimize', '收起便签'], ['size', '窗口大小固定'], ['close', '关闭便签']].forEach(([action, label]) => {
    const button = document.createElement('button');
    button.id = 'notes-window-' + action;
    button.className = 'task-window-control';
    button.setAttribute('aria-label', label);
    button.title = label;
    notesSurface.append(button);
    buttons[action] = button;
  });
  notesPage.append(notesSurface);
  windowHost.append(notesPage);
  notesArtwork = mountSvgWindow(notesSource.contentDocument, '#_备忘录', notesSurface, buttons, 'NOTES：自动保存便签', {
    frameId: 'outer-frame', headerId: 'header', alignLeft: false,
    lockSelector: 'path[d^="M385.53"]', controlsSelector: 'path[d^="M447.16"]'
  });
  initializeNotesEditor(notesArtwork.svg, notesSurface);
  buttons.minimize.addEventListener('click', () => {
    if (activeModule === 'note' && !closingModule) minimizeWindow();
  });
  buttons.close.addEventListener('click', () => closeWindow('note'));
  return true;
}

function initializeInvestigationArtwork() {
  if (investigationArtwork) return true;
  if (!investigationSource.contentDocument?.querySelector('#_线索1')) return false;
  if (!draftReportSource.contentDocument?.querySelector('#_线索1')) return false;
  investigationPage = document.createElement('section');
  investigationPage.id = 'dashboard-investigation';
  investigationPage.dataset.module = 'investigation';
  investigationPage.className = 'dashboard-svg-window';
  investigationPage.hidden = true;
  investigationPage.setAttribute('role', 'dialog');
  investigationPage.setAttribute('aria-label', 'FILE 1调查证据');
  investigationSurface = document.createElement('div');
  investigationSurface.id = 'investigation-window-surface';
  investigationSurface.className = 'desktop-svg-surface';
  const buttons = {};
  [['minimize', '收起调查文件'], ['size', '窗口大小固定'], ['close', '关闭调查文件']].forEach(([action, label]) => {
    const button = document.createElement('button');
    button.id = 'investigation-window-' + action;
    button.className = 'task-window-control';
    button.setAttribute('aria-label', label);
    button.title = label;
    investigationSurface.append(button);
    buttons[action] = button;
  });
  investigationPage.append(investigationSurface);
  windowHost.append(investigationPage);
  investigationArtwork = mountSvgWindow(investigationSource.contentDocument, '#_线索1', investigationSurface, buttons, 'FILE 1：Investigation Evidence', { alignLeft: false });
  const draftButton = artwork(draftReportSource.contentDocument, [draftReportSource.contentDocument.querySelector('#_线索1')], [0, 0, 168.62, 42.09]);
  draftButton.removeAttribute('aria-hidden');
  useLocalFonts(draftButton);
  investigationInteraction = initializeInvestigation(investigationArtwork.svg, {
    onUnlocked: playOpenSound, draftButton, onDraftReport: openReportDraft
  });
  buttons.minimize.addEventListener('click', () => {
    if (activeModule === 'investigation' && !closingModule) minimizeWindow();
  });
  buttons.close.addEventListener('click', () => closeWindow('investigation'));
  return true;
}

async function openReportDraft(number = 1, savedCharacters) {
  if (closingModule) return;
  const reportObject = number === 2 ? reportTwoSource : reportSource;
  const ownerPage = number === 2 ? investigationTwo.surface : investigationPage;
  const ownerSurface = number === 2 ? investigationTwo.motionElement : investigationSurface;
  let reportDraft = reportDrafts.get(number);
  if (!reportDraft) {
    await waitForArtwork(reportObject, '#_文档管理');
    if (ownerPage.hidden && savedCharacters === undefined) return;
    const document = reportObject.contentDocument;
    const svg = artwork(document, [document.querySelector('#_文档管理'), document.querySelector('#_线索1')], [0, 0, 781.27, 721.28]);
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Draft investigation report');
    useLocalFonts(svg);
    const overlay = window.document.createElement('div');
    overlay.className = 'investigation-report-overlay';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Investigation report');
    overlay.append(svg);
    ownerSurface.append(overlay);
    const editor = initializeReportDraft(svg, { number, onSubmit: submitInvestigationReport });
    if (submittedReports.has(number)) editor.restoreSubmitted();
    reportDraft = { overlay, editor };
    reportDrafts.set(number, reportDraft);
    playOpenSound();
  }
  reportDraft.overlay.hidden = false;
  if (savedCharacters !== undefined) {
    reportDraft.editor.restore(savedCharacters);
    return;
  }
  reportDraft.editor.focus();
}

function archiveReport(number) {
  const reportObject = number === 1 ? reportSource : number === 2 ? reportTwoSource : recordThreeSource;
  const reportDocument = reportObject.contentDocument;
  const elements = [reportDocument.querySelector('#_文档管理')];
  if (number !== 3) elements.push(reportDocument.querySelector('#_线索1'));
  const archived = artwork(reportDocument, elements, [0,0,781.27,721.28]);
  if (number !== 3) archived.querySelector('[id$="-_线索1"]').firstElementChild.remove();
  archived.removeAttribute('aria-hidden');
  useLocalFonts(archived);
  submittedReports.set(number, archived);
  documentsInteraction?.refresh();
}

async function submitInvestigationReport(report) {
  const number = report.number || 1;
  if (!mailDialogue.submitReport(report)) return;
  archiveReport(number);
  await closeWindow(number === 2 ? 'investigation2' : 'investigation');
  openModule(shortcuts.get('mailbox'));
}

function initializeSecondInvestigationArtwork() {
  if (investigationTwo) return true;
  if (!investigationTwoSource.contentDocument?.querySelector('#_线索1')) return false;
  if (!evaluateSource.contentDocument?.querySelector('#_线索1') || !draftReportSource.contentDocument?.querySelector('#_线索1')) return false;
  const surface = document.createElement('section');
  surface.id = 'dashboard-investigation2';
  surface.dataset.module = 'investigation2';
  surface.className = 'dashboard-svg-window';
  surface.hidden = true;
  surface.setAttribute('role', 'dialog');
  surface.setAttribute('aria-label', 'FILE 2面部分析');
  const motionElement = document.createElement('div');
  motionElement.id = 'investigation2-window-surface';
  motionElement.className = 'desktop-svg-surface';
  const buttons = {};
  [['minimize', '收起调查文件'], ['size', '窗口大小固定'], ['close', '关闭调查文件']].forEach(([action, label]) => {
    const button = document.createElement('button');
    button.id = 'investigation2-window-' + action;
    button.className = 'task-window-control';
    button.setAttribute('aria-label', label);
    button.title = label;
    motionElement.append(button);
    buttons[action] = button;
  });
  surface.append(motionElement);
  windowHost.append(surface);
  const art = mountSvgWindow(investigationTwoSource.contentDocument, '#_线索1', motionElement, buttons, 'FILE 2：Preliminary Facial Analysis', { alignLeft: false });
  const evaluateButton = artwork(evaluateSource.contentDocument, [evaluateSource.contentDocument.querySelector('#_线索1')], [0,0,116.82,28.86]);
  const draftButton = artwork(draftReportSource.contentDocument, [draftReportSource.contentDocument.querySelector('#_线索1')], [0,0,168.62,42.09]);
  [evaluateButton,draftButton].forEach(button=>{button.removeAttribute('aria-hidden');useLocalFonts(button)});
  const interaction = initializeFacialAnalysis(art.svg, {
    evaluateButton, draftButton, onReveal: playOpenSound, onDraftReport: () => openReportDraft(2)
  });
  investigationTwo = { surface, motionElement, art, interaction };
  buttons.minimize.addEventListener('click', () => {
    if (activeModule === 'investigation2' && !closingModule) minimizeWindow();
  });
  buttons.close.addEventListener('click', () => closeWindow('investigation2'));
  return true;
}

function initializeFileThreeArtwork(key) {
  if(fileThreeWindows.has(key))return fileThreeWindows.get(key);
  const source=document.querySelector(`#file3-${key}-source`);
  if(!source.contentDocument?.querySelector('#file3-root'))return null;
  const id=key==='overview'?'investigation3':`file3-${key}`;
  const label=key==='overview'?'FILE 3':['restricted','contact'].includes(key)?'???':key[0].toUpperCase()+key.slice(1);
  const surface=document.createElement('section');
  surface.id='dashboard-'+id;
  surface.dataset.module=id;
  surface.className='dashboard-svg-window';
  surface.hidden=true;
  surface.setAttribute('role','dialog');
  surface.setAttribute('aria-label',label);
  const motionElement=document.createElement('div');
  motionElement.id=id+'-window-surface';
  motionElement.className='desktop-svg-surface case-file-surface';
  const buttons={};
  [['minimize','收起窗口'],['size','最大化窗口'],['close','关闭窗口']].forEach(([action,name])=>{
    const button=document.createElement('button');
    button.id=id+'-window-'+action;
    button.className='task-window-control';
    button.setAttribute('aria-label',name);button.title=name;
    motionElement.append(button);buttons[action]=button;
  });
  surface.append(motionElement);windowHost.append(surface);
  const art=mountSvgWindow(source.contentDocument,'#file3-root',motionElement,buttons,label,{alignLeft:false});
  motionElement.style.setProperty('--case-window-height',(art.bounds[3]/987.62*100)+'%');
  const interaction=key==='overview'?initializeFileThreeFolders(art.svg,{onOpenFolder:openFileThreeFolder,onReveal:playOpenSound}):key==='restricted'?initializeRestrictedFolder(art.svg,{onUnlocked:openSurvivorContactClue}):null;
  const state={surface,motionElement,art,interaction};
  fileThreeWindows.set(key,state);
  buttons.minimize.addEventListener('click',()=>{if(activeModule===id&&!closingModule)minimizeWindow()});
  buttons.close.addEventListener('click',()=>closeWindow(id));
  return state;
}

async function openFileThreeFolder(key='overview') {
  if(closingModule)return;
  if(!restoring&&key==='restricted'&&!fileThreeWindows.get('overview')?.interaction.isRestrictedVisible())return;
  if(key==='restricted'&&survivorClueUnlocked)key='contact';
  const source=document.querySelector(`#file3-${key}-source`);
  if(!source)return;
  await waitForArtwork(source,'#file3-root');
  if(!fileThreeModules.has(key)){
    const label=key==='overview'?'FILE 3':['restricted','contact'].includes(key)?'???':key[0].toUpperCase()+key.slice(1);
    fileThreeModules.set(key,{...shortcuts.get('mailbox'),id:key==='overview'?'investigation3':`file3-${key}`,desktopId:'mailbox',fileThreeKey:key,label,title:label});
  }
  const module=fileThreeModules.get(key);
  openModule(module);
  if(openWindows.has(module.id)&&['alpha','beta','gamma','delta'].includes(key))fileThreeWindows.get('overview')?.interaction.markViewed(key);
}

async function openSurvivorContactClue(){
  if(survivorClueUnlocked)return;
  survivorClueUnlocked=true;mailContacts?.refresh();
  await waitForArtwork(recordThreeSource,'#_文档管理');
  archiveReport(3);
  await closeWindow('file3-restricted');
  await openFileThreeFolder('contact');
}

function createTaskProjection(svg, outline) {
  const [, , width, height] = svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  const random = (min, max) => min + Math.random() * (max - min);
  const defs = svg.querySelector('defs');
  const prefix = `${svg.id}-projection`;
  function node(tag, attributes, parent = defs) {
    const element = window.document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.append(element);
    return element;
  }
  const original = svg.children[1];
  original.id = `${prefix}-content`;
  // 保留真实DOM节点而非use影子树，确保AI导出字体/颜色的限定样式继续生效。
  const sliceCopy = original.cloneNode(true);
  sliceCopy.querySelectorAll('[id]').forEach(element => { element.id += '-slice'; });
  sliceCopy.id = `${prefix}-slice-copy`;
  const boundary = node('clipPath', { id: `${prefix}-boundary`, clipPathUnits: 'userSpaceOnUse' });
  node('path', { d: outline }, boundary);
  const mask = node('mask', { id: `${prefix}-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, 'mask-type': 'luminance' });
  node('rect', { width, height, fill: 'white' }, mask);
  const hole = node('rect', { width: 0, height: 0, fill: 'black' }, mask);
  const sliceClip = node('clipPath', { id: `${prefix}-slice`, clipPathUnits: 'userSpaceOnUse' });
  const slice = node('rect', { width: 0, height: 0 }, sliceClip);
  const base = node('g', { mask: `url(#${mask.id})` }, svg);
  base.append(original);
  const driftRegion = node('g', { 'clip-path': `url(#${sliceClip.id})` }, svg);
  const drift = sliceCopy;
  driftRegion.append(drift);
  // 位移时先擦除原位置，再显示同一份矢量切片；不会产生重影或移动整个界面。
  const overlays = node('g', { 'clip-path': `url(#${boundary.id})`, 'pointer-events': 'none' }, svg);
  const scanlines = node('pattern', { id: `${prefix}-lines`, width: 1, height: 6, patternUnits: 'userSpaceOnUse' });
  node('rect', { width: 1, height: 0.7, fill: 'black', opacity: 0.018 }, scanlines);
  node('rect', { width, height, fill: `url(#${scanlines.id})` }, overlays);
  // 噪声只渲染64单位的小瓦片后重复铺设，避免全屏湍流滤镜拖慢短暂干扰。
  const grainFilter = node('filter', { id: `${prefix}-grain`, x: 0, y: 0, width: 64, height: 64, filterUnits: 'userSpaceOnUse' });
  const grain = node('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.8, numOctaves: 1, seed: 12, stitchTiles: 'stitch' }, grainFilter);
  node('feColorMatrix', { type: 'saturate', values: 0 }, grainFilter);
  const grainPattern = node('pattern', { id: `${prefix}-grain-tile`, width: 64, height: 64, patternUnits: 'userSpaceOnUse' });
  node('rect', { width: 64, height: 64, filter: `url(#${grainFilter.id})` }, grainPattern);
  node('rect', { width, height, fill: `url(#${grainPattern.id})`, opacity: 0.006, style: 'mix-blend-mode:soft-light' }, overlays);
  const gradient = node('linearGradient', { id: `${prefix}-refresh`, x1: 0, y1: 0, x2: 0, y2: 1 });
  [0, 0.25, 0.5, 0.75, 1].forEach((offset, index) => {
    node('stop', { offset, 'stop-color': 'white', 'stop-opacity': [0, 0.008, 0.014, 0.008, 0][index] }, gradient);
  });
  const refresh = node('rect', { x: 0, y: -130, width, height: 120, fill: `url(#${gradient.id})` }, overlays);
  let lastFrame = 0;
  let nextSignal = 0;
  let signalUntil = 0;
  let nextBreath = 0;
  let targetOpacity = 1;
  let opacity = 1;
  let targetBrightness = 1;
  let brightness = 1;
  let refreshStart = 0;
  let refreshDuration = 16;
  function reset() {
    const time = performance.now() / 1000;
    nextSignal = time + random(4, 8);
    signalUntil = 0;
    nextBreath = time + random(1.5, 4);
    targetOpacity = opacity = targetBrightness = brightness = 1;
    refreshStart = time + random(2, 4);
    refreshDuration = random(12, 19);
    [hole, slice].forEach(rect => rect.setAttribute('width', '0'));
    refresh.setAttribute('y', '-130');
    svg.style.opacity = '1';
    svg.style.filter = 'brightness(1)';
    lastFrame = time;
  }
  reset();
  return {
    reset,
    render(time) {
      if (time - lastFrame < 1 / 24) return;
      const delta = Math.min(time - lastFrame, 0.1);
      lastFrame = time;
      if (time > nextBreath) {
        targetOpacity = random(0.991, 1);
        targetBrightness = random(0.997, 1.004);
        nextBreath = time + random(1.5, 4.5);
      }
      const ease = 1 - Math.exp(-delta * 2);
      opacity += (targetOpacity - opacity) * ease;
      brightness += (targetBrightness - brightness) * ease;
      svg.style.opacity = opacity.toFixed(4);
      svg.style.filter = `brightness(${brightness.toFixed(4)})`;
      if (time > nextSignal) {
        nextSignal = time + random(4, 8);
        signalUntil = time + random(0.05, 0.12);
        const unitsPerPixel = width / svg.getBoundingClientRect().width;
        const bounds = { x: random(width * .035, width * .56), y: random(height * .11, height * .89), width: random(width * .14, width * .32), height: random(2, 4) * unitsPerPixel };
        [hole, slice].forEach(rect => Object.entries(bounds).forEach(([key, value]) => rect.setAttribute(key, String(value))));
        drift.setAttribute('transform', `translate(${random(1, 3) * unitsPerPixel * (Math.random() < 0.5 ? -1 : 1)} 0)`);
        grain.setAttribute('seed', String(Math.floor(random(1, 100))));
      }
      if (time >= signalUntil) [hole, slice].forEach(rect => rect.setAttribute('width', '0'));
      const progress = (time - refreshStart) / refreshDuration;
      refresh.setAttribute('y', String(-130 + Math.max(0, Math.min(progress, 1)) * (height + 260)));
      if (progress > 1) {
        refreshStart = time + random(2, 5);
        refreshDuration = random(12, 19);
      }
    }
  };
}

function findArt(svg, id) {
  return svg.querySelector('[id="' + svg.id + '-' + id + '"]');
}

function useLocalFonts(svg) {
  // 从素材本身的字体判断，不依赖每次AI导出都会变化的cls编号。
  // 归档副本和内嵌按钮可能尚未挂入DOM，先改样式声明以确保仍使用本地字体。
  svg.querySelectorAll('style').forEach(style => {
    style.textContent = style.textContent.replace(/font-family:\s*AgencyFB[^;]+;/g, "font-family: 'FCA Agency', 'Agency FB', sans-serif;");
  });
  svg.querySelectorAll('text, tspan').forEach(text => {
    if (getComputedStyle(text).fontFamily.includes('Agency')) {
      text.style.fontFamily = "'FCA Agency', 'Agency FB', sans-serif";
    }
  });
}

function bindButton(element, label, activate) {
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', activate);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) activate();
    }
  });
  element.addEventListener('pointerdown', event => {
    if (event.button === 0) element.classList.add('is-pressed');
  });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(type => {
    element.addEventListener(type, () => element.classList.remove('is-pressed'));
  });
}

function addHitArea(group, box) {
  const hit = document.createElementNS(SVG_NS, 'rect');
  Object.entries({
    x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8,
    fill: 'transparent', 'pointer-events': 'all'
  }).forEach(([key, value]) => hit.setAttribute(key, String(value)));
  group.append(hit);
}

function createWelcomeTyping(svg, panel, onComplete) {
  const defs = svg.querySelector('defs');
  const lines = [...panel.querySelectorAll('text')].map((text, index) => {
    const box = text.getBBox();
    const count = text.getNumberOfChars();
    // 原文字、tspan、字距和坐标全部保留；只按字形边界逐字揭开。
    const edges = Array.from({ length: count }, (_, i) => {
      const glyph = text.getExtentOfChar(i);
      return glyph.x + glyph.width;
    });
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.id = svg.id + '-welcome-line-' + index;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const reveal = document.createElementNS(SVG_NS, 'rect');
    Object.entries({ x: box.x - 2, y: box.y - 3, width: 0, height: box.height + 6 })
      .forEach(([key, value]) => reveal.setAttribute(key, String(value)));
    clip.append(reveal);
    defs.append(clip);
    text.setAttribute('clip-path', 'url(#' + clip.id + ')');
    text.classList.add('dashboard-welcome-line');
    text.dataset.visibleCharacters = '0';
    text.dataset.typewriterState = 'waiting';
    return { text, clip, reveal, box, count, edges, revealed: 0 };
  });
  let started = false;
  let currentLine = 0;
  let nextCharacter = Infinity;
  let completedAt = Infinity;
  let completionNotified = false;
  const complete = line => {
    line.text.removeAttribute('clip-path');
    line.clip.remove();
    line.text.dataset.visibleCharacters = String(line.count);
    line.text.dataset.typewriterState = 'complete';
  };
  return {
    dispose() {
      completionNotified = true;
      setTypingSound('assistant', false);
      lines.forEach(line => { line.text.removeAttribute('clip-path'); line.clip.remove(); });
    },
    start() {
      if (started) return;
      started = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        lines.forEach(complete);
        currentLine = lines.length;
        completedAt = performance.now();
      } else nextCharacter = performance.now() + 140;
    },
    render(now) {
      if (!started) return;
      if (currentLine >= lines.length) {
        if (onComplete && !completionNotified && now >= completedAt + 900) {
          completionNotified = true;
          onComplete();
        }
        return;
      }
      if (now < nextCharacter) return;
      const line = lines[currentLine];
      line.revealed++;
      setTypingSound('assistant', true);
      line.text.dataset.typewriterState = 'typing';
      line.text.dataset.visibleCharacters = String(line.revealed);
      line.reveal.setAttribute('width', String(Math.max(0, line.edges[line.revealed - 1] - line.box.x + 3)));
      nextCharacter = now + 45 + Math.random() * 25;
      if (line.revealed >= line.count) {
        complete(line);
        setTypingSound('assistant', false);
        currentLine++;
        if (currentLine === lines.length) completedAt = now;
        nextCharacter = now + 260;
      }
    }
  };
}

function initializeTaskbar(svg) {
  taskbarGroup = findArt(svg, 'Taskbar');
  const text = [...taskbarGroup.querySelectorAll('text')];
  desktopClock = {
    date: text.at(-2).querySelector('tspan'),
    time: text.at(-1).querySelector('tspan')
  };
  // Reuse the original tab outline in a horizontally extensible viewport.
  const frames = [...taskbarGroup.children].filter(element => {
    if (element.localName !== 'path') return false;
    const box = element.getBBox();
    return Math.abs(box.height - 31.15) < 0.1 && box.width > 100 && box.width < 105;
  });
  if (!frames.length) throw new Error('资源24任务栏缺少窗口槽位');
  taskbarBounds=frames[0].getBBox();taskbarFrame=frames[0].cloneNode(true);
  taskbarStride=frames.length>1?frames[1].getBBox().x-taskbarBounds.x:taskbarBounds.width+20;
  const clockText=desktopClock.date.parentElement,clockBox=clockText.getBBox();
  const clockLeft=new DOMPoint(clockBox.x,clockBox.y).matrixTransform(clockText.transform.baseVal.consolidate()?.matrix||new DOMMatrix()).x;
  taskbarWidth=clockLeft-40-taskbarBounds.x;
  frames.forEach(frame=>frame.remove());
  taskbarViewport=document.createElementNS(SVG_NS,'svg');
  Object.entries({x:taskbarBounds.x-5,y:taskbarBounds.y-6,width:taskbarWidth+10,height:taskbarBounds.height+12,overflow:'hidden','aria-label':'已打开的窗口'}).forEach(([key,value])=>taskbarViewport.setAttribute(key,value));
  taskbarGroup.append(taskbarViewport);
  const scrollTabs = direction => {
    const last = Math.max(0, (openWindows.size-1)*taskbarStride+taskbarBounds.width-taskbarWidth);
    taskbarStart = Math.max(0, Math.min(last, taskbarStart + direction*taskbarStride));
    updateTaskbar();
  };
  taskbarViewport.addEventListener('wheel', event => {
    if (!(event.deltaY || event.deltaX)) return;
    event.preventDefault();scrollTabs(Math.sign(event.deltaY || event.deltaX));
  }, { passive: false });
  taskbarViewport.addEventListener('keydown', event => {
    if (event.key !== 'PageDown' && event.key !== 'PageUp') return;
    event.preventDefault();scrollTabs(event.key === 'PageDown' ? 1 : -1);
  });
  updateClock();
  updateTaskbar();
}

function createTaskbarSlot(){
    const box = taskbarBounds,frame=taskbarFrame.cloneNode(true);
    const button = document.createElementNS(SVG_NS, 'g');
    taskbarViewport.append(button);button.append(frame);
    button.classList.add('dashboard-taskbar-button');
    const label = document.createElementNS(SVG_NS, 'text');
    Object.entries({ x: box.x + box.width / 2, y: box.y + 21, 'text-anchor': 'middle' })
      .forEach(([key, value]) => label.setAttribute(key, String(value)));
    label.classList.add('dashboard-taskbar-label');
    button.append(label);
    addHitArea(button, box);
    const title = document.createElementNS(SVG_NS, 'title');
    button.append(title);
    const slot = { button, label, title, module: null };
    button.addEventListener('focus',()=>{if(slot.module)updateTaskbar(slot.module.id)});
    bindButton(button, '窗口', () => {
      if (!slot.module || closingModule) return;
      if (activeModule === slot.module.id) minimizeWindow();
      else openModule(slot.module);
    });
    taskbarSlots.push(slot);
}

function initializeArtwork() {
  if (ready || page.hidden) return;
  const svgDocument = source.contentDocument;
  const content = svgDocument?.querySelector('#_001');
  if (!content?.querySelector('#Shortcut_Tasks')) return;
  const viewBox = svgDocument.documentElement.viewBox.baseVal;
  const bounds = [viewBox.x, viewBox.y, viewBox.width, viewBox.height];
  const svg = artwork(svgDocument, [content], bounds);
  svg.removeAttribute('aria-hidden');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'FCA系统桌面');
  // 同一份新稿的任务栏独立置于窗口上方，原路径不缩放、不重新排版。
  findArt(svg, 'Taskbar').remove();
  document.querySelector('#dashboard-desktop-surface').append(svg);
  const taskbarSvg = artwork(svgDocument, [svgDocument.querySelector('#Taskbar')], bounds);
  taskbarSvg.removeAttribute('aria-hidden');
  taskbarSvg.setAttribute('role', 'group');
  taskbarSvg.setAttribute('aria-label', '系统任务栏');
  document.querySelector('#dashboard-taskbar-surface').append(taskbarSvg);
  useLocalFonts(svg);
  useLocalFonts(taskbarSvg);

  modules.forEach(([sourceId, id, label, title]) => {
    const button = findArt(svg, sourceId);
    const box = button.getBBox();
    const bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
    addHitArea(button, bounds);
    button.classList.add('dashboard-desktop-shortcut');
    button.dataset.module = id;
    const module = { button, id, label, title, bounds };
    shortcuts.set(id, module);
    bindButton(button, label, () => openModule(module));
    if (id === 'computer') {
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'fca-ending-net-menu');
    }
    button.addEventListener('pointerenter', () => {
      page.dataset.hoveredModule = id;
      selectDesktopModule(module, true);
    });
    button.addEventListener('pointerleave', () => {
      if (page.dataset.hoveredModule !== id) return;
      delete page.dataset.hoveredModule;
      // 离开后停留在最后悬停的位置，不回弹到已选中的图标。
    });
  });
  // 资源24最后一个完整组就是原投影机器人，只给该组增加小幅位移。
  const robot = findArt(svg, '_001').lastElementChild;
  robot.classList.add('dashboard-projection-robot');
  robot.setAttribute('aria-label', 'FCA投影助手');
  initializeDesktopSelection(svg);
  welcomeSvg = svg;
  welcomePanel = findArt(svg, 'Welcome_Panel');
  setWelcomeContent(welcomeLines, false, afterWelcomeLines);
  initializeTaskbar(taskbarSvg);
  sessionMenu = initializeSessionMenu(page, { loadArtwork: loadSessionMenuArtwork });
  const computerIcon = findArt(svg, 'Shortcut_This_PC').firstElementChild.getBBox();
  const menuIcon = artwork(svgDocument, [svgDocument.querySelector('#Shortcut_This_PC > g')], [
    computerIcon.x - 2, computerIcon.y - 2, computerIcon.width + 4, computerIcon.height + 4
  ]);
  endings=initializeEndings({page,menuIcon,createArtwork:doc=>{
    const box=doc.documentElement.viewBox.baseVal;
    const svg=artwork(doc,[doc.querySelector('#_final')],[box.x,box.y,box.width,box.height]);useLocalFonts(svg);return svg;
  },sessionMenu,onStart:()=>{welcomeTyping?.dispose();mailDialogue?.pause();survivorStory?.pause();setTypingSound('player',false)}});
  ready = true;
}

async function loadSessionMenuArtwork() {
  const source = document.querySelector('#session-control-source');
  await waitForArtwork(source, '[data-session-art="continue"]');
  const sessionDocument = source.contentDocument;
  const root = sessionDocument.documentElement;
  const { x, y, width, height } = root.viewBox.baseVal;
  const panel = artwork(sessionDocument, root.querySelectorAll(':scope > g'), [x, y, width, height]);
  useLocalFonts(panel);
  findArt(panel, 'network-search-heading').style.fontFamily = "'FCA Consolas', Consolas, monospace";
  return panel;
}

function setWelcomeContent(lines, start = true, nextLines = null) {
  welcomeTyping?.dispose();
  welcomePanel.querySelectorAll('text').forEach((text, index) => {
    const span = text.querySelector('tspan');
    const content = lines[index] ?? '';
    text.replaceChildren(span);
    span.textContent = content;
    span.removeAttribute('class');
    text.style.fontFamily = span.style.fontFamily = "'FCA Consolas', monospace";
    text.style.fontWeight = '700';
    text.style.fontStyle = 'normal';
  });
  welcomeTyping = createWelcomeTyping(welcomeSvg, welcomePanel, nextLines ? () => setWelcomeContent(nextLines) : null);
  if (start) welcomeTyping.start();
}

function initializeDesktopSelection(svg) {
  const root = findArt(svg, '_001');
  // 原稿TASKS外框是独立的五图元组：一个折角多边形和四条橙色角线。
  const frame = [...root.children].find(group => group.localName === 'g'
    && group.querySelector(':scope > polygon')
    && group.querySelectorAll(':scope > line').length === 4
    && group.children.length === 5);
  if (!frame) throw new Error('资源24缺少桌面选中框图层');
  const box = frame.getBBox();
  frame.classList.add('dashboard-selection-frame');
  frame.setAttribute('aria-hidden', 'true');
  desktopSelection = {
    frame,
    bounds: { x: box.x, y: box.y, width: box.width, height: box.height },
    origin: shortcuts.get('task').bounds
  };
  selectDesktopModule(shortcuts.get('task'));
}

function selectDesktopModule(module, preview = false) {
  if (!desktopSelection) return;
  const { frame, bounds, origin } = desktopSelection;
  const target = module.bounds;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const dx = target.x + target.width / 2 - origin.x - origin.width / 2;
  const dy = target.y + target.height / 2 - origin.y - origin.height / 2;
  // 沿用同一原框移动，仅在图标较宽/高时适量撑开，避免压住文字或图形。
  const scaleX = Math.max(1, (target.width + 20) / bounds.width);
  const scaleY = Math.max(1, (target.height + 20) / bounds.height);
  const x = centerX + dx - centerX * scaleX;
  const y = centerY + dy - centerY * scaleY;
  frame.style.transform = 'matrix(' + [scaleX, 0, 0, scaleY, x, y].join(',') + ')';
  if (!preview) {
    const desktopId = module.desktopId || module.id;
    shortcuts.forEach(shortcut => shortcut.button.setAttribute('aria-pressed', String(shortcut.id === desktopId)));
    page.dataset.selectedModule = desktopId;
  }
}

function updateTaskbar(ensureVisibleId = null) {
  const windows = [...openWindows.values()];
  while(taskbarSlots.length<windows.length)createTaskbarSlot();
  while(taskbarSlots.length>windows.length)taskbarSlots.pop().button.remove();
  windowHost.classList.toggle('has-maximized-window', windows.some(state => state.maximized && !state.surface.hidden));
  if (ensureVisibleId) {
    const index = windows.findIndex(item => item.module.id === ensureVisibleId);
    const left=index*taskbarStride,right=left+taskbarBounds.width;
    if(left<taskbarStart)taskbarStart=left;
    else if(right>taskbarStart+taskbarWidth)taskbarStart=right-taskbarWidth;
  }
  taskbarStart = Math.max(0, Math.min(taskbarStart, (windows.length-1)*taskbarStride+taskbarBounds.width-taskbarWidth));
  taskbarViewport.setAttribute('viewBox',`${taskbarBounds.x-5+taskbarStart} ${taskbarBounds.y-6} ${taskbarWidth+10} ${taskbarBounds.height+12}`);
  taskbarSlots.forEach((slot, index) => {
    const state = windows[index];
    slot.button.setAttribute('transform',`translate(${index*taskbarStride} 0)`);
    slot.module = state?.module || null;
    if (!state) {
      slot.button.setAttribute('hidden', '');
      slot.button.removeAttribute('data-module');
      slot.button.classList.remove('is-active', 'is-pressed');
      slot.button.setAttribute('aria-pressed', 'false');
      slot.label.textContent = '';
      return;
    }
    const active = activeModule === state.module.id;
    slot.button.removeAttribute('hidden');
    slot.button.dataset.module = state.module.id;
    slot.button.classList.toggle('is-active', active);
    slot.button.querySelector('path').style.stroke = active ? '#ee842b' : '#65523c';
    slot.button.setAttribute('aria-pressed', String(active));
    slot.button.setAttribute('aria-label', state.module.label + (active ? '，点击收起窗口' : '，点击恢复窗口'));
    slot.label.textContent = state.module.title;
    slot.label.style.fill = active ? '#ee842b' : '#d9c7ad';
    slot.title.textContent = state.module.label + (windows.length*taskbarStride>taskbarWidth ? '；滚轮或PageUp/PageDown横向查看标签' : '');
  });
  page.dataset.openWindows = String(openWindows.size);
  page.dataset.activeModule = activeModule || '';
}

function raiseWindow(state) {
  if (closingModule || state.surface.hidden) return;
  activeModule = state.module.id;
  state.order = ++windowOrder;
  state.surface.style.zIndex = String(state.order);
  selectDesktopModule(state.module);
  updateTaskbar(state.module.id);
  if(state.module.fileThreeKey)fileThreeWindows.get(state.module.fileThreeKey)?.interaction?.show();
  if(state.module.id==='mailbox')mailContacts?.refresh();
}

function toggleWindowLock(state) {
  windowDragging.cancel();
  applyWindowLock(state, !state.locked);
  state.motionElement.querySelector('.window-lock-status')?.remove();
  const notice = document.createElement('span');
  notice.className = 'window-lock-status';
  notice.setAttribute('role', 'status');
  notice.textContent = state.locked ? '位置已锁定' : '位置已解锁';
  state.motionElement.append(notice);
  window.setTimeout(() => notice.remove(), 1500);
}

function applyWindowLock(state, locked) {
  state.locked = locked;
  state.motionElement.classList.toggle('window-is-locked', state.locked);
  const button = state.art?.buttons.lock;
  if (button) {
    button.setAttribute('aria-pressed', String(state.locked));
    button.setAttribute('aria-label', state.locked ? '解除窗口位置锁定' : '锁定窗口位置');
    button.title = state.locked ? '已锁定位置，点击解锁' : '锁定窗口位置';
  }
}

function setWindowMaximized(state, maximized) {
  if (!state) return;
  windowDragging.cancel();
  state.maximized = maximized;
  state.surface.classList.toggle('window-is-maximized', maximized);
  const button = state.art?.buttons.size || state.surface.querySelector('[data-window-maximize]');
  button?.setAttribute('aria-pressed', String(maximized));
  button?.setAttribute('aria-label', maximized ? '还原窗口' : '最大化窗口');
  if (button) button.title = maximized ? '还原窗口' : '最大化窗口';
  windowDragging.apply(state);
  if (!state.surface.hidden && state.art) layoutSvgControls(state.art);
  updateTaskbar();
}

function activateTopVisible() {
  const top = [...openWindows.values()].filter(state => !state.surface.hidden).sort((a,b) => b.order-a.order)[0];
  activeModule = top?.module.id || null;
  updateTaskbar();
  if(top?.module.fileThreeKey)fileThreeWindows.get(top.module.fileThreeKey)?.interaction?.show();
  if(top?.module.id==='mailbox')mailContacts?.refresh();
}

function openModule(module) {
  if (closingModule || !ready) return;
  if (module.id === 'computer') {
    // The old example window may still be present in saves from before the menu.
    if (restoring || !sessionMenu.open(module.button)) return;
    playOpenSound();
    windowDragging.cancel();
    selectDesktopModule(module);
    setTypingSound('assistant', false);
    mailDialogue?.pause();
    survivorStory?.pause();
    investigationTwo?.interaction.pause();
    return;
  }
  selectDesktopModule(module);
  let state = openWindows.get(module.id);
  if (!state) {
    let surface;
    let motionElement;
    let art = null;
    let dragHandle;
    if (module.id === 'task') {
      if (!initializeTaskArtwork()) return;
      surface = taskPage;
      motionElement = taskSurface;
      art = taskArtwork;
      dragHandle = art.dragHandle;
    } else if (module.id === 'mailbox') {
      if (!initializeMailArtwork()) return;
      surface = mailPage;
      motionElement = mailSurface;
      art = mailArtwork;
      dragHandle = art.dragHandle;
    } else if (module.id === 'documents') {
      if (!initializeDocumentsArtwork()) return;
      surface = documentsPage;
      motionElement = documentsSurface;
      art = documentsArtwork;
      dragHandle = art.dragHandle;
    } else if(module.id==='browser'){
      if(!initializeNetArtwork())return;
      ({surface,motionElement,art}=netWindow);dragHandle=art.dragHandle;
    } else if (module.id === 'note') {
      if (!initializeNotesArtwork()) return;
      surface = notesPage;
      motionElement = notesSurface;
      art = notesArtwork;
      dragHandle = art.dragHandle;
    } else if (module.id === 'investigation') {
      if (!initializeInvestigationArtwork()) return;
      surface = investigationPage;
      motionElement = investigationSurface;
      art = investigationArtwork;
      dragHandle = art.dragHandle;
    } else if (module.id === 'investigation2') {
      if (!initializeSecondInvestigationArtwork()) return;
      ({ surface, motionElement, art } = investigationTwo);
      dragHandle = art.dragHandle;
    } else if (module.fileThreeKey) {
      const fileWindow=initializeFileThreeArtwork(module.fileThreeKey);
      if(!fileWindow)return;
      ({surface,motionElement,art}=fileWindow);
      dragHandle=art.dragHandle;
    } else {
      surface = exampleTemplate.content.firstElementChild.cloneNode(true);
      surface.dataset.module = module.id;
      surface.setAttribute('aria-label', module.label);
      surface.querySelector('.dashboard-example-title').textContent = module.label;
      surface.querySelector('.dashboard-example-window-title').textContent = module.title;
      surface.querySelector('.dashboard-return').addEventListener('click', () => closeWindow(module.id));
      surface.querySelector('[data-window-minimize]').addEventListener('click', minimizeWindow);
      surface.querySelector('[data-window-maximize]').onclick = () => {
        const current = openWindows.get(module.id);
        if (!closingModule) setWindowMaximized(current, !current.maximized);
      };
      surface.querySelector('[data-window-close]').addEventListener('click', () => closeWindow(module.id));
      windowHost.append(surface);
      motionElement = surface;
      dragHandle = surface.querySelector('[data-window-titlebar]');
    }
    state = { module, surface, motionElement, art, locked: false, maximized: false, order: 0, position: { x: 0, y: 0 } };
    openWindows.set(module.id, state);
    if (!surface.dataset.focusBound) {
      surface.dataset.focusBound = 'true';
      surface.addEventListener('pointerdown', () => {
        const current = openWindows.get(module.id);
        if (current) raiseWindow(current);
      }, { capture: true });
      surface.addEventListener('focusin', () => {
        const current = openWindows.get(module.id);
        if (current && activeModule !== module.id) raiseWindow(current);
      });
    }
    // SVG窗口在关闭后复用；事件处理器读取当前窗口状态，不保留过期状态。
    if (art) art.buttons.lock.onclick = () => toggleWindowLock(openWindows.get(module.id));
    if (art) art.buttons.size.onclick = () => {
      const current = openWindows.get(module.id);
      if (!closingModule) setWindowMaximized(current, !current.maximized);
    };
    windowDragging.bind(module.id, motionElement, dragHandle, module.label);
    playOpenSound();
  }
  windowDragging.cancel();
  activeModule = module.id;
  state.surface.hidden = false;
  raiseWindow(state);
  windowDragging.apply(state);
  if (state.art) {
    layoutSvgControls(state.art);
    if (module.id === 'task') taskProjection?.reset();
    if (module.id === 'note') state.motionElement.querySelector('.notes-editor').focus({ preventScroll: true });
    else if(module.id==='browser')netWindow.interaction.focus();
    else state.art.buttons.close.focus({ preventScroll: true });
  } else state.surface.querySelector('.dashboard-return').focus({ preventScroll: true });
  updateTaskbar(module.id);
}

function openInvestigationPreview(fileNumber = 1) {
  // 下载后的任务拥有独立窗口与任务栏项，不占用DOCUMENT文档管理器。
  if(fileNumber===3){openFileThreeFolder('overview');return}
  if (fileNumber === 2) {
    investigationTwoModule ||= { ...shortcuts.get('mailbox'), id: 'investigation2', desktopId: 'mailbox', label: '面部分析', title: 'FILE 2' };
    openModule(investigationTwoModule);
    return;
  }
  investigationModule ||= { ...shortcuts.get('mailbox'), id: 'investigation', desktopId: 'mailbox', label: '调查任务', title: 'FILE 1' };
  openModule(investigationModule);
}

function minimizeWindow() {
  if (closingModule || !openWindows.has(activeModule)) return;
  if (activeModule === 'investigation') investigationInteraction?.cancel();
  const module = openWindows.get(activeModule)?.module;
  windowDragging.cancel();
  openWindows.get(activeModule).surface.hidden = true;
  if (activeModule === 'task') setWelcomeContent(afterTaskLines);
  activateTopVisible();
  module?.button.focus({ preventScroll: true });
}

async function closeWindow(id = activeModule) {
  const state = openWindows.get(id);
  if (!state || closingModule) return;
  if (id === 'investigation') investigationInteraction?.cancel();
  windowDragging.cancel();
  closingModule = true;
  if (state.art && !state.surface.hidden) {
    if (id === 'task') taskProjection?.reset();
    state.motionElement.classList.add('is-closing');
    await Promise.all(state.motionElement.getAnimations().map(animation => animation.finished.catch(() => {})));
  }
  state.surface.hidden = true;
  setWindowMaximized(state, false);
  if (state.art) {
    state.motionElement.classList.remove('is-closing');
    state.motionElement.querySelector('.window-lock-status')?.remove();
    state.position = { x: 0, y: 0 };
    windowDragging.apply(state);
    state.motionElement.classList.remove('window-is-locked');
    state.art.buttons.lock.setAttribute('aria-pressed', 'false');
    state.art.buttons.lock.setAttribute('aria-label', '锁定窗口位置');
    state.art.buttons.lock.title = '锁定窗口位置';
  }
  else state.surface.remove();
  openWindows.delete(id);
  if (id === 'task') setWelcomeContent(afterTaskLines);
  closingModule = false;
  activateTopVisible();
  state.module.button.focus({ preventScroll: true });
}

function playOpenSound() {
  if (restoring || document.querySelector('#game').inert) return;
  playEffect(document.querySelector('#screen-open-audio')).catch(error => console.warn('系统页打开音效未能播放', error));
}

function updateClock() {
  if (!desktopClock) return;
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  desktopClock.date.textContent = '2126/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate());
  desktopClock.time.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
}

function waitForArtwork(object, selector) {
  if (object.contentDocument?.querySelector(selector)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      object.removeEventListener('load', loaded);
      object.removeEventListener('error', failed);
    };
    const loaded = () => {
      cleanup();
      if (object.contentDocument?.querySelector(selector)) resolve();
      else reject(new Error('FCA桌面素材内容不完整'));
    };
    const failed = () => { cleanup(); reject(new Error('FCA桌面素材加载失败')); };
    const timeout = window.setTimeout(failed, 3500);
    object.addEventListener('load', loaded);
    object.addEventListener('error', failed);
  });
}

taskClose.addEventListener('click', () => closeWindow('task'));
taskMinimize.addEventListener('click', () => {
  if (activeModule === 'task' && !closingModule) minimizeWindow();
});
window.addEventListener('keydown', event => {
  if (page.closest('#game').inert || event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape' && activeModule === 'investigation' && investigationInteraction?.stopScanning()) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && activeModule) {
    event.preventDefault();
    closeWindow();
  }
});
window.setInterval(updateClock, 1000);
window.addEventListener('focus', updateClock);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });
taskSource.addEventListener('load', initializeTaskArtwork);
initializeTaskArtwork();

function saveDashboard() {
  if (!ready || restoring || closingModule || !checkpointAvailable) return;
  const windows = [...openWindows.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ module, surface, position, maximized, locked }) => ({
      id: module.id, hidden: surface.hidden, position, maximized, locked
    }));
  const drafts = Object.fromEntries([...reportDrafts]
    .filter(([number]) => !submittedReports.has(number))
    .map(([number, { editor }]) => [number, editor.count]));
  writeCheckpoint({
    windows, drafts,
    archive: [...submittedReports.keys()],
    document: documentsInteraction?.selectedFile,
    mail: mailDialogue?.snapshot(),
    survivor: survivorStory?.snapshot(),
    fileOne: investigationInteraction?.snapshot(),
    fileTwo: investigationTwo?.interaction.snapshot(),
    folders: fileThreeWindows.get('overview')?.interaction.snapshot(),
    survivorClueUnlocked,
    net: netWindow?.interaction.snapshot(),
    ending: endings?.snapshot()
  });
}

async function restoreDashboard(checkpoint) {
  const windows = checkpoint.windows.filter(state => typeof state?.id === 'string');
  const wants = id => windows.some(window => window.id === id);
  const reportObjects = [reportSource, reportTwoSource, recordThreeSource];
  const archive = [1, 2, 3].filter(number => checkpoint.archive?.includes?.(number) || (number === 3 && checkpoint.survivorClueUnlocked));
  survivorClueUnlocked = Boolean(checkpoint.survivorClueUnlocked);
  await Promise.all([
    ...archive.map(number => waitForArtwork(reportObjects[number - 1], '#_文档管理')),
    wants('task') && waitForArtwork(taskSource, '#_002'),
    (wants('mailbox') || checkpoint.mail) && waitForArtwork(mailSource, '#_003'),
    (wants('documents') || checkpoint.document) && waitForArtwork(documentsSource, '#_文档管理'),
    wants('note') && waitForArtwork(notesSource, '#_备忘录'),
    (wants('browser') || checkpoint.net) && waitForArtwork(document.querySelector('#net-source'), '#net'),
    (wants('investigation') || checkpoint.fileOne) && waitForArtwork(investigationSource, '#_线索1'),
    (wants('investigation2') || checkpoint.fileTwo) && Promise.all([
      waitForArtwork(investigationTwoSource, '#_线索1'), waitForArtwork(evaluateSource, '#_线索1')
    ]),
    (wants('investigation') || wants('investigation2') || checkpoint.fileOne || checkpoint.fileTwo) && waitForArtwork(draftReportSource, '#_线索1'),
    checkpoint.folders && waitForArtwork(document.querySelector('#file3-overview-source'), '#file3-root')
  ]);
  archive.forEach(archiveReport);
  if (checkpoint.mail && initializeMailArtwork()) {
    mailPage.hidden = false; // SVG line wrapping needs the restored window to be laid out.
    try {
      await survivorArtworkReady;
      if (survivorStory) await survivorStory.restore(checkpoint.survivor, checkpoint.mail);
      else mailDialogue.restore(checkpoint.mail);
    } finally {
      mailPage.hidden = true;
    }
  }
  if (checkpoint.fileOne && initializeInvestigationArtwork()) investigationInteraction.restore(checkpoint.fileOne);
  if (checkpoint.fileTwo && initializeSecondInvestigationArtwork()) investigationTwo.interaction.restore(checkpoint.fileTwo);
  if (checkpoint.folders) initializeFileThreeArtwork('overview')?.interaction.restore(checkpoint.folders);
  if (checkpoint.net && initializeNetArtwork()) netWindow.interaction.restore(checkpoint.net);
  if ([1, 2, 3].includes(checkpoint.document) && initializeDocumentsArtwork()) documentsInteraction.select(checkpoint.document);
  for (const number of [1, 2]) {
    if (!archive.includes(number) && Number.isInteger(checkpoint.drafts?.[number])) {
      const initialized = number === 1 ? initializeInvestigationArtwork() : initializeSecondInvestigationArtwork();
      if (initialized) await openReportDraft(number, checkpoint.drafts[number]);
    }
  }

  for (const saved of windows) {
    const { id } = saved;
    const module = shortcuts.get(id);
    if (module) openModule(module);
    else if (id === 'investigation') openInvestigationPreview(1);
    else if (id === 'investigation2') openInvestigationPreview(2);
    else if (id === 'investigation3') await openFileThreeFolder('overview');
    else if (/^file3-(alpha|beta|gamma|delta|restricted|contact)$/.test(id)) await openFileThreeFolder(id.slice(6));

    const state = openWindows.get(id);
    if (!state) continue;
    if (Number.isFinite(saved.position?.x) && Number.isFinite(saved.position?.y)) {
      state.position = { x: saved.position.x, y: saved.position.y };
    }
    setWindowMaximized(state, Boolean(saved.maximized));
    applyWindowLock(state, Boolean(saved.locked));
  }
  for (const { id, hidden } of windows) {
    if (hidden && openWindows.has(id)) openWindows.get(id).surface.hidden = true;
  }
  activateTopVisible();
  if (activeModule) selectDesktopModule(openWindows.get(activeModule).module);
  if (investigationTwo && !investigationTwo.surface.hidden) {
    investigationTwo.interaction.render(performance.now());
    investigationTwo.interaction.pause();
  }
  if (checkpoint.mail) setWelcomeContent(afterTaskLines, false);
  if (checkpoint.ending) await endings.restore(checkpoint.ending);
}

window.addEventListener('beforeunload', saveDashboard);
window.setInterval(saveDashboard, 1000);

window.addEventListener('fca:enter-dashboard', () => enterDashboard());

export async function enterDashboard(checkpoint = null) {
  if (entered) return;
  entered = true;
  restoring = Boolean(checkpoint);
  const entry = document.querySelector('.system-entry');
  try {
    await waitForArtwork(source, '#Shortcut_Tasks');
    await Promise.all([document.fonts.load('400 20px "FCA Agency"'), document.fonts.load('700 20px "FCA Agency"'), document.fonts.load('700 32px "FCA Consolas"')]);
    if (!checkpoint) await entry.animate([
      { opacity: 1, filter: 'brightness(1)' },
      { opacity: .72, filter: 'brightness(.98)' },
      { opacity: 0, filter: 'brightness(.94)' }
    ], { duration: 280, easing: 'ease-in-out', fill: 'forwards' }).finished;
    entry.hidden = true;
    page.hidden = false;
    initializeArtwork();
    window.dispatchEvent(new Event('fca:dashboard-entered'));
    if (checkpoint) {
      try { await restoreDashboard(checkpoint); }
      catch (error) {
        checkpointAvailable = false;
        console.warn('FCA部分续玩记录无法恢复', error);
      }
      window.addEventListener('fca:startup-ready', beginResumedDesktop, { once: true });
    } else {
      beginDesktop();
      saveDashboard();
    }
  } catch (error) {
    entered = false;
    restoring = false;
    console.error('FCA桌面无法打开', error);
  }
}

function beginDesktop() {
  page.classList.add('is-entering');
  playOpenSound();
  const finishEntry = event => {
    if (event && (event.target !== page || event.animationName !== 'dashboard-desktop-in')) return;
    window.clearTimeout(finishTimer);
    page.classList.remove('is-entering');
    page.removeEventListener('animationend', finishEntry);
    welcomeTyping?.start();
  };
  page.addEventListener('animationend', finishEntry);
  const finishTimer = window.setTimeout(() => finishEntry(), 900);
  requestAnimationFrame(renderDesktop);
}

function beginResumedDesktop() {
  restoring = false;
  netWindow?.interaction.resume();
  endings?.resume();
  if (!endings?.active) {
    survivorStory?.resume();
    welcomeTyping?.start();
    const state = openWindows.get(activeModule);
    if (!survivorStory?.isMediaOpen) {
      const draft = activeModule === 'investigation' ? reportDrafts.get(1) : activeModule === 'investigation2' ? reportDrafts.get(2) : null;
      if (draft && !draft.overlay.hidden) draft.editor.focus();
      else if (activeModule === 'note') state.motionElement.querySelector('.notes-editor').focus({ preventScroll: true });
      else if (activeModule === 'browser') netWindow.interaction.focus();
      else state?.art?.buttons.close.focus({ preventScroll: true });
    }
  }
  requestAnimationFrame(renderDesktop);
}

function renderDesktop(now) {
  if (!endings?.active && !sessionMenu.isOpen) {
    welcomeTyping?.render(now);
    if (activeModule === 'task' && !closingModule) taskProjection?.render(now / 1000);
    if (mailPage && !mailPage.hidden && !closingModule && !survivorStory?.isMediaOpen && (!mailContacts || mailContacts.activeChannel === 'partner')) mailDialogue?.render(now);
    else mailDialogue?.pause();
    if (mailPage && !mailPage.hidden && !closingModule) survivorStory?.render(now);
    else survivorStory?.pause();
    if (investigationTwo && !investigationTwo.surface.hidden && !closingModule) investigationTwo.interaction.render(now);
    else investigationTwo?.interaction.pause();
  }
  requestAnimationFrame(renderDesktop);
}
