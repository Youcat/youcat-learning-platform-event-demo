import test from "node:test";
import assert from "node:assert/strict";
import { isGroupJourneyComplete } from "../src/event-winner.js";

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
