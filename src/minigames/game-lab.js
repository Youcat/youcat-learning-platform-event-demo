import { bundledMinigameSource, createAppMinigameRegistry } from "./catalog.js";
import { launchGameStage } from "./stage-shell.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function labError(mount, id, language) {
  const en = language === "en";
  const links = bundledMinigameSource.list().map((fixture) => `<a href="?lab=${encodeURIComponent(fixture.id)}&lang=${language}">${escapeHtml(fixture.id)}</a>`).join(" · ");
  mount.innerHTML = `<main class="minigame-lab-error"><h1>${en ? "Game Lab fixture not found" : "Fixture do Laboratório não encontrada"}</h1><p>${en ? "Available fixtures" : "Fixtures disponíveis"}: ${links}</p><code>${escapeHtml(id)}</code></main>`;
}

export async function startGameLab({ mount, id, language = "pt" }) {
  const instance = bundledMinigameSource.get(id, { mode: "lab" });
  if (!instance) {
    labError(mount, id, language);
    return null;
  }
  return launchGameStage({
    mount,
    instance,
    registry: createAppMinigameRegistry(),
    language,
    onClose: () => { window.location.href = `?lang=${language}`; },
  });
}
