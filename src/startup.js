import { enterDashboard } from './dashboard.js';
import { consumeNewGameRequest, readCheckpoint } from './checkpoint.js';
import { releaseEffect, trackEffect } from './audio-settings.js';

const game = document.querySelector('#game');
const intro = document.querySelector('#startup-intro');
// The embedded opening sound uses the saved SFX level before the film starts.
const video = trackEffect(intro.querySelector('video'));
const bgm = document.querySelector('#game-bgm');
const startButton = intro.querySelector('#fca-start-game');
// Align the live screen with the scan opening and settling in the approved film.
const revealAt = 106 / 30;
const settleAt = 126 / 30;
let finished = false;
let prepared = false;
let frameRequest;
let watchdog;

const newGame = consumeNewGameRequest();
const checkpoint = newGame ? null : readCheckpoint();
const destination = (checkpoint ? enterDashboard(checkpoint) : Promise.resolve())
  .finally(() => { prepared = true; });

function playBackgroundMusic() {
  const retry = new AbortController();
  const play = () => {
    bgm.play().then(() => retry.abort(), error => {
      if (startButton && error.name === 'NotAllowedError') return;
      retry.abort();
      console.warn('FCA背景音乐未能播放', error);
    });
  };
  if (startButton) {
    const entryDocument = document.querySelector('#system-entry-art').contentDocument;
    const options = { capture: true, signal: retry.signal };
    for (const target of [document, entryDocument]) {
      target?.addEventListener('click', play, options);
      target?.addEventListener('keydown', play, options);
    }
  }
  play();
}

async function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(watchdog);
  cancelAnimationFrame(frameRequest);
  video.pause();
  releaseEffect(video);
  await destination;
  game.classList.remove('is-startup-reveal');
  game.style.removeProperty('--startup-edge');
  intro.remove();
  game.inert = false;
  window.dispatchEvent(new Event('fca:startup-ready'));
  playBackgroundMusic();
}

function revealScreen() {
  const time = video.currentTime;
  if (time >= revealAt) intro.classList.add('has-finished-title');
  if (prepared && time >= revealAt) {
    const progress = Math.min(1, (time - revealAt) / (settleAt - revealAt));
    const edge = 49.6 * (1 - progress) ** 2.25;
    game.style.setProperty('--startup-edge', edge + '%');
    intro.style.setProperty('--startup-edge', edge + '%');
    intro.style.setProperty('--startup-glow', String(0.56 * (1 - progress)));
    game.classList.add('is-startup-reveal');
    intro.classList.add('is-revealing');
  }
  if (!finished && (!prepared || time < settleAt)) frameRequest = requestAnimationFrame(revealScreen);
}

function playIntro(allowPrompt = true) {
  watchdog = setTimeout(finish, 8000);
  video.play().then(() => {
    if (!finished) frameRequest = requestAnimationFrame(revealScreen);
  }, error => {
    if (!startButton || error.name !== 'NotAllowedError' || !allowPrompt) {
      finish();
      return;
    }
    clearTimeout(watchdog);
    intro.removeAttribute('aria-hidden');
    startButton.hidden = false;
    startButton.addEventListener('click', () => {
      startButton.hidden = true;
      intro.setAttribute('aria-hidden', 'true');
      playIntro(false);
    }, { once: true });
  });
}

if (newGame) finish();
else {
  video.addEventListener('ended', finish, { once: true });
  video.addEventListener('error', finish, { once: true });
  playIntro();
}
