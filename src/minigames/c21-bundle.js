import { c21Engine } from "./engines/c21-engine.js";
import {
  C21_ENGINE_ID,
  C21_ENGINE_VERSION,
  C21_FIXTURE_ID,
  c21LabFixture,
  c21MissionDefinition,
} from "./fixtures/c21-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";
import { launchGameStage } from "./stage-shell.js";

export const c21Source = createBundledGameSource([c21LabFixture, c21MissionDefinition]);

export function createC21Registry() {
  return createMinigameRegistry().register({
    engineId: C21_ENGINE_ID,
    engineVersion: C21_ENGINE_VERSION,
    engine: c21Engine,
    production: true,
  });
}

export function c21MissionInstanceFor({ mission, activity }) {
  if (activity?.type !== "minigame" || activity.definitionId !== "c21-q127-slot0") {
    throw new TypeError("C21 mission integration requires the Q127 slot 0 activity");
  }
  const definition = c21Source.get(activity.definitionId, { mode: "mission" });
  return missionGameInstanceFrom({ mission, definition });
}

export function launchC21Lab({ mount, language, onResult, onClose }) {
  return launchGameStage({
    mount,
    instance: c21Source.get(C21_FIXTURE_ID, { mode: "lab" }),
    registry: createC21Registry(),
    language,
    onResult,
    onClose,
  });
}

export function launchC21Mission({ mount, mission, activity, language, onResult, onClose }) {
  return launchGameStage({
    mount,
    instance: c21MissionInstanceFor({ mission, activity }),
    registry: createC21Registry(),
    language,
    onResult,
    onClose,
  });
}

