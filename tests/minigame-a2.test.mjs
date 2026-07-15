import test from "node:test";
import assert from "node:assert/strict";
import learningContent from "../src/data/learning-content.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import {
  a2Engine,
  applyA2Decision,
  createA2InitialState,
  createA2Puzzle,
  evaluateA2State,
  normalizeA2Payload,
  restoreA2State,
} from "../src/minigames/engines/a2-engine.js";
import {
  A2_CONCEPTS,
  A2_ENGINE_ID,
  A2_ENGINE_VERSION,
  a2Fixture,
  a2MissionDefinition,
} from "../src/minigames/fixtures/a2-fixture.js";
import { a2BundledSource, registerA2 } from "../src/minigames/a2-registration.js";
import { createA2MissionInstance, createSingleSubmissionAdapter } from "../src/minigames/a2-mission-adapter.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function fakeScene(instance = a2Fixture) {
  const a2Puzzle = createA2Puzzle(instance.payload, instance.seed);
  return {
    a2Puzzle,
    a2State: createA2InitialState(a2Puzzle),
    redrawCount: 0,
    redraw() { this.redrawCount += 1; },
    selectOffset() {},
    decideSelected() {},
  };
}

function solve(scene) {
  for (const branch of scene.a2Puzzle.branches) scene.a2State.decisions[branch.id] = branch.expected;
}

test("A2 fixture and production registration satisfy the exact contract", () => {
  assert.deepEqual(validateGameInstance(a2Fixture), { ok: true, errors: [] });
  assert.deepEqual(validateGameInstance(a2MissionDefinition), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof a2Engine[method] !== "function"), []);
  assert.deepEqual(a2Engine.validate(a2Fixture.payload, a2Fixture), { ok: true, errors: [] });
  assert.equal(a2BundledSource.kind, "bundled");
  assert.equal(a2BundledSource.get("A2").engineId, A2_ENGINE_ID);
  assert.deepEqual(registerA2().registrations(), [{ engineId: A2_ENGINE_ID, engineVersion: A2_ENGINE_VERSION, production: true }]);
});

test("A2 schema rejects malformed payloads while normalization supplies a safe fallback", () => {
  const invalid = { concepts: [{ id: "only-one" }], targets: { keep: { x: 2, y: 2 } }, extra: true };
  const validation = a2Engine.validate(invalid, a2Fixture);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly ten/);
  assert.match(validation.errors.join("\n"), /targets/);
  const fallback = normalizeA2Payload(invalid);
  assert.deepEqual(fallback.concepts, A2_CONCEPTS);
  assert.deepEqual(fallback.targets, { keep: { x: 0.24, y: 0.9 }, prune: { x: 0.76, y: 0.9 } });
});

test("seeded generation is deterministic, varied across seeds, and always solvable", () => {
  const first = createA2Puzzle(a2Fixture.payload, "same-seed");
  const second = createA2Puzzle(a2Fixture.payload, "same-seed");
  const other = createA2Puzzle(a2Fixture.payload, "other-seed");
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.branches.map((branch) => branch.id), other.branches.map((branch) => branch.id));
  assert.equal(first.branches.filter((branch) => branch.expected === "keep").length, 5);
  assert.equal(first.branches.filter((branch) => branch.expected === "prune").length, 5);
  const state = createA2InitialState(first);
  for (const branch of first.branches) applyA2Decision(state, first, branch.id, branch.expected);
  assert.deepEqual(evaluateA2State(state, first), {
    correct: true,
    complete: true,
    decided: 10,
    remaining: 0,
    correctCount: 10,
    incorrectIds: [],
  });
});

test("serialization and resume are JSON-safe and malformed saved state falls back per branch", () => {
  const scene = fakeScene();
  const firstBranch = scene.a2Puzzle.branches[0];
  applyA2Decision(scene.a2State, scene.a2Puzzle, firstBranch.id, "keep");
  scene.a2State.hintLevel = 1;
  const serialized = a2Engine.serializeState(scene, a2Fixture);
  assert.doesNotThrow(() => JSON.stringify(serialized));
  serialized.decisions[firstBranch.id] = "prune";
  assert.equal(scene.a2State.decisions[firstBranch.id], "keep", "serialization must return an isolated copy");

  a2Engine.restoreState(scene, { decisions: { [firstBranch.id]: "keep", unknown: "prune" }, selectedId: firstBranch.id, hintLevel: 1 }, a2Fixture);
  assert.equal(scene.a2State.decisions[firstBranch.id], "keep");
  assert.equal(scene.a2State.hintLevel, 1);
  a2Engine.restoreState(scene, { decisions: { [firstBranch.id]: "impossible" }, selectedId: "missing", hintLevel: 99 }, a2Fixture);
  assert.equal(scene.a2State.decisions[firstBranch.id], "undecided");
  assert.equal(scene.a2State.selectedId, scene.a2Puzzle.branches[0].id);
  assert.equal(scene.a2State.hintLevel, 2);
});

test("Reset and Replay both recreate the deterministic clean run", () => {
  const scene = fakeScene();
  const original = structuredClone(scene.a2State);
  scene.a2State.decisions[scene.a2Puzzle.branches[0].id] = "prune";
  scene.a2State.hintLevel = 2;
  a2Engine.restoreState(scene, null, a2Fixture);
  assert.deepEqual(scene.a2State, original);
  scene.a2State.decisions[scene.a2Puzzle.branches[1].id] = "keep";
  a2Engine.restoreState(scene, null, a2Fixture);
  assert.deepEqual(scene.a2State, original);
});

