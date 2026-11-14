import { playEffect, trackEffect } from './audio-settings.js';
import { assetUrl } from './assets.js';

const gameRoot = document.querySelector("#game");
const entryArtwork = document.querySelector("#system-entry-art");
const codeErrorOverlay = document.querySelector("#code-error-overlay");
const codeErrorArtwork = document.querySelector("#code-error-art");
const identitySuccessOverlay = document.querySelector("#identity-success-overlay");
const identitySuccessArtwork = document.querySelector("#identity-success-art");
const cameraPromptOverlay = document.querySelector("#camera-prompt-overlay");
const eyeCameraViewport = document.querySelector("#eye-camera-viewport");
const eyeCameraVideo = document.querySelector("#eye-camera-video");
const eyeCameraStatus = document.querySelector("#eye-camera-status");
const eyeScanAudio = trackEffect(document.querySelector("#eye-scan-audio"));
const screenOpenAudio = document.querySelector("#screen-open-audio");
const popupAudio = document.querySelector("#popup-audio");

if (
  !gameRoot || !entryArtwork || !codeErrorOverlay || !codeErrorArtwork
  || !identitySuccessOverlay || !identitySuccessArtwork
  || !cameraPromptOverlay || !eyeCameraViewport || !eyeCameraVideo
  || !eyeCameraStatus || !eyeScanAudio || !screenOpenAudio || !popupAudio
) {
  throw new Error("FCA系统入口组件未正确加载");
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

function createCameraFrameValidator() {
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = 80;
  frameCanvas.height = 60;
  const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
  let previousLuminance = null;
  let usableFrameStreak = 0;

  return (video, track) => {
    if (
      !frameContext || !track || track.readyState !== "live" || track.muted
      || video.readyState < 2 || !video.videoWidth || !video.videoHeight
    ) {
      usableFrameStreak = 0;
      previousLuminance = null;
      return false;
    }

    frameContext.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
    const pixels = frameContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
    const luminanceSamples = [];
    let luminanceTotal = 0;
    let luminanceSquaredTotal = 0;
    let darkSamples = 0;

    for (let index = 0; index < pixels.length; index += 16) {
      const luminance = (
        0.299 * pixels[index]
        + 0.587 * pixels[index + 1]
        + 0.114 * pixels[index + 2]
      );
      luminanceSamples.push(luminance);
      luminanceTotal += luminance;
      luminanceSquaredTotal += luminance * luminance;
      if (luminance < 14) darkSamples += 1;
    }

    const sampleCount = luminanceSamples.length;
    const mean = luminanceTotal / sampleCount;
    const variance = luminanceSquaredTotal / sampleCount - mean * mean;
    const darkRatio = darkSamples / sampleCount;
    let frameDifference = 0;

    if (previousLuminance) {
      frameDifference = luminanceSamples.reduce((total, value, index) => (
        total + Math.abs(value - previousLuminance[index])
      ), 0) / sampleCount;
    }
    previousLuminance = luminanceSamples;

    // 必须同时是有效视频轨道、非黑屏，并且连续帧确实发生细微变化。
    // 这样关闭的镜头、纯黑帧和静止的驱动占位图都不能触发扫描。
    const frameIsUsable = (
      mean > 18
      && variance > 90
      && darkRatio < 0.88
      && frameDifference > 0.16
    );
    usableFrameStreak = frameIsUsable ? usableFrameStreak + 1 : 0;
    return usableFrameStreak >= 3;
  };
}

const hasUsableCameraFrame = createCameraFrameValidator();

function createLocalFaceDetector() {
  let nativeDetector = null;
  if ("FaceDetector" in window) {
    try {
      nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    } catch (error) {
      console.warn("当前运行环境未开放原生人脸检测，将使用本地图像特征判断。", error);
    }
  }

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 160;
  sampleCanvas.height = 120;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });

  return async (video) => {
    if (!sampleContext || video.readyState < 2 || !video.videoWidth) return false;

    if (nativeDetector) {
      try {
        const faces = await nativeDetector.detect(video);
        return faces.length > 0;
      } catch (error) {
        // 某些摄像头帧格式不被Shape Detection API接受，失败后自动退回像素判断。
        nativeDetector = null;
        console.warn("原生人脸检测不可用，已切换至本地图像特征判断。", error);
      }
    }

    sampleContext.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = sampleContext.getImageData(28, 8, 104, 104).data;
    let validSamples = 0;
    let skinSamples = 0;
    let luminanceTotal = 0;
    let luminanceSquaredTotal = 0;

    // 降采样中央区域：黑屏会因亮度/方差不足失败，正常面部则需同时满足肤色占比。
    for (let index = 0; index < pixels.length; index += 16) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      const cb = 128 - 0.168736 * red - 0.331264 * green + 0.5 * blue;
      const cr = 128 + 0.5 * red - 0.418688 * green - 0.081312 * blue;

      validSamples += 1;
      luminanceTotal += luminance;
      luminanceSquaredTotal += luminance * luminance;
      if (luminance > 25 && cb >= 77 && cb <= 135 && cr >= 133 && cr <= 180) {
        skinSamples += 1;
      }
    }

    const mean = luminanceTotal / validSamples;
    const variance = luminanceSquaredTotal / validSamples - mean * mean;
    return mean > 25 && variance > 180 && skinSamples / validSamples > 0.1;
  };
}

const detectFacePresence = createLocalFaceDetector();

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function playOneShot(sourceAudio, description) {
  playEffect(sourceAudio).catch((error) => {
    console.error(`${description}无法播放：`, error);
  });
}

async function playEyeScanSoundOnce() {
  eyeScanAudio.pause();
  eyeScanAudio.currentTime = 0;

  const finished = new Promise((resolve) => {
    eyeScanAudio.addEventListener("ended", resolve, { once: true });
    eyeScanAudio.addEventListener("error", resolve, { once: true });
  });

  try {
    await eyeScanAudio.play();
    await finished;
  } catch (error) {
    // 音频设备不可用时仍允许三秒验证流程完成，不让游戏卡死。
    console.error("FCA瞳孔扫描音效无法播放：", error);
  }
}

function approximatelyEqual(value, expected, tolerance = 2) {
  return Math.abs(value - expected) <= tolerance;
}

function findDirectElementByBounds(root, tagName, expectedBounds) {
  return [...root.children].find((element) => {
    if (element.tagName.toLowerCase() !== tagName) return false;
    const box = element.getBBox();
    const actualBounds = [box.x, box.y, box.width, box.height];
    return expectedBounds.every((expected, index) => (
      approximatelyEqual(actualBounds[index], expected)
    ));
  });
}

