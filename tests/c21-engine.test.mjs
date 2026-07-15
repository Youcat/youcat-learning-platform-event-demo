import test from "node:test";
import assert from "node:assert/strict";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import activities from "../src/data/approved-activities.js";
import { c21MissionInstanceFor, c21Source, createC21Registry } from "../src/minigames/c21-bundle.js";
import {
  applyC21Move,
  c21Engine,
  createC21InitialState,
  createC21Puzzle,
  normalizeC21Payload,
  summarizeC21State,
} from "../src/minigames/engines/c21-engine.js";
import { c21LabFixture, c21MissionDefinition } from "../src/minigames/fixtures/c21-fixture.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function solvedState(payload = c21LabFixture.payload) {
  const state = createC21InitialState(payload);
  payload.concepts.forEach((concept, index) => applyC21Move(state, concept.id, payload.slots[index].id));
  applyC21Move(state, "love", "support-2");
  return state;
}

test("C21 fixture and mission definition satisfy the exact schema and all eight engine methods", () => {
  assert.deepEqual(validateGameInstance(c21LabFixture), { ok: true, errors: [] });
  assert.deepEqual(validateGameInstance(c21MissionDefinition), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof c21Engine[method] === "function"), ENGINE_METHODS);
  assert.deepEqual(c21Engine.validate(c21LabFixture.payload), { ok: true, errors: [] });
});

test("C21 rejects malformed payloads but normalizes them to a safe solvable fallback", () => {
  const malformed = { concepts: [{ id: "love" }], slots: [], minimumMoves: -1, surprise: true };
  const validation = c21Engine.validate(malformed);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly/);
  const fallback = normalizeC21Payload(malformed);
  assert.equal(fallback.concepts.length, 5);
  assert.equal(fallback.slots.length, 5);
  assert.equal(summarizeC21State(solvedState(fallback), fallback).complete, true);
});

test("C21 seeded generation is deterministic and changes with the seed", () => {
  const first = createC21Puzzle("c21-seed-a", c21LabFixture.payload);
  const repeated = createC21Puzzle("c21-seed-a", structuredClone(c21LabFixture.payload));
  const other = createC21Puzzle("c21-seed-b", c21LabFixture.payload);
  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first.concepts.map(({ id }) => id), other.concepts.map(({ id }) => id));
});

test("every valid generated puzzle is solvable through placements and one reflective swap", () => {
  for (const seed of ["one", "two", "three", "portuguese", "mission-127"]) {
    const puzzle = createC21Puzzle(seed, c21LabFixture.payload);
    const state = createC21InitialState(c21LabFixture.payload);
    puzzle.concepts.forEach((concept, index) => applyC21Move(state, concept.id, puzzle.slots[index].id));
    applyC21Move(state, puzzle.concepts[0].id, puzzle.slots[1].id);
    assert.deepEqual(summarizeC21State(state, c21LabFixture.payload), {
      assigned: 5,
      reconsidered: 2,
      stable: true,
      explored: true,
      complete: true,
    });
  }
});

test("C21 serialization is JSON-safe and restores compatible partial state", () => {
  const state = solvedState();
  state.selectedId = "truth";
  state.hintLevel = 1;
  const sourceScene = { c21State: state, c21Payload: c21LabFixture.payload };
  const serialized = c21Engine.serializeState(sourceScene, c21LabFixture);
  const jsonRoundTrip = JSON.parse(JSON.stringify(serialized));
  const restoredScene = { c21Payload: c21LabFixture.payload, redrawCalls: 0, redraw() { this.redrawCalls += 1; } };
  c21Engine.restoreState(restoredScene, jsonRoundTrip, c21LabFixture);
  assert.deepEqual(restoredScene.c21State, state);
  assert.equal(restoredScene.redrawCalls, 1);
});

test("malformed saved state falls back safely and reset/replay recreate the clean state", () => {
  const scene = { c21Payload: c21LabFixture.payload, redraw() {} };
  c21Engine.restoreState(scene, { assignments: { love: "missing", truth: "support-1", safety: "support-1" }, totalMoves: "no" }, c21LabFixture);
  assert.equal(scene.c21State.assignments.love, null);
  assert.equal(scene.c21State.assignments.truth, "support-1");
  assert.equal(scene.c21State.assignments.safety, null);
  c21Engine.restoreState(scene, null, c21LabFixture);
  assert.deepEqual(scene.c21State, createC21InitialState(c21LabFixture.payload));
});

