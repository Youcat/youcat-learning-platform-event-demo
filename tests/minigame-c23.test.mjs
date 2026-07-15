import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import {
  C23_DEFAULT_PAYLOAD,
  c23Engine,
  createC23InitialState,
  isC23Solvable,
  normalizeC23Payload,
  scoreC23Placements,
  validateC23Payload,
} from "../src/minigames/engines/c23-engine.js";
import { C23_FIXTURE_ID, c23Fixture } from "../src/minigames/fixtures/c23-fixture.js";
import {
  c23BundledSource,
  createC23MissionInstance,
  createC23Registry,
  createC23SingleSubmissionAdapter,
} from "../src/minigames/c23-integration.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function fakeScene(seed = c23Fixture.seed) {
  const initial = createC23InitialState(C23_DEFAULT_PAYLOAD, seed);
  const scene = {
    c23Model: structuredClone(C23_DEFAULT_PAYLOAD),
    c23InitialState: structuredClone(initial),
    c23State: structuredClone(initial),
    redraws: 0,
    notifications: 0,
    redraw() { this.redraws += 1; },
    notify() { this.notifications += 1; },
  };
  scene.placeCue = (cueId, targetIndex) => {
    const sourceIndex = scene.c23State.placements.indexOf(cueId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex > 5) return false;
    [scene.c23State.placements[sourceIndex], scene.c23State.placements[targetIndex]] = [scene.c23State.placements[targetIndex], scene.c23State.placements[sourceIndex]];
    scene.c23State.selectedCueId = cueId;
    scene.c23State.targetIndex = targetIndex;
    return true;
  };
  return scene;
}

test("C23 fixture satisfies the exact contract and registers all eight engine methods", () => {
  assert.deepEqual(validateGameInstance(c23Fixture), { ok: true, errors: [] });
  assert.equal(c23Fixture.id, C23_FIXTURE_ID);
  assert.equal(c23Fixture.questionNumber, 25);
  assert.equal(c23Fixture.missionSlot, 1);
  assert.equal(c23Fixture.engineId, "C23");
  assert.equal(c23Fixture.engineVersion, "1.0.0");
  assert.ok(c23Fixture.assets.baseImage.endsWith("emmaus-guide-360.webp"));
  for (const method of ENGINE_METHODS) assert.equal(typeof c23Engine[method], "function");
  assert.deepEqual(validateC23Payload(c23Fixture.payload, c23Fixture), { ok: true, errors: [] });
});

test("C23 rejects malformed schema but has a complete deterministic fallback model", () => {
  const malformed = { concepts: [{ id: "only-one" }], slots: [], solution: [], forwardCueId: "missing", extra: true };
  const validation = validateC23Payload(malformed);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly six|permutation|supported/);
  assert.deepEqual(normalizeC23Payload(malformed), structuredClone(C23_DEFAULT_PAYLOAD));
  const fallback = createC23InitialState(malformed, "broken-input-seed");
  assert.equal(isC23Solvable(fallback.placements), true);
});

test("seeded generation is deterministic, unsolved, and varies across seeds", () => {
  const first = createC23InitialState(c23Fixture.payload, "seed-alpha");
  const repeated = createC23InitialState(c23Fixture.payload, "seed-alpha");
  const other = createC23InitialState(c23Fixture.payload, "seed-beta");
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first.placements, other.placements);
  assert.notDeepEqual(first.placements, c23Fixture.payload.solution);
});

test("every generated C23 arrangement is a guaranteed-solvable permutation", () => {
  for (let index = 0; index < 250; index += 1) {
    const state = createC23InitialState(c23Fixture.payload, `solvability-${index}`);
    assert.equal(isC23Solvable(state.placements, c23Fixture.payload), true);
    assert.notDeepEqual(state.placements, c23Fixture.payload.solution);
  }
});

test("C23 serializes JSON-safe state and resumes compatible partial progress", () => {
  const scene = fakeScene("resume-seed");
  scene.placeCue("gospel", 1);
  scene.c23State.hintLevel = 1;
  const serialized = c23Engine.serializeState(scene, c23Fixture);
  assert.doesNotThrow(() => JSON.stringify(serialized));
  const restored = fakeScene("resume-seed");
  c23Engine.restoreState(restored, JSON.parse(JSON.stringify(serialized)), c23Fixture);
  assert.deepEqual(restored.c23State.placements, serialized.placements);
  assert.equal(restored.c23State.hintLevel, 1);
  assert.equal(restored.redraws, 1);
});

test("malformed resume falls back cleanly and Reset/Replay restore the seeded start", () => {
  const scene = fakeScene("reset-replay-seed");
  const seeded = structuredClone(scene.c23InitialState);
  scene.c23State.placements = [...C23_DEFAULT_PAYLOAD.solution];
  scene.c23State.completed = true;
  c23Engine.restoreState(scene, null, c23Fixture);
  assert.deepEqual(scene.c23State, seeded);
  scene.c23State.placements = ["experience", "experience"];
  c23Engine.restoreState(scene, { placements: ["bad"] }, c23Fixture);
  assert.deepEqual(scene.c23State, seeded);
});

