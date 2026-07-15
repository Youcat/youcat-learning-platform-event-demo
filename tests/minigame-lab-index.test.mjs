import test from "node:test";
import assert from "node:assert/strict";
import { createMinigameRegistry } from "../src/minigames/registry.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";
import { skeletonEngine } from "../src/minigames/engines/skeleton-engine.js";
import { skeletonFixture } from "../src/minigames/fixtures/skeleton-fixture.js";
import {
  buildMinigameLabEntries,
  minigameLabIndexHref,
  PLANNED_MINIGAME_ENGINES,
  renderGameLabIndex,
} from "../src/minigames/lab-index.js";

test("Lab index lists thirteen planned engines plus the foundation fixture", () => {
  const entries = buildMinigameLabEntries({ language: "en" });
  assert.equal(PLANNED_MINIGAME_ENGINES.length, 13);
  assert.equal(entries.length, 14);
  assert.equal(entries.filter(({ fixture }) => fixture).length, 1);
  assert.equal(entries.filter(({ playable }) => playable).length, 14);
  entries.forEach((entry) => assert.match(entry.href, /^\?lab=.+&lang=en$/));
});

test("playability requires both a bundled fixture and compatible registry entry", () => {
  const source = createBundledGameSource([skeletonFixture]);
  const emptyRegistry = createMinigameRegistry();
  const beforeRegistration = buildMinigameLabEntries({ source, registry: emptyRegistry, language: "pt" });
  assert.equal(beforeRegistration.find(({ fixture }) => fixture).playable, false);
  assert.equal(beforeRegistration.find(({ engineId }) => engineId === "A2").playable, false);

  emptyRegistry.register({
    engineId: skeletonFixture.engineId,
    engineVersion: skeletonFixture.engineVersion,
    engine: skeletonEngine,
    production: false,
  });
  const afterRegistration = buildMinigameLabEntries({ source, registry: emptyRegistry, language: "pt" });
  assert.equal(afterRegistration.find(({ fixture }) => fixture).playable, true);
  assert.equal(afterRegistration.find(({ engineId }) => engineId === "A2").href, null);
});

test("Lab index renders bilingual links and a non-interactive review state", () => {
  const mount = { innerHTML: "" };
  renderGameLabIndex({
    mount,
    language: "en",
    source: createBundledGameSource([skeletonFixture]),
    registry: createMinigameRegistry(),
  });
  assert.match(mount.innerHTML, /Test minigames/);
  assert.match(mount.innerHTML, /In review/);
  assert.doesNotMatch(mount.innerHTML, /href="\?lab=foundation-skeleton-v1/);

  renderGameLabIndex({
    mount,
    language: "pt",
    source: createBundledGameSource([skeletonFixture]),
    registry: createMinigameRegistry(),
  });
  assert.match(mount.innerHTML, /Testar minijogos/);
  assert.match(mount.innerHTML, /Em revisão/);
  assert.equal(minigameLabIndexHref("pt"), "?lab=index&lang=pt");
  assert.equal(minigameLabIndexHref("en"), "?lab=index&lang=en");
});