test("two hints escalate without choosing a moral arrangement", () => {
  const scene = {
    c21State: createC21InitialState(c21LabFixture.payload),
    c21Payload: c21LabFixture.payload,
    redrawCalls: 0,
    notifyCalls: 0,
    redraw() { this.redrawCalls += 1; },
    notify() { this.notifyCalls += 1; },
  };
  const first = c21Engine.showHint(scene, 0, c21LabFixture);
  const second = c21Engine.showHint(scene, 1, c21LabFixture);
  assert.equal(scene.c21State.hintLevel, 2);
  assert.equal(scene.c21State.selectedId, "love");
  assert.match(first.en, /do not rank/i);
  assert.match(second.en, /swap or move two/i);
  assert.equal(scene.notifyCalls, 2);
});

test("evaluation distinguishes incomplete and completed participation without moral scoring", () => {
  const incomplete = { c21State: createC21InitialState(c21LabFixture.payload) };
  const incompleteResult = c21Engine.evaluate(incomplete, c21LabFixture);
  assert.deepEqual({ correct: incompleteResult.correct, complete: incompleteResult.complete }, { correct: false, complete: false });
  assert.match(incompleteResult.feedback.en, /No position is morally ranked/i);

  const complete = { c21State: solvedState() };
  const completeResult = c21Engine.evaluate(complete, c21LabFixture);
  assert.deepEqual({ correct: completeResult.correct, complete: completeResult.complete }, { correct: true, complete: true });
  assert.match(completeResult.feedback.en, /not a moral ranking/i);
});

test("different stable personal arrangements are equally accepted", () => {
  const first = solvedState();
  const second = createC21InitialState(c21LabFixture.payload);
  const reversedSlots = [...c21LabFixture.payload.slots].reverse();
  c21LabFixture.payload.concepts.forEach((concept, index) => applyC21Move(second, concept.id, reversedSlots[index].id));
  applyC21Move(second, "boundaries", "support-2");
  assert.equal(c21Engine.evaluate({ c21State: first }, c21LabFixture).complete, true);
  assert.equal(c21Engine.evaluate({ c21State: second }, c21LabFixture).complete, true);
  assert.notDeepEqual(first.assignments, second.assignments);
});

test("accessible actions provide keyboard-operable concept and target steps", () => {
  const calls = [];
  const scene = {
    c21Payload: c21LabFixture.payload,
    c21State: createC21InitialState(c21LabFixture.payload),
    selectConcept(id) { calls.push(["select", id]); this.c21State.selectedId = id; },
    moveConcept(id, slot) { calls.push(["move", id, slot]); },
    returnToTray(id) { calls.push(["tray", id]); },
  };
  const conceptActions = c21Engine.getAccessibleActions(scene, c21LabFixture);
  assert.equal(conceptActions.length, 5);
  conceptActions[0].run();
  const targetActions = c21Engine.getAccessibleActions(scene, c21LabFixture);
  assert.equal(targetActions.length, 6);
  targetActions[0].run();
  assert.deepEqual(calls, [["select", "love"], ["move", "love", "support-1"]]);
});

test("mission adapter preserves Q127 slot 0, production registration, and bundled source isolation", () => {
  const mission = { groupCode: "Assis-Sao-Jose", id: "127__game-0", questionNumber: 127, challengeIndex: 0, xp: 5 };
  const activity = { type: "minigame", definitionId: "c21-q127-slot0" };
  const instance = c21MissionInstanceFor({ mission, activity });
  assert.equal(instance.questionNumber, 127);
  assert.equal(instance.missionSlot, 0);
  assert.equal(instance.mode, "mission");
  assert.equal(instance.engineId, "C21");
  assert.equal(createC21Registry().resolve(instance), c21Engine);
  const copy = c21Source.get("c21-q127-slot0");
  copy.payload.concepts[0].label.en = "Changed";
  assert.equal(c21Source.get("c21-q127-slot0").payload.concepts[0].label.en, "Love");
});

test("Q127 replaces only human game 1 and still has four games plus one quiz", () => {
  assert.equal(activities[127].games.length, 4);
  assert.equal(activities[127].quiz.length, 1);
  assert.deepEqual(
    activities[127].games.map((game) => game.type),
    ["minigame", "wordsearch", "order", "match"],
  );
  assert.equal(activities[127].games[0].definitionId, "c21-q127-slot0");
});

test("mission submission lock persists and participation XP is normalized only after completion", () => {
  const missionInstance = { ...structuredClone(c21MissionDefinition), mode: "mission", xp: 5 };
  const persistence = createMinigamePersistence(new MemoryStorage());
  persistence.save(missionInstance, { submitted: true, engineState: solvedState() });
  assert.equal(persistence.load(missionInstance).submitted, true);

  const incomplete = createMinigameResult(missionInstance, { correct: false, complete: false });
  const participated = createMinigameResult(missionInstance, { correct: true, complete: true });
  assert.equal(incomplete.xpAwarded, 0);
  assert.equal(participated.xpAwarded, 5);
  assert.equal(participated.mode, "mission");
});