test("two hints escalate from a principle to one concrete highlighted branch", () => {
  const scene = fakeScene();
  const first = a2Engine.showHint(scene, 0, a2Fixture);
  assert.match(first.en, /God/);
  assert.equal(scene.a2State.hintLevel, 1);
  assert.equal(scene.a2State.hintFocus, null);
  const second = a2Engine.showHint(scene, 1, a2Fixture);
  assert.match(second.en, /Isolation/);
  assert.equal(scene.a2State.hintLevel, 2);
  assert.equal(scene.a2State.hintFocus, "isolation");
  assert.equal(scene.a2State.selectedId, "isolation");
});

test("evaluation distinguishes incomplete, completed-incorrect, and completed-correct states", () => {
  const incomplete = fakeScene();
  const incompleteResult = a2Engine.evaluate(incomplete, a2Fixture);
  assert.equal(incompleteResult.correct, false);
  assert.equal(incompleteResult.complete, false);
  assert.match(incompleteResult.feedback.en, /10 branches/);

  const incorrect = fakeScene();
  for (const branch of incorrect.a2Puzzle.branches) incorrect.a2State.decisions[branch.id] = "keep";
  const incorrectResult = a2Engine.evaluate(incorrect, a2Fixture);
  assert.equal(incorrectResult.correct, false);
  assert.equal(incorrectResult.complete, true);
  assert.equal(incorrect.a2State.locked, false, "lab play stays editable after a wrong Check");

  const correct = fakeScene();
  solve(correct);
  const correctResult = a2Engine.evaluate(correct, a2Fixture);
  assert.deepEqual({ correct: correctResult.correct, complete: correctResult.complete }, { correct: true, complete: true });
  assert.equal(correct.a2State.locked, true);
  assert.equal(correct.a2State.solutionShown, true);
});

test("impossible moves are rejected without corrupting recoverable state", () => {
  const scene = fakeScene();
  const before = structuredClone(scene.a2State);
  assert.deepEqual(applyA2Decision(scene.a2State, scene.a2Puzzle, "missing", "keep"), { accepted: false, reason: "impossible" });
  assert.deepEqual(applyA2Decision(scene.a2State, scene.a2Puzzle, scene.a2State.selectedId, "burn"), { accepted: false, reason: "impossible" });
  assert.deepEqual(scene.a2State, before);
});

test("mission mode locks on its first Check and normalized XP has no engine side effect", async () => {
  const q34 = learningContent.find((item) => item.number === 34);
  const activity = q34.games[1];
  const mission = { groupCode: "Assis-Sao-Jose", id: "34__game-1", questionNumber: 34, challengeIndex: 1, xp: 9 };
  const instance = createA2MissionInstance(mission, activity);
  const scene = fakeScene(instance);
  scene.a2State.decisions[scene.a2Puzzle.branches[0].id] = "keep";
  const partialPersistence = createMinigamePersistence(new MemoryStorage());
  partialPersistence.save(instance, { submitted: false, engineState: a2Engine.serializeState(scene, instance) });
  assert.equal(partialPersistence.load(instance).submitted, false, "leaving partial play does not consume the submission");
  assert.equal(partialPersistence.load(instance).engineState.decisions[scene.a2Puzzle.branches[0].id], "keep");
  const evaluation = a2Engine.evaluate(scene, instance);
  assert.equal(evaluation.correct, false);
  assert.equal(scene.a2State.locked, true);
  assert.equal(scene.a2State.solutionShown, true);
  assert.equal(applyA2Decision(scene.a2State, scene.a2Puzzle, scene.a2Puzzle.branches[1].id, "prune").reason, "locked");
  assert.equal(createMinigameResult(instance, evaluation).xpAwarded, 0);

  let deliveries = 0;
  const submitOnce = createSingleSubmissionAdapter(async () => { deliveries += 1; });
  assert.equal(await submitOnce({ correct: false }), true);
  assert.equal(await submitOnce({ correct: true }), false);
  assert.equal(deliveries, 1);

  const persistence = createMinigamePersistence(new MemoryStorage());
  persistence.save(instance, { submitted: true, engineState: a2Engine.serializeState(scene, instance) });
  assert.equal(persistence.load(instance).submitted, true);
});

test("A2 scoring treats beginning again as growth and despair as choking love", () => {
  const scene = fakeScene();
  solve(scene);
  scene.a2State.decisions["begin-again"] = "prune";
  scene.a2State.decisions.despair = "keep";
  const reflectionCase = evaluateA2State(scene.a2State, scene.a2Puzzle);
  assert.equal(reflectionCase.complete, true);
  assert.equal(reflectionCase.correct, false);
  assert.equal(reflectionCase.correctCount, 8);
  assert.deepEqual(new Set(reflectionCase.incorrectIds), new Set(["begin-again", "despair"]));
});

test("Q34 replaces only human game 2 and still contains four games plus one quiz", () => {
  const q34 = learningContent.find((item) => item.number === 34);
  assert.equal(q34.games.length, 4);
  assert.equal(q34.quiz.length, 1);
  assert.deepEqual(q34.games.map((game) => game.type), ["reveal", "minigame", "order", "image-shuffle"]);
  assert.deepEqual(
    { engineId: q34.games[1].engineId, engineVersion: q34.games[1].engineVersion, sourceId: q34.games[1].sourceId },
    { engineId: "A2", engineVersion: "1.0.0", sourceId: "a2-q34-slot1" },
  );
  assert.equal(learningContent.flatMap((item) => item.games).filter((game) => game.type === "wordsearch").length, 5);
});
