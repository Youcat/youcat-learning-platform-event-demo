import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import {
  analyzeB13State,
  b13RelationshipMetroEngine,
  B13_CONCEPTS,
  B13_ENGINE_ID,
  B13_ENGINE_VERSION,
  B13_SOLUTION,
  B13_STATIONS,
  createB13State,
  generateB13Tray,
  placeB13Token,
  restoreB13State,
} from "../src/minigames/engines/b13-relationship-metro.js";
import { b13Fixture } from "../src/minigames/fixtures/b13-fixture.js";
import { b13MissionInstanceFrom } from "../src/minigames/mission-integration.js";
import { createMinigameRegistry } from "../src/minigames/registry.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";

function sceneWith(state) {
  return {
    b13State: structuredClone(state),
    accessibleStatus: structuredClone(state.status),
    redrawCalls: 0,
    notifyCalls: 0,
    redraw() { this.redrawCalls += 1; },
    notify() { this.notifyCalls += 1; },
    selectToken(tokenId) { this.b13State.selectedTokenId = tokenId; },
    placeToken(tokenId, stationId) { this.b13State = placeB13Token(this.b13State, tokenId, stationId); },
  };
}

function solvedState(seed = b13Fixture.seed) {
  let state = createB13State(seed);
  for (const [stationId, tokenId] of Object.entries(B13_SOLUTION)) state = placeB13Token(state, tokenId, stationId);
  return state;
}

test("B13 fixture uses the exact GameInstance schema and all eight engine methods", () => {
  assert.deepEqual(validateGameInstance(b13Fixture), { ok: true, errors: [] });
  assert.equal(b13Fixture.id, "B13");
  assert.equal(b13Fixture.questionNumber, 14);
  assert.equal(b13Fixture.missionSlot, 1);
  assert.equal(b13Fixture.engineId, B13_ENGINE_ID);
  assert.equal(b13Fixture.engineVersion, B13_ENGINE_VERSION);
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof b13RelationshipMetroEngine[method] === "function"), ENGINE_METHODS);
  assert.deepEqual(b13RelationshipMetroEngine.validate(b13Fixture.payload, b13Fixture), { ok: true, errors: [] });
});

test("B13 rejects malformed payload schema while malformed saved state falls back cleanly", () => {
  const malformedPayload = structuredClone(b13Fixture.payload);
  malformedPayload.solution["last-transfer"] = "gift";
  malformedPayload.extra = true;
  const validation = b13RelationshipMetroEngine.validate(malformedPayload, b13Fixture);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /exactly/);
  assert.match(validation.errors.join("\n"), /approved B13 route map/);

  const clean = restoreB13State({ assignments: { surprise: "body" }, moves: -99 }, b13Fixture.seed);
  assert.deepEqual(clean, createB13State(b13Fixture.seed));
});

test("seeded tray generation is deterministic, unsolved, and seed-sensitive", () => {
  const first = generateB13Tray("seed-one");
  assert.deepEqual(first, generateB13Tray("seed-one"));
  assert.notDeepEqual(first, generateB13Tray("seed-two"));
  assert.deepEqual([...first].sort(), B13_CONCEPTS.map(({ id }) => id).sort());
  assert.notDeepEqual(first, Object.values(B13_SOLUTION));
});

test("every generated start is solvable and free manipulation remains recoverable", () => {
  for (const seed of ["alpha", "beta", "gamma", "delta"]) {
    let state = createB13State(seed);
    state = placeB13Token(state, "body", "lower-start");
    state = placeB13Token(state, "soul", "lower-start");
    assert.equal(state.assignments["lower-start"], "soul");
    assert.equal(Object.values(state.assignments).includes("body"), false);
    for (const [stationId, tokenId] of Object.entries(B13_SOLUTION)) state = placeB13Token(state, tokenId, stationId);
    assert.equal(analyzeB13State(state).correct, true);
    assert.equal(state.completed, false, "manipulation never evaluates the answer");
  }
});

test("impossible moves are rejected immediately without damaging the map", () => {
  const state = placeB13Token(createB13State("invalid"), "body", "upper-start");
  const invalid = placeB13Token(state, "body", "not-a-station");
  assert.deepEqual(invalid.assignments, state.assignments);
  assert.equal(invalid.invalidMoves, state.invalidMoves + 1);
  assert.match(invalid.status.en, /unchanged/);
});

test("serialization and compatible partial resume are JSON-safe", () => {
  const state = placeB13Token(createB13State(b13Fixture.seed), "gift", "upper-branch");
  const scene = sceneWith(state);
  const serialized = b13RelationshipMetroEngine.serializeState(scene, b13Fixture);
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);

  const resumed = sceneWith(createB13State("other"));
  b13RelationshipMetroEngine.restoreState(resumed, serialized, b13Fixture);
  assert.deepEqual(resumed.b13State.assignments, state.assignments);
  assert.equal(resumed.b13State.moves, 1);
});

