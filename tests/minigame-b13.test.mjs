import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import {
  analyzeB13State,
  b13MatchingPairsEngine,
  B13_ENGINE_ID,
  B13_ENGINE_VERSION,
  B13_PAIRS,
  B13_WORDS,
  chooseB13Word,
  createB13State,
  generateB13Order,
  restoreB13State,
} from "../src/minigames/engines/b13-matching-pairs.js";
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
    redraw() { this.redrawCalls += 1; },
    choose(wordId) { this.b13State = chooseB13Word(this.b13State, wordId); },
    isUnavailable(wordId) {
      const word = B13_WORDS.find(({ id }) => id === wordId);
      return this.b13State.matchedPairIds.includes(word.pairId);
    },
  };
}

function solve(seed = b13Fixture.seed) {
  let state = createB13State(seed);
  for (const pair of B13_PAIRS) {
    state = chooseB13Word(state, pair.words[0].id);
    state = chooseB13Word(state, pair.words[1].id);
  }
  return state;
}

test("B13 matching-pairs fixture uses the exact versioned contract", () => {
  assert.deepEqual(validateGameInstance(b13Fixture), { ok: true, errors: [] });
  assert.deepEqual(b13MatchingPairsEngine.validate(b13Fixture.payload, b13Fixture), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof b13MatchingPairsEngine[method] === "function"), ENGINE_METHODS);
  assert.equal(b13Fixture.engineId, B13_ENGINE_ID);
  assert.equal(b13Fixture.engineVersion, B13_ENGINE_VERSION);
  assert.equal(B13_ENGINE_VERSION, "2.0.0");
  assert.equal(b13Fixture.questionNumber, 14);
  assert.equal(b13Fixture.missionSlot, 1);
  assert.equal(b13Fixture.assets.baseImage, null);
});

test("B13 contains exactly the three requested bilingual pairs", () => {
  assert.deepEqual(
    B13_PAIRS.map((pair) => pair.words.map((word) => word.label.en)),
    [["Body", "Soul"], ["Dignity", "Freedom"], ["Gift", "Covenant"]],
  );
  assert.deepEqual(
    B13_PAIRS.map((pair) => pair.words.map((word) => word.label.pt)),
    [["Corpo", "Alma"], ["Dignidade", "Liberdade"], ["Dom", "Aliança"]],
  );
});

test("strict payload validation rejects extra, malformed, and relabelled pairs", () => {
  const malformed = structuredClone(b13Fixture.payload);
  malformed.pairs[2].words[1].label.en = "Convenience";
  malformed.extra = true;
  const result = b13MatchingPairsEngine.validate(malformed, b13Fixture);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exactly|approved label/);
  assert.equal(b13MatchingPairsEngine.validate(b13Fixture.payload, { ...b13Fixture, layoutOverrides: { columns: 2 } }).ok, false);
});

test("seeded order is deterministic, varied, and always contains six unique words", () => {
  const first = generateB13Order("one");
  assert.deepEqual(first, generateB13Order("one"));
  assert.notDeepEqual(first, generateB13Order("two"));
  assert.deepEqual([...first].sort(), B13_WORDS.map(({ id }) => id).sort());
  assert.equal(new Set(first).size, 6);
});

test("tap selection accepts correct pairs and keeps wrong attempts recoverable", () => {
  let state = createB13State("tap");
  state = chooseB13Word(state, "body");
  assert.equal(state.selectedId, "body");
  state = chooseB13Word(state, "freedom");
  assert.equal(state.selectedId, null);
  assert.equal(state.matchedPairIds.length, 0);
  assert.equal(state.attempts, 1);
  assert.match(state.status.en, /not a pair/);
  state = chooseB13Word(state, "body");
  state = chooseB13Word(state, "soul");
  assert.deepEqual(state.matchedPairIds, ["body-soul"]);
  assert.match(state.status.pt, /pertencem/);
});

test("every generated start is solvable and completes only after all three pairs", () => {
  for (const seed of ["alpha", "beta", "gamma", "delta"]) {
    const state = solve(seed);
    assert.deepEqual(analyzeB13State(state), { matchedCount: 3, remaining: 0, correct: true, complete: true });
    assert.equal(state.completed, true);
  }
});

