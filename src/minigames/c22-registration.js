import { c22MagneticFieldEngine, C22_ENGINE_ID, C22_ENGINE_VERSION } from "./engines/c22-magnetic-field.js";
import { c22Fixture, C22_FIXTURE_ID } from "./fixtures/c22-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";

export const c22BundledSource = createBundledGameSource([c22Fixture]);

export function createC22Registry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: C22_ENGINE_ID,
    engineVersion: C22_ENGINE_VERSION,
    engine: c22MagneticFieldEngine,
    production: true,
  });
  return registry;
}

export function createC22MissionInstance(mission) {
  if (Number(mission?.questionNumber) !== 59 || Number(mission?.challengeIndex) !== 0) {
    throw new TypeError("C22 is registered only for Q59 mission slot 0");
  }
  const definition = c22BundledSource.get(C22_FIXTURE_ID, { mode: "lab" });
  return missionGameInstanceFrom({ mission, definition });
}