test("the two hints escalate from relationship guidance to one corrected bearing", () => {
  const scene = fakeScene("hint-seed");
  const before = [...scene.c23State.placements];
  const first = c23Engine.showHint(scene, 0, c23Fixture);
  assert.match(first.en, /Gospel/);
  assert.deepEqual(scene.c23State.placements, before);
  const firstIncorrect = before.findIndex((id, index) => id !== C23_DEFAULT_PAYLOAD.solution[index]);
  const second = c23Engine.showHint(scene, 1, c23Fixture);
  assert.match(second.en, /bearing|aligned/);
  assert.equal(scene.c23State.placements[firstIncorrect], C23_DEFAULT_PAYLOAD.solution[firstIncorrect]);
  assert.equal(scene.c23State.hintLevel, 2);
});

test("Check distinguishes incorrect, correct, and completed lab states without XP side effects", () => {
  const scene = fakeScene("evaluate-seed");
  const wrong = c23Engine.evaluate(scene, c23Fixture);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.complete, false);
  assert.match(wrong.feedback.en, /of 6/);
  assert.equal("xpAwarded" in wrong, false);
  assert.equal(scene.c23State.completed, false);

  scene.c23State.placements = [...C23_DEFAULT_PAYLOAD.solution];
  const correct = c23Engine.evaluate(scene, c23Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(scene.c23State.completed, true);
  assert.equal(scene.c23State.solutionShown, true);
});

test("mission Check reveals a coherent solution after either outcome", () => {
  const missionInstance = { ...structuredClone(c23Fixture), mode: "mission", xp: 6 };
  const wrongScene = fakeScene("mission-wrong-seed");
  const wrong = c23Engine.evaluate(wrongScene, missionInstance);
  assert.equal(wrong.correct, false);
  assert.equal(wrongScene.c23State.solutionShown, true);
  assert.deepEqual(wrongScene.c23State.placements, C23_DEFAULT_PAYLOAD.solution);

  const correctScene = fakeScene("mission-correct-seed");
  correctScene.c23State.placements = [...C23_DEFAULT_PAYLOAD.solution];
  const correct = c23Engine.evaluate(correctScene, missionInstance);
  assert.equal(correct.correct, true);
  assert.equal(correctScene.c23State.solutionShown, true);
});

test("special scoring rewards alignment but accepts neither rotation nor reflection as complete", () => {
  const solved = scoreC23Placements(C23_DEFAULT_PAYLOAD.solution);
  assert.deepEqual(solved, { correctSlots: 6, alignedPairs: 6, forwardAligned: true, points: 14, maximum: 14 });
  const rotated = [...C23_DEFAULT_PAYLOAD.solution.slice(1), C23_DEFAULT_PAYLOAD.solution[0]];
  const rotationScore = scoreC23Placements(rotated);
  assert.equal(rotationScore.alignedPairs, 6);
  assert.equal(rotationScore.correctSlots, 0);
  assert.equal(rotationScore.points < rotationScore.maximum, true);
  const reflected = [...C23_DEFAULT_PAYLOAD.solution].reverse();
  assert.equal(scoreC23Placements(reflected).alignedPairs, 0);
});

test("mission adapter delivers once and normalized XP remains all-or-nothing", async () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "25__game-1", questionNumber: 25, challengeIndex: 1, xp: 6 };
  const instance = createC23MissionInstance(mission);
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 1);
  assert.equal(instance.xp, 6);
  let deliveries = 0;
  const deliver = createC23SingleSubmissionAdapter(async () => { deliveries += 1; });
  assert.equal(await deliver({ correct: false }), true);
  assert.equal(await deliver({ correct: true }), false);
  assert.equal(deliveries, 1);
  assert.equal(createMinigameResult(instance, { correct: true, complete: true }).xpAwarded, 6);
  assert.equal(createMinigameResult(instance, { correct: false, complete: false }).xpAwarded, 0);
});

test("leaving a mission before Check preserves C23 progress without consuming its submission", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "25__game-1", questionNumber: 25, challengeIndex: 1, xp: 6 };
  const instance = createC23MissionInstance(mission);
  const persistence = createMinigamePersistence(new MemoryStorage());
  const progressState = createC23InitialState(instance.payload, instance.seed);
  [progressState.placements[0], progressState.placements[2]] = [progressState.placements[2], progressState.placements[0]];
  persistence.save(instance, { hintsUsed: 1, submitted: false, engineState: progressState });
  const resumed = persistence.load(instance);
  assert.equal(resumed.submitted, false);
  assert.equal(resumed.hintsUsed, 1);
  assert.deepEqual(resumed.engineState.placements, progressState.placements);
});

test("bundled source, production registry, and Q25 replacement preserve four games plus one quiz", () => {
  assert.equal(c23BundledSource.kind, "bundled");
  assert.equal(c23BundledSource.get(C23_FIXTURE_ID).engineId, "C23");
  const registry = createC23Registry();
  assert.equal(registry.resolve(c23Fixture), c23Engine);
  assert.deepEqual(registry.registrations(), [{ engineId: "C23", engineVersion: "1.0.0", production: true }]);
  assert.equal(activities[25].games.length, 4);
  assert.equal(activities[25].quiz.length, 1);
  assert.equal(activities[25].games[1].type, "minigame");
  assert.equal(activities[25].games[1].definitionId, "C23");
  assert.equal(activities[25].games.filter((game) => game.definitionId === "C23").length, 1);
});
