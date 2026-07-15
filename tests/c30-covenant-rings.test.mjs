import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import { bundledMinigameSource, createAppMinigameRegistry } from "../src/minigames/catalog.js";
import {
  c30CovenantRingsEngine,
  createC30StartSteps,
  isC30Solved,
} from "../src/minigames/engines/c30-covenant-rings.js";
import { c30CovenantRingsFixture } from "../src/minigames/fixtures/c30-covenant-rings-fixture.js";
import { missionMinigameInstance } from "../src/minigames/mission-adapter.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

class FakePhaserScene {
  constructor(config) { this.config = config; }
}

function createScene({ mode = "lab", seed = c30CovenantRingsFixture.seed, payload, onStateChange = () => {} } = {}) {
  const instance = {
    ...structuredClone(c30CovenantRingsFixture),
    mode,
    seed,
    ...(payload === undefined ? {} : { payload }),
  };
  const scene = c30CovenantRingsEngine.createScene({
    Phaser: { Scene: FakePhaserScene },
    instance,
    language: "en",
    reducedMotion: false,
    onStateChange,
    onReady: () => {},
  });
  return { scene, instance };
}

test("C30 fixture follows the exact GameInstance schema and engine contract", () => {
  assert.deepEqual(validateGameInstance(c30CovenantRingsFixture), { ok: true, errors: [] });
  assert.deepEqual(
    ENGINE_METHODS.filter((method) => typeof c30CovenantRingsEngine[method] === "function"),
    ENGINE_METHODS,
  );
  assert.deepEqual(c30CovenantRingsEngine.validate(c30CovenantRingsFixture.payload, c30CovenantRingsFixture), { ok: true, errors: [] });
});

test("C30 rejects malformed schema but uses a safe runtime fallback", () => {
  const malformedPayload = { sectors: 2, concepts: [], solution: "absolute" };
  const validation = c30CovenantRingsEngine.validate(malformedPayload, c30CovenantRingsFixture);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /five concepts/);
  assert.match(validation.errors.join("\n"), /8 to 16/);

  const { scene } = createScene({ payload: malformedPayload });
  assert.equal(scene.covenantPayload.sectors, 12);
  assert.equal(scene.covenantPayload.concepts.length, 5);
  assert.equal(scene.covenantState.ringSteps.length, 5);
});

test("seeded generation is deterministic, unsolved, and guaranteed solvable", () => {
  const first = createC30StartSteps("stable-seed", 12);
  const second = createC30StartSteps("stable-seed", 12);
  const other = createC30StartSteps("other-seed", 12);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, other);
  assert.equal(isC30Solved(first), false);
  assert.ok(first.every((step) => Number.isInteger(step) && step >= 0 && step < 12));
  assert.equal(isC30Solved(Array(5).fill(first[0])), true);
});

test("JSON-safe serialization resumes meaningful state and rejects malformed saved rings", () => {
  const { scene, instance } = createScene();
  scene.covenantState.ringSteps = [2, 4, 6, 8, 10];
  scene.covenantState.selectedRing = 4;
  scene.covenantState.moveCount = 9;
  const serialized = c30CovenantRingsEngine.serializeState(scene, instance);
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);

  const resumed = createScene().scene;
  c30CovenantRingsEngine.restoreState(resumed, serialized, instance);
  assert.deepEqual(resumed.covenantState.ringSteps, [2, 4, 6, 8, 10]);
  assert.equal(resumed.covenantState.selectedRing, 4);
  assert.equal(resumed.covenantState.moveCount, 9);

  c30CovenantRingsEngine.restoreState(resumed, { ringSteps: [99], selectedRing: 99 }, instance);
  assert.deepEqual(resumed.covenantState.ringSteps, resumed.covenantInitialState.ringSteps);
  assert.equal(resumed.covenantState.selectedRing, resumed.covenantInitialState.selectedRing);
});

test("Reset and Replay both restore the same deterministic clean run", () => {
  const { scene, instance } = createScene({ seed: "reset-replay-seed" });
  const expected = structuredClone(scene.covenantInitialState);
  scene.covenantState.ringSteps = [0, 0, 0, 0, 0];
  scene.covenantState.hintLevel = 2;
  scene.covenantState.moveCount = 18;
  scene.covenantState.locked = true;
  c30CovenantRingsEngine.restoreState(scene, null, instance);
  assert.deepEqual(scene.covenantState, expected);
  scene.covenantState.ringSteps[0] = 7;
  c30CovenantRingsEngine.restoreState(scene, null, instance);
  assert.deepEqual(scene.covenantState, expected);
});

