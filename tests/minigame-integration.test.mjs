import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { bundledMinigameSource, createAppMinigameRegistry, fixtureForMissionActivity, productionMinigameFixtures } from "../src/minigames/catalog.js";
import { missionInstanceForActivity } from "../src/minigames/mission-player.js";

const approvedSlots = [
  [3, 0, "B9", "1.0.0"], [3, 1, "C29", "1.0.0"], [14, 1, "B13", "2.0.0"], [14, 3, "C30", "1.0.0"],
  [25, 1, "C23", "1.0.0"], [25, 3, "A4", "1.0.0"], [34, 1, "A2", "1.0.0"], [59, 0, "C22", "1.0.0"],
  [68, 3, "A7", "1.0.0"], [83, 1, "C20", "1.0.0"], [126, 0, "C27", "1.0.0"], [140, 3, "B14", "1.0.0"],
];

test("the combined catalog registers exactly the twelve retained production engines", () => {
  assert.equal(productionMinigameFixtures.length, 12);
  assert.equal(new Set(productionMinigameFixtures.map((fixture) => fixture.id)).size, 12);
  const registry = createAppMinigameRegistry();
  const production = registry.registrations().filter((entry) => entry.production);
  assert.deepEqual(new Set(production.map((entry) => entry.engineId)), new Set(approvedSlots.map(([, , engineId]) => engineId)));
  productionMinigameFixtures.forEach((fixture) => assert.doesNotThrow(() => registry.resolve({ ...fixture, mode: "mission" })));
  assert.throws(() => registry.resolve({ ...bundledMinigameSource.get("foundation-skeleton-v1"), mode: "mission" }), /non-production/);
});

test("every reviewed engine occupies its exact real mission slot while all questions retain four games and one quiz", () => {
  Object.values(activities).forEach((activity) => {
    assert.equal(activity.games.length, 4);
    assert.equal(activity.quiz.length, 1);
  });
  assert.equal(Object.values(activities).flatMap((activity) => activity.games).filter((game) => game.type === "minigame").length, 12);
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

test("Q127 no longer contains or registers Balance of Love", () => {
  const q127 = activities[127];
  assert.equal(q127.games.length, 4);
  assert.equal(q127.quiz.length, 1);
  assert.deepEqual(q127.games.map(({ type }) => type), ["reveal", "wordsearch", "order", "match"]);
  assert.equal(q127.games[0].title.en, "What protects love in a grave crisis?");
  assert.equal(q127.games[0].cards.length, 5);
  assert.equal(productionMinigameFixtures.some(({ engineId }) => engineId === "C21"), false);
  assert.equal(bundledMinigameSource.get("C21"), null);
});
