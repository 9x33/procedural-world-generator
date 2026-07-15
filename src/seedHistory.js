const SEED_HISTORY_KEY = "world-generator-seeds";
const MAX_SEED_HISTORY = 8;

// Keeps the seed dropdown small while still making recent worlds easy to reopen.
export function createSeedHistory({ select, input, onChoose }) {
  select.addEventListener("change", () => {
    if (!select.value) return;
    input.value = select.value;
    onChoose();
  });

  return {
    remember(seed) {
      const cleanSeed = seed.trim() || "world";
      const history = loadSeedHistory().filter((item) => item !== cleanSeed);

      history.unshift(cleanSeed);
      saveSeedHistory(history);
      renderSeedHistory(select, history, cleanSeed);
    },

    render() {
      renderSeedHistory(select, loadSeedHistory(), input.value);
    }
  };
}

function loadSeedHistory() {
  try {
    return JSON.parse(localStorage.getItem(SEED_HISTORY_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveSeedHistory(history) {
  localStorage.setItem(SEED_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEED_HISTORY)));
}

function renderSeedHistory(select, history, currentSeed) {
  if (!history.length) {
    select.innerHTML = `<option value="">No saved seeds yet</option>`;
    return;
  }

  select.innerHTML = [
    `<option value="">Seed history</option>`,
    ...history.map((seed) => `<option value="${escapeHtml(seed)}">${escapeHtml(seed)}</option>`)
  ].join("");
  select.value = history.includes(currentSeed) ? currentSeed : "";
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
