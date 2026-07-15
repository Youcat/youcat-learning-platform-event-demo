import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { assertEngineInterface, validateGameInstance } from "../src/minigames/contracts.js";
import {
  b9Engine,
  createB9State,
  deriveB9Order,
  isB9Correct,
  normalizeB9Payload,
  swapB9Slots,
} from "../src/minigames/engines/b9-engine.js";
import { applyB9MissionResult, b9MissionInstance, createB9Registry } from "../src/minigames/b9-integration.js";
import { B9_ENGINE_ID, B9_ENGINE_VERSION, b9Fixture } from "../src/minigames/fixtures/b9-fixture.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";

function testScene(instance = b9Fixture) {
  return {
    b9InitialState: createB9State(instance),
    b9State: createB9State(instance),
    redrawCount: 0,
    notifyCount: 0,
    redraw() { this.redrawCount += 1; },
    notify() { this.notifyCount += 1; },
    playCrossing() { this.b9State.crossingProgress = 1; },
  };
}

function solveBySwaps(state, answer) {
  for (let index = 0; index < answer.length; index += 1) {
    if (state.order[index] === answer[index]) continue;
    const source = state.order.indexOf(answer[index]);
    assert.equal(swapB9Slots(state, source, index), true);
  }
}

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("B9 fixture follows the exact contract and the engine implements all eight methods", () => {
  assert.deepEqual(validateGameInstance(b9Fixture), { ok: true, errors: [] });
  assert.equal(assertEngineInterface(b9Engine), b9Engine);
  assert.deepEqual(b9Engine.validate(b9Fixture.payload, b9Fixture), { ok: true, errors: [] });
  assert.equal(createBundledGameSource([b9Fixture]).get("B9").engineId, B9_ENGINE_ID);
  assert.equal(createB9Registry().resolve({ ...b9Fixture, mode: "mission" }), b9Engine);
});

test("B9 schema rejects malformed input while normalization provides a safe playable fallback", () => {
  const malformed = { concepts: [{ id: "only-one", label: { en: "One" } }], answer: ["missing"], extra: true };
  const validation = b9Engine.validate(malformed, b9Fixture);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly/);
  const fallback = normalizeB9Payload(malformed);
  assert.deepEqual(fallback.answer, ["attraction", "reality", "good", "fidelity"]);
  const state = createB9State({ ...b9Fixture, payload: malformed });
  assert.deepEqual([...state.order].sort(), [...fallback.answer].sort());
});

test("seeded generation is deterministic, starts unsolved, and varies across the seed set", () => {
  const answer = b9Fixture.payload.answer;
  const first = deriveB9Order("bridge-seed-11", answer);
  assert.deepEqual(first, deriveB9Order("bridge-seed-11", answer));
  assert.notDeepEqual(first, answer);
  const variants = new Set(Array.from({ length: 20 }, (_, index) => deriveB9Order(`bridge-seed-${index}`, answer).join("|")));
  assert.ok(variants.size >= 8);
});

test("every generated arrangement is solvable through permitted swaps", () => {
  const answer = b9Fixture.payload.answer;
  for (let index = 0; index < 200; index += 1) {
    const state = { ...createB9State({ ...b9Fixture, seed: `solvable-${index}` }), status: { en: "", pt: "" } };
    assert.equal(new Set(state.order).size, 4);
    solveBySwaps(state, answer);
    assert.deepEqual(state.order, answer);
    assert.equal(isB9Correct(state, b9Fixture), true);
  }
});

test("state serialization is JSON-safe and restores a compatible partial run", () => {
  const source = testScene();
  swapB9Slots(source.b9State, 0, 2);
  source.b9State.hintLevel = 1;
  source.b9State.checks = 2;
  const serialized = b9Engine.serializeState(source, b9Fixture);
  assert.doesNotThrow(() => JSON.stringify(serialized));
  const resumed = testScene();
  b9Engine.restoreState(resumed, JSON.parse(JSON.stringify(serialized)), b9Fixture);
  assert.deepEqual(resumed.b9State.order, serialized.order);
  assert.equal(resumed.b9State.hintLevel, 1);
  assert.equal(resumed.b9State.checks, 2);

  b9Engine.restoreState(resumed, { order: ["broken"], hintLevel: 99 }, b9Fixture);
  assert.deepEqual(resumed.b9State.order, createB9State(b9Fixture).order);
  assert.equal(resumed.b9State.hintLevel, 2);
});

test("Reset and Replay both recreate the same clean deterministic run", () => {
  const scene = testScene();
  scene.b9State.complete = true;
  scene.b9State.order = [...b9Fixture.payload.answer];
  b9Engine.restoreState(scene, null, b9Fixture);
  const reset = b9Engine.serializeState(scene, b9Fixture);
  swapB9Slots(scene.b9State, 0, 1);
  b9Engine.restoreState(scene, null, b9Fixture);
  const replay = b9Engine.serializeState(scene, b9Fixture);
  assert.deepEqual(replay, reset);
  assert.equal(replay.complete, false);
  assert.notDeepEqual(replay.order, b9Fixture.payload.answer);
});