function addSvgRuntimeStyles(svgDocument) {
  const style = svgDocument.createElementNS(SVG_NAMESPACE, "style");
  style.textContent = `
    /* SVG有独立字体上下文，直接从项目内加载用户提供的Agency字体，不依赖系统安装。 */
    @font-face {
      font-family: 'FCA Agency';
      src: url("${assetUrl('fonts/agency-regular.ttf')}") format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'FCA Agency';
      src: url("${assetUrl('fonts/agency-bold.ttf')}") format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    #fca-entry-local-date, #fca-entry-local-time {
      font-family: 'FCA Agency', 'Agency FB', sans-serif;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    #fca-left-ring-inner,
    #fca-left-ring-outer,
    .fca-scanner-layer,
    .fca-scanner-center-ring {
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-left-ring-inner { animation: fca-spin 14s linear infinite; }
    #fca-left-ring-outer { animation: fca-spin-reverse 21s linear infinite; }

    .fca-scanner-layer {
      animation: fca-spin var(--spin-speed) linear infinite;
      animation-play-state: paused;
    }
    .fca-scanner-layer.is-reversed { animation-name: fca-spin-reverse; }
    .fca-scanner-layer.is-always-spinning { animation-play-state: running; }
    .fca-scanner-center-ring {
      animation: fca-spin var(--spin-speed) linear infinite;
      animation-play-state: paused;
    }
    .fca-scanner-center-ring.is-reversed { animation-name: fca-spin-reverse; }

    #fca-scanner {
      cursor: pointer;
      outline: none;
    }

    #fca-scanner:focus-visible {
      filter: brightness(1.08);
    }

    #fca-entry-cube {
      cursor: default;
      outline: none;
      transform-box: view-box;
      transform-origin: center;
      animation: fca-cube-breathe 4.8s ease-in-out infinite;
    }

    #fca-entry-cube:hover,
    #fca-entry-cube:focus-visible {
      animation-play-state: paused;
      filter: brightness(1.18) drop-shadow(0 0 2px rgba(249, 243, 30, 0.7));
    }

    #fca-access-panel {
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-access-panel.is-projected {
      visibility: visible;
      animation: fca-project-panel 720ms steps(10, end) forwards;
    }

    #fca-access-panel.is-settled {
      visibility: visible;
      opacity: 1;
      animation: fca-screen-projection-jitter 4.7s steps(1, end) infinite;
    }

    #fca-code-node,
    #fca-code-connector,
    #fca-code-panel {
      visibility: hidden;
      opacity: 0;
    }

    #fca-code-node {
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-code-node.is-igniting {
      visibility: visible;
      animation: fca-code-node-ignite 360ms ease-out forwards;
    }

    #fca-code-connector.is-drawing {
      visibility: visible;
      opacity: 1;
      stroke-dasharray: var(--connector-length);
      stroke-dashoffset: var(--connector-length);
      animation: fca-code-line-draw 760ms 220ms ease-out forwards;
    }

    #fca-code-panel {
      pointer-events: none;
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-code-panel.is-projecting {
      visibility: visible;
      animation: fca-code-panel-project 680ms 920ms steps(9, end) both;
    }

    #fca-code-panel.is-visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }

    #fca-success-node,
    #fca-success-connector,
    #fca-success-button {
      visibility: hidden;
      opacity: 0;
    }

    #fca-success-node {
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-success-node.is-igniting {
      visibility: visible;
      animation: fca-code-node-ignite 360ms ease-out forwards;
    }

    #fca-success-connector.is-drawing {
      visibility: visible;
      opacity: 1;
      stroke-dasharray: var(--connector-length);
      stroke-dashoffset: var(--connector-length);
      animation: fca-code-line-draw 760ms 220ms ease-out forwards;
    }

    #fca-success-button {
      pointer-events: none;
      cursor: pointer;
      outline: none;
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-success-button.is-projecting {
      visibility: visible;
      animation: fca-code-panel-project 680ms 920ms steps(9, end) both;
    }

    #fca-success-button.is-visible {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }

    #fca-success-button.is-visible:hover,
    #fca-success-button.is-visible:focus-visible {
      filter: brightness(1.13) drop-shadow(0 0 3px rgba(255, 148, 41, 0.62));
    }

    #fca-success-button.is-visible:active,
    #fca-success-button.is-visible.is-pressed {
      filter: brightness(0.72) saturate(0.9);
    }

    #fca-scanner-scan {
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
    }

    #fca-scanner-scan.is-active {
      visibility: visible;
      opacity: 1;
    }

    .fca-scanner-scan-band {
      animation: fca-scanner-scan-down 2.65s linear infinite;
      animation-play-state: paused;
    }

    #fca-scanner-scan.is-active .fca-scanner-scan-band {
      animation-play-state: running;
    }

    #fca-eye-scanner {
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transform-box: fill-box;
      transform-origin: center;
    }

    #fca-eye-scanner.is-appearing {
      visibility: visible;
      animation: fca-eye-scanner-in 760ms steps(10, end) both;
    }

    #fca-eye-scanner.is-visible {
      visibility: visible;
      opacity: 1;
    }

    .fca-eye-ring-layer {
      transform-box: view-box;
      transform-origin: 1738.33px 645.78px;
      animation: fca-spin var(--eye-ring-speed) linear infinite;
      animation-play-state: paused;
    }

    .fca-eye-ring-layer.is-reversed { animation-name: fca-spin-reverse; }
    #fca-eye-scanner.is-active .fca-eye-ring-layer { animation-play-state: running; }

    .fca-eye-camera-viewport {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: 50%;
      background: #120b08;
      box-shadow: inset 0 0 18px rgba(255, 148, 41, 0.34);
      color: #ffb464;
      font-family: Consolas, monospace;
    }

    .fca-eye-video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
      filter: contrast(1.12) saturate(0.72) sepia(0.16);
      opacity: 0;
      transition: opacity 240ms ease-out;
    }

    .fca-eye-camera-viewport.is-camera-ready .fca-eye-video { opacity: 1; }

    .fca-eye-scanlines,
    .fca-eye-vignette,
    .fca-eye-reticle,
    .fca-eye-sweep,
    .fca-eye-status {
      position: absolute;
      pointer-events: none;
    }

    .fca-eye-scanlines {
      inset: 0;
      background: repeating-linear-gradient(
        to bottom,
        rgba(255, 164, 62, 0.1) 0,
        rgba(255, 164, 62, 0.1) 1px,
        transparent 1px,
        transparent 4px
      );
      mix-blend-mode: screen;
    }

    .fca-eye-vignette {
      inset: 0;
      border-radius: 50%;
      box-shadow: inset 0 0 22px 9px rgba(15, 7, 3, 0.78);
    }

    .fca-eye-reticle {
      left: 19%;
      top: 31%;
      width: 62%;
      height: 38%;
      border: 1px solid rgba(255, 175, 85, 0.72);
      border-radius: 50%;
      box-shadow: 0 0 5px rgba(255, 148, 41, 0.36);
      animation: fca-eye-reticle-pulse 1.8s ease-in-out infinite;
    }

    .fca-eye-reticle::before,
    .fca-eye-reticle::after {
      content: "";
      position: absolute;
      background: rgba(255, 183, 98, 0.72);
    }

    .fca-eye-reticle::before { left: 50%; top: -8px; width: 1px; height: calc(100% + 16px); }
    .fca-eye-reticle::after { top: 50%; left: -8px; height: 1px; width: calc(100% + 16px); }

    .fca-eye-sweep {
      left: 7%;
      top: 9%;
      width: 86%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #fff0c2 30%, #ff9429 50%, #fff0c2 70%, transparent);
      box-shadow: 0 0 5px rgba(255, 148, 41, 0.75);
      animation: fca-eye-sweep-down 2.15s ease-in-out infinite;
    }

    .fca-eye-status {
      left: 0;
      right: 0;
      bottom: 10px;
      text-align: center;
      font-size: 7px;
      letter-spacing: 0.8px;
      text-shadow: 0 0 3px #ff9429;
    }

    .fca-code-input {
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: #ffe0c7;
      caret-color: #ff8f1f;
      font: 600 28px/1 Consolas, monospace;
      text-align: center;
      text-shadow: 0 0 3px rgba(255, 164, 44, 0.48);
    }

    .fca-code-input:disabled {
      color: transparent;
      caret-color: transparent;
    }

    #fca-ecg-core,
    #fca-ecg-glow {
      fill: none;
      stroke-linecap: square;
      stroke-linejoin: miter;
      vector-effect: non-scaling-stroke;
    }

    #fca-ecg-core {
      stroke: #ffe7c4;
      stroke-width: 2.1;
    }

    #fca-ecg-glow {
      stroke: #ee842b;
      stroke-width: 4.2;
      stroke-opacity: 0.26;
      filter: url(#fca-ecg-soft-glow);
    }

    .fca-border-sweep {
      fill: none;
      stroke-linecap: butt;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      animation: fca-border-sweep 8s linear infinite;
    }

    .fca-entry-map-breath { pointer-events: none; animation: fca-entry-map-breathe 5.7s ease-in-out infinite; }
    @keyframes fca-entry-map-breathe { 0%, 100% { opacity: .22; } 50% { opacity: .32; } }

    @keyframes fca-spin {
      from {
        transform: translate(
          var(--center-offset-x, 0px),
          var(--center-offset-y, 0px)
        ) rotate(0deg);
      }
      to {
        transform: translate(
          var(--center-offset-x, 0px),
          var(--center-offset-y, 0px)
        ) rotate(360deg);
      }
    }
    @keyframes fca-spin-reverse {
      from {
        transform: translate(
          var(--center-offset-x, 0px),
          var(--center-offset-y, 0px)
        ) rotate(0deg);
      }
      to {
        transform: translate(
          var(--center-offset-x, 0px),
          var(--center-offset-y, 0px)
        ) rotate(-360deg);
      }
    }
    @keyframes fca-cube-breathe {
      0%, 100% { transform: translateY(var(--cube-rise, -5px)); }
      50% { transform: translateY(var(--cube-fall, 9px)); }
    }

    @keyframes fca-project-panel {
      0% { opacity: 0; transform: scaleY(0.015) translateX(-7px); }
      14% { opacity: 0.8; transform: scaleY(0.035) translateX(5px); }
      23% { opacity: 0.12; transform: scaleY(0.08) translateX(-3px); }
      39% { opacity: 0.9; transform: scaleY(0.42) translateX(2px); }
      51% { opacity: 0.3; transform: scaleY(0.61) translateX(-2px); }
      72% { opacity: 1; transform: scaleY(1.025) translateX(1px); }
      82% { opacity: 0.65; transform: scaleY(0.985); }
      100% { opacity: 1; transform: scaleY(1); }
    }

    @keyframes fca-screen-projection-jitter {
      0%, 18%, 20%, 55%, 59%, 84%, 87%, 100% { transform: translate(0, 0); }
      19% { transform: translate(0.8px, -0.2px); }
      56% { transform: translate(-0.7px, 0.25px); }
      57% { transform: translate(0.45px, -0.2px); }
      58% { transform: translate(-0.25px, 0); }
      85% { transform: translate(0.65px, 0.2px); }
      86% { transform: translate(-0.35px, -0.15px); }
    }

    @keyframes fca-code-node-ignite {
      0% { opacity: 0; transform: scale(0.35); }
      45% { opacity: 1; transform: scale(1.32); }
      70% { opacity: 0.55; transform: scale(0.88); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes fca-code-line-draw {
      from { stroke-dashoffset: var(--connector-length); }
      to { stroke-dashoffset: 0; }
    }

    @keyframes fca-code-panel-project {
      0% { opacity: 0; transform: scaleY(0.015) translateX(-5px); filter: brightness(1.8); }
      18% { opacity: 0.82; transform: scaleY(0.035) translateX(4px); }
      31% { opacity: 0.16; transform: scaleY(0.18) translateX(-3px); }
      52% { opacity: 0.9; transform: scaleY(0.62) translateX(2px); }
      67% { opacity: 0.35; transform: scaleY(0.84) translateX(-1px); }
      84% { opacity: 1; transform: scaleY(1.025); filter: brightness(1.25); }
      100% { opacity: 1; transform: scaleY(1); filter: brightness(1); }
    }

    @keyframes fca-scanner-scan-down {
      from { transform: translateY(0); }
      to { transform: translateY(890px); }
    }

    @keyframes fca-eye-scanner-in {
      0% { opacity: 0; transform: scale(0.72); filter: brightness(2); }
      18% { opacity: 0.8; transform: scale(1.04) translateX(2px); }
      31% { opacity: 0.22; transform: scale(0.96) translateX(-2px); }
      54% { opacity: 1; transform: scale(1.015); }
      67% { opacity: 0.48; transform: scale(0.99) translateX(1px); }
      84% { opacity: 1; transform: scale(1.006); filter: brightness(1.2); }
      100% { opacity: 1; transform: scale(1); filter: brightness(1); }
    }

    @keyframes fca-eye-sweep-down {
      0% { transform: translateY(0); opacity: 0; }
      12% { opacity: 0.95; }
      88% { opacity: 0.95; }
      100% { transform: translateY(88px); opacity: 0; }
    }

    @keyframes fca-eye-reticle-pulse {
      0%, 100% { opacity: 0.52; transform: scale(0.96); }
      50% { opacity: 0.92; transform: scale(1.03); }
    }

    @keyframes fca-border-sweep {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: -100; }
    }

    @media (prefers-reduced-motion: reduce) {
      #fca-left-ring-inner,
      #fca-left-ring-outer,
      .fca-scanner-layer,
      .fca-scanner-center-ring,
      #fca-entry-cube,
      .fca-border-sweep,
      .fca-scanner-scan-band {
        animation-play-state: paused;
      }
    }
  `;
  svgDocument.documentElement.append(style);
}

