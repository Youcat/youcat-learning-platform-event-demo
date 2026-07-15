import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { createSolvedBoard, isSolved, moveTile, movableTileIndices, shuffleBoard, tileBackground } from "../src/image-shuffle.js";

const puzzleSlots = new Map([
  [25, 0],
  [34, 3],
  [59, 1],
  [83, 0],
  [126, 2],
  [140, 1],
]);

test("Assis preserves the six game illustrations still used as 3x3 shuffle puzzles", () => {
  const puzzles = [];
  for (const [number, index] of puzzleSlots) {
    const game = activities[number].games[index];
    assert.equal(game.type, "image-shuffle");
    assert.ok(game.title.en);
    assert.ok(game.title.pt);
    puzzles.push(`${number}:${index}`);
  }
  assert.deepEqual(puzzles, ["25:0", "34:3", "59:1", "83:0", "126:2", "140:1"]);
});

test("a 3x3 shuffle is always a reachable unsolved board", () => {
  const board = shuffleBoard(3, { random: () => 0.37 });
  assert.equal(board.length, 9);
  assert.deepEqual([...board].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(isSolved(board, 3), false);
});

test("only a neighbour may move into the empty 3x3 cell", () => {
  const solved = createSolvedBoard(3);
  const movable = movableTileIndices(solved, 3);
  assert.deepEqual(movable.sort((a, b) => a - b), [5, 7]);
  assert.equal(moveTile(solved, 0, 3), null);
  assert.equal(isSolved(moveTile(solved, 5, 3), 3), false);
});

test("3x3 tile backgrounds align to their original source positions", () => {
  assert.deepEqual(tileBackground(1, 3), { backgroundSize: "300% 300%", backgroundPosition: "0% 0%" });
  assert.deepEqual(tileBackground(8, 3), { backgroundSize: "300% 300%", backgroundPosition: "50% 100%" });
});
