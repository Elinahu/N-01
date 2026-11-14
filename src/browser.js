import { useEmbeddedAssets } from './assets.js';

const svgType = 'image/svg+xml';
const assetTag = document.querySelector('#fca-embedded-assets');
const assets = JSON.parse(assetTag.textContent);
assetTag.remove();
const urls = new Map();
const parser = new DOMParser();

function resolveArtwork(path, source) {
  return source.replace(/(\bhref=["'])(\.{1,2}\/[^"']+)(["'])/g, (_match, start, reference, end) => {
    const relativePath = new URL(reference, 'https://fca.invalid/' + path).pathname.slice(1);
    return start + embeddedUrl(relativePath) + end;
  });
}

function embeddedUrl(path) {
  if (!urls.has(path)) {
    if (!Object.hasOwn(assets, path)) throw new Error('Missing FCA asset: ' + path);
    const [type, source] = assets[path];
    const content = type === svgType ? resolveArtwork(path, source) : decodeBase64(source);
    urls.set(path, URL.createObjectURL(new Blob([content], { type })));
    if (type !== svgType) delete assets[path];
  }
  return urls.get(path);
}

function decodeBase64(source) {
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(source);
  const binary = atob(source);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

useEmbeddedAssets(embeddedUrl);

for (const style of document.querySelectorAll('[data-fca-stylesheet]')) {
  style.textContent = style.textContent.replace(/url\(['"]?\.\/assets\/([^)'"]+)['"]?\)/g,
    (_match, path) => 'url("' + embeddedUrl(path) + '")');
}

for (const media of document.querySelectorAll('[data-fca-media]')) {
  media.src = embeddedUrl(media.dataset.fcaMedia);
}

// A file URL cannot read an external object's SVG document. Blank iframes
// inherit the page's origin and keep each SVG's styles and IDs isolated.
for (const frame of document.querySelectorAll('[data-fca-artwork]')) {
  const path = frame.dataset.fcaArtwork;
  const artwork = parser.parseFromString(resolveArtwork(path, assets[path][1]), svgType);
  if (artwork.querySelector('parsererror')) throw new Error('Invalid FCA artwork: ' + path);
  const target = frame.contentDocument;
  const svg = target.importNode(artwork.documentElement, true);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  target.replaceChild(svg, target.documentElement);
}