test("impossible choices are rejected without losing matched pairs", () => {
  let state = createB13State("invalid");
  state = chooseB13Word(chooseB13Word(state, "gift"), "covenant");
  const before = structuredClone(state.matchedPairIds);
  state = chooseB13Word(state, "missing");
  assert.deepEqual(state.matchedPairIds, before);
  assert.equal(state.invalidMoves, 1);
});

test("serialization and resume preserve a JSON-safe partial run", () => {
  let state = createB13State(b13Fixture.seed);
  state = chooseB13Word(chooseB13Word(state, "dignity"), "freedom");
  state = chooseB13Word(state, "gift");
  const scene = sceneWith(state);
  const serialized = b13MatchingPairsEngine.serializeState(scene);
  assert.deepEqual(JSON.parse(JSON.stringify(serialized)), serialized);
  const resumed = sceneWith(createB13State("other"));
  b13MatchingPairsEngine.restoreState(resumed, serialized, b13Fixture);
  assert.deepEqual(resumed.b13State, serialized);
  b13MatchingPairsEngine.restoreState(resumed, { schemaVersion: 1, matchedPairIds: ["metro"] }, b13Fixture);
  assert.deepEqual(resumed.b13State, createB13State(b13Fixture.seed));
});

test("evaluation remains editable in Lab and reveals the result after completion", () => {
  const partial = sceneWith(chooseB13Word(createB13State("partial"), "body"));
  const incomplete = b13MatchingPairsEngine.evaluate(partial, b13Fixture);
  assert.deepEqual({ correct: incomplete.correct, complete: incomplete.complete }, { correct: false, complete: false });
  assert.equal(partial.b13State.completed, false);
  assert.match(incomplete.feedback.en, /0 of 3/);
  const solved = sceneWith(solve());
  const correct = b13MatchingPairsEngine.evaluate(solved, b13Fixture);
  assert.deepEqual({ correct: correct.correct, complete: correct.complete }, { correct: true, complete: true });
  assert.equal(solved.b13State.revealSolution, true);
  assert.match(correct.feedback.en, /body and soul/);
  assert.match(correct.feedback.pt, /corpo e alma/);
});

test("engine actions preserve keyboard-equivalent word selection without rendering a controls section", () => {
  const scene = sceneWith(createB13State("actions"));
  let actions = b13MatchingPairsEngine.getAccessibleActions(scene);
  assert.equal(actions.length, 6);
  actions.find(({ id }) => id === "choose-body").run();
  actions = b13MatchingPairsEngine.getAccessibleActions(scene);
  actions.find(({ id }) => id === "choose-soul").run();
  assert.deepEqual(scene.b13State.matchedPairIds, ["body-soul"]);
  assert.match(b13MatchingPairsEngine.showHint().en, /human reality/);
});

test("mission wiring remains Q14 slot 1 with one normalized result", () => {
  const activity = activities[14].games[1];
  const mission = { groupCode: "Assis-Sao-Jose", id: "14__game-1", questionNumber: 14, challengeIndex: 1, xp: 9 };
  const instance = b13MissionInstanceFrom({ mission, activity });
  assert.equal(instance.mode, "mission");
  assert.equal(instance.engineVersion, "2.0.0");
  assert.equal(instance.missionSlot, 1);
  assert.equal(instance.xp, 9);
  const success = b13MatchingPairsEngine.evaluate(sceneWith(solve()), instance);
  assert.equal(createMinigameResult(instance, success).xpAwarded, 9);
  const failure = b13MatchingPairsEngine.evaluate(sceneWith(createB13State("mission")), instance);
  assert.equal(createMinigameResult(instance, failure).xpAwarded, 0);
});

test("B13 is production registered and Q14 keeps four games plus one quiz", () => {
  const source = createBundledGameSource([b13Fixture]);
  const registry = createMinigameRegistry();
  registry.register({ engineId: B13_ENGINE_ID, engineVersion: B13_ENGINE_VERSION, engine: b13MatchingPairsEngine, production: true });
  assert.equal(registry.resolve(source.get("B13")), b13MatchingPairsEngine);
  assert.equal(activities[14].games.length, 4);
  assert.equal(activities[14].quiz.length, 1);
  assert.deepEqual(activities[14].games.map(({ type }) => type), ["match", "minigame", "reveal", "minigame"]);
  assert.equal(activities[14].games[1].engineId, "B13");
  assert.equal(activities[14].games[1].title.en, "Words that belong together");
  assert.equal(activities[14].games[3].engineId, "C30");
});
