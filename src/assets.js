let resolveAsset = path => new URL('./assets/' + path, document.baseURI).href;

export function assetUrl(path) {
  return resolveAsset(path);
}

export function useEmbeddedAssets(resolve) {
  resolveAsset = resolve;
}
