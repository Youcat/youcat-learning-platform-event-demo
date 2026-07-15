import { a2Engine } from "./engines/a2-engine.js";
import { a4Engine } from "./engines/a4-engine.js";
import { a7Engine } from "./engines/a7-engine.js";
import { b14Engine } from "./engines/b14.js";
import { c20Engine } from "./engines/c20-engine.js";
import { c30CovenantRingsEngine } from "./engines/c30-covenant-rings.js";
import { skeletonEngine } from "./engines/skeleton-engine.js";
import { a2Fixture } from "./fixtures/a2-fixture.js";
import { a4Fixture } from "./fixtures/a4-fixture.js";
import { a7Fixture } from "./fixtures/a7-fixture.js";
import { b14Fixture } from "./fixtures/b14-fixture.js";
import { c20Fixture } from "./fixtures/c20-fixture.js";
import { c30CovenantRingsFixture } from "./fixtures/c30-covenant-rings-fixture.js";
import { skeletonFixture } from "./fixtures/skeleton-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";

const productionEntries = Object.freeze([
  [a2Fixture, a2Engine],
  [a4Fixture, a4Engine],
  [a7Fixture, a7Engine],
  [b14Fixture, b14Engine],
  [c20Fixture, c20Engine],
  [c30CovenantRingsFixture, c30CovenantRingsEngine],
]);

export const productionMinigameFixtures = Object.freeze(productionEntries.map(([fixture]) => fixture));
export const bundledMinigameSource = createBundledGameSource([skeletonFixture, ...productionMinigameFixtures]);
export const bundledGameSource = bundledMinigameSource;

export function createAppMinigameRegistry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: skeletonFixture.engineId,
    engineVersion: skeletonFixture.engineVersion,
    engine: skeletonEngine,
    production: false,
  });
  productionEntries.forEach(([fixture, engine]) => {
    registry.register({
      engineId: fixture.engineId,
      engineVersion: fixture.engineVersion,
      engine,
      production: true,
    });
  });
  return registry;
}

export const createRegisteredMinigameRegistry = createAppMinigameRegistry;

export function fixtureForMissionActivity(activity) {
  if (!activity || activity.type !== "minigame") return null;
  const fixture = [activity.fixtureId, activity.definitionId, activity.sourceId, activity.engineId]
    .filter(Boolean)
    .map((id) => bundledMinigameSource.get(id, { mode: "lab" }))
    .find(Boolean);
  if (!fixture) return null;
  if (fixture.engineId !== activity.engineId || fixture.engineVersion !== activity.engineVersion) return null;
  return fixture;
}
