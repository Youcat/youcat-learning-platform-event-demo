import { a2Engine } from "./engines/a2-engine.js";
import { skeletonEngine } from "./engines/skeleton-engine.js";
import { A2_FIXTURE_ID, a2Fixture } from "./fixtures/a2-fixture.js";
import { SKELETON_FIXTURE_ID, skeletonFixture } from "./fixtures/skeleton-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

const source = createBundledGameSource([skeletonFixture, a2Fixture]);

function labError(mount, id, language) {
  const en = language === "en";
  mount.innerHTML = `<main class="minigame-lab-error"><h1>${en ? "Game Lab fixture not found" : "Fixture do Laboratório não encontrada"}</h1><p>${en ? "Available fixtures" : "Fixtures disponíveis"}: <a href="?lab=${A2_FIXTURE_ID}&lang=${language}">${A2_FIXTURE_ID}</a> · <a href="?lab=${SKELETON_FIXTURE_ID}&lang=${language}">${SKELETON_FIXTURE_ID}</a></p><code>${String(id || "")}</code></main>`;
}

export async function startGameLab({ mount, id, language = "pt" }) {
  const instance = bundledMinigameSource.get(id, { mode: "lab" });
  if (!instance) {
    labError(mount, id, language);
    return null;
  }
  const registry = createMinigameRegistry();
  registry.register({
    engineId: "C23",
    engineVersion: "1.0.0",
    engine: c23Engine,
    production: true,
  });
  registry.register({
    engineId: "foundation-skeleton",
    engineVersion: "1.0.0",
    engine: skeletonEngine,
    production: false,
  });
  registry.register({
    engineId: "A2",
    engineVersion: "1.0.0",
    engine: a2Engine,
    production: true,
  });
  return launchGameStage({
    mount,
    instance,
    registry: createAppMinigameRegistry(),
    language,
    onClose: () => { window.location.href = `?lang=${language}`; },
  });
}
