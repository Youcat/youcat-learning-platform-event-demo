import { c20Engine } from "./engines/c20-engine.js";
import { C20_ENGINE_ID, C20_ENGINE_VERSION, C20_FIXTURE_ID, c20Fixture } from "./fixtures/c20-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

export const c20Source = createBundledGameSource([c20Fixture]);

export function createC20Registry() {
  return createMinigameRegistry().register({
    engineId: C20_ENGINE_ID,
    engineVersion: C20_ENGINE_VERSION,
    engine: c20Engine,
    production: true,
  });
}

export function createC20MissionInstance({ mission, activity }) {
  if (Number(mission?.questionNumber) !== 83 || Number(mission?.challengeIndex) !== 1) {
    throw new TypeError("C20 is registered only for question 83 mission slot 1");
  }
  if (activity?.type !== "minigame" || activity.engineId !== C20_ENGINE_ID || activity.engineVersion !== C20_ENGINE_VERSION) {
    throw new TypeError("Question 83 mission slot 1 is not configured for C20@1.0.0");
  }
  const definition = c20Source.get(C20_FIXTURE_ID, { mode: "mission" });
  return missionGameInstanceFrom({ mission, definition });
}

export function launchC20Mission({ mount, mission, activity, language, onResult, onClose }) {
  const instance = createC20MissionInstance({ mission, activity });
  return launchGameStage({
    mount,
    instance,
    registry: createC20Registry(),
    language,
    onResult,
    onClose,
  });
}
