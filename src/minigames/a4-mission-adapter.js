import { a4Engine, A4_ENGINE_ID, A4_ENGINE_VERSION } from "./engines/a4-engine.js";
import { a4MissionDefinition } from "./fixtures/a4-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { launchGameStage } from "./stage-shell.js";

export function createA4MissionInstance(mission) {
  return missionGameInstanceFrom({ mission, definition: a4MissionDefinition });
}

export async function launchA4Mission({ mount, mission, language, onResult, onClose }) {
  const instance = createA4MissionInstance(mission);
  const registry = createMinigameRegistry();
  registry.register({
    engineId: A4_ENGINE_ID,
    engineVersion: A4_ENGINE_VERSION,
    engine: a4Engine,
    production: true,
  });
  return launchGameStage({ mount, instance, registry, language, onResult, onClose });
}
