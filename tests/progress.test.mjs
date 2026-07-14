import test from "node:test";
import assert from "node:assert/strict";
import { countWords, createProgressStore, readingReward } from "../src/progress.js";

class MemoryStorage {
  value = new Map();
  getItem(key) { return this.value.get(key) || null; }
  setItem(key, value) { this.value.set(key, value); }
  removeItem(key) { this.value.delete(key); }
}

test("reading rewards use 400 wpm, five-second minimum, and 1–10 XP", () => {
  assert.equal(countWords("Um texto muito curto."), 4);
  assert.deepEqual(readingReward("palavra ".repeat(1)), { words: 1, xp: 1, requiredMs: 5000 });
  assert.equal(readingReward("palavra ".repeat(76)).xp, 2);
  assert.equal(readingReward("palavra ".repeat(1000)).xp, 10);
  assert.equal(readingReward("palavra ".repeat(400)).requiredMs, 60000);
});

test("awards are idempotent", () => {
  const store = createProgressStore(new MemoryStorage());
  assert.equal(store.awardOnce("game:3:0", 3, "Assis-Sao-Jose").awarded, true);
  assert.equal(store.awardOnce("game:3:0", 3, "Assis-Santa-Clara").awarded, false);
  assert.equal(store.totalXp(), 3);
  assert.equal(store.groupXp("Assis-Sao-Jose"), 3);
  assert.equal(store.groupXp("Assis-Santa-Clara"), 0);
});

test("changing group transfers every previously earned award", () => {
  const store = createProgressStore(new MemoryStorage());
  store.awardOnce("read:3:0", 4, "Assis-Sao-Jose", { question: 3 });
  store.awardOnce("team:3:quiz", 10, "Assis-Sao-Jose", { question: 3 });
  store.transferAwardsToGroup("Assis-Santa-Clara");
  assert.equal(store.totalXp(), 14);
  assert.equal(store.groupXp("Assis-Sao-Jose"), 0);
  assert.equal(store.groupXp("Assis-Santa-Clara"), 14);
  assert.equal(store.questionGroupXp("Assis-Santa-Clara", 3), 14);
});

test("achievement thresholds unlock once", () => {
  const store = createProgressStore(new MemoryStorage());
  store.awardOnce("a", 24, "Assis-Sao-Jose");
  const result = store.awardOnce("b", 1, "Assis-Sao-Jose");
  assert.equal(result.unlocked[0].id, "first-steps");
  assert.equal(store.pendingAchievement(), "first-steps");
});

test("question XP stays attributed to the group where it was earned", () => {
  const store = createProgressStore(new MemoryStorage());
  store.awardOnce("quiz:3:0", 10, "Assis-Sao-Jose", { question: 3 });
  store.awardOnce("game:3:0", 3, "Assis-Santa-Clara", { question: 3 });
  store.awardOnce("quiz:14:0", 10, "Assis-Sao-Jose", { question: 14 });
  assert.equal(store.questionGroupXp("Assis-Sao-Jose", 3), 10);
  assert.equal(store.questionGroupXp("Assis-Santa-Clara", 3), 3);
  assert.deepEqual(store.allGroupQuestionXp(), {
    "Assis-Sao-Jose": { 3: 10, 14: 10 },
    "Assis-Santa-Clara": { 3: 3 },
  });
});
