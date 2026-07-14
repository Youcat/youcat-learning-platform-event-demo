import test from "node:test";
import assert from "node:assert/strict";
import { claimRandomMission, finishPersonalMission, resetParticipantSession } from "../src/firebase.js";

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
