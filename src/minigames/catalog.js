import { a2Engine } from "./engines/a2-engine.js";
import { a4Engine } from "./engines/a4-engine.js";
import { a7Engine } from "./engines/a7-engine.js";
import { b9Engine } from "./engines/b9-engine.js";
import { b13RelationshipMetroEngine } from "./engines/b13-relationship-metro.js";
import { b14Engine } from "./engines/b14.js";
import { c20Engine } from "./engines/c20-engine.js";
import { c21Engine } from "./engines/c21-engine.js";
import { c22MagneticFieldEngine } from "./engines/c22-magnetic-field.js";
import { c23Engine } from "./engines/c23-engine.js";
import { c27Engine } from "./engines/c27-engine.js";
import { c29Engine } from "./engines/c29.js";
import { c30CovenantRingsEngine } from "./engines/c30-covenant-rings.js";
import { skeletonEngine } from "./engines/skeleton-engine.js";
import { a2Fixture } from "./fixtures/a2-fixture.js";
import { a4Fixture } from "./fixtures/a4-fixture.js";
import { a7Fixture } from "./fixtures/a7-fixture.js";
import { b9Fixture } from "./fixtures/b9-fixture.js";
import { b13Fixture } from "./fixtures/b13-fixture.js";
import { b14Fixture } from "./fixtures/b14-fixture.js";
import { c20Fixture } from "./fixtures/c20-fixture.js";
import { c21LabFixture } from "./fixtures/c21-fixture.js";
import { c22Fixture } from "./fixtures/c22-fixture.js";
import { c23Fixture } from "./fixtures/c23-fixture.js";
import { c27Fixture } from "./fixtures/c27-fixture.js";
import { c29Fixture } from "./fixtures/c29-fixture.js";
import { c30CovenantRingsFixture } from "./fixtures/c30-covenant-rings-fixture.js";
import { skeletonFixture } from "./fixtures/skeleton-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";

const productionEntries = Object.freeze([
  [a2Fixture, a2Engine],
  [a4Fixture, a4Engine],
  [a7Fixture, a7Engine],
  [b9Fixture, b9Engine],
  [b13Fixture, b13RelationshipMetroEngine],
  [b14Fixture, b14Engine],
  [c20Fixture, c20Engine],
  [c21LabFixture, c21Engine],
  [c22Fixture, c22MagneticFieldEngine],
  [c23Fixture, c23Engine],
  [c27Fixture, c27Engine],
  [c29Fixture, c29Engine],
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
