import { c29Engine, C29_ENGINE_ID, C29_ENGINE_VERSION } from "./engines/c29.js";
import { skeletonEngine } from "./engines/skeleton-engine.js";
import { c29Fixture } from "./fixtures/c29-fixture.js";
import { skeletonFixture } from "./fixtures/skeleton-fixture.js";
import { createMinigameRegistry } from "./registry.js";
import { createBundledGameSource } from "./source-adapter.js";

export const bundledMinigameSource = createBundledGameSource([skeletonFixture, c29Fixture]);

export function createAppMinigameRegistry() {
  const registry = createMinigameRegistry();
  registry.register({
    engineId: "foundation-skeleton",
    engineVersion: "1.0.0",
    engine: skeletonEngine,
    production: false,
  });
  registry.register({
    engineId: C29_ENGINE_ID,
    engineVersion: C29_ENGINE_VERSION,
    engine: c29Engine,
    production: true,
  });
  return registry;
}
