import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateGroupStandings,
  isGroupJourneyComplete,
  isStandingWinnerEligible,
  winnerTargetForMembers,
} from "../src/event-winner.js";

const challengeIds = ["3__quiz", "3__game-0"];
const questions = [3, 14];
const completeMember = (overrides = {}) => ({
  active: true,
  reflectionStatus: { 3: "submitted", 14: "declined" },
  boardCompleted: { 3: true, 14: true },
  ...overrides,
});
const completeGroup = {
  challenges: {
    "3__quiz": { status: "completed" },
    "3__game-0": { status: "skipped" },
  },
};

test("the first group may win only after every shared and personal mission is resolved", () => {
  assert.equal(isGroupJourneyComplete({
    members: [completeMember(), completeMember()], group: completeGroup, challengeIds, questions,
  }), true);

  assert.equal(isGroupJourneyComplete({
    members: [completeMember(), completeMember({ boardCompleted: { 3: true } })],
    group: completeGroup, challengeIds, questions,
  }), false);
});

test("inactive members do not block completion and a one-person group cannot win", () => {
  assert.equal(isGroupJourneyComplete({
    members: [completeMember(), completeMember({ active: false, boardCompleted: {} })],
    group: completeGroup, challengeIds, questions,
  }), false);

  assert.equal(isGroupJourneyComplete({
    members: [completeMember(), completeMember(), completeMember({ active: false, boardCompleted: {} })],
    group: completeGroup, challengeIds, questions,
  }), true);
});

test("winner targets scale with current membership and round to tens", () => {
  assert.equal(winnerTargetForMembers(8), 1140);
  assert.equal(winnerTargetForMembers(10), 1300);
  assert.equal(winnerTargetForMembers(12), 1460);
  assert.equal(winnerTargetForMembers(-4), 510);
  assert.equal(winnerTargetForMembers(10.9), 1300);
});

test("all active members count toward the target, while two XP contributors are required", () => {
  const standings = aggregateGroupStandings([
    ...Array.from({ length: 8 }, (_, index) => ({ groupCode: "Sao-Jose", active: true, groupXp: index < 2 ? 570 : 0 })),
    { groupCode: "Santa-Clara", active: true, groupXp: 2000 },
    { groupCode: "Santa-Clara", active: true, groupXp: 0 },
    { groupCode: "Sao-Jose", active: false, groupXp: 9000 },
  ]);
  assert.deepEqual(standings.map(({ groupCode, members, participants, totalXp, targetXp }) => ({ groupCode, members, participants, totalXp, targetXp })), [
    { groupCode: "Sao-Jose", members: 8, participants: 2, totalXp: 1140, targetXp: 1140 },
  ]);
  assert.equal(isStandingWinnerEligible(standings[0]), true);
});

test("ten members need exactly 1,300 XP", () => {
  const standingAt = (totalXp) => aggregateGroupStandings(Array.from({ length: 10 }, (_, index) => ({
    groupCode: "Sao-Jose",
    active: true,
    groupXp: index === 0 ? totalXp - 1 : index === 1 ? 1 : 0,
  })))[0];
  assert.equal(isStandingWinnerEligible(standingAt(1299)), false);
  assert.equal(isStandingWinnerEligible(standingAt(1300)), true);
});
