import { a2Engine } from "./engines/a2-engine.js";
import {
  A2_ENGINE_ID,
  A2_ENGINE_VERSION,
  A2_MISSION_DEFINITION_ID,
  a2Fixture,
  a2MissionDefinition,
} from "./fixtures/a2-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";

export const a2BundledSource = createBundledGameSource([a2Fixture, a2MissionDefinition]);

export function registerA2(registry = createMinigameRegistry()) {
  registry.register({
    engineId: A2_ENGINE_ID,
    engineVersion: A2_ENGINE_VERSION,
    engine: a2Engine,
    production: true,
  });
  return registry;
}

export function getA2MissionDefinition() {
  return a2BundledSource.get(A2_MISSION_DEFINITION_ID, { mode: "mission" });
}
