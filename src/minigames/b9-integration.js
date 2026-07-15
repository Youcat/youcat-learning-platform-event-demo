import { b9Engine } from "./engines/b9-engine.js";
import { B9_ENGINE_ID, B9_ENGINE_VERSION, B9_FIXTURE_ID, b9Fixture } from "./fixtures/b9-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

const b9Source = createBundledGameSource([b9Fixture]);

export function createB9Registry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: B9_ENGINE_ID,
    engineVersion: B9_ENGINE_VERSION,
    engine: b9Engine,
    production: true,
  });
  return registry;
}

export function b9MissionInstance(mission) {
  return missionGameInstanceFrom({ mission, definition: b9Source.get(B9_FIXTURE_ID, { mode: "mission" }) });
}

export async function applyB9MissionResult({ interaction, result, finish }) {
  if (!interaction || interaction.attempted || result?.engineId !== B9_ENGINE_ID || result?.mode !== "mission") return false;
  interaction.attempted = true;
  interaction.finished = true;
  interaction.currentCorrect = Boolean(result.correct && result.complete);
  interaction.succeeded = interaction.currentCorrect;
  await finish(interaction.currentCorrect);
  return true;
}

export function launchB9MissionStage({ mount, mission, language, onResult, onClose }) {
  return launchGameStage({
    mount,
    instance: b9MissionInstance(mission),
    registry: createB9Registry(),
    language,
    onResult,
    onClose,
  });
}
