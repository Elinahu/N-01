const KEY = 'fca.checkpoint.v1';
const NEW_GAME = 'fca.new-game';
let lastSaved;
let resetting = false;

export function startNewGame() {
  if (resetting) return;
  sessionStorage.setItem(NEW_GAME, '1');
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    sessionStorage.removeItem(NEW_GAME);
    throw error;
  }
  // The old page also saves on beforeunload. It must not restore the cleared checkpoint.
  resetting = true;
  location.reload();
}

export function consumeNewGameRequest() {
  try {
    if (sessionStorage.getItem(NEW_GAME) !== '1') return false;
    sessionStorage.removeItem(NEW_GAME);
    return true;
  } catch {
    return false;
  }
}

export function readCheckpoint() {
  try {
    const raw = localStorage.getItem(KEY);
    const checkpoint = JSON.parse(raw);
    if (checkpoint?.version !== 1 || !Array.isArray(checkpoint.windows)) return null;
    lastSaved = raw;
    return checkpoint;
  } catch {
    return null;
  }
}

export function writeCheckpoint(state) {
  if (resetting) return;
  try {
    const serialized = JSON.stringify({ version: 1, ...state });
    if (serialized === lastSaved) return;
    localStorage.setItem(KEY, serialized);
    lastSaved = serialized;
  } catch (error) {
    console.warn('FCA续玩记录无法保存', error);
  }
}
