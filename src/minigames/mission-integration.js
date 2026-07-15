import { b13MatchingPairsEngine, B13_ENGINE_ID, B13_ENGINE_VERSION } from "./engines/b13-matching-pairs.js";
import { b13Fixture } from "./fixtures/b13-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

const source = createBundledGameSource([b13Fixture]);

function createProductionRegistry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: B13_ENGINE_ID,
    engineVersion: B13_ENGINE_VERSION,
    engine: b13MatchingPairsEngine,
    production: true,
  });
  return registry;
}

export function b13MissionInstanceFrom({ mission, activity }) {
  if (activity?.type !== "minigame"
    || activity.engineId !== B13_ENGINE_ID
    || activity.engineVersion !== B13_ENGINE_VERSION
    || activity.fixtureId !== b13Fixture.id) {
    throw new TypeError("Mission activity does not reference the registered B13 fixture");
  }
  const definition = source.get(activity.fixtureId);
  return missionGameInstanceFrom({ mission, definition });
}

export function launchB13MissionGame({ mount, mission, activity, language, onResult, onClose }) {
  const instance = b13MissionInstanceFrom({ mission, activity });
  return launchGameStage({
    mount,
    instance,
    registry: createProductionRegistry(),
    language,
    onResult,
    onClose,
  });
}