function createCodeInputs(svgDocument, codePanel) {
  const inputPositions = [...codePanel.querySelectorAll('rect')]
    .map(rect => rect.getBBox()).filter(box => box.width > 40 && box.width < 50 && box.height > 40)
    .sort((left, right) => left.x - right.x);
  if (inputPositions.length !== 4) throw new Error('新入口缺少四位工号输入框');

  return inputPositions.map((box, index) => {
    const foreignObject = svgDocument.createElementNS(SVG_NAMESPACE, "foreignObject");
    foreignObject.setAttribute("x", String(box.x));
    foreignObject.setAttribute("y", String(box.y));
    foreignObject.setAttribute("width", String(box.width));
    foreignObject.setAttribute("height", String(box.height));

    const input = svgDocument.createElementNS(XHTML_NAMESPACE, "input");
    input.setAttribute("class", "fca-code-input");
    input.setAttribute("type", "text");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("maxlength", "1");
    input.setAttribute("aria-label", `工号第${index + 1}位`);
    input.disabled = true;

    // 每格只保留一个数字；输入后自动前进，退格空框时返回上一格。
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      if (input.value && index < inputPositions.length - 1) {
        const nextInput = codePanel.querySelectorAll(".fca-code-input")[index + 1];
        nextInput?.focus();
      }
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Backspace" && !input.value && index > 0) {
        const previousInput = codePanel.querySelectorAll(".fca-code-input")[index - 1];
        previousInput?.focus();
      }
    });

    foreignObject.append(input);
    codePanel.append(foreignObject);
    return input;
  });
}

// 只重组上传SVG的现有节点；不混入旧页面的图形或沿用旧坐标补偿。
function groupArtwork(svgDocument, elements, id) {
  if (!elements.length || elements.some(element => !element)) throw new Error(`入口素材缺少组件：${id}`);
  const group = svgDocument.createElementNS(SVG_NAMESPACE, 'g');
  group.id = id;
  elements[0].before(group);
  elements.forEach(element => group.append(element));
  return group;
}

function splitProjectionArtwork(svgDocument, parent, prefix, points, bodyId) {
  const parts = [...parent.children];
  const body = groupArtwork(svgDocument, parts.slice(0, -3), bodyId);
  const node = groupArtwork(svgDocument, parts.slice(-2), `${prefix}-node`);
  const originalConnector = parts.at(-3);
  const connector = svgDocument.createElementNS(SVG_NAMESPACE, 'polyline');
  [...originalConnector.attributes].filter(attribute => attribute.name !== 'd')
    .forEach(attribute => connector.setAttribute(attribute.name, attribute.value));
  connector.id = `${prefix}-connector`;
  connector.setAttribute('points', points);
  originalConnector.replaceWith(connector);
  connector.style.setProperty('--connector-length', `${connector.getTotalLength()}px`);
  return { body, node, connector };
}

