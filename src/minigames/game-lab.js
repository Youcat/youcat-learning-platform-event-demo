import { skeletonEngine } from "./engines/skeleton-engine.js";
import { SKELETON_FIXTURE_ID, skeletonFixture } from "./fixtures/skeleton-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

const source = createBundledGameSource([skeletonFixture]);

function labError(mount, id, language) {
  const en = language === "en";
  mount.innerHTML = `<main class="minigame-lab-error"><h1>${en ? "Game Lab fixture not found" : "Fixture do Laboratório não encontrada"}</h1><p>${en ? "Available fixture" : "Fixture disponível"}: <a href="?lab=${SKELETON_FIXTURE_ID}&lang=${language}">${SKELETON_FIXTURE_ID}</a></p><code>${String(id || "")}</code></main>`;
}

export async function startGameLab({ mount, id, language = "pt" }) {
  const instance = source.get(id, { mode: "lab" });
  if (!instance) {
    labError(mount, id, language);
    return null;
  }
  const registry = createMinigameRegistry();
  registry.register({
    engineId: "foundation-skeleton",
    engineVersion: "1.0.0",
    engine: skeletonEngine,
    production: false,
  });
  return launchGameStage({
    mount,
    instance,
    registry,
    language,
    onClose: () => { window.location.href = `?lang=${language}`; },
  });
}
