import test from "node:test";
import assert from "node:assert/strict";
import approvedActivities from "../src/data/approved-activities.js";
import { acceptC29MissionResult } from "../src/minigames/c29-integration.js";
import { bundledMinigameSource, createAppMinigameRegistry } from "../src/minigames/catalog.js";
import { validateGameInstance, ENGINE_METHODS } from "../src/minigames/contracts.js";
import {
  applyC29Action,
  c29Engine,
  createC29Model,
  createInitialC29State,
  evaluateC29State,
  isC29Complete,
  isC29Solvable,
  restoreC29State,
} from "../src/minigames/engines/c29.js";
import { c29Fixture } from "../src/minigames/fixtures/c29-fixture.js";
import { missionGameInstanceFrom } from "../src/minigames/mission-hooks.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

function clearAll(state, model) {
  let next = state;
  for (const id of model.mirrorOrder) {
    while (next.fogCleared[id] < model.payload.fogPatchCount) {
      next = applyC29Action(next, model, { type: "clear-fog", distortionId: id }).state;
    }
  }
  return next;
}

function solve(state, model) {
  let next = clearAll(state, model);
  for (const distortion of model.payload.distortions) {
    next = applyC29Action(next, model, { type: "place", distortionId: distortion.id, clarificationId: distortion.clarificationId }).state;
  }
  return next;
}

test("C29 fixture and engine satisfy the exact versioned contract", () => {
  assert.deepEqual(validateGameInstance(c29Fixture), { ok: true, errors: [] });
  assert.deepEqual(c29Engine.validate(c29Fixture.payload, c29Fixture), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof c29Engine[method] === "function"), ENGINE_METHODS);
  assert.equal(c29Fixture.id, "C29");
  assert.equal(c29Fixture.engineVersion, "1.0.0");
});

test("C29 rejects malformed schema and falls back safely for malformed model/state input", () => {
  const malformedFixture = structuredClone(c29Fixture);
  malformedFixture.payload.extra = true;
  assert.equal(c29Engine.validate(malformedFixture.payload, malformedFixture).ok, false);
  const model = createC29Model(malformedFixture.payload, malformedFixture.seed);
  assert.equal(model.usedFallback, true);
  assert.equal(isC29Solvable(model), true);
  assert.deepEqual(restoreC29State({ fogCleared: { unknown: 999 }, placements: { unknown: "bad" }, selected: { type: "bad", id: 4 } }, model), createInitialC29State(model));
});

test("seeded generation is deterministic and always solvable", () => {
  const first = createC29Model(c29Fixture.payload, "same-seed");
  const second = createC29Model(c29Fixture.payload, "same-seed");
  const third = createC29Model(c29Fixture.payload, "different-seed");
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.fog, third.fog);
  for (let index = 0; index < 100; index += 1) {
    assert.equal(isC29Solvable(createC29Model(c29Fixture.payload, `seed-${index}`)), true);
  }
});

test("serialization and resume are JSON-safe and discard impossible saved values", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  let state = createInitialC29State(model);
  state = applyC29Action(state, model, { type: "clear-fog", distortionId: model.mirrorOrder[0] }).state;
  state = applyC29Action(state, model, { type: "select-clarification", id: model.clarificationOrder[0] }).state;
  const scene = { c29Model: model, c29State: state, dragVisuals: { stale: true }, redraw() { this.redrawn = true; } };
  const serialized = c29Engine.serializeState(scene);
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);
  const wrongValidCard = model.payload.distortions.find((item) => item.id !== model.mirrorOrder[1]).clarificationId;
  const resumed = { c29Model: model, c29State: null, redraw() { this.redrawn = true; } };
  c29Engine.restoreState(resumed, { ...serialized, placements: { ...serialized.placements, [model.mirrorOrder[1]]: wrongValidCard } });
  assert.equal(resumed.c29State.fogCleared[model.mirrorOrder[0]], 1);
  assert.equal(resumed.c29State.placements[model.mirrorOrder[1]], null);
  assert.equal(resumed.redrawn, true);
});

test("Reset and Replay recreate the same clean seeded puzzle", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  const initial = createInitialC29State(model);
  const scene = { c29Model: model, c29State: solve(initial, model), redraw() {} };
  c29Engine.restoreState(scene, null);
  const reset = c29Engine.serializeState(scene);
  c29Engine.restoreState(scene, solve(reset, model));
  c29Engine.restoreState(scene, null);
  const replay = c29Engine.serializeState(scene);
  assert.deepEqual(reset, initial);
  assert.deepEqual(replay, initial);
});

test("two hints escalate without breaking solvability", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  const scene = {
    c29Model: model,
    c29State: createInitialC29State(model),
    redrawCount: 0,
    notifyCount: 0,
    redraw() { this.redrawCount += 1; },
    notify() { this.notifyCount += 1; },
  };
  const first = c29Engine.showHint(scene, 0);
  const beforeSecond = Object.values(scene.c29State.fogCleared).reduce((sum, value) => sum + value, 0);
  const second = c29Engine.showHint(scene, 1);
  const afterSecond = Object.values(scene.c29State.fogCleared).reduce((sum, value) => sum + value, 0);
  assert.match(first.en, /two different confusions/i);
  assert.match(second.en, /One fog patch/i);
  assert.equal(scene.c29State.hintLevel, 2);
  assert.equal(afterSecond, beforeSecond + 1);
  assert.equal(isC29Solvable(model), true);
});

