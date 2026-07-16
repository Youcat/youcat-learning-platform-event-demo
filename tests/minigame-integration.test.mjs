import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { bundledMinigameSource, createAppMinigameRegistry, fixtureForMissionActivity, productionMinigameFixtures } from "../src/minigames/catalog.js";
import { missionInstanceForActivity } from "../src/minigames/mission-player.js";

const approvedSlots = [
  [14, 3, "C30", "1.0.0"], [25, 3, "A4", "1.0.0"], [34, 1, "A2", "1.0.0"],
  [68, 3, "A7", "1.0.0"], [140, 3, "B14", "1.0.0"],
];

test("the combined catalog registers exactly the six retained production engines", () => {
  assert.equal(productionMinigameFixtures.length, 6);
  assert.equal(new Set(productionMinigameFixtures.map((fixture) => fixture.id)).size, 6);
  const registry = createAppMinigameRegistry();
  const production = registry.registrations().filter((entry) => entry.production);
  assert.deepEqual(new Set(production.map((entry) => entry.engineId)), new Set(["A2", "A4", "A7", "B14", "C20", "C30"]));
  productionMinigameFixtures.forEach((fixture) => assert.doesNotThrow(() => registry.resolve({ ...fixture, mode: "mission" })));
  assert.throws(() => registry.resolve({ ...bundledMinigameSource.get("foundation-skeleton-v1"), mode: "mission" }), /non-production/);
});

test("every assigned engine occupies its exact real mission slot while all questions retain four games and one quiz", () => {
  Object.values(activities).forEach((activity) => {
    assert.equal(activity.games.length, 4);
    assert.equal(activity.quiz.length, 1);
  });
  assert.equal(Object.values(activities).flatMap((activity) => activity.games).filter((game) => game.type === "minigame").length, 5);
  approvedSlots.forEach(([questionNumber, missionSlot, engineId, engineVersion]) => {
    const activity = activities[questionNumber].games[missionSlot];
    assert.deepEqual({ type: activity.type, engineId: activity.engineId, engineVersion: activity.engineVersion }, { type: "minigame", engineId, engineVersion });
    const fixture = fixtureForMissionActivity(activity);
    assert.deepEqual({ questionNumber: fixture.questionNumber, missionSlot: fixture.missionSlot, engineId: fixture.engineId }, { questionNumber, missionSlot, engineId });
  });
});

test("the generic mission launcher derives an exact mission GameInstance for every engine", () => {
  approvedSlots.forEach(([questionNumber, missionSlot, engineId, engineVersion], index) => {
    const activity = activities[questionNumber].games[missionSlot];
    const instance = missionInstanceForActivity({
      mission: { id: `review-${index}`, groupCode: "assis", questionNumber, challengeIndex: missionSlot, xp: activity.xp || 5 },
      activity,
    });
    assert.deepEqual(
      { mode: instance.mode, questionNumber: instance.questionNumber, missionSlot: instance.missionSlot, engineId: instance.engineId, engineVersion: instance.engineVersion },
      { mode: "mission", questionNumber, missionSlot, engineId, engineVersion },
    );
  });
});

test("removed engines are absent and their mission slots remain playable standard activities", () => {
  const q127 = activities[127];
  assert.equal(q127.games.length, 4);
  assert.equal(q127.quiz.length, 1);
  assert.deepEqual(q127.games.map(({ type }) => type), ["reveal", "wordsearch", "order", "match"]);
  assert.equal(q127.games[0].title.en, "What protects love in a grave crisis?");
  assert.equal(q127.games[0].cards.length, 5);
  assert.equal(productionMinigameFixtures.some(({ engineId }) => engineId === "C21"), false);
  for (const engineId of ["B9", "B13", "C21", "C22", "C23", "C27", "C29"]) {
    assert.equal(productionMinigameFixtures.some((fixture) => fixture.engineId === engineId), false);
    assert.equal(bundledMinigameSource.get(engineId), null);
  }
  assert.deepEqual(activities[14].games.map(({ type }) => type), ["match", "crossword", "reveal", "minigame"]);
  assert.deepEqual(activities[25].games.map(({ type }) => type), ["image-shuffle", "order", "match", "minigame"]);
  assert.deepEqual(activities[59].games.map(({ type }) => type), ["match", "image-shuffle", "reveal", "wordsearch"]);
  assert.deepEqual(activities[3].games.map(({ type }) => type), ["order", "reveal", "move", "wordsearch"]);
  assert.deepEqual(activities[126].games.map(({ type }) => type), ["order", "match", "image-shuffle", "reveal"]);
  assert.deepEqual(activities[83].games.map(({ type }) => type), ["image-shuffle", "reveal", "wordsearch", "match"]);
});
