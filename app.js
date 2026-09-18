// Shared state, synchronous persistence and small UI utilities.
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let stored = null;
try {
  stored = JSON.parse(localStorage.getItem('deckroom-quests') || 'null');
} catch {
  localStorage.setItem('deckroom-corrupt-backup', localStorage.getItem('deckroom-quests') || '');
}
const state = stored?.games
  ? stored
  : {
      activeGame: 'kards',
      games: Object.fromEntries(
        GAMES.map(([id]) => [
          id,
          {
            generalDate: '',
            generalMissions: [],
            completedMissions: [],
            refreshed: [],
            seasonQuests: [],
            weeklyCount: 0,
            rewards: { credits: 0, seasonXp: 0 }
          }
        ])
      )
    };
for (const entry of state.customGames || [])
  if (!GAMES.some(([id]) => id === entry[0])) GAMES.push(entry);
for (const [id, name] of Object.entries(state.gameNames || {})) {
  const entry = GAMES.find(([gid]) => gid === id);
  if (entry) entry[1] = name;
}
let lastCommittedState = structuredClone(state);
let lastCommittedSerialized = localStorage.getItem('deckroom-quests');
function restoreCommittedState() {
  const restored = structuredClone(lastCommittedState);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, restored);
}
function save({ deferRefreshDeadline = false } = {}) {
  try {
    const serialized = JSON.stringify(state);
    if (serialized === lastCommittedSerialized) return true;
    const snapshot = structuredClone(state);
    localStorage.setItem('deckroom-quests', serialized);
    lastCommittedState = snapshot;
    lastCommittedSerialized = serialized;
    if (!deferRefreshDeadline) rebuildRefreshDeadline();
    return true;
  } catch (error) {
    restoreCommittedState();
    nextRefreshAt = 0;
    throw error;
  }
}
function data() {
  return state.games[state.activeGame];
}
function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2200);
}
function setQuestSummary(label, value) {
  $('#questSummary').hidden = false;
  $('#questSummaryLabel').textContent = label;
  $('#questSummaryValue').textContent = value;
}
function clearQuestSummary() {
  $('#questSummary').hidden = true;
}
function renderAll() {
  return renderManaged();
}
