import { a7Engine } from "./engines/a7-engine.js";
import { A7_ENGINE_ID, A7_ENGINE_VERSION, a7Fixture } from "./fixtures/a7-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { launchGameStage } from "./stage-shell.js";

export function createA7MissionInstance(mission) {
  if (Number(mission?.questionNumber) !== 68 || Number(mission?.challengeIndex) !== 3) {
    throw new TypeError("A7 is registered only for Q68 mission slot 3");
  }
  return missionGameInstanceFrom({ mission, definition: a7Fixture });
}
export function createOneSubmissionHandler(handler) {
  let consumed = false;
  return async (result) => {
    if (consumed) return false;
    consumed = true;
    await handler(result);
    return true;
  };
}

export function launchA7MissionStage({ mount, mission, language, onResult, onClose }) {
  const registry = createMinigameRegistry();
  registry.register({ engineId: A7_ENGINE_ID, engineVersion: A7_ENGINE_VERSION, engine: a7Engine, production: true });
  return launchGameStage({
    mount,
    instance: createA7MissionInstance(mission),
    registry,
    language,
    onResult: createOneSubmissionHandler(onResult),
    onClose,
  });
}
