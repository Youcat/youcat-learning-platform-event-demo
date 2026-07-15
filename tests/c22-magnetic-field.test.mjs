import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { validateGameInstance } from "../src/minigames/contracts.js";
import {
  C22_DEFAULT_PAYLOAD,
  C22_ENGINE_ID,
  C22_ENGINE_VERSION,
  c22MagneticFieldEngine,
  generateC22Field,
  isC22MovePossible,
  isHealthyC22Arrangement,
  normalizeC22Payload,
} from "../src/minigames/engines/c22-magnetic-field.js";
import { c22Fixture } from "../src/minigames/fixtures/c22-fixture.js";
import { createC22MissionInstance, createC22Registry } from "../src/minigames/c22-registration.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function sceneFor(seed = c22Fixture.seed) {
  const field = generateC22Field(seed, c22Fixture.payload);
  const scene = {
    c22Field: field,
    c22State: null,
    redrawCalls: 0,
    notifyCalls: 0,
    redraw() { this.redrawCalls += 1; },
    notify() { this.notifyCalls += 1; },
  };
  c22MagneticFieldEngine.restoreState(scene, null, c22Fixture);
  return scene;
}

function completeState(scene, reflection = "transparency") {
  scene.c22State.positions = structuredClone(scene.c22Field.solution);
  scene.c22State.explored = { "friend-a": true, "friend-b": true };
  scene.c22State.moveCount = scene.c22Field.payload.requiredMoves;
  scene.c22State.reflection = reflection;
}

test("C22 fixture follows the exact contract and malformed engine input has a safe fallback", () => {
  assert.deepEqual(validateGameInstance(c22Fixture), { ok: true, errors: [] });
  assert.deepEqual(c22MagneticFieldEngine.validate(c22Fixture.payload, c22Fixture), { ok: true, errors: [] });
  const malformed = { ...structuredClone(c22Fixture.payload), requiredMoves: -3 };
  assert.equal(c22MagneticFieldEngine.validate(malformed, c22Fixture).ok, false);
  assert.deepEqual(normalizeC22Payload(malformed), structuredClone(C22_DEFAULT_PAYLOAD));
  assert.equal(generateC22Field("fallback", malformed).solvable, true);
});

test("seeded field generation is deterministic and seed-sensitive", () => {
  const first = generateC22Field("same-seed", c22Fixture.payload);
  const second = generateC22Field("same-seed", c22Fixture.payload);
  const different = generateC22Field("different-seed", c22Fixture.payload);
  assert.deepEqual(first.starts, second.starts);
  assert.deepEqual(first.solution, second.solution);
  assert.notDeepEqual(first.starts, different.starts);
});

test("generated C22 fields are guaranteed solvable", () => {
  for (let index = 0; index < 100; index += 1) {
    const field = generateC22Field(`c22-seed-${index}`, c22Fixture.payload);
    assert.equal(field.solvable, true);
    assert.equal(isHealthyC22Arrangement(field.solution, field.payload), true);
  }
});

test("impossible moves are rejected without changing the recoverable state", () => {
  const field = generateC22Field("moves", c22Fixture.payload);
  const positions = structuredClone(field.starts);
  assert.equal(isC22MovePossible(positions, "friend-a", { x: 0.01, y: 0.5 }), false);
  assert.equal(isC22MovePossible(positions, "friend-a", positions["friend-b"]), false);
  assert.equal(isC22MovePossible(positions, "friend-a", { x: 0.2, y: 0.7 }), true);
  assert.deepEqual(positions, field.starts);
});

test("state serializes to JSON, resumes safely, and malformed saved points fall back", () => {
  const scene = sceneFor("resume");
  completeState(scene, "freedom");
  scene.c22State.hintLevel = 1;
  const serialized = c22MagneticFieldEngine.serializeState(scene, c22Fixture);
  const json = JSON.stringify(serialized);
  const restored = sceneFor("resume");
  c22MagneticFieldEngine.restoreState(restored, JSON.parse(json), c22Fixture);
  assert.deepEqual(restored.c22State, serialized);

  c22MagneticFieldEngine.restoreState(restored, { positions: { "friend-a": { x: 99, y: 99 } } }, c22Fixture);
  assert.deepEqual(restored.c22State.positions, restored.c22Field.starts);
  assert.equal(restored.c22State.reflection, null);
});

