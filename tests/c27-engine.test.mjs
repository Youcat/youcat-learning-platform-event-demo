import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { bundledGameSource, createRegisteredMinigameRegistry } from "../src/minigames/catalog.js";
import {
  c27Engine,
  createWellspringState,
  generateWellspringPuzzle,
  normalizeWellspringPayload,
  validateWellspringPayload,
  waterReachFor,
} from "../src/minigames/engines/c27-engine.js";
import { c27Activity, c27Fixture } from "../src/minigames/fixtures/c27-fixture.js";
import { applyMissionMinigameResult, missionInstanceForActivity } from "../src/minigames/mission-player.js";

function fakeScene(instance = c27Fixture) {
  const puzzle = generateWellspringPuzzle(instance.seed, instance.payload);
  const scene = {
    wellspringPuzzle: puzzle,
    wellspringInitialState: createWellspringState(puzzle),
    wellspringState: createWellspringState(puzzle),
    redrawCount: 0,
    notifyCount: 0,
    redraw() { this.redrawCount += 1; },
    notify() { this.notifyCount += 1; },
    setGate(index, direction) {
      if (this.wellspringState.gateStates[index] !== direction) this.wellspringState.moveCount += 1;
      this.wellspringState.gateStates[index] = direction;
      this.wellspringState.selectedGate = index;
      this.redraw();
      this.notify();
      return true;
    },
    toggleGate(index) { return this.setGate(index, this.wellspringState.gateStates[index] ? 0 : 1); },
  };
  return scene;
}

test("C27 fixture has the exact root contract and all eight engine methods", () => {
  assert.deepEqual(validateGameInstance(c27Fixture), { ok: true, errors: [] });
  assert.deepEqual(Object.keys(c27Engine).sort(), [...ENGINE_METHODS].sort());
  assert.equal(c27Fixture.id, "C27");
  assert.equal(c27Fixture.engineId, "C27");
  assert.equal(c27Fixture.engineVersion, "1.0.0");
  assert.equal(c27Fixture.questionNumber, 126);
  assert.equal(c27Fixture.missionSlot, 0);
});

test("C27 payload schema rejects unknown or malformed input and generation falls back safely", () => {
  assert.deepEqual(validateWellspringPayload(c27Fixture.payload), { ok: true, errors: [] });
  const malformed = { schemaVersion: 9, gateCount: 2, fruitCount: 0, concepts: [], unknown: true };
  assert.equal(c27Engine.validate(malformed, c27Fixture).ok, false);
  const normalized = normalizeWellspringPayload(malformed);
  assert.equal(normalized.fallbackUsed, true);
  assert.deepEqual(normalized.payload, c27Fixture.payload);
  const puzzle = generateWellspringPuzzle("malformed", malformed);
  assert.equal(puzzle.fallbackUsed, true);
  assert.equal(puzzle.solution.length, 5);
  assert.equal(puzzle.initial.length, 5);
});

test("seeded generation is deterministic and varies by seed", () => {
  const first = generateWellspringPuzzle("alpha", c27Fixture.payload);
  const again = generateWellspringPuzzle("alpha", c27Fixture.payload);
  const other = generateWellspringPuzzle("bravo", c27Fixture.payload);
  assert.deepEqual(first.solution, again.solution);
  assert.deepEqual(first.initial, again.initial);
  assert.notDeepEqual({ solution: first.solution, initial: first.initial }, { solution: other.solution, initial: other.initial });
});

test("every generated puzzle begins unsolved and has a guaranteed complete solution", () => {
  for (let index = 0; index < 100; index += 1) {
    const puzzle = generateWellspringPuzzle(`seed-${index}`, c27Fixture.payload);
    assert.equal(waterReachFor(puzzle, puzzle.initial).complete, false);
    assert.deepEqual(waterReachFor(puzzle, puzzle.solution), {
      gateOpen: [true, true, true, true, true],
      fruitReached: [true, true, true],
      reachedCount: 3,
      complete: true,
    });
  }
});

test("state serialization is JSON-safe and restores a compatible partial run", () => {
  const scene = fakeScene();
  scene.setGate(2, scene.wellspringPuzzle.solution[2]);
  scene.wellspringState.selectedGate = 4;
  scene.wellspringState.hintLevel = 1;
  const saved = c27Engine.serializeState(scene, c27Fixture);
  assert.doesNotThrow(() => JSON.stringify(saved));
  const resumed = fakeScene();
  c27Engine.restoreState(resumed, JSON.parse(JSON.stringify(saved)), c27Fixture);
  assert.deepEqual(resumed.wellspringState, saved);
});

test("Reset and Replay restore the deterministic clean initial state", () => {
  const scene = fakeScene();
  const initial = structuredClone(scene.wellspringState);
  scene.toggleGate(0);
  scene.wellspringState.hintLevel = 2;
  scene.wellspringState.lastEvaluation = "wrong";
  c27Engine.restoreState(scene, null, c27Fixture);
  assert.deepEqual(scene.wellspringState, initial);
  scene.toggleGate(4);
  c27Engine.restoreState(scene, null, c27Fixture);
  assert.deepEqual(scene.wellspringState, initial);
});