function prepareEntryArtwork(svgDocument) {
  const root = svgDocument.querySelector('#_000');
  if (!root) throw new Error('入口SVG缺少主图层');
  const find = (tag, bounds) => findDirectElementByBounds(root, tag, bounds);
  const icon = find('g', [45.13, 431.87, 119.22, 118.97]);
  if (!icon || icon.children.length !== 3) throw new Error('新入口Morse Code图标结构不符');
  const [entryCube, leftRingInner, leftRingOuter] = [...icon.children];
  const panelFrame = find('path', [181.82, 420.4, 605.08, 567.35]);
  const panelHeader = find('g', [183.14, 442, 592.59, 62.67]);
  const panelDecorations = find('g', [364.86, 457.96, 390.77, 33.4]);
  const panelTitle = [...root.children].find(element => element.localName === 'text' && element.textContent.includes('MOSE CODE'));
  const panelDigits = find('g', [203.94, 533.34, 562.66, 426.02]);
  const accessPanel = groupArtwork(svgDocument, [panelFrame, panelHeader, panelDecorations, panelTitle, panelDigits], 'fca-access-panel');
  const scannerSource = svgDocument.querySelector('#fca-entry-scanner-source');
  if (!scannerSource) throw new Error('入口SVG缺少资源22圆环');
  const center = findDirectElementByBounds(scannerSource, 'circle', [323.39, 310.55, 29.96, 29.96]);
  const outer = findDirectElementByBounds(scannerSource, 'g', [27.18, 16.93, 617.16, 617.16]);
  if (!center || !outer) throw new Error('新入口扫描器图层结构不符');
  const parts = [];
  for (let element = center; element; element = element.nextElementSibling) {
    parts.push(element);
    if (element === outer) break;
  }
  if (parts.length !== 32) throw new Error('新入口扫描器分层数量不符');
  const scanner = groupArtwork(svgDocument, parts, 'fca-scanner');
  // 相邻的弧、刻度和分段线组成独立环层；所有旋转使用原图圆心，不以单段弧的包围盒为圆心。
  [[6, 7], [7, 18], [18, 23], [23, 29], [29, 31]].forEach(([start, end], index) => {
    groupArtwork(svgDocument, parts.slice(start, end), `fca-scanner-native-layer-${index}`);
  });
  const scannerLayers = [...scanner.children].filter(element => element.localName === 'g');
  scannerLayers.forEach(layer => {
    layer.style.transformBox = 'view-box';
    layer.style.transformOrigin = '338.37px 325.53px';
  });
  outer.style.transformOrigin = '335.76px 325.51px';
  const centerRings = parts.slice(1, 4);
  centerRings.forEach(ring => {
    ring.style.transformBox = 'view-box';
    ring.style.transformOrigin = '338.37px 325.53px';
  });
  const code = splitProjectionArtwork(svgDocument, svgDocument.querySelector('#input-id'), 'fca-code',
    '1464.15,478.39 1586.24,478.39 1661.37,379.78', 'fca-code-panel');
  const lowerOrangePanel = svgDocument.querySelector('#scan-button');
  const eyeArtwork = find('g', [1619.96, 524.29, 238.29, 242.8]);
  if (!lowerOrangePanel || !eyeArtwork) throw new Error('新入口缺少瞳孔扫描组件');
  const viewBox = svgDocument.documentElement.viewBox.baseVal;
  const cameraRadius = 67;
  // 主HTML视频覆盖层按新SVG坐标计算，窗口缩放后仍与圆孔严格对齐。
  eyeCameraViewport.style.left = `${(1738.33 - cameraRadius) / viewBox.width * 100}%`;
  eyeCameraViewport.style.top = `${(645.78 - cameraRadius) / viewBox.height * 100}%`;
  eyeCameraViewport.style.width = `${cameraRadius * 2 / viewBox.width * 100}%`;
  entryCube.style.setProperty('--cube-rise', '-1.4px');
  entryCube.style.setProperty('--cube-fall', '2.3px');
  return { root, entryCube, leftRingInner, leftRingOuter, accessPanel, scanner, scannerLayers,
    centerRings, outermostScannerLayer: outer, codePanel: code.body, codeNode: code.node,
    codeConnector: code.connector, lowerOrangePanel, eyeArtwork };
}

function createSuccessButton(svgDocument, originalPanel) {
  const { body: button, node, connector } = splitProjectionArtwork(svgDocument, originalPanel, 'fca-success',
    '1316.23,878.59 1372.58,934.94 1512.28,934.94', 'fca-success-button');
  button.setAttribute("tabindex", "0");
  button.setAttribute("role", "button");
  button.setAttribute("aria-label", "开始瞳孔扫描");

  // 透明命中区让圆点、连接线和按钮面板之间的空白也可稳定响应点击。
  const hitArea = svgDocument.createElementNS(SVG_NAMESPACE, "polygon");
  hitArea.setAttribute("points", "1518.15,909.11 1823.38,909.11 1803.42,960.76 1482.93,960.76");
  hitArea.setAttribute("fill", "transparent");
  hitArea.setAttribute("pointer-events", "all");

  button.append(hitArea);
  return { button, node, connector };
}

function createScannerScanEffect(svgDocument, root) {
  const definitions = svgDocument.querySelector("defs");
  if (!definitions) throw new Error("入口SVG缺少定义图层");

  // 圆形裁切严格使用最外圈边界，扫描亮带不会越过扫描器范围。
  const clipPath = svgDocument.createElementNS(SVG_NAMESPACE, "clipPath");
  clipPath.id = "fca-scanner-circle-clip";
  clipPath.setAttribute("clipPathUnits", "userSpaceOnUse");
  const clipCircle = svgDocument.createElementNS(SVG_NAMESPACE, "circle");
  clipCircle.setAttribute("cx", "1168.69");
  clipCircle.setAttribute("cy", "598.88");
  clipCircle.setAttribute("r", "308.58");
  clipPath.append(clipCircle);

  const gradient = svgDocument.createElementNS(SVG_NAMESPACE, "linearGradient");
  gradient.id = "fca-scanner-scan-gradient";
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "0");
  gradient.setAttribute("y2", "1");
  [
    ["0%", "0"],
    ["22%", "0.12"],
    ["50%", "1"],
    ["78%", "0.12"],
    ["100%", "0"]
  ].forEach(([offset, opacity]) => {
    const stop = svgDocument.createElementNS(SVG_NAMESPACE, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", "#ffe0c7");
    stop.setAttribute("stop-opacity", opacity);
    gradient.append(stop);
  });

  definitions.append(clipPath, gradient);

  // 直接绘制可见扫描亮带，避免部分渲染器不更新SVG mask内部CSS动画。
  const overlay = svgDocument.createElementNS(SVG_NAMESPACE, "g");
  overlay.id = "fca-scanner-scan";
  overlay.setAttribute("clip-path", "url(#fca-scanner-circle-clip)");
  const scanBand = svgDocument.createElementNS(SVG_NAMESPACE, "rect");
  scanBand.setAttribute("class", "fca-scanner-scan-band");
  scanBand.setAttribute("x", "858");
  scanBand.setAttribute("y", "120.3");
  scanBand.setAttribute("width", "622");
  scanBand.setAttribute("height", "170");
  scanBand.setAttribute("fill", "url(#fca-scanner-scan-gradient)");
  scanBand.setAttribute("opacity", "0.42");
  scanBand.setAttribute("style", "mix-blend-mode:screen; filter:drop-shadow(0 0 3px rgba(255,192,134,.45))");
  overlay.append(scanBand);
  root.append(overlay);
  return overlay;
}

function createEyeScanner(svgDocument, scanner) {
  scanner.id = "fca-eye-scanner";
  const parts = [...scanner.children];
  [[parts[0]], parts.slice(1, 3), parts.slice(3)].forEach((elements, index) => {
    const layer = groupArtwork(svgDocument, elements, `fca-eye-native-layer-${index}`);
    layer.classList.add('fca-eye-ring-layer');
    if (index === 1) layer.classList.add('is-reversed');
    layer.style.setProperty('--eye-ring-speed', `${[24, 32, 42][index]}s`);
    layer.style.transformOrigin = '1738.33px 645.78px';
  });
  return { scanner };
}