test("reset and replay restoration return to the same deterministic clean run", () => {
  const changed = sceneWith(placeB13Token(createB13State(b13Fixture.seed), "body", "upper-start"));
  b13RelationshipMetroEngine.restoreState(changed, null, b13Fixture);
  const reset = structuredClone(changed.b13State);
  b13RelationshipMetroEngine.restoreState(changed, null, b13Fixture);
  assert.deepEqual(changed.b13State, reset);
  assert.deepEqual(changed.b13State, createB13State(b13Fixture.seed));
});

test("the two hints escalate from transfer guidance to safe partial placement", () => {
  const scene = sceneWith(createB13State(b13Fixture.seed));
  const first = b13RelationshipMetroEngine.showHint(scene, 0, b13Fixture);
  assert.equal(scene.b13State.hintLevel, 1);
  assert.equal(analyzeB13State(scene.b13State).filled, 0);
  assert.match(first.en, /Dignity comes before Covenant/);

  const second = b13RelationshipMetroEngine.showHint(scene, 1, b13Fixture);
  assert.equal(scene.b13State.hintLevel, 2);
  assert.equal(scene.b13State.assignments["first-transfer"], "dignity");
  assert.equal(scene.b13State.assignments["last-transfer"], "covenant");
  assert.match(second.pt, /foram posicionadas/);
});

test("evaluation distinguishes incomplete, transfer, branch, and completed reflection cases", () => {
  const incompleteScene = sceneWith(placeB13Token(createB13State("partial"), "body", "upper-start"));
  const incomplete = b13RelationshipMetroEngine.evaluate(incompleteScene, b13Fixture);
  assert.deepEqual({ correct: incomplete.correct, complete: incomplete.complete }, { correct: false, complete: false });
  assert.match(incomplete.feedback.en, /Place all six/);

  const transferWrong = solvedState("transfer-wrong");
  [transferWrong.assignments["first-transfer"], transferWrong.assignments["upper-branch"]] = [transferWrong.assignments["upper-branch"], transferWrong.assignments["first-transfer"]];
  const transferResult = b13RelationshipMetroEngine.evaluate(sceneWith(transferWrong), b13Fixture);
  assert.match(transferResult.feedback.en, /shared circles/);

  const branchWrong = solvedState("branch-wrong");
  [branchWrong.assignments["upper-branch"], branchWrong.assignments["lower-branch"]] = [branchWrong.assignments["lower-branch"], branchWrong.assignments["upper-branch"]];
  const branchResult = b13RelationshipMetroEngine.evaluate(sceneWith(branchWrong), b13Fixture);
  assert.match(branchResult.feedback.en, /approved routes/);

  const correctScene = sceneWith(solvedState());
  const correct = b13RelationshipMetroEngine.evaluate(correctScene, b13Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(correctScene.b13State.completed, true);
  assert.equal(correctScene.b13State.revealSolution, true);
  assert.match(correct.feedback.en, /body and soul meet in dignity/);
});

test("mission mode permits one normalized submission and applies XP semantics without engine-side awards", () => {
  const activity = activities[14].games[1];
  const mission = { groupCode: "Assis-Sao-Jose", id: "14__game-1", questionNumber: 14, challengeIndex: 1, xp: 9 };
  const instance = b13MissionInstanceFrom({ mission, activity });
  assert.equal(instance.mode, "mission");
  assert.equal(instance.missionSlot, 1);
  assert.equal(instance.xp, 9);

  const wrongState = solvedState("mission-wrong");
  [wrongState.assignments["upper-start"], wrongState.assignments["lower-start"]] = [wrongState.assignments["lower-start"], wrongState.assignments["upper-start"]];
  const wrongScene = sceneWith(wrongState);
  const evaluation = b13RelationshipMetroEngine.evaluate(wrongScene, instance);
  assert.equal(evaluation.correct, false);
  assert.equal(wrongScene.b13State.completed, true);
  assert.equal(wrongScene.b13State.revealSolution, true, "mission debrief reveals the approved solution after the one check");
  assert.equal(createMinigameResult(instance, evaluation).xpAwarded, 0);

  const success = b13RelationshipMetroEngine.evaluate(sceneWith(solvedState()), instance);
  assert.equal(createMinigameResult(instance, success).xpAwarded, 9);
});

test("B13 is production-registered and Q14 replaces only human game 2", () => {
  const source = createBundledGameSource([b13Fixture]);
  const registry = createMinigameRegistry();
  registry.register({ engineId: B13_ENGINE_ID, engineVersion: B13_ENGINE_VERSION, engine: b13RelationshipMetroEngine, production: true });
  assert.equal(registry.resolve(source.get("B13")), b13RelationshipMetroEngine);

  assert.equal(activities[14].games.length, 4);
  assert.equal(activities[14].quiz.length, 1);
  assert.deepEqual(activities[14].games.map(({ type }) => type), ["match", "minigame", "reveal", "order"]);
  assert.equal(activities[14].games[1].engineId, "B13");
  assert.equal(B13_STATIONS.length, 6);
});
