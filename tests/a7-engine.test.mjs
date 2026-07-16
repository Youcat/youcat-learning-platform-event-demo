import test from "node:test";
import assert from "node:assert/strict";
import { ENGINE_METHODS, validateGameInstance } from "../src/minigames/contracts.js";
import { a7Engine, createA7InitialState, placeA7Shard, restoreA7State } from "../src/minigames/engines/a7-engine.js";
import { A7_ENGINE_ID, A7_ENGINE_VERSION, a7Fixture } from "../src/minigames/fixtures/a7-fixture.js";
import { createA7MissionInstance, createOneSubmissionHandler } from "../src/minigames/mission-a7.js";
import { createMinigamePersistence } from "../src/minigames/persistence.js";
import { createMinigameRegistry } from "../src/minigames/registry.js";
import { createMinigameResult } from "../src/minigames/result-adapter.js";
import { createBundledGameSource } from "../src/minigames/source-adapter.js";
import activities from "../src/data/approved-activities.js";

class MemoryStorage { values = new Map(); getItem(key) { return this.values.get(key) || null; } setItem(key, value) { this.values.set(key, value); } removeItem(key) { this.values.delete(key); } }
function fakeScene(instance, state = createA7InitialState(instance)) { return { a7State: state, redraw() {}, notify() {}, scale: { width: 360, height: 350 } }; }
function begin(state) { state.referenceVisible = false; return state; }

test("A7 fixture satisfies the exact GameInstance and eight-method contracts", () => {
  assert.deepEqual(validateGameInstance(a7Fixture), { ok: true, errors: [] });
  assert.deepEqual(a7Engine.validate(a7Fixture.payload, a7Fixture), { ok: true, errors: [] });
  assert.deepEqual(ENGINE_METHODS.filter((method) => typeof a7Engine[method] === "function"), ENGINE_METHODS);
  assert.equal(a7Fixture.engineId, "A7"); assert.equal(a7Fixture.engineVersion, "1.0.0"); assert.equal(a7Fixture.missionSlot, 3);
  assert.equal(a7Fixture.payload.concepts.length, 7); assert.equal(a7Fixture.layoutOverrides.showSecondaryControls, false);
});

test("A7 rejects malformed schema and falls back safely from malformed saved state", () => {
  const malformed = structuredClone(a7Fixture); malformed.payload.concepts[0].polygon = [[-1, 0]]; malformed.payload.extra = true;
  const validation = a7Engine.validate(malformed.payload, malformed);
  assert.equal(validation.ok, false); assert.match(validation.errors.join("\n"), /unsupported|normalized/);
  assert.deepEqual(restoreA7State({ version: 1, positions: { trust: { x: 99 } } }, a7Fixture), createA7InitialState(a7Fixture));
});

test("A7 seeded generation is deterministic and changes with a different seed", () => {
  const first = createA7InitialState(a7Fixture); const second = createA7InitialState(structuredClone(a7Fixture));
  const other = createA7InitialState({ ...structuredClone(a7Fixture), seed: "love-forever-68-a7-other" });
  assert.deepEqual(first, second); assert.notDeepEqual(first.positions, other.positions); assert.equal(first.referenceVisible, true);
});

test("every valid A7 instance is solvable after studying the reference", () => {
  const state = begin(createA7InitialState(a7Fixture));
  for (const [index, concept] of a7Fixture.payload.concepts.entries()) assert.deepEqual(placeA7Shard(state, concept.id, concept.id, a7Fixture), { accepted: true, complete: index === 6 });
  assert.equal(state.completed, true);
  const evaluation = a7Engine.evaluate(fakeScene(a7Fixture, state), a7Fixture);
  assert.equal(evaluation.correct, true); assert.match(evaluation.feedback.en, /theological|faithful love/i); assert.equal("xp" in evaluation, false);
});

test("A7 hides the target until play begins and rejects impossible moves without corrupting progress", () => {
  const state = createA7InitialState(a7Fixture); const originalTrust = structuredClone(state.positions.trust);
  assert.deepEqual(placeA7Shard(state, "trust", "trust", a7Fixture), { accepted: false, reason: "unavailable" });
  begin(state); const result = placeA7Shard(state, "trust", "promise", a7Fixture);
  assert.deepEqual(result, { accepted: false, reason: "mismatch" }); assert.deepEqual(state.positions.trust, originalTrust); assert.equal(state.selectedId, "trust"); assert.equal(state.rejectedMoves, 1);
});

