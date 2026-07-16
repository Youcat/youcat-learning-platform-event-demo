import test from "node:test";
import assert from "node:assert/strict";
import approvedActivities from "../src/data/approved-activities.js";
import { createC20MissionInstance, createC20Registry, c20Source } from "../src/minigames/c20-mission-adapter.js";
import { createC20InitialState, c20Engine, evaluateC20State, restoreC20State } from "../src/minigames/engines/c20-engine.js";
import { C20_ENGINE_ID, C20_ENGINE_VERSION, C20_SAFE_PAYLOAD, c20Fixture } from "../src/minigames/fixtures/c20-fixture.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { nextSubmissionState } from "../src/minigames/stage-shell.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function stateFor(choices = []) {
  const state = createC20InitialState(c20Fixture);
  C20_SAFE_PAYLOAD.stages.forEach((stage, index) => { state.choices[stage.id] = choices[index] || null; });
  return state;
}

function fakeScene(state = createC20InitialState(c20Fixture)) {
  return {
    c20State: structuredClone(state),
    redrawCount: 0,
    notifyCount: 0,
    redraw() { this.redrawCount += 1; },
    notify(message) { this.c20State.notice = structuredClone(message); this.notifyCount += 1; },
    chooseOption(stageId, optionId) {
      this.c20State.choices[stageId] = optionId;
      this.c20State.selectedOptionId = null;
      return true;
    },
  };
}

test("C20 fixture satisfies the exact root and strict engine schemas", () => {
  assert.deepEqual(validateGameInstance(c20Fixture), { ok: true, errors: [] });
  assert.deepEqual(c20Engine.validate(c20Fixture.payload, c20Fixture), { ok: true, errors: [] });
  assert.equal(c20Fixture.engineId, "C20");
  assert.equal(c20Fixture.engineVersion, "1.0.0");
  assert.equal(c20Fixture.questionNumber, 83);
  assert.equal(c20Fixture.missionSlot, 1);
  assert.match(c20Fixture.assets.baseImage, /choosing-not-drifting-720\.webp$/);
  assert.ok(ENGINE_METHODS.every((method) => typeof c20Engine[method] === "function"));
});

test("C20 honors the supplied reduced-motion flag and defines no motion dependency", () => {
  class FakeScene { constructor(config) { this.config = config; } }
  const scene = c20Engine.createScene({
    Phaser: { Scene: FakeScene },
    instance: c20Fixture,
    language: "en",
    reducedMotion: true,
    onStateChange() {},
    onReady() {},
  });
  assert.equal(scene.c20ReducedMotion, true);
  assert.equal("tweens" in scene, false);
});

test("C20 rejects malformed payload schema but generates a safe solvable fallback state", () => {
  const malformed = { ...structuredClone(c20Fixture), payload: { stages: "broken" } };
  const validation = c20Engine.validate(malformed.payload, malformed);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly|stages/);
  const fallback = createC20InitialState(malformed);
  assert.deepEqual(Object.keys(fallback.choices), ["pressure", "discernment", "covenant"]);
  const safeRoute = C20_SAFE_PAYLOAD.approvedRoutes[0].choices;
  C20_SAFE_PAYLOAD.stages.forEach((stage, index) => { fallback.choices[stage.id] = safeRoute[index]; });
  assert.equal(evaluateC20State(fallback, malformed).correct, true);
});

test("C20 seeded option generation is deterministic", () => {
  const first = createC20InitialState(c20Fixture);
  const again = createC20InitialState(structuredClone(c20Fixture));
  const other = createC20InitialState({ ...structuredClone(c20Fixture), seed: "assis-c20-another-seed" });
  assert.deepEqual(first.optionOrder, again.optionOrder);
  assert.notDeepEqual(first.optionOrder, other.optionOrder);
});

