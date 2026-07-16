import test from "node:test";
import assert from "node:assert/strict";
import learningContent from "../src/data/learning-content.js";
import { validateGameInstance } from "../src/minigames/contracts.js";
import {
  B14_DEFAULT_PAYLOAD,
  activeB14Layer,
  applyB14Move,
  b14Engine,
  completeB14Solution,
  createB14InitialState,
  isB14Complete,
  normalizeB14Payload,
  restoreB14State,
  seededB14ItemOrder,
} from "../src/minigames/engines/b14.js";
import { b14Fixture, b14MissionDefinition } from "../src/minigames/fixtures/b14-fixture.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameRegistry } from "../src/minigames/registry.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";
import { submissionAllowed } from "../src/minigames/stage-shell.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function fakeScene(instance = b14Fixture) {
  const payload = normalizeB14Payload(instance.payload);
  return {
    b14Payload: payload,
    b14State: createB14InitialState(payload, instance.seed),
    redrawCount: 0,
    notifyCount: 0,
    redraw() { this.redrawCount += 1; },
    notify() { this.notifyCount += 1; },
    placeItem(itemId, targetId) { return applyB14Move(this.b14State, this.b14Payload, itemId, targetId); },
  };
}

function solveInReverseWithinLayers(state, payload) {
  for (const layer of payload.layers) {
    const items = payload.items.filter((item) => item.layer === layer.id).reverse();
    const targets = payload.targets.filter((target) => target.layer === layer.id);
    targets.forEach((target, index) => assert.equal(applyB14Move(state, payload, items[index].id, target.id).ok, true));
  }
}

test("B14 fixture satisfies the exact contract and rejects malformed schema", () => {
  assert.deepEqual(validateGameInstance(b14Fixture), { ok: true, errors: [] });
  assert.deepEqual(validateGameInstance(b14MissionDefinition), { ok: true, errors: [] });
  assert.deepEqual(b14Engine.validate(b14Fixture.payload, b14Fixture), { ok: true, errors: [] });

  const malformed = structuredClone(b14Fixture.payload);
  malformed.items[0].layer = "canopy";
  malformed.extra = true;
  const result = b14Engine.validate(malformed, b14Fixture);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exactly/);
  assert.deepEqual(normalizeB14Payload(malformed), B14_DEFAULT_PAYLOAD);
});

test("B14 seeded generation is deterministic and the bundled source returns isolated copies", () => {
  assert.deepEqual(seededB14ItemOrder(b14Fixture.payload, "seed-a"), seededB14ItemOrder(b14Fixture.payload, "seed-a"));
  assert.notDeepEqual(seededB14ItemOrder(b14Fixture.payload, "seed-a"), seededB14ItemOrder(b14Fixture.payload, "seed-b"));
  const source = createBundledGameSource([b14Fixture]);
  const first = source.get("B14");
  first.payload.items[0].label.en = "Changed";
  assert.equal(source.get("B14").payload.items[0].label.en, "Grace");
});

test("B14 is guaranteed solvable and accepts free ordering inside roots and branches", () => {
  const payload = normalizeB14Payload(b14Fixture.payload);
  const state = createB14InitialState(payload, b14Fixture.seed);
  assert.equal(activeB14Layer(state, payload), "roots");
  solveInReverseWithinLayers(state, payload);
  assert.equal(isB14Complete(state, payload), true);
  assert.equal(state.placements["root-left"], "prayer");
  assert.equal(state.placements["branch-left"], "care");
});

test("B14 keeps all terms available and rejects only impossible layer mismatches", () => {
  const payload = normalizeB14Payload(b14Fixture.payload);
  const state = createB14InitialState(payload, b14Fixture.seed);
  assert.equal(applyB14Move(state, payload, "gratitude", "branch-left").ok, true);
  assert.equal(applyB14Move(state, payload, "grace", "trunk-centre").reason, "wrongLayer");
  assert.deepEqual(state.placements, { "branch-left": "gratitude" });
  assert.equal(applyB14Move(state, payload, "grace", "root-left").ok, true);
  assert.equal(applyB14Move(state, payload, "decision", "root-centre").reason, "wrongLayer");
  assert.deepEqual(state.placements, { "branch-left": "gratitude", "root-left": "grace" });
});

test("B14 keeps scored play freely rearrangeable by swapping compatible placements", () => {
  const payload = normalizeB14Payload(b14Fixture.payload);
  const state = createB14InitialState(payload, b14Fixture.seed);
  applyB14Move(state, payload, "grace", "root-left");
  applyB14Move(state, payload, "truth", "root-centre");
  applyB14Move(state, payload, "prayer", "root-right");
  const moved = applyB14Move(state, payload, "grace", "root-centre");
  assert.equal(moved.ok, true);
  assert.deepEqual(state.placements, {
    "root-left": "truth",
    "root-centre": "grace",
    "root-right": "prayer",
  });
  assert.equal(activeB14Layer(state, payload), "trunk");
});