async function activateEyeScanner(eyeScanner) {
  const { scanner } = eyeScanner;
  if (scanner.classList.contains("is-active")) return;

  playOneShot(screenOpenAudio, "瞳孔扫描器打开音效");
  scanner.classList.add("is-active", "is-appearing");
  eyeCameraViewport.classList.add("is-active");
  eyeCameraViewport.setAttribute("aria-hidden", "false");
  const finishAppearance = (event) => {
    if (event.animationName !== "fca-eye-scanner-in") return;
    scanner.classList.add("is-visible");
    scanner.classList.remove("is-appearing");
  };
  scanner.addEventListener("animationend", finishAppearance, { once: true });
  eyeCameraStatus.textContent = "CAMERA LINK...";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前环境不支持摄像头访问");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });
    eyeCameraVideo.srcObject = stream;
    await eyeCameraVideo.play();
    eyeCameraViewport.classList.add("is-camera-ready");
    eyeCameraStatus.textContent = "CAMERA WARMUP";

    const videoTrack = stream.getVideoTracks()[0];
    let consecutiveDetections = 0;
    let missingPromptShown = false;

    // 摄像头先稳定两秒；期间可在后台确认有效画面和人脸，但不运行扫描特效或音效。
    const warmupStartedAt = performance.now();
    while (performance.now() - warmupStartedAt < 2000) {
      const cameraFrameIsUsable = hasUsableCameraFrame(eyeCameraVideo, videoTrack);
      const facePresent = cameraFrameIsUsable
        ? await detectFacePresence(eyeCameraVideo)
        : false;
      consecutiveDetections = facePresent ? consecutiveDetections + 1 : 0;
      await wait(200);
    }

    eyeCameraStatus.textContent = "SEARCHING FACE";
    const searchStartedAt = performance.now();

    // 先确认摄像头确实在持续输出有效画面，再进行连续多帧的人脸判断。
    while (consecutiveDetections < 4) {
      const cameraFrameIsUsable = hasUsableCameraFrame(eyeCameraVideo, videoTrack);
      const facePresent = cameraFrameIsUsable
        ? await detectFacePresence(eyeCameraVideo)
        : false;
      consecutiveDetections = facePresent ? consecutiveDetections + 1 : 0;

      if (!missingPromptShown && performance.now() - searchStartedAt >= 3000) {
        missingPromptShown = true;
        window.dispatchEvent(new CustomEvent("fca:eye-scan-face-missing"));
      }
      if (consecutiveDetections < 4) await wait(220);
    }

    window.dispatchEvent(new CustomEvent("fca:eye-scan-face-found"));
    eyeCameraViewport.classList.add("is-face-detected");
    eyeCameraStatus.textContent = "IRIS SCANNING";

    // 弹窗不早于人脸出现后三秒；若音效更长，则严格等待音效结束的瞬间。
    await Promise.all([wait(3000), playEyeScanSoundOnce()]);
    eyeCameraStatus.textContent = "IDENTITY VERIFIED";
    window.dispatchEvent(new CustomEvent("fca:eye-scan-complete"));
  } catch (error) {
    eyeCameraStatus.textContent = "CAMERA ACCESS DENIED";
    console.error("FCA瞳孔扫描无法启动摄像头：", error);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("fca:eye-scan-face-missing"));
    }, 5000);
  }
}

function accelerateScannerRotations(scannerParts) {
  const accelerationDuration = 2800;
  const rotationAnimations = scannerParts.flatMap((part) => {
    // 先解除CSS暂停，再从动画初始角度以0倍速启动。
    part.style.animationPlayState = "running";
    return part.getAnimations().filter((animation) => (
      animation.animationName === "fca-spin"
      || animation.animationName === "fca-spin-reverse"
    ));
  });

  rotationAnimations.forEach((animation) => {
    animation.currentTime = 0;
    animation.play();
    animation.playbackRate = 0;
  });

  const accelerationStart = performance.now();
  const increaseSpeed = (now) => {
    // 播放倍率线性增加，因而角速度从0匀速提升到每一层原本的最终速度。
    const progress = Math.min((now - accelerationStart) / accelerationDuration, 1);
    rotationAnimations.forEach((animation) => { animation.playbackRate = progress; });
    if (progress < 1) window.requestAnimationFrame(increaseSpeed);
  };
  window.requestAnimationFrame(increaseSpeed);
}

function addErrorSymbolGlow(svgDocument) {
  const symbol = svgDocument.querySelector("#fca-error-symbol");
  if (!symbol) throw new Error("错误警告缺少中央三角标志");

  // 只让原图中的三角与感叹号产生光晕起伏；主体位置和其余警告图形保持不动。
  const style = svgDocument.createElementNS(SVG_NAMESPACE, "style");
  style.textContent = `
    #fca-error-symbol {
      animation: fca-error-symbol-glow 1.18s ease-in-out infinite;
    }

    @keyframes fca-error-symbol-glow {
      0%, 100% {
        filter: brightness(1) drop-shadow(0 0 1px rgba(255, 0, 67, 0.32));
      }
      17% {
        filter: brightness(1.16) drop-shadow(0 0 3px rgba(255, 0, 67, 0.54));
      }
      38% {
        filter: brightness(1.06) drop-shadow(0 0 2px rgba(255, 0, 67, 0.42));
      }
      64% {
        filter: brightness(1.32) drop-shadow(0 0 6px rgba(255, 0, 67, 0.76));
      }
      79% {
        filter: brightness(1.11) drop-shadow(0 0 3px rgba(255, 0, 67, 0.5));
      }
    }
  `;
  svgDocument.documentElement.append(style);
}

function addVerifiedSymbolGlow(svgDocument) {
  const symbol = svgDocument.querySelector("#fca-verified-symbol");
  if (!symbol) throw new Error("身份验证窗口缺少中央通过符号");

  // 只让中央圆环和对勾轻微发光、闪烁，外框与文字保持稳定。
  const style = svgDocument.createElementNS(SVG_NAMESPACE, "style");
  style.textContent = `
    #fca-verified-symbol {
      animation: fca-verified-symbol-pulse 1.7s ease-in-out infinite;
    }

    @keyframes fca-verified-symbol-pulse {
      0%, 100% {
        opacity: 1;
        filter: brightness(1) drop-shadow(0 0 1px rgba(232, 253, 124, 0.34));
      }
      42% {
        opacity: 1;
        filter: brightness(1.17) drop-shadow(0 0 4px rgba(232, 253, 124, 0.62));
      }
      49% {
        opacity: 0.82;
        filter: brightness(1.04) drop-shadow(0 0 2px rgba(232, 253, 124, 0.42));
      }
      57% {
        opacity: 1;
        filter: brightness(1.23) drop-shadow(0 0 5px rgba(232, 253, 124, 0.68));
      }
      72% {
        opacity: 0.94;
        filter: brightness(1.08) drop-shadow(0 0 2px rgba(232, 253, 124, 0.44));
      }
    }
  `;
  svgDocument.documentElement.append(style);
}