test("every bundled approved route is guaranteed solvable and earns full XP", () => {
  for (const route of C20_SAFE_PAYLOAD.approvedRoutes) {
    const evaluation = evaluateC20State(stateFor(route.choices), c20Fixture);
    assert.deepEqual({ correct: evaluation.correct, complete: evaluation.complete, routeId: evaluation.routeId }, { correct: true, complete: true, routeId: route.id });
    assert.equal(createMinigameResult(c20Fixture, evaluation).xpAwarded, 8);
  }
});

test("approved routes return distinct pastoral reflections", () => {
  const feedback = C20_SAFE_PAYLOAD.approvedRoutes.map((route) => evaluateC20State(stateFor(route.choices), c20Fixture).feedback.en);
  assert.equal(new Set(feedback).size, C20_SAFE_PAYLOAD.approvedRoutes.length);
  assert.ok(feedback.every((message) => /pressure|freedom|decision|counsel|covenant/i.test(message)));
});

test("incomplete, harmful, provisional, and completed states score differently", () => {
  const missing = evaluateC20State(stateFor(["make-room", "seek-counsel"]), c20Fixture);
  const momentum = evaluateC20State(stateFor(["move-now", "seek-counsel", "public-covenant"]), c20Fixture);
  const drift = evaluateC20State(stateFor(["make-room", "let-drift", "public-covenant"]), c20Fixture);
  const provisional = evaluateC20State(stateFor(["make-room", "seek-counsel", "stay-provisional"]), c20Fixture);
  const trial = evaluateC20State(stateFor(["name-pressure", "set-decision", "trial-first"]), c20Fixture);
  assert.deepEqual([missing.correct, missing.complete], [false, false]);
  assert.deepEqual([momentum.correct, momentum.complete], [false, true]);
  assert.deepEqual([drift.correct, drift.complete], [false, true]);
  assert.deepEqual([provisional.correct, provisional.complete], [false, false]);
  assert.deepEqual([trial.correct, trial.complete], [false, true]);
  for (const evaluation of [missing, momentum, drift, provisional, trial]) assert.equal(createMinigameResult(c20Fixture, evaluation).xpAwarded, 0);
  assert.match(momentum.feedback.en, /pressure|urgency/i);
  assert.match(drift.feedback.en, /momentum/i);
  assert.match(provisional.feedback.en, /promise/i);
  assert.match(trial.feedback.en, /trial/i);
});

test("C20 state serialization is JSON-safe and resumes compatible partial progress", () => {
  const scene = fakeScene(stateFor(["name-pressure", "seek-counsel"]));
  scene.c20State.selectedOptionId = "public-covenant";
  scene.c20State.hintLevel = 1;
  const serialized = c20Engine.serializeState(scene, c20Fixture);
  const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
  const resumed = restoreC20State(jsonRoundTrip, c20Fixture);
  assert.equal(resumed.choices.pressure, "name-pressure");
  assert.equal(resumed.choices.discernment, "seek-counsel");
  assert.equal(resumed.choices.covenant, null);
  assert.equal(resumed.selectedOptionId, "public-covenant");
  assert.equal(resumed.hintLevel, 1);
});

test("malformed saved state falls back safely and Reset/Replay reproduce the seeded start", () => {
  const scene = fakeScene(stateFor(["move-now", "let-drift", "trial-first"]));
  c20Engine.restoreState(scene, { choices: { pressure: "not-an-option" }, hintLevel: 99, keyboardIndex: -20 }, c20Fixture);
  assert.equal(scene.c20State.choices.pressure, null);
  assert.equal(scene.c20State.hintLevel, 2);
  c20Engine.restoreState(scene, null, c20Fixture);
  const firstReset = structuredClone(scene.c20State);
  scene.c20State.choices.pressure = "move-now";
  c20Engine.restoreState(scene, null, c20Fixture);
  assert.deepEqual(scene.c20State, firstReset);
  assert.deepEqual(scene.c20State.optionOrder, createC20InitialState(c20Fixture).optionOrder);
});