test("two hints escalate from a seam cue to aligning one band", () => {
  let updates = 0;
  const { scene, instance } = createScene({ onStateChange: () => { updates += 1; } });
  scene.covenantState.ringSteps = [3, 3, 3, 7, 9];
  const before = [...scene.covenantState.ringSteps];
  const first = c30CovenantRingsEngine.showHint(scene, 0, instance);
  assert.match(first.en, /Compare the ribbon/);
  assert.deepEqual(scene.covenantState.ringSteps, before);
  assert.equal(scene.covenantState.hintLevel, 1);
  const second = c30CovenantRingsEngine.showHint(scene, 1, instance);
  assert.match(second.en, /aligned/);
  assert.equal(scene.covenantState.hintLevel, 2);
  assert.equal(scene.covenantState.ringSteps.filter((step) => step === 3).length, 4);
  assert.ok(updates >= 2);
});

test("lab Check distinguishes incorrect, correct, and completed states", () => {
  const { scene, instance } = createScene();
  scene.covenantState.ringSteps = [0, 1, 0, 0, 0];
  const incorrect = c30CovenantRingsEngine.evaluate(scene, instance);
  assert.deepEqual({ correct: incorrect.correct, complete: incorrect.complete }, { correct: false, complete: false });
  assert.equal(scene.covenantState.locked, false);

  scene.covenantState.ringSteps = [8, 8, 8, 8, 8];
  const correct = c30CovenantRingsEngine.evaluate(scene, instance);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(scene.covenantState.completed, true);
  assert.equal(scene.covenantState.locked, true);
});

test("all shared rotations are accepted and hints do not reduce XP", () => {
  for (let shared = 0; shared < 12; shared += 1) {
    assert.equal(isC30Solved(Array(5).fill(shared)), true);
  }
  const evaluation = { correct: true, complete: true };
  const result = createMinigameResult({ ...c30CovenantRingsFixture, xp: 6 }, evaluation, { hintsUsed: 2 });
  assert.equal(result.xpAwarded, 6);
  assert.equal(result.hintsUsed, 2);
});

test("mission mode permits one scored submission, locks manipulation, and reveals a wrong solution", () => {
  const { scene, instance } = createScene({ mode: "mission" });
  scene.covenantState.ringSteps = [0, 2, 4, 6, 8];
  const evaluation = c30CovenantRingsEngine.evaluate(scene, instance);
  assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete }, { correct: false, complete: true });
  assert.equal(scene.covenantState.locked, true);
  assert.equal(scene.covenantState.solutionShown, true);
  assert.deepEqual(scene.covenantState.ringSteps, [0, 0, 0, 0, 0]);
  assert.equal(scene.setRingStep(0, 3), false);
  assert.equal(scene.covenantState.statusCode, "locked");
  assert.equal(createMinigameResult({ ...instance, xp: 6 }, evaluation).xpAwarded, 0);
});

test("accessible actions expose complete non-canvas operation and reject impossible moves", () => {
  const { scene, instance } = createScene();
  const actions = c30CovenantRingsEngine.getAccessibleActions(scene, instance);
  assert.deepEqual(actions.map((action) => action.id), ["previous-band", "turn-left", "turn-right", "next-band"]);
  assert.ok(actions.every((action) => action.label.en && action.label.pt && typeof action.run === "function"));
  const before = scene.covenantState.ringSteps[scene.covenantState.selectedRing];
  actions.find((action) => action.id === "turn-right").run();
  assert.equal(scene.covenantState.ringSteps[scene.covenantState.selectedRing], (before + 1) % 12);
  assert.equal(scene.setRingStep(9, 2), false);
  assert.equal(scene.covenantState.statusCode, "invalid");
});

test("C30 is bundled and production registered for lab and mission resolution", () => {
  const lab = bundledMinigameSource.get("C30", { mode: "lab" });
  assert.equal(lab.engineId, "C30");
  assert.equal(createAppMinigameRegistry().resolve(lab), c30CovenantRingsEngine);

  const mission = { groupCode: "Assis-Sao-Jose", id: "14__game-3", questionNumber: 14, challengeIndex: 3, xp: 6 };
  const activity = activities[14].games[3];
  const instance = missionMinigameInstance({ mission, activity });
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 3);
  assert.equal(instance.xp, 6);
  assert.equal(instance.engineId, "C30");
});

test("Q14 preserves three standard games, C30 in human game 4, and one quiz", () => {
  assert.equal(activities[14].games.length, 4);
  assert.equal(activities[14].quiz.length, 1);
  assert.deepEqual(activities[14].games.slice(0, 3).map((game) => game.type), ["match", "crossword", "reveal"]);
  assert.deepEqual(
    activities[14].games[3],
    {
      type: "minigame",
      fixtureId: "C30",
      engineId: "C30",
      engineVersion: "1.0.0",
      xp: 6,
      title: { en: "Covenant Rings", pt: "Anéis da Aliança" },
      prompt: {
        en: "Rotate the five concentric bands until the ribbon, gift, and figures form one image.",
        pt: "Gire as cinco faixas concêntricas até que a fita, o presente e as figuras formem uma só imagem.",
      },
    },
  );
  assert.equal(Object.values(activities).flatMap((item) => item.games).filter((game) => game.type === "minigame").length, 6);
});
