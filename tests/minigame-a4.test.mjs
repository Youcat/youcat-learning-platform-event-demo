import test from "node:test";
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import approvedActivities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import { a4Engine, A4_ENGINE_ID, A4_ENGINE_VERSION, createA4InitialState, normalizeA4State, scoreA4State } from "../src/minigames/engines/a4-engine.js";
import { a4Fixture, a4MissionDefinition } from "../src/minigames/fixtures/a4-fixture.js";
import { createA4MissionInstance } from "../src/minigames/a4-mission-adapter.js";
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

function makeScene(instance = a4Fixture) {
  const Phaser = { Scene: class { constructor() {} } };
  let changes = 0;
  const scene = a4Engine.createScene({
    Phaser,
    instance,
    language: "en",
    reducedMotion: true,
    onStateChange: () => { changes += 1; },
    onReady: () => {},
  });
  return { scene, changes: () => changes };
}

test("A4 uses the exact GameInstance contract and all eight engine methods", () => {
  assert.deepEqual(validateGameInstance(a4Fixture), { ok: true, errors: [] });
  assert.equal(a4Fixture.engineId, A4_ENGINE_ID);
  assert.equal(a4Fixture.engineVersion, A4_ENGINE_VERSION);
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof a4Engine[method] === "function"), ENGINE_METHODS);
  assert.deepEqual(a4Engine.validate(a4Fixture.payload, a4Fixture), { ok: true, errors: [] });
});

test("A4 rejects malformed payload schema and invalid layout overrides", () => {
  const malformed = structuredClone(a4Fixture);
  malformed.payload.extra = true;
  malformed.payload.solution.ear = "light";
  malformed.layoutOverrides.objectScale = 2;
  const result = a4Engine.validate(malformed.payload, malformed);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exactly/);
  assert.match(result.errors.join("\n"), /each zone exactly once/);
  assert.match(result.errors.join("\n"), /between 0.7 and 1.25/);
});

test("seeded generation is deterministic, variable, and always solvable", () => {
  const first = createA4InitialState(a4Fixture);
  const second = createA4InitialState(a4Fixture);
  const other = createA4InitialState({ ...a4Fixture, seed: "another-seed" });
  assert.deepEqual(first, second);
  assert.notDeepEqual([first.objectOrder, first.zoneOrder], [other.objectOrder, other.zoneOrder]);
  assert.equal(new Set(first.objectOrder).size, 5);
  assert.equal(new Set(first.zoneOrder).size, 5);
  assert.deepEqual(new Set(Object.values(a4Fixture.payload.solution)), new Set(a4Fixture.payload.zoneIds));
});

test("malformed saved input falls back safely and drops impossible placements", () => {
  const fallback = normalizeA4State({ objectOrder: ["bad"], placements: { ear: "harvest", book: "light", fruit: "light" }, hintLevel: 99 }, a4Fixture);
  assert.deepEqual(fallback.objectOrder, createA4InitialState(a4Fixture).objectOrder);
  assert.equal(fallback.placements.ear, null);
  assert.equal(fallback.placements.book, "light");
  assert.equal(fallback.placements.fruit, null);
  assert.equal(fallback.hintLevel, 2);
});

test("state serialization is JSON-safe and resumes meaningful partial play", () => {
  const { scene } = makeScene();
  assert.equal(scene.placeObject("ear", "story"), true);
  scene.selectObject("book");
  const saved = a4Engine.serializeState(scene, a4Fixture);
  const roundTrip = JSON.parse(JSON.stringify(saved));
  const resumed = makeScene().scene;
  a4Engine.restoreState(resumed, roundTrip, a4Fixture);
  assert.equal(resumed.a4State.placements.ear, "story");
  assert.equal(resumed.a4State.selectedId, "book");
  assert.deepEqual(a4Engine.serializeState(resumed), roundTrip);
});

test("Reset and Replay restore the same clean seeded state", () => {
  const { scene } = makeScene();
  scene.placeObject("ear", "story");
  a4Engine.showHint(scene, 0, a4Fixture);
  a4Engine.restoreState(scene, null, a4Fixture);
  const reset = a4Engine.serializeState(scene);
  scene.placeObject("fruit", "harvest");
  a4Engine.restoreState(scene, null, a4Fixture);
  assert.deepEqual(a4Engine.serializeState(scene), reset);
  assert.deepEqual(reset.placements, Object.fromEntries(a4Fixture.payload.objectIds.map((id) => [id, null])));
  assert.equal(reset.hintLevel, 0);
});

test("wrong zones are rejected immediately without consuming a valid placement", () => {
  const { scene, changes } = makeScene();
  assert.equal(scene.placeObject("ear", "harvest"), false);
  assert.equal(scene.a4State.placements.ear, null);
  assert.equal(scene.a4State.lastInvalid, "ear");
  assert.match(scene.accessibleFeedback.en, /cannot live there/);
  assert.equal(changes(), 1);
});

