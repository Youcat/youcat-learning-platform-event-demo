import test from "node:test";
import assert from "node:assert/strict";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import { skeletonEngine } from "../src/minigames/engines/skeleton-engine.js";
import { skeletonFixture } from "../src/minigames/fixtures/skeleton-fixture.js";
import { missionGameInstanceFrom } from "../src/minigames/mission-hooks.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameRegistry } from "../src/minigames/registry.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("GameInstance accepts the exact versioned fixture contract", () => {
  assert.deepEqual(validateGameInstance(skeletonFixture), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS, ["validate", "createScene", "serializeState", "restoreState", "evaluate", "getAccessibleActions", "showHint", "destroy"]);
});

test("GameInstance rejects extra fields, an invalid slot, and incomplete localization", () => {
  const invalid = {
    ...structuredClone(skeletonFixture),
    missionSlot: 4,
    title: { en: "Only English" },
    extra: true,
  };
  const result = validateGameInstance(invalid);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exactly/);
  assert.match(result.errors.join("\n"), /0 to 3/);
  assert.match(result.errors.join("\n"), /title/);
});

test("registry versions engines and blocks the skeleton from production resolution", () => {
  const registry = createMinigameRegistry();
  registry.register({ engineId: "foundation-skeleton", engineVersion: "1.0.0", engine: skeletonEngine, production: false });
  assert.equal(registry.version, 1);
  assert.equal(registry.resolve(skeletonFixture, { allowNonProduction: true }), skeletonEngine);
  assert.throws(() => registry.resolve(skeletonFixture), /non-production/);
  assert.throws(() => registry.register({ engineId: "foundation-skeleton", engineVersion: "1.0.0", engine: skeletonEngine }), /already registered/);
});

test("bundled source returns isolated validated copies", () => {
  const source = createBundledGameSource([skeletonFixture]);
  const first = source.get(skeletonFixture.id);
  first.payload.start.x = 0.5;
  assert.equal(source.kind, "bundled");
  assert.equal(source.get(skeletonFixture.id).payload.start.x, skeletonFixture.payload.start.x);
  assert.equal(source.get("missing"), null);
});

test("partial state persists by mode and engine version", () => {
  const storage = new MemoryStorage();
  const persistence = createMinigamePersistence(storage);
  persistence.save(skeletonFixture, { hintsUsed: 1, submitted: false, engineState: { marker: { x: 0.4, y: 0.5 } } });
  assert.deepEqual(persistence.load(skeletonFixture).engineState, { marker: { x: 0.4, y: 0.5 } });
  assert.equal(persistence.load({ ...skeletonFixture, mode: "mission" }), null);
  assert.equal(persistence.load({ ...skeletonFixture, engineVersion: "2.0.0" }), null);
  persistence.clear(skeletonFixture);
  assert.equal(persistence.load(skeletonFixture), null);
});

test("result adapter normalizes XP without awarding it", () => {
  const result = createMinigameResult({ ...skeletonFixture, xp: 7 }, { correct: true, complete: true }, { hintsUsed: 2 });
  assert.equal(result.xpAwarded, 7);
  assert.equal(result.hintsUsed, 2);
  assert.equal(result.mode, "lab");
  assert.equal(Object.isFrozen(result), true);
});

test("mission launcher maps a definition without changing its engine payload", () => {
  const definition = { ...structuredClone(skeletonFixture), id: "template", mode: "lab", xp: 0 };
  const mission = { groupCode: "Assis-Sao-Jose", id: "3__game-2", questionNumber: 3, challengeIndex: 2, xp: 8 };
  const instance = missionGameInstanceFrom({ mission, definition });
  assert.equal(instance.id, "Assis-Sao-Jose:3__game-2");
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 2);
  assert.equal(instance.xp, 8);
  assert.deepEqual(instance.payload, definition.payload);
});