test("free manipulation rejects impossible repairs immediately and waits for Check to evaluate", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  let state = createInitialC29State(model);
  const distortion = model.payload.distortions[0];
  const wrong = model.payload.clarifications.find((item) => item.id !== distortion.clarificationId);
  let move = applyC29Action(state, model, { type: "place", distortionId: distortion.id, clarificationId: distortion.clarificationId });
  assert.equal(move.accepted, false);
  assert.equal(move.reason, "fog-blocks-repair");
  state = clearAll(move.state, model);
  move = applyC29Action(state, model, { type: "place", distortionId: distortion.id, clarificationId: wrong.id });
  assert.equal(move.accepted, false);
  assert.equal(move.reason, "wrong-mirror");
  assert.equal(move.state.placements[distortion.id], null);
  assert.equal(move.state.completed, false);
  assert.equal(evaluateC29State(move.state, model).correct, false);
});

test("evaluation distinguishes incomplete reflection cases and the completed state", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  const clear = clearAll(createInitialC29State(model), model);
  assert.match(evaluateC29State(clear, model).feedback.en, /repair both/i);

  const idealisation = model.payload.distortions.find((item) => item.id === "idealisation");
  const idealOnly = applyC29Action(clear, model, { type: "place", distortionId: idealisation.id, clarificationId: idealisation.clarificationId }).state;
  assert.match(evaluateC29State(idealOnly, model).feedback.en, /changing feelings/i);

  const feeling = model.payload.distortions.find((item) => item.id === "fading-feeling");
  const feelingOnly = applyC29Action(clear, model, { type: "place", distortionId: feeling.id, clarificationId: feeling.clarificationId }).state;
  assert.match(evaluateC29State(feelingOnly, model).feedback.en, /idealisation/i);

  const completed = solve(createInitialC29State(model), model);
  assert.equal(isC29Complete(completed, model), true);
  assert.deepEqual(evaluateC29State(completed, model), {
    correct: true,
    complete: true,
    feedback: {
      en: "Both distortions are exposed and repaired. Truth makes love more human, not less.",
      pt: "As duas distorções foram expostas e corrigidas. A verdade torna o amor mais humano, não menos.",
    },
  });
});

test("accessible actions can complete the full task without canvas semantics", () => {
  const model = createC29Model(c29Fixture.payload, c29Fixture.seed);
  const scene = {
    c29Model: model,
    c29State: createInitialC29State(model),
    clearNext(id) { this.c29State = applyC29Action(this.c29State, model, { type: "clear-fog", distortionId: id }).state; },
    placeClarification(clarificationId, distortionId) { this.c29State = applyC29Action(this.c29State, model, { type: "place", clarificationId, distortionId }).state; },
  };
  while (!Object.values(scene.c29State.fogCleared).every((count) => count === model.payload.fogPatchCount)) {
    const action = c29Engine.getAccessibleActions(scene).find((item) => item.id.startsWith("clear-"));
    action.run();
  }
  for (const action of c29Engine.getAccessibleActions(scene).filter((item) => item.id.startsWith("repair-") && !item.disabled)) action.run();
  assert.equal(isC29Complete(scene.c29State, model), true);
});

test("mission accepts one submission and result semantics award XP only for success", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "3__game-1", questionNumber: 3, challengeIndex: 1, xp: 8 };
  const instance = missionGameInstanceFrom({ mission, definition: c29Fixture });
  const wrong = createMinigameResult(instance, { correct: false, complete: false }, { hintsUsed: 1 });
  const correct = createMinigameResult(instance, { correct: true, complete: true }, { hintsUsed: 2 });
  assert.equal(wrong.xpAwarded, 0);
  assert.equal(correct.xpAwarded, 8);
  const first = acceptC29MissionResult({}, wrong);
  const duplicate = acceptC29MissionResult(first.interaction, correct);
  assert.equal(first.accepted, true);
  assert.equal(first.interaction.succeeded, false);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.interaction.minigameResult.xpAwarded, 0);
});

test("catalog registers production C29 and Q3 replaces only human game 2", () => {
  const lab = bundledMinigameSource.get("C29", { mode: "lab" });
  const registry = createAppMinigameRegistry();
  assert.equal(registry.resolve({ ...lab, mode: "mission" }), c29Engine);
  assert.deepEqual(registry.registrations().find((item) => item.engineId === "C29"), { engineId: "C29", engineVersion: "1.0.0", production: true });

  const q3 = approvedActivities[3];
  assert.equal(q3.games.length, 4);
  assert.equal(q3.quiz.length, 1);
  assert.equal(q3.games[0].type, "order");
  assert.deepEqual({ type: q3.games[1].type, fixtureId: q3.games[1].fixtureId, engineId: q3.games[1].engineId, engineVersion: q3.games[1].engineVersion }, { type: "minigame", fixtureId: "C29", engineId: "C29", engineVersion: "1.0.0" });
  assert.equal(q3.games[2].type, "move");
  assert.equal(q3.games[3].type, "wordsearch");
});