test("hints escalate from reflection to an exact remaining pair", () => {
  const { scene } = makeScene();
  const first = a4Engine.showHint(scene, 0, a4Fixture);
  assert.match(first.en, /attention, light, freedom/);
  assert.equal(scene.a4State.hintLevel, 1);
  assert.ok(scene.a4State.selectedId);
  const selected = scene.a4State.selectedId;
  const second = a4Engine.showHint(scene, 1, a4Fixture);
  assert.match(second.en, new RegExp(a4Fixture.payload.solution[selected] === "story" ? "life shared" : ".+"));
  assert.equal(scene.a4State.hintLevel, 2);
});

test("evaluation distinguishes incomplete, partial, and completed states without XP side effects", () => {
  const { scene } = makeScene();
  let evaluation = a4Engine.evaluate(scene, a4Fixture);
  assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: false, complete: false });
  scene.placeObject("ear", "story");
  assert.deepEqual(scoreA4State(scene.a4State, a4Fixture), { placed: 1, total: 5, complete: false });
  for (const [id, zoneId] of Object.entries(a4Fixture.payload.solution)) scene.placeObject(id, zoneId);
  evaluation = a4Engine.evaluate(scene, a4Fixture);
  assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: true, complete: true });
  assert.equal("xpAwarded" in evaluation, false);
  assert.match(evaluation.feedback.pt, /cinco sinais/);
});

test("accessible actions cover selection, every target, cancellation, and lock", () => {
  const { scene } = makeScene();
  let actions = a4Engine.getAccessibleActions(scene, a4Fixture);
  assert.equal(actions.length, 5);
  actions.find((action) => action.id === "select-ear").run();
  actions = a4Engine.getAccessibleActions(scene, a4Fixture);
  assert.equal(actions.filter((action) => action.id.startsWith("place-ear-")).length, 5);
  assert.ok(actions.some((action) => action.id === "cancel-ear"));
  scene.setLocked(true);
  assert.deepEqual(a4Engine.getAccessibleActions(scene, a4Fixture), []);
});

test("mission instance preserves slot 3 and one-submission XP semantics", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "25__game-3", questionNumber: 25, challengeIndex: 3, xp: 10 };
  const instance = createA4MissionInstance(mission);
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 3);
  assert.equal(instance.id, "Assis-Sao-Jose:25__game-3");
  const correct = createMinigameResult(instance, { correct: true, complete: true }, { hintsUsed: 1 });
  const wrong = createMinigameResult(instance, { correct: false, complete: false });
  assert.equal(correct.xpAwarded, 10);
  assert.equal(wrong.xpAwarded, 0);
  const storage = new MemoryStorage();
  const persistence = createMinigamePersistence(storage);
  persistence.save(instance, { submitted: true, engineState: { locked: true } });
  assert.equal(persistence.load(instance).submitted, true);
  assert.equal(persistence.load({ ...instance, engineVersion: "2.0.0" }), null);
});

test("A4 is production-registered and bundled source copies are isolated", () => {
  const registry = createMinigameRegistry();
  registry.register({ engineId: A4_ENGINE_ID, engineVersion: A4_ENGINE_VERSION, engine: a4Engine, production: true });
  assert.equal(registry.resolve(a4Fixture), a4Engine);
  const source = createBundledGameSource([a4Fixture]);
  const copy = source.get("A4", { mode: "mission" });
  copy.payload.objectIds.reverse();
  assert.deepEqual(source.get("A4").payload.objectIds, a4Fixture.payload.objectIds);
});

test("Q25 keeps four games plus one quiz and replaces only human game 4", () => {
  const q25 = approvedActivities[25];
  assert.equal(q25.games.length, 4);
  assert.equal(q25.quiz.length, 1);
  assert.deepEqual(q25.games.slice(0, 3).map((game) => game.type), ["image-shuffle", "order", "match"]);
  assert.deepEqual(q25.games[3], {
    type: "minigame",
    engineId: "A4",
    engineVersion: "1.0.0",
    title: { en: "Living Symbols", pt: "Símbolos vivos" },
    prompt: { en: "Place five signs where they become part of healthy spiritual accompaniment.", pt: "Coloque cinco sinais onde eles se tornam parte de um acompanhamento espiritual saudável." },
    insight: a4MissionDefinition.insight,
  });
});

test("optimized A4 assets are present, transparent WebP, and small", async () => {
  assert.equal(a4Fixture.assets.layers.length, 5);
  for (const asset of a4Fixture.assets.layers) {
    const path = fileURLToPath(asset);
    const info = await stat(path);
    assert.match(path, /src\/assets\/minigames\/a4\/.+\.webp$/);
    assert.ok(info.size > 1_000 && info.size < 30_000, `${path} should be optimized`);
  }
});

test("debrief is concise pastoral reflection, not an invented quotation", () => {
  assert.match(a4Fixture.insight.en, /protects freedom/);
  assert.match(a4Fixture.insight.pt, /protege a liberdade/);
  assert.doesNotMatch(a4Fixture.insight.en, /[“”\"]|said|quote/i);
});
