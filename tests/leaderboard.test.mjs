import test from "node:test";
import assert from "node:assert/strict";
import { rankGroupSummaries, rankMembers } from "../src/leaderboard.js";

test("active event groups require two contributors and rank by total XP", () => {
  const ranked = rankGroupSummaries([
    { groupCode: "A", totalXp: 120, participants: 2, averageXp: 60 },
    { groupCode: "B", totalXp: 100, participants: 2, averageXp: 50 },
    { groupCode: "C", totalXp: 150, participants: 1, averageXp: 150 },
  ]);
  assert.deepEqual(ranked.map((item) => item.code), ["A", "B"]);
});

test("member ties are stable by display name", () => {
  const ranked = rankMembers([
    { displayName: "Bia S.", personalXp: 20 },
    { displayName: "Ana M.", personalXp: 20 },
    { displayName: "Caio P.", personalXp: 10 },
  ]);
  assert.deepEqual(ranked.map((item) => item.displayName), ["Ana M.", "Bia S.", "Caio P."]);
});