test("Reset and Replay both restore the deterministic clean run", () => {
  const scene = sceneFor("reset-replay");
  const initial = structuredClone(scene.c22State);
  completeState(scene, "boundary");
  scene.c22State.hintLevel = 2;
  c22MagneticFieldEngine.restoreState(scene, null, c22Fixture);
  assert.deepEqual(scene.c22State, initial);
  completeState(scene, "transparency");
  c22MagneticFieldEngine.restoreState(scene, null, c22Fixture);
  assert.deepEqual(scene.c22State, initial);
});

test("two hints escalate from conceptual guidance to visible solution outlines", () => {
  const scene = sceneFor("hints");
  const first = c22MagneticFieldEngine.showHint(scene, 0, c22Fixture);
  assert.equal(scene.c22State.hintLevel, 1);
  assert.match(first.en, /open lower field/i);
  const second = c22MagneticFieldEngine.showHint(scene, 1, c22Fixture);
  assert.equal(scene.c22State.hintLevel, 2);
  assert.match(second.en, /outlines/i);
  assert.deepEqual(scene.c22State.positions, scene.c22Field.starts);
});

test("healthy placement still requires exploration and a reflective debrief", () => {
  const scene = sceneFor("reflection-special-case");
  scene.c22State.positions = structuredClone(scene.c22Field.solution);
  let evaluation = c22MagneticFieldEngine.evaluate(scene, c22Fixture);
  assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: false, complete: false });
  assert.match(evaluation.feedback.en, /moving both/i);

  scene.c22State.explored = { "friend-a": true, "friend-b": true };
  scene.c22State.moveCount = scene.c22Field.payload.requiredMoves;
  evaluation = c22MagneticFieldEngine.evaluate(scene, c22Fixture);
  assert.equal(evaluation.complete, false);
  assert.match(evaluation.feedback.en, /guiding principle/i);

  for (const reflection of ["transparency", "freedom", "boundary"]) {
    completeState(scene, reflection);
    evaluation = c22MagneticFieldEngine.evaluate(scene, c22Fixture);
    assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: true, complete: true });
  }
});

test("incorrect arrangements explain the specific field problem and mission Check reveals the solution", () => {
  const labScene = sceneFor("incorrect");
  completeState(labScene);
  labScene.c22State.positions["friend-a"].y = 0.3;
  let evaluation = c22MagneticFieldEngine.evaluate(labScene, c22Fixture);
  assert.equal(evaluation.correct, false);
  assert.match(evaluation.feedback.en, /open/i);
  assert.equal(labScene.c22State.showSolution, false);

  const missionScene = sceneFor("incorrect");
  completeState(missionScene);
  missionScene.c22State.positions["friend-a"].y = 0.3;
  evaluation = c22MagneticFieldEngine.evaluate(missionScene, { ...c22Fixture, mode: "mission" });
  assert.equal(evaluation.complete, false);
  assert.equal(missionScene.c22State.showSolution, true);
});

test("mission registration, one-submission persistence, and reflective XP semantics are exact", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "59__game-0", questionNumber: 59, challengeIndex: 0, xp: 8 };
  const instance = createC22MissionInstance(mission);
  assert.equal(instance.engineId, C22_ENGINE_ID);
  assert.equal(instance.engineVersion, C22_ENGINE_VERSION);
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 0);
  assert.equal(createC22Registry().resolve(instance), c22MagneticFieldEngine);

  const incomplete = createMinigameResult(instance, { correct: false, complete: false }, { hintsUsed: 1 });
  const complete = createMinigameResult(instance, { correct: true, complete: true }, { hintsUsed: 1 });
  assert.equal(incomplete.xpAwarded, 0);
  assert.equal(complete.xpAwarded, 8);

  const persistence = createMinigamePersistence(new MemoryStorage());
  persistence.save(instance, { submitted: true, engineState: { reflection: "freedom" } });
  assert.equal(persistence.load(instance).submitted, true);
  assert.equal(persistence.load(instance).engineState.reflection, "freedom");
});

test("Q59 replaces only mission slot 0 and preserves four games plus one quiz", () => {
  assert.equal(activities[59].games.length, 4);
  assert.equal(activities[59].quiz.length, 1);
  assert.deepEqual(
    activities[59].games.map((game) => game.type),
    ["minigame", "image-shuffle", "reveal", "wordsearch"],
  );
  assert.equal(activities[59].games[0].engineId, C22_ENGINE_ID);
  assert.equal(activities[59].games[0].engineVersion, C22_ENGINE_VERSION);
});