test("C20 exposes compact localized HTML cycling actions and two escalating non-solving hints", () => {
  const scene = fakeScene();
  const actions = c20Engine.getAccessibleActions(scene, c20Fixture);
  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.label.en && action.label.pt && typeof action.run === "function"));
  const pressureAction = actions.find((action) => action.id === "cycle-pressure");
  pressureAction.run();
  assert.equal(scene.c20State.choices.pressure, scene.c20State.optionOrder[0][0]);
  const nextPressureAction = c20Engine.getAccessibleActions(scene, c20Fixture).find((action) => action.id === "cycle-pressure");
  nextPressureAction.run();
  assert.equal(scene.c20State.choices.pressure, scene.c20State.optionOrder[0][1]);
  const choicesBeforeHints = structuredClone(scene.c20State.choices);
  const first = c20Engine.showHint(scene, 0, c20Fixture);
  const second = c20Engine.showHint(scene, 1, c20Fixture);
  assert.equal(scene.c20State.hintLevel, 2);
  assert.deepEqual(scene.c20State.choices, choicesBeforeHints);
  assert.match(first.en, /urgency|momentum/i);
  assert.match(second.en, /public covenant/i);
  assert.equal(scene.notifyCount, 2);
});

test("Q83 uses a clear three-answer quiz challenge and preserves four games plus one quiz", () => {
  const q83 = approvedActivities[83];
  assert.equal(q83.games.length, 4);
  assert.equal(q83.quiz.length, 1);
  assert.equal(q83.games[0].type, "image-shuffle");
  assert.equal(q83.games[1].type, "reveal");
  assert.equal(q83.games[1].xp, 8);
  assert.equal(q83.games[1].categories.length, 3);
  assert.equal(q83.games[1].cards.length, 1);
  assert.equal(q83.games[1].cards[0].correct, 1);
  assert.equal(q83.games[2].type, "wordsearch");
  assert.equal(q83.games[3].type, "match");
});

test("C20 remains available as a production bundled engine for the minigame laboratory", () => {
  const activity = { type: "minigame", engineId: "C20", engineVersion: "1.0.0", fixtureId: "C20", xp: 8 };
  const mission = { groupCode: "Assis-Sao-Jose", id: "83__game-1", questionNumber: 83, challengeIndex: 1, xp: 8 };
  const instance = createC20MissionInstance({ mission, activity });
  assert.equal(c20Source.kind, "bundled");
  assert.equal(c20Source.list().length, 1);
  assert.equal(instance.id, "Assis-Sao-Jose:83__game-1");
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 1);
  assert.equal(instance.xp, 8);
  assert.equal(createC20Registry().resolve(instance), c20Engine);
  assert.throws(() => createC20MissionInstance({ mission: { ...mission, challengeIndex: 2 }, activity }), /slot 1/);
  assert.deepEqual([instance.engineId, instance.engineVersion], [C20_ENGINE_ID, C20_ENGINE_VERSION]);
});

test("mission submission policy accepts once, locks repeats, and exit-before-submit preserves progress", () => {
  const first = nextSubmissionState({ mode: "mission", submitted: false });
  const repeat = nextSubmissionState({ mode: "mission", submitted: first.submitted });
  const labRepeat = nextSubmissionState({ mode: "lab", submitted: false });
  assert.deepEqual(first, { accepted: true, submitted: true });
  assert.deepEqual(repeat, { accepted: false, submitted: true });
  assert.deepEqual(labRepeat, { accepted: true, submitted: false });

  const mission = createC20MissionInstance({
    mission: { groupCode: "Assis-Santa-Clara", id: "83__game-1", questionNumber: 83, challengeIndex: 1, xp: 8 },
    activity: { type: "minigame", engineId: "C20", engineVersion: "1.0.0", fixtureId: "C20", xp: 8 },
  });
  const persistence = createMinigamePersistence(new MemoryStorage());
  persistence.save(mission, { submitted: false, engineState: stateFor(["make-room"]) });
  const restored = persistence.load(mission);
  assert.equal(restored.submitted, false);
  assert.equal(restored.engineState.choices.pressure, "make-room");
  assert.equal(nextSubmissionState({ mode: mission.mode, submitted: restored.submitted }).accepted, true);
});