function enhanceEcgTrace(svgDocument) {
  // 保留新的网格和状态面板，用原来的移动reveal/erase窗口替换静态信号。
  const monitorFrame = svgDocument.querySelector('#signal-and-status');
  const waveformPaths = [...monitorFrame.children].filter(element => element.localName === 'polyline');
  if (waveformPaths.length !== 1) throw new Error('新入口心电波形结构不符');

  waveformPaths.forEach((path) => path.setAttribute("visibility", "hidden"));

  const definitions = svgDocument.querySelector("defs");
  const glowFilter = svgDocument.createElementNS(SVG_NAMESPACE, "filter");
  glowFilter.id = "fca-ecg-soft-glow";
  glowFilter.setAttribute("x", "-12%");
  glowFilter.setAttribute("y", "-30%");
  glowFilter.setAttribute("width", "124%");
  glowFilter.setAttribute("height", "160%");

  const blur = svgDocument.createElementNS(SVG_NAMESPACE, "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "1.7");
  glowFilter.append(blur);
  definitions.append(glowFilter);

  const clipPath = svgDocument.createElementNS(SVG_NAMESPACE, "clipPath");
  clipPath.id = "fca-ecg-clip";
  const clipRectangle = svgDocument.createElementNS(SVG_NAMESPACE, "rect");
  clipRectangle.setAttribute("x", "62.7");
  clipRectangle.setAttribute("y", "200.5");
  clipRectangle.setAttribute("width", "332.2");
  clipRectangle.setAttribute("height", "94.3");
  clipPath.append(clipRectangle);
  definitions.append(clipPath);

  // 窄窗口的左缘负责柔和擦除，右缘较陡，形成清晰的“当前绘制前端”。
  const revealGradient = svgDocument.createElementNS(SVG_NAMESPACE, "linearGradient");
  revealGradient.id = "fca-ecg-reveal-gradient";
  revealGradient.setAttribute("x1", "0%");
  revealGradient.setAttribute("x2", "100%");
  revealGradient.setAttribute("y1", "0%");
  revealGradient.setAttribute("y2", "0%");
  [
    ["0%", "#000000"],
    ["16%", "#202020"],
    ["31%", "#b8b8b8"],
    ["42%", "#ffffff"],
    ["94%", "#ffffff"],
    ["100%", "#000000"]
  ].forEach(([offset, color]) => {
    const stop = svgDocument.createElementNS(SVG_NAMESPACE, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    revealGradient.append(stop);
  });
  definitions.append(revealGradient);

  const revealMask = svgDocument.createElementNS(SVG_NAMESPACE, "mask");
  revealMask.id = "fca-ecg-reveal-mask";
  revealMask.setAttribute("maskUnits", "userSpaceOnUse");
  revealMask.setAttribute("mask-type", "luminance");
  revealMask.setAttribute("x", "62.7");
  revealMask.setAttribute("y", "200.5");
  revealMask.setAttribute("width", "332.2");
  revealMask.setAttribute("height", "94.3");

  const movingWindow = svgDocument.createElementNS(SVG_NAMESPACE, "g");
  movingWindow.id = "fca-ecg-reveal-window";
  const revealWidth = 118;
  const maskRectangle = svgDocument.createElementNS(SVG_NAMESPACE, "rect");
  maskRectangle.setAttribute("x", String(62.7 - revealWidth));
  maskRectangle.setAttribute("y", "200.5");
  maskRectangle.setAttribute("width", String(revealWidth));
  maskRectangle.setAttribute("height", "94.3");
  maskRectangle.setAttribute("fill", "url(#fca-ecg-reveal-gradient)");
  movingWindow.append(maskRectangle);

  // 窗口从监测框左外侧移动到右外侧；复位时两端均不可见，因此没有跳帧。
  const revealAnimation = svgDocument.createElementNS(SVG_NAMESPACE, "animateTransform");
  revealAnimation.setAttribute("attributeName", "transform");
  revealAnimation.setAttribute("type", "translate");
  revealAnimation.setAttribute("from", "0 0");
  revealAnimation.setAttribute("to", `${332.2 + revealWidth} 0`);
  revealAnimation.setAttribute("dur", "2.1s");
  revealAnimation.setAttribute("repeatCount", "indefinite");
  movingWindow.append(revealAnimation);
  revealMask.append(movingWindow);
  definitions.append(revealMask);

  const viewportGroup = svgDocument.createElementNS(SVG_NAMESPACE, "g");
  viewportGroup.setAttribute("clip-path", "url(#fca-ecg-clip)");
  // 波形模板保持原有尖峰、深谷与2.1秒节奏，整体映射到资源21的新监测框。
  viewportGroup.setAttribute('transform', `translate(78.66 231.27) scale(${390.93 / 332.2} ${142.05 / 94.3}) translate(-62.7 -200.5)`);
  const maskedGroup = svgDocument.createElementNS(SVG_NAMESPACE, "g");
  maskedGroup.setAttribute("mask", "url(#fca-ecg-reveal-mask)");
  const stationaryTrace = svgDocument.createElementNS(SVG_NAMESPACE, "g");
  stationaryTrace.id = "fca-ecg-trace";

  const cycleWidth = 166.1;
  const baseline = 250;
  const cyclePoints = [
    [0, baseline],
    [37, baseline],
    [43, 248],
    [48, 242],
    [54, 248],
    [59, baseline],
    [78, baseline],
    [81.5, 255],
    [85.5, 204],
    [89.5, 292],
    [94.5, 246],
    [99, baseline],
    [113, baseline],
    [121, 247],
    [128, 239],
    [136, 247],
    [143, baseline],
    [cycleWidth, baseline]
  ];

  // 三个周期组成覆盖整个监测框的静止路径；动画只发生在遮罩窗口上。
  const commands = [];
  for (let cycle = 0; cycle < 3; cycle += 1) {
    cyclePoints.forEach(([localX, y], pointIndex) => {
      const x = 62.7 + cycle * cycleWidth + localX;
      const command = cycle === 0 && pointIndex === 0 ? "M" : "L";
      commands.push(`${command}${x.toFixed(2)} ${y.toFixed(2)}`);
    });
  }
  const seamlessPathData = commands.join(" ");

  const glowPath = svgDocument.createElementNS(SVG_NAMESPACE, "path");
  glowPath.id = "fca-ecg-glow";
  glowPath.setAttribute("d", seamlessPathData);
  const corePath = svgDocument.createElementNS(SVG_NAMESPACE, "path");
  corePath.id = "fca-ecg-core";
  corePath.setAttribute("d", seamlessPathData);
  stationaryTrace.append(glowPath, corePath);
  maskedGroup.append(stationaryTrace);
  viewportGroup.append(maskedGroup);
  monitorFrame.insertBefore(viewportGroup, waveformPaths[0]);
}

function addBorderSweeps(svgDocument) {
  const borderPaths = [svgDocument.querySelector('#outer-frame > rect')].filter(Boolean);

  borderPaths.forEach((borderPath, pathIndex) => {
    // 三条同轨短虚线叠加为暖色薄边、白色主体和极短白色核心。
    [
      { length: 5.5, width: 2.8, color: "#d6b37a", opacity: 0.22 },
      { length: 3.2, width: 2, color: "#fffdf5", opacity: 0.72 },
      { length: 1.2, width: 1.2, color: "#ffffff", opacity: 1 }
    ].forEach((layer, layerIndex) => {
      const sweep = borderPath.cloneNode(false);
      sweep.removeAttribute("class");
      sweep.setAttribute("class", "fca-border-sweep");
      sweep.setAttribute("pathLength", "100");
      sweep.setAttribute("stroke", layer.color);
      sweep.setAttribute("stroke-width", String(layer.width));
      sweep.setAttribute("stroke-opacity", String(layer.opacity));
      sweep.setAttribute("stroke-dasharray", `${layer.length} ${100 - layer.length}`);
      sweep.style.animationDelay = `${pathIndex * -4 - layerIndex * 0.035}s`;
      borderPath.parentNode.append(sweep);
    });
  });
}

function addEntryMapScan(svgDocument) {
  const map = svgDocument.querySelector('#world-map');
  const box = map.getBBox();
  const defs = svgDocument.querySelector('defs');
  const gradient = svgDocument.createElementNS(SVG_NAMESPACE, 'linearGradient');
  gradient.id = 'fca-entry-map-gradient';
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('y2', '1');
  [0, 0.28, 0.5, 0.72, 1].forEach((offset, index) => {
    const stop = svgDocument.createElementNS(SVG_NAMESPACE, 'stop');
    stop.setAttribute('offset', String(offset));
    stop.setAttribute('stop-color', 'white');
    stop.setAttribute('stop-opacity', String([0, 0.45, 1, 0.45, 0][index]));
    gradient.append(stop);
  });
  const mask = svgDocument.createElementNS(SVG_NAMESPACE, 'mask');
  mask.id = 'fca-entry-map-mask';
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  Object.entries({ x: box.x, y: box.y, width: box.width, height: box.height }).forEach(([name, value]) => mask.setAttribute(name, String(value)));
  const band = svgDocument.createElementNS(SVG_NAMESPACE, 'rect');
  Object.entries({ x: box.x, y: box.y - 220, width: box.width, height: 220, fill: `url(#${gradient.id})` }).forEach(([name, value]) => band.setAttribute(name, String(value)));
  const motion = svgDocument.createElementNS(SVG_NAMESPACE, 'animateTransform');
  Object.entries({ attributeName: 'transform', type: 'translate', from: '0 0', to: `0 ${box.height + 440}`, dur: '12s', repeatCount: 'indefinite' }).forEach(([name, value]) => motion.setAttribute(name, value));
  band.append(motion);
  mask.append(band);
  defs.append(gradient, mask);
  const scan = svgDocument.createElementNS(SVG_NAMESPACE, 'g');
  scan.id = 'fca-entry-map-scan';
  scan.classList.add('fca-entry-map-breath');
  scan.setAttribute('mask', `url(#${mask.id})`);
  const image = svgDocument.createElementNS(SVG_NAMESPACE, 'use');
  image.setAttribute('href', '#world-map');
  scan.append(image);
  // 使用同一张矢量地图；宽遮罩移动，地图和其上所有UI均不会位移。
  map.after(scan);
}

function startEntryClock(svgDocument) {
  const dateText = svgDocument.querySelector('#fca-entry-local-date tspan');
  const timeText = svgDocument.querySelector('#fca-entry-local-time tspan');
  if (!dateText || !timeText) throw new Error('入口缺少右上角日期和时间组件');
  const pad = value => String(value).padStart(2, '0');
  const update = () => {
    // 每次读取电脑本地时钟，避免以计时器累加导致休眠、手动校时或跨日后漂移。
    const now = new Date();
    // 年份保持FCA世界观的2126；月、日和时分继续跟随主机本地时间。
    const date = `2126/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (dateText.textContent !== date) dateText.textContent = date;
    if (timeText.textContent !== time) timeText.textContent = time;
  };
  update();
  const timer = window.setInterval(update, 1000);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', update);
  // 交接系统页后由系统页自己的时钟接管，不让入口时钟留在后台更新。
  window.addEventListener('fca:dashboard-entered', () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', update);
    document.removeEventListener('visibilitychange', update);
  }, { once: true });
}

function initializeEntryScreen(svgDocument) {
  const { root, leftRingInner, leftRingOuter, entryCube, accessPanel, scanner,
    scannerLayers, centerRings, outermostScannerLayer, codePanel, codeNode, codeConnector,
    lowerOrangePanel, eyeArtwork } = prepareEntryArtwork(svgDocument);

  addSvgRuntimeStyles(svgDocument);
  startEntryClock(svgDocument);
  enhanceEcgTrace(svgDocument);
  addBorderSweeps(svgDocument);
  addEntryMapScan(svgDocument);

  leftRingInner.id = "fca-left-ring-inner";
  leftRingOuter.id = "fca-left-ring-outer";
  entryCube.id = "fca-entry-cube";
  accessPanel.id = "fca-access-panel";
  scanner.id = "fca-scanner";
  codePanel.id = "fca-code-panel";
  codeNode.id = "fca-code-node";
  codeConnector.id = "fca-code-connector";

  // 透明命中区覆盖整个圆形范围，使圆环之间的空隙同样可以触发点击。
  const scannerHitArea = svgDocument.createElementNS(SVG_NAMESPACE, "circle");
  scannerHitArea.setAttribute("cx", "335.76");
  scannerHitArea.setAttribute("cy", "325.51");
  scannerHitArea.setAttribute("r", "308.58");
  scannerHitArea.setAttribute("fill", "transparent");
  scannerHitArea.setAttribute("pointer-events", "all");
  scanner.insertBefore(scannerHitArea, scanner.firstChild);

  scannerLayers.forEach((layer, index) => {
    layer.classList.add("fca-scanner-layer");
    layer.style.setProperty("--spin-speed", `${7 + index * 4.5}s`);
    if (index % 2 === 1) layer.classList.add("is-reversed");
  });

  // 新图最外圈从页面开始就以7秒一周匀速旋转，其余层仍等待正确工号后加速。
  outermostScannerLayer.classList.add("is-always-spinning");
  outermostScannerLayer.style.setProperty("--spin-speed", "7s");

  const centerRingSpeeds = [5.8, 9.6, 14.2];
  centerRings.forEach((ring, index) => {
    ring.classList.add("fca-scanner-center-ring");
    ring.style.setProperty("--spin-speed", `${centerRingSpeeds[index]}s`);
    if (index === 1) ring.classList.add("is-reversed");
  });

  // 正确工号通过后才启用下方按钮与圆形扫描效果。
  const {
    button: successButton,
    node: successNode,
    connector: successConnector
  } = createSuccessButton(svgDocument, lowerOrangePanel);
  const scannerScan = createScannerScanEffect(svgDocument, root);
  const eyeScanner = createEyeScanner(svgDocument, eyeArtwork);

  // 两条新连线均已按“圆点 → 面板”排列，直接沿原形状生成。
  const connectorLength = codeConnector.getTotalLength();
  codeConnector.style.setProperty("--connector-length", `${connectorLength}px`);
  const codeInputs = createCodeInputs(svgDocument, codePanel);

  let errorState = "closed";
  let errorTransitionTimer = null;
  let identityResultState = "closed";
  let identityResultTimer = null;
  let cameraPromptState = "closed";
  let cameraPromptTimer = null;
  let accessGranted = false;

  const dismissCameraPrompt = () => {
    if (cameraPromptState === "closed" || cameraPromptState === "closing") return;

    window.clearTimeout(cameraPromptTimer);
    cameraPromptState = "closing";
    cameraPromptOverlay.classList.remove("is-opening", "is-open");
    cameraPromptOverlay.classList.add("is-closing");
    cameraPromptTimer = window.setTimeout(() => {
      cameraPromptOverlay.classList.remove("is-closing");
      cameraPromptOverlay.setAttribute("aria-hidden", "true");
      cameraPromptState = "closed";
    }, 280);
  };

  const showCameraPrompt = () => {
    if (cameraPromptState !== "closed") return;

    playOneShot(popupAudio, "摄像头提示弹窗音效");
    cameraPromptState = "opening";
    cameraPromptOverlay.classList.remove("is-closing", "is-open");
    void cameraPromptOverlay.offsetWidth;
    cameraPromptOverlay.classList.add("is-opening");
    cameraPromptOverlay.setAttribute("aria-hidden", "false");
    cameraPromptOverlay.focus({ preventScroll: true });
    cameraPromptTimer = window.setTimeout(() => {
      if (cameraPromptState !== "opening") return;
      cameraPromptOverlay.classList.remove("is-opening");
      cameraPromptOverlay.classList.add("is-open");
      cameraPromptState = "open";
    }, 240);
  };

  const dismissIdentityResult = () => {
    if (identityResultState === "closed" || identityResultState === "closing") return;

    window.clearTimeout(identityResultTimer);
    identityResultState = "closing";
    identitySuccessOverlay.classList.remove("is-opening", "is-open");
    identitySuccessOverlay.classList.add("is-closing");
    identityResultTimer = window.setTimeout(() => {
      identitySuccessOverlay.classList.remove("is-closing");
      identitySuccessOverlay.setAttribute("aria-hidden", "true");
      identityResultState = "closed";
      // 成功提示关闭后交接系统页，并释放上一页摄像头设备。
      eyeCameraVideo.srcObject?.getTracks().forEach((track) => track.stop());
      eyeScanAudio.pause();
      window.dispatchEvent(new CustomEvent("fca:enter-dashboard"));
    }, 280);
  };

  const showIdentityResult = () => {
    if (identityResultState !== "closed") return;

    playOneShot(popupAudio, "身份验证弹窗音效");
    identityResultState = "opening";
    identitySuccessOverlay.classList.remove("is-closing", "is-open");
    void identitySuccessOverlay.offsetWidth;
    identitySuccessOverlay.classList.add("is-opening");
    identitySuccessOverlay.setAttribute("aria-hidden", "false");
    identitySuccessOverlay.focus({ preventScroll: true });
    identityResultTimer = window.setTimeout(() => {
      if (identityResultState !== "opening") return;
      identitySuccessOverlay.classList.remove("is-opening");
      identitySuccessOverlay.classList.add("is-open");
      identityResultState = "open";
    }, 240);
  };

  const revealSuccessState = () => {
    playOneShot(screenOpenAudio, "瞳孔扫描按钮打开音效");
    scannerScan.classList.add("is-active");
    successNode.classList.add("is-igniting");
    successConnector.classList.add("is-drawing");
    successButton.classList.add("is-projecting");

    const finishProjection = (event) => {
      if (event.animationName !== "fca-code-panel-project") return;
      successButton.classList.remove("is-projecting");
      successButton.classList.add("is-visible");
    };
    successButton.addEventListener("animationend", finishProjection, { once: true });
  };

  const dismissCodeError = () => {
    if (errorState === "closed" || errorState === "closing") return;

    window.clearTimeout(errorTransitionTimer);
    errorState = "closing";
    codeErrorOverlay.classList.remove("is-opening", "is-open");
    codeErrorOverlay.classList.add("is-closing");

    errorTransitionTimer = window.setTimeout(() => {
      codeErrorOverlay.classList.remove("is-closing");
      codeErrorOverlay.setAttribute("aria-hidden", "true");
      errorState = "closed";

      // 警告关闭后清空错误工号，恢复第一格输入焦点。
      codeInputs.forEach((input) => {
        input.value = "";
        input.disabled = false;
      });
      codeInputs[0]?.focus();
    }, 280);
  };

  const showCodeError = () => {
    if (errorState !== "closed") return;

    playOneShot(popupAudio, "工号错误弹窗音效");
    errorState = "opening";
    codeInputs.forEach((input) => { input.disabled = true; });
    codeErrorOverlay.classList.remove("is-closing", "is-open");
    // 强制刷新动画初始状态，保证连续两次输错都能重新播放弹出效果。
    void codeErrorOverlay.offsetWidth;
    codeErrorOverlay.classList.add("is-opening");
    codeErrorOverlay.setAttribute("aria-hidden", "false");
    codeErrorOverlay.focus({ preventScroll: true });
    errorTransitionTimer = window.setTimeout(() => {
      if (errorState !== "opening") return;
      codeErrorOverlay.classList.remove("is-opening");
      codeErrorOverlay.classList.add("is-open");
      errorState = "open";
    }, 240);
  };

  const validateAccessCode = () => {
    if (accessGranted || errorState !== "closed") return;
    if (!codeInputs.every((input) => input.value.length === 1)) return;

    const code = codeInputs.map((input) => input.value).join("");
    if (code !== "4986" && code !== "7777") {
      showCodeError();
      return;
    }

    accessGranted = true;
    gameRoot.dataset.accessGranted = "true";
    codePanel.setAttribute("data-access-granted", "true");
    codeInputs.forEach((input) => { input.readOnly = true; });
    if (code === "7777") {
      window.dispatchEvent(new CustomEvent("fca:enter-dashboard"));
      return;
    }

    // 4986验证成功后立即加速，继续原有摄像头扫描流程。
    const acceleratingLayers = scannerLayers.filter((layer) => layer !== outermostScannerLayer);
    accelerateScannerRotations([...acceleratingLayers, ...centerRings]);
    revealSuccessState();
    window.dispatchEvent(new CustomEvent("fca:access-granted", {
      detail: { investigatorId: code }
    }));
  };

  codeInputs.forEach((input) => input.addEventListener("input", validateAccessCode));
  codeErrorOverlay.addEventListener("click", dismissCodeError);
  identitySuccessOverlay.addEventListener("click", dismissIdentityResult);
  cameraPromptOverlay.addEventListener("click", dismissCameraPrompt);
  document.addEventListener("keydown", dismissCodeError);
  document.addEventListener("keydown", dismissIdentityResult);
  document.addEventListener("keydown", dismissCameraPrompt);
  svgDocument.addEventListener("keydown", dismissCodeError);
  svgDocument.addEventListener("keydown", dismissIdentityResult);
  svgDocument.addEventListener("keydown", dismissCameraPrompt);
  window.addEventListener("fca:eye-scan-complete", showIdentityResult);
  window.addEventListener("fca:eye-scan-face-missing", showCameraPrompt);
  window.addEventListener("fca:eye-scan-face-found", dismissCameraPrompt);

  entryCube.setAttribute("role", "img");
  entryCube.setAttribute("aria-label", "Morse Code提示标志");
  scanner.setAttribute("tabindex", "0");
  scanner.setAttribute("role", "button");
  scanner.setAttribute("aria-label", "调出工号输入面板");

  // Morse表格从首帧直接可见，图标只保留旋转/呼吸，不再作为展开开关。
  accessPanel.classList.add('is-settled');

  const revealCodePanel = () => {
    if (
      codePanel.classList.contains("is-projecting")
      || codePanel.classList.contains("is-visible")
    ) return;

    playOneShot(screenOpenAudio, "工号输入屏幕打开音效");
    codeNode.classList.add("is-igniting");
    codeConnector.classList.add("is-drawing");
    codePanel.classList.add("is-projecting");

    const finishProjection = (event) => {
      if (event.animationName !== "fca-code-panel-project") return;
      codePanel.classList.add("is-visible");
      codePanel.classList.remove("is-projecting");
      codeInputs.forEach((input) => { input.disabled = false; });
    };
    codePanel.addEventListener("animationend", finishProjection, { once: true });
  };

  scanner.addEventListener("click", revealCodePanel);
  scanner.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      revealCodePanel();
    }
  });

  const continueIntoSystem = () => {
    if (!accessGranted || !successButton.classList.contains("is-visible")) return;
    activateEyeScanner(eyeScanner);
    window.dispatchEvent(new CustomEvent("fca:continue-requested", {
      detail: { investigatorId: "4986" }
    }));
  };

  successButton.addEventListener("click", continueIntoSystem);
  // SVG g并非原生HTML按钮，显式维护按下状态，保证各平台都有变深反馈。
  successButton.addEventListener('pointerdown', event => {
    if (event.button === 0 && accessGranted) successButton.classList.add('is-pressed');
  });
  const releaseSuccessButton = () => successButton.classList.remove('is-pressed');
  successButton.addEventListener('pointerleave', releaseSuccessButton);
  svgDocument.addEventListener('pointerup', releaseSuccessButton);
  svgDocument.addEventListener('pointercancel', releaseSuccessButton);
  window.addEventListener('blur', releaseSuccessButton);
  successButton.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    successButton.classList.add("is-pressed");
    window.setTimeout(() => successButton.classList.remove("is-pressed"), 120);
    continueIntoSystem();
  });
}

function initializeLoadedArtwork() {
  if (entryArtwork.closest('.system-entry').hidden) return;
  const svgDocument = entryArtwork.contentDocument;
  if (!svgDocument) throw new Error("无法读取FCA入口SVG");
  initializeEntryScreen(svgDocument);
}

function initializeErrorArtwork() {
  const svgDocument = codeErrorArtwork.contentDocument;
  if (!svgDocument) throw new Error("无法读取错误警告SVG");
  addErrorSymbolGlow(svgDocument);
}

function initializeIdentityArtwork() {
  const svgDocument = identitySuccessArtwork.contentDocument;
  if (!svgDocument) throw new Error("无法读取身份验证通过SVG");
  addVerifiedSymbolGlow(svgDocument);
}

if (entryArtwork.contentDocument?.querySelector("#_000")) {
  initializeLoadedArtwork();
} else {
  entryArtwork.addEventListener("load", initializeLoadedArtwork, { once: true });
}

if (codeErrorArtwork.contentDocument?.querySelector("#_进入系统")) {
  initializeErrorArtwork();
} else {
  codeErrorArtwork.addEventListener("load", initializeErrorArtwork, { once: true });
}

if (identitySuccessArtwork.contentDocument?.querySelector("#_进入系统")) {
  initializeIdentityArtwork();
} else {
  identitySuccessArtwork.addEventListener("load", initializeIdentityArtwork, { once: true });
}