test("two hints escalate from orientation to placing one incorrect stone", () => {
  const scene = testScene();
  const before = [...scene.b9State.order];
  const first = b9Engine.showHint(scene, 0, b9Fixture);
  assert.match(first.en, /Attraction begins/);
  assert.deepEqual(scene.b9State.order, before);
  const correctBefore = before.filter((id, index) => id === b9Fixture.payload.answer[index]).length;
  const second = b9Engine.showHint(scene, 1, b9Fixture);
  const correctAfter = scene.b9State.order.filter((id, index) => id === b9Fixture.payload.answer[index]).length;
  assert.match(second.en, /One stone moved home/);
  assert.ok(correctAfter > correctBefore);
  assert.equal(scene.b9State.hintLevel, 2);
});

test("lab evaluation accepts only the exact order and remains revisable after an incorrect Check", () => {
  const scene = testScene();
  const wrong = b9Engine.evaluate(scene, b9Fixture);
  assert.deepEqual({ correct: wrong.correct, complete: wrong.complete }, { correct: false, complete: false });
  assert.equal(scene.b9State.complete, false);
  assert.equal("xpAwarded" in wrong, false);

  scene.b9State.order = [...b9Fixture.payload.answer];
  const correct = b9Engine.evaluate(scene, b9Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(scene.b9State.complete, true);
  assert.equal(scene.b9State.crossingProgress, 1);
  assert.match(correct.feedback.pt, /atração/);
});

test("an incorrect mission Check completes once, preserves the submitted order, and reveals the solution", () => {
  const mission = { ...structuredClone(b9Fixture), mode: "mission", xp: 9 };
  const scene = testScene(mission);
  const submitted = [...scene.b9State.order];
  const evaluation = b9Engine.evaluate(scene, mission);
  assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: false, complete: true });
  assert.deepEqual(scene.b9State.submittedOrder, submitted);
  assert.deepEqual(scene.b9State.order, mission.payload.answer);
  assert.equal(scene.b9State.revealedSolution, true);
  assert.match(evaluation.feedback.en, /attraction.*reality.*concrete good.*fidelity/i);
});

test("mission result integration consumes one result and keeps XP normalization side-effect free", async () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "3__game-0", questionNumber: 3, challengeIndex: 0, xp: 9 };
  const instance = b9MissionInstance(mission);
  assert.equal(instance.missionSlot, 0);
  assert.equal(instance.mode, "mission");
  assert.equal(instance.xp, 9);
  const result = createMinigameResult(instance, { correct: true, complete: true });
  assert.equal(result.xpAwarded, 9);
  const interaction = { attempted: false };
  const completions = [];
  const finish = async (correct) => completions.push(correct);
  assert.equal(await applyB9MissionResult({ interaction, result, finish }), true);
  assert.equal(await applyB9MissionResult({ interaction, result, finish }), false);
  assert.deepEqual(completions, [true]);
  assert.deepEqual({ attempted: interaction.attempted, finished: interaction.finished, succeeded: interaction.succeeded }, { attempted: true, finished: true, succeeded: true });

  const wrong = createMinigameResult({ ...instance, id: "wrong" }, { correct: false, complete: true });
  assert.equal(wrong.xpAwarded, 0);
});

test("leaving a mission before Check preserves its order without consuming the attempt", () => {
  const mission = b9MissionInstance({ groupCode: "Assis-Santa-Clara", id: "3__game-0", questionNumber: 3, challengeIndex: 0, xp: 6 });
  const scene = testScene(mission);
  swapB9Slots(scene.b9State, 0, 2);
  const persistence = createMinigamePersistence(new MemoryStorage());
  persistence.save(mission, { submitted: false, hintsUsed: 0, engineState: b9Engine.serializeState(scene, mission) });
  const resumed = persistence.load(mission);
  assert.equal(resumed.submitted, false);
  assert.deepEqual(resumed.engineState.order, scene.b9State.order);
  assert.equal(createMinigameResult(mission, null).xpAwarded, 0);
});

test("accessible actions expose all four stones, work by keyboard-activatable HTML buttons, and lock on completion", () => {
  const scene = testScene();
  let tapped = null;
  scene.tapSlot = (index) => { tapped = index; };
  const actions = b9Engine.getAccessibleActions(scene, b9Fixture);
  assert.equal(actions.length, 4);
  assert.ok(actions.every((action) => action.label.en && action.label.pt && action.disabled === false));
  actions[2].run();
  assert.equal(tapped, 2);
  scene.b9State.complete = true;
  assert.ok(b9Engine.getAccessibleActions(scene, b9Fixture).every((action) => action.disabled));
});

test("createScene and destroy remain safe at the contract boundary", () => {
  class FakeScene {
    constructor(config) { this.config = config; }
  }
  const scene = b9Engine.createScene({
    Phaser: { Scene: FakeScene },
    instance: b9Fixture,
    language: "en",
    reducedMotion: true,
    onStateChange() {},
    onReady() {},
  });
  assert.match(scene.config.key, /^b9-/);
  assert.doesNotThrow(() => b9Engine.destroy(scene, b9Fixture));
});

test("Q3 replacement preserves exactly four games and one quiz", () => {
  const q3 = activities[3];
  assert.equal(q3.games.length, 4);
  assert.equal(q3.quiz.length, 1);
  assert.deepEqual(q3.games.map(({ type }) => type), ["minigame", "reveal", "move", "wordsearch"]);
  assert.deepEqual(
    { engineId: q3.games[0].engineId, engineVersion: q3.games[0].engineVersion, fixtureId: q3.games[0].fixtureId },
    { engineId: B9_ENGINE_ID, engineVersion: B9_ENGINE_VERSION, fixtureId: "B9" },
  );
});