test("serialization and resume preserve a JSON-safe movable partial restoration", () => {
  const scene = fakeScene(a7Fixture); begin(scene.a7State); placeA7Shard(scene.a7State, "trust", "trust", a7Fixture); scene.a7State.selectedId = "promise";
  const saved = a7Engine.serializeState(scene, a7Fixture); assert.doesNotThrow(() => JSON.stringify(saved));
  const resumed = fakeScene(a7Fixture); a7Engine.restoreState(resumed, JSON.parse(JSON.stringify(saved)), a7Fixture); assert.deepEqual(resumed.a7State, saved);
  const storage = new MemoryStorage(); const persistence = createMinigamePersistence(storage); persistence.save(a7Fixture, { hintsUsed: 0, submitted: false, engineState: saved });
  assert.deepEqual(persistence.load(a7Fixture).engineState, saved); assert.equal(persistence.load({ ...a7Fixture, engineVersion: "2.0.0" }), null);
});

test("placed shards can be moved again and no hint reveals a solution", () => {
  const state = begin(createA7InitialState(a7Fixture)); placeA7Shard(state, "trust", "trust", a7Fixture); state.positions.trust.placed = false; state.positions.trust.x = 0.18;
  assert.equal(state.positions.trust.placed, false); assert.match(a7Engine.showHint(null, 0, a7Fixture).en, /no hints/i);
});

test("incomplete Lab checks stay editable while incomplete Mission checks reveal the solution", () => {
  const labScene = fakeScene(a7Fixture); const labResult = a7Engine.evaluate(labScene, a7Fixture);
  assert.deepEqual({ correct: labResult.correct, complete: labResult.complete }, { correct: false, complete: false }); assert.equal(labScene.a7State.solutionShown, false);
  const mission = { ...structuredClone(a7Fixture), mode: "mission", xp: 8 }; const missionScene = fakeScene(mission); const missionResult = a7Engine.evaluate(missionScene, mission);
  assert.deepEqual({ correct: missionResult.correct, complete: missionResult.complete }, { correct: false, complete: false }); assert.equal(missionScene.a7State.solutionShown, true); assert.match(missionResult.feedback.pt, /conclusão teológica/i);
});

test("A7 accessible actions offer a non-canvas start, selection, movement, and position check", () => {
  const scene = fakeScene(a7Fixture); scene.beginRestoration = () => { scene.a7State.referenceVisible = false; }; scene.selectShard = (id) => { scene.a7State.selectedId = id; }; scene.tryDrop = () => ({ accepted: false });
  let actions = a7Engine.getAccessibleActions(scene, a7Fixture); assert.equal(actions.length, 1); assert.match(actions[0].label.en, /begin restoration/i); actions[0].run();
  actions = a7Engine.getAccessibleActions(scene, a7Fixture); assert.equal(actions.length, 7); assert.match(actions[0].label.en, /Select fragment 1/); actions[0].run();
  actions = a7Engine.getAccessibleActions(scene, a7Fixture); assert.equal(actions.length, 6); assert.match(actions.map((action) => action.label.en).join(" "), /Move selected fragment left.*Try this position/);
});

test("production registry, bundled source, and Q68 mission adapter preserve slot and XP", () => {
  const source = createBundledGameSource([a7Fixture]); assert.equal(source.kind, "bundled"); assert.equal(source.get("A7").id, "A7");
  const registry = createMinigameRegistry(); registry.register({ engineId: A7_ENGINE_ID, engineVersion: A7_ENGINE_VERSION, engine: a7Engine, production: true }); assert.equal(registry.resolve(a7Fixture), a7Engine);
  const mission = createA7MissionInstance({ groupCode: "Assis-Sao-Jose", id: "68__game-3", questionNumber: 68, challengeIndex: 3, xp: 8 });
  assert.equal(mission.mode, "mission"); assert.equal(mission.questionNumber, 68); assert.equal(mission.missionSlot, 3); assert.equal(mission.xp, 8); assert.equal(mission.payload.concepts.length, 7);
});

test("mission submission is consumed once and result normalization alone determines XP", async () => {
  const mission = createA7MissionInstance({ groupCode: "Assis-Sao-Jose", id: "68__game-3", questionNumber: 68, challengeIndex: 3, xp: 8 }); const accepted = []; const submit = createOneSubmissionHandler(async (result) => accepted.push(result));
  const correct = createMinigameResult(mission, { correct: true, complete: true }); assert.equal(await submit(correct), true); assert.equal(await submit(correct), false); assert.equal(accepted.length, 1); assert.equal(correct.xpAwarded, 8); assert.equal(createMinigameResult(mission, { correct: false, complete: false }).xpAwarded, 0);
});

test("Q68 replaces only human game 4 and still has four games plus one quiz", () => {
  const q68 = activities[68]; assert.equal(q68.games.length, 4); assert.equal(q68.quiz.length, 1); assert.deepEqual(q68.games.slice(0, 3).map((game) => game.type), ["wordsearch", "order", "match"]);
  assert.equal(q68.games[3].engineId, "A7"); assert.equal(q68.games[3].engineVersion, "1.0.0"); assert.equal(q68.games[3].title.en, "Restore the relationship"); assert.match(q68.games[3].prompt.en, /seven/);
});
