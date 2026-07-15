import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { bundledMinigameSource, createAppMinigameRegistry, fixtureForMissionActivity, productionMinigameFixtures } from "../src/minigames/catalog.js";
import { missionInstanceForActivity } from "../src/minigames/mission-player.js";

const approvedSlots = [
  [3, 0, "B9"], [3, 1, "C29"], [14, 1, "B13"], [14, 3, "C30"],
  [25, 1, "C23"], [25, 3, "A4"], [34, 1, "A2"], [59, 0, "C22"],
  [68, 3, "A7"], [83, 1, "C20"], [126, 0, "C27"], [127, 0, "C21"], [140, 3, "B14"],
];

test("the combined catalog registers exactly the thirteen reviewed production engines", () => {
  assert.equal(productionMinigameFixtures.length, 13);
  assert.equal(new Set(productionMinigameFixtures.map((fixture) => fixture.id)).size, 13);
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
  assert.equal(Object.values(activities).flatMap((activity) => activity.games).filter((game) => game.type === "minigame").length, 13);
  approvedSlots.forEach(([questionNumber, missionSlot, engineId]) => {
    const activity = activities[questionNumber].games[missionSlot];
    assert.deepEqual({ type: activity.type, engineId: activity.engineId, engineVersion: activity.engineVersion }, { type: "minigame", engineId, engineVersion: "1.0.0" });
    const fixture = fixtureForMissionActivity(activity);
    assert.deepEqual({ questionNumber: fixture.questionNumber, missionSlot: fixture.missionSlot, engineId: fixture.engineId }, { questionNumber, missionSlot, engineId });
  });
});

test("the generic mission launcher derives an exact mission GameInstance for every engine", () => {
  approvedSlots.forEach(([questionNumber, missionSlot, engineId], index) => {
    const activity = activities[questionNumber].games[missionSlot];
    const instance = missionInstanceForActivity({
      mission: { id: `review-${index}`, groupCode: "assis", questionNumber, challengeIndex: missionSlot, xp: activity.xp || 5 },
      activity,
    });
    assert.deepEqual(
      { mode: instance.mode, questionNumber: instance.questionNumber, missionSlot: instance.missionSlot, engineId: instance.engineId, engineVersion: instance.engineVersion },
      { mode: "mission", questionNumber, missionSlot, engineId, engineVersion: "1.0.0" },
    );
  });
});
