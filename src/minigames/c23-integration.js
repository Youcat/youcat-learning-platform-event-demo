import { c23Engine } from "./engines/c23-engine.js";
import { C23_FIXTURE_ID, c23Fixture } from "./fixtures/c23-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

export const c23BundledSource = createBundledGameSource([c23Fixture]);

export function createC23Registry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: "C23",
    engineVersion: "1.0.0",
    engine: c23Engine,
    production: true,
  });
  return registry;
}

export function createC23MissionInstance(mission) {
  if (Number(mission?.questionNumber) !== 25 || Number(mission?.challengeIndex) !== 1) {
    throw new TypeError("C23 is registered only for YOUCAT Love Forever 25, mission slot 1");
  }
  const definition = c23BundledSource.get(C23_FIXTURE_ID, { mode: "mission" });
  return missionGameInstanceFrom({ mission, definition });
}

export function createC23SingleSubmissionAdapter(onResult = () => {}) {
  let delivered = false;
  return async function deliverOnce(result) {
    if (delivered) return false;
    delivered = true;
    await onResult(result);
    return true;
  };
}

export function launchC23MissionStage({ mount, mission, language, onResult, onClose }) {
  const instance = createC23MissionInstance(mission);
  return launchGameStage({
    mount,
    instance,
    registry: createC23Registry(),
    language,
    onResult: createC23SingleSubmissionAdapter(onResult),
    onClose,
  });
}
