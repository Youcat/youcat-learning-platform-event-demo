import test from "node:test";
import assert from "node:assert/strict";
import { claimRandomMission, chooseMission, finishPersonalMission, resetParticipantSession, skipSharedMission } from "../src/firebase.js";

test("a reserved team challenge cannot be assigned to a second group member", async () => {
  const challenges = [{ id: "3__quiz", questionNumber: 3, challengeKind: "quiz", challengeIndex: 0, xp: 10 }];
  const first = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: challenges, questions: [] });
  assert.equal(first.id, "3__quiz");

  await resetParticipantSession();
  const second = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: challenges, questions: [] });
  assert.equal(second, null);

  await resetParticipantSession();
  const otherGroup = await claimRandomMission({ roomCode: "Assis-Santa-Clara", sharedChallenges: challenges, questions: [] });
  assert.equal(otherGroup.id, "3__quiz");
});

test("not now returns a reflection to the pool, while declining resolves it", async () => {
  await resetParticipantSession();
  const first = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: [], questions: [14] });
  assert.equal(first.type, "reflection");
  await finishPersonalMission({ mission: first, reflectionStatus: "" });

  const offeredAgain = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: [], questions: [14] });
  assert.equal(offeredAgain.type, "reflection");
  await finishPersonalMission({ mission: offeredAgain, reflectionStatus: "declined" });

  const resolved = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: [], questions: [14] });
  assert.equal(resolved, null);
});

test("submitting a reflection resolves the mission and clears its lease", async () => {
  await resetParticipantSession();
  const first = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: [], questions: [25] });
  assert.equal(first.type, "reflection");

  await finishPersonalMission({ mission: first, reflectionStatus: "submitted" });

  const next = await claimRandomMission({ roomCode: "Assis-Sao-Jose", sharedChallenges: [], questions: [25] });
  assert.equal(next, null);
});

test("skipping a team challenge removes it permanently for the whole group", async () => {
  await resetParticipantSession();
  const challenges = [{ id: "68__game__3", questionNumber: 68, challengeKind: "game", challengeIndex: 3, xp: 8 }];
  const first = await claimRandomMission({ roomCode: "Assis-Santa-Monica", sharedChallenges: challenges, questions: [] });
  await skipSharedMission(first);

  await resetParticipantSession();
  const teammate = await claimRandomMission({ roomCode: "Assis-Santa-Monica", sharedChallenges: challenges, questions: [] });
  assert.equal(teammate?.type, "complete");
});

test("an unlocked reflection board is prioritized over the random mission pool", () => {
  const mission = chooseMission({
    participant: { reflectionStatus: { 14: "submitted" }, boardCompleted: {} },
    group: { challenges: {} },
    event: { unlocked: { 14: true } },
    sharedChallenges: [{ id: "14__quiz", questionNumber: 14, challengeKind: "quiz", xp: 10 }],
    questions: [14, 25],
    roomCode: "Assis-Sao-Jose",
    now: Date.now(),
  });
  assert.equal(mission.type, "board");
  assert.equal(mission.questionNumber, 14);
});