test("two hints escalate from marking a blocked gate to correcting one gate", () => {
  const scene = fakeScene();
  const before = [...scene.wellspringState.gateStates];
  const first = c27Engine.showHint(scene, 0, c27Fixture);
  assert.match(first.en, /marked in pink/);
  assert.equal(scene.wellspringState.hintLevel, 1);
  assert.deepEqual(scene.wellspringState.gateStates, before);
  const closedBefore = waterReachFor(scene.wellspringPuzzle, before).gateOpen.filter((open) => !open).length;
  const second = c27Engine.showHint(scene, 1, c27Fixture);
  const closedAfter = waterReachFor(scene.wellspringPuzzle, scene.wellspringState.gateStates).gateOpen.filter((open) => !open).length;
  assert.match(second.en, /set correctly/);
  assert.equal(scene.wellspringState.hintLevel, 2);
  assert.equal(closedAfter, closedBefore - 1);
});

test("evaluation distinguishes incorrect, correct, and completed states", () => {
  const labScene = fakeScene();
  const wrong = c27Engine.evaluate(labScene, c27Fixture);
  assert.deepEqual({ correct: wrong.correct, complete: wrong.complete }, { correct: false, complete: false });
  assert.equal(labScene.wellspringState.showSolution, false);
  labScene.wellspringState.gateStates = [...labScene.wellspringPuzzle.solution];
  const correct = c27Engine.evaluate(labScene, c27Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(correct.feedback.pt.includes("três frutos"), true);
});

test("mission evaluation reveals the solution only after an incorrect Check", () => {
  const missionFixture = { ...structuredClone(c27Fixture), id: "room:126__game-0", mode: "mission", xp: 8 };
  const scene = fakeScene(missionFixture);
  const result = c27Engine.evaluate(scene, missionFixture);
  assert.equal(result.correct, false);
  assert.equal(scene.wellspringState.showSolution, true);
  scene.wellspringState.gateStates = [...scene.wellspringPuzzle.solution];
  c27Engine.evaluate(scene, missionFixture);
  assert.equal(scene.wellspringState.showSolution, false);
});

test("engine-specific reflection counts one dry fruit separately from a dry root", () => {
  const scene = fakeScene();
  scene.wellspringState.gateStates = [...scene.wellspringPuzzle.solution];
  scene.wellspringState.gateStates[4] = scene.wellspringState.gateStates[4] ? 0 : 1;
  const oneDry = c27Engine.evaluate(scene, c27Fixture);
  assert.match(oneDry.feedback.en, /^1 fruit is still dry/);
  scene.wellspringState.gateStates = [...scene.wellspringPuzzle.solution];
  scene.wellspringState.gateStates[0] = scene.wellspringState.gateStates[0] ? 0 : 1;
  const rootDry = c27Engine.evaluate(scene, c27Fixture);
  assert.match(rootDry.feedback.en, /^3 fruits are still dry/);
});

test("accessible actions expose every gate and permit complete HTML-only play", () => {
  const scene = fakeScene();
  const actions = c27Engine.getAccessibleActions(scene, c27Fixture);
  assert.equal(actions.length, 5);
  actions.forEach((action, index) => {
    assert.ok(action.label.en.includes("Toggle"));
    if (scene.wellspringState.gateStates[index] !== scene.wellspringPuzzle.solution[index]) action.run();
  });
  assert.equal(waterReachFor(scene.wellspringPuzzle, scene.wellspringState.gateStates).complete, true);
});

test("bundled source and production registry resolve C27 without Firebase content", () => {
  const fixture = bundledGameSource.get("C27", { mode: "mission" });
  assert.equal(bundledGameSource.kind, "bundled");
  assert.equal(fixture.mode, "mission");
  assert.equal(createRegisteredMinigameRegistry().resolve(fixture), c27Engine);
});

test("Q126 replaces only human game 1 and preserves four games plus one quiz", () => {
  assert.equal(activities[126].games.length, 4);
  assert.equal(activities[126].quiz.length, 1);
  assert.deepEqual(activities[126].games[0], c27Activity);
  assert.deepEqual(activities[126].games.slice(1).map((game) => game.type), ["match", "image-shuffle", "reveal"]);
});

test("mission adapter maps slot 0, locks a second result, and keeps XP side-effect free", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "126__game-0", questionNumber: 126, challengeIndex: 0, xp: 8 };
  const instance = missionInstanceForActivity({ mission, activity: c27Activity });
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 0);
  assert.equal(instance.xp, 8);
  const normalized = createMinigameResult(instance, { correct: true, complete: true }, { hintsUsed: 1 });
  assert.equal(normalized.xpAwarded, 8);
  const interaction = { attempted: false };
  assert.deepEqual(applyMissionMinigameResult(interaction, normalized), { accepted: true, correct: true });
  assert.equal(interaction.succeeded, true);
  assert.deepEqual(applyMissionMinigameResult(interaction, { correct: false, complete: false }), { accepted: false, correct: true });
  assert.equal(interaction.minigameResult.xpAwarded, 8);
});