test("B14 serialization is JSON-safe and partial state resumes while malformed state falls back safely", () => {
  const scene = fakeScene();
  applyB14Move(scene.b14State, scene.b14Payload, "grace", "root-left");
  scene.b14State.selectedItemId = "truth";
  const saved = b14Engine.serializeState(scene, b14Fixture);
  const roundTrip = JSON.parse(JSON.stringify(saved));
  const restored = fakeScene();
  b14Engine.restoreState(restored, roundTrip, b14Fixture);
  assert.deepEqual(restored.b14State.placements, { "root-left": "grace" });
  assert.equal(restored.b14State.selectedItemId, "truth");

  const malformed = restoreB14State({ placements: { "branch-left": "gratitude", "root-left": "unknown" }, hintLevel: 99 }, scene.b14Payload, b14Fixture.seed);
  assert.deepEqual(malformed.placements, { "branch-left": "gratitude" });
  assert.equal(malformed.hintLevel, 2);
});

test("B14 Reset and Replay recreate the same clean seeded run", () => {
  const scene = fakeScene();
  applyB14Move(scene.b14State, scene.b14Payload, "grace", "root-left");
  b14Engine.restoreState(scene, null, b14Fixture);
  const reset = structuredClone(scene.b14State);
  applyB14Move(scene.b14State, scene.b14Payload, "truth", "root-centre");
  b14Engine.restoreState(scene, null, b14Fixture);
  assert.deepEqual(scene.b14State, reset);
  assert.deepEqual(reset.itemOrder, seededB14ItemOrder(b14Fixture.payload, b14Fixture.seed));
});

test("B14 deliberately offers no content hint or automatic placement", () => {
  const scene = fakeScene();
  const first = b14Engine.showHint(scene, 0, b14Fixture);
  assert.equal(b14Engine.hintsAvailable, false);
  assert.match(first.en, /whole tree/i);
  assert.equal(Object.keys(scene.b14State.placements).length, 0);
  const second = b14Engine.showHint(scene, 1, b14Fixture);
  assert.match(second.en, /whole tree/i);
  assert.equal(Object.keys(scene.b14State.placements).length, 0);
  assert.equal(scene.b14State.hintLevel, 0);
});

test("B14 evaluates incomplete, correct, and completed states only on Check", () => {
  const scene = fakeScene();
  const incomplete = b14Engine.evaluate(scene, b14Fixture);
  assert.deepEqual({ correct: incomplete.correct, complete: incomplete.complete }, { correct: false, complete: false });
  assert.equal(scene.b14State.solutionShown, false);

  solveInReverseWithinLayers(scene.b14State, scene.b14Payload);
  const correct = b14Engine.evaluate(scene, b14Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(scene.b14State.completed, true);
});

test("B14 mission submission locks after one Check, shows the solution, and awards XP only for success", () => {
  assert.equal(submissionAllowed(b14MissionDefinition, false), true);
  assert.equal(submissionAllowed(b14MissionDefinition, true), false);

  const scene = fakeScene(b14MissionDefinition);
  const incorrect = b14Engine.evaluate(scene, b14MissionDefinition);
  assert.deepEqual({ correct: incorrect.correct, complete: incorrect.complete }, { correct: false, complete: false });
  assert.equal(scene.b14State.solutionShown, true);
  assert.equal(isB14Complete(scene.b14State, scene.b14Payload), true);
  assert.equal(createMinigameResult(b14MissionDefinition, incorrect).xpAwarded, 0);

  const correctScene = fakeScene(b14MissionDefinition);
  completeB14Solution(correctScene.b14State, correctScene.b14Payload);
  const correct = b14Engine.evaluate(correctScene, b14MissionDefinition);
  assert.equal(createMinigameResult(b14MissionDefinition, correct).xpAwarded, 8);

  const storage = new MemoryStorage();
  const persistence = createMinigamePersistence(storage);
  persistence.save(b14MissionDefinition, { submitted: true, hintsUsed: 1, engineState: b14Engine.serializeState(scene) });
  assert.equal(persistence.load(b14MissionDefinition).submitted, true);

  const unfinished = { ...b14MissionDefinition, id: "unfinished-b14" };
  const partialScene = fakeScene(unfinished);
  applyB14Move(partialScene.b14State, partialScene.b14Payload, "grace", "root-left");
  persistence.save(unfinished, { submitted: false, hintsUsed: 0, engineState: b14Engine.serializeState(partialScene) });
  const resumed = persistence.load(unfinished);
  assert.equal(resumed.submitted, false);
  assert.deepEqual(resumed.engineState.placements, { "root-left": "grace" });
  assert.equal(submissionAllowed(unfinished, resumed.submitted), true);
});

test("B14 is production-registered by exact id/version and Q140 replaces only human game 4", () => {
  const registry = createMinigameRegistry();
  registry.register({ engineId: "B14", engineVersion: "1.0.0", engine: b14Engine, production: true });
  assert.equal(registry.resolve(b14MissionDefinition), b14Engine);

  const q140 = learningContent.find((item) => item.number === 140);
  assert.equal(q140.games.length, 4);
  assert.equal(q140.quiz.length, 1);
  assert.deepEqual(q140.games.slice(0, 3).map((game) => game.type), ["match", "image-shuffle", "reveal"]);
  assert.equal(q140.games[3].engineId, "B14");
  assert.equal(q140.games[3].missionSlot, 3);
  assert.equal(q140.games[3].engineVersion, "1.0.0");
});
