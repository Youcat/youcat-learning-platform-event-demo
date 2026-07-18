import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReflectionBoardEligibility,
  isResolvedReflectionStatus,
} from "../src/reflections.js";

test("submitted and declined both resolve a reflection", () => {
  assert.equal(isResolvedReflectionStatus("submitted"), true);
  assert.equal(isResolvedReflectionStatus("declined"), true);
  assert.equal(isResolvedReflectionStatus(""), false);
});

test("all members of active groups count, including zero-XP members", () => {
  const result = calculateReflectionBoardEligibility([
    { groupCode: "A", participants: 2, members: 10, reflectionResolved: { 14: 5 } },
    { groupCode: "B", participants: 1, members: 10, reflectionResolved: { 14: 10 } },
  ]);
  assert.equal(result.eligibleParticipantCount[14], 10);
  assert.equal(result.resolved[14], 5);
  assert.equal(result.unlocked[14], true);
});

test("inactive groups are excluded from both denominator and resolved total", () => {
  const result = calculateReflectionBoardEligibility([
    { groupCode: "A", participants: 2, members: 10, reflectionResolved: { 25: 4 } },
    { groupCode: "B", participants: 1, members: 50, reflectionResolved: { 25: 50 } },
  ]);
  assert.equal(result.eligibleParticipantCount[25], 10);
  assert.equal(result.resolved[25], 4);
  assert.equal(result.unlocked[25], undefined);
});

test("boards unlock at exactly 50 percent and remain unlocked", () => {
  const exact = calculateReflectionBoardEligibility([
    { participants: 2, members: 20, reflectionResolved: { 34: 10 } },
  ]);
  assert.equal(exact.unlocked[34], true);

  const laterBelowThreshold = calculateReflectionBoardEligibility([
    { participants: 2, members: 21, reflectionResolved: { 34: 10 } },
  ], exact.unlocked);
  assert.equal(laterBelowThreshold.unlocked[34], true);
});

test("group changes are reflected by the current summary membership", () => {
  const before = calculateReflectionBoardEligibility([
    { groupCode: "A", participants: 2, members: 10, reflectionResolved: { 59: 9 } },
    { groupCode: "B", participants: 2, members: 10, reflectionResolved: { 59: 8 } },
  ]);
  assert.equal(before.eligibleParticipantCount[59], 20);
  assert.equal(before.resolved[59], 17);

  const after = calculateReflectionBoardEligibility([
    { groupCode: "A", participants: 2, members: 9, reflectionResolved: { 59: 8 } },
    { groupCode: "B", participants: 2, members: 11, reflectionResolved: { 59: 9 } },
  ]);
  assert.equal(after.eligibleParticipantCount[59], 20);
  assert.equal(after.resolved[59], 17);
});
