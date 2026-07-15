import test from "node:test";
import assert from "node:assert/strict";
import activities from "../src/data/approved-activities.js";
import { createWordSearch, pathBetweenCells, simplifyPath, validateStroke } from "../src/wordsearch.js";

const directions = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
];

function occurrences(grid, normalized) {
  const letters = [...normalized];
  const found = new Set();
  for (const { dr, dc } of directions) {
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid.length; col += 1) {
        const endRow = row + dr * (letters.length - 1);
        const endCol = col + dc * (letters.length - 1);
        if (endRow >= grid.length || endCol >= grid.length) continue;
        if (letters.every((letter, index) => grid[row + dr * index][col + dc * index] === letter)) {
          found.add(`${row},${col}:${endRow},${endCol}`);
        }
      }
    }
  }
  return found;
}

test("all Assis word searches generate deterministic English and Portuguese grids", () => {
  const expectedPuzzleCount = Object.values(activities).flatMap((activity) => activity.games).filter((game) => game.type === "wordsearch").length * 2;
  let puzzleCount = 0;
  for (const [questionNumber, activity] of Object.entries(activities)) {
    activity.games.forEach((game, gameIndex) => {
      if (game.type !== "wordsearch") return;
      for (const locale of ["en", "pt"]) {
        const input = {
          words: game.words.map((word) => word[locale]),
          locale,
          seed: `${game.seed}:${locale}`,
          id: `assis-${questionNumber}-${gameIndex}-${locale}`,
        };
        const puzzle = createWordSearch(input);
        assert.deepEqual(puzzle, createWordSearch(input));
        assert.ok(puzzle.size >= 7 && puzzle.size <= 10);
        assert.equal(puzzle.grid.length, puzzle.size);
        assert.ok(puzzle.grid.every((row) => row.length === puzzle.size));
        for (const word of puzzle.words) {
          const expected = `${word.start.row},${word.start.col}:${word.end.row},${word.end.col}`;
          assert.deepEqual([...occurrences(puzzle.grid, word.normalized)], [expected]);
        }
        puzzleCount += 1;
      }
    });
  }
  assert.equal(puzzleCount, expectedPuzzleCount);
});

test("freehand validation accepts reverse paths, rejects wandering paths, and prevents duplicates", () => {
  const puzzle = createWordSearch({ words: ["FAITH", "HOPE", "LOVE"], seed: "assis-interaction" });
  const target = puzzle.words[0];
  const path = pathBetweenCells(target.start, target.end, puzzle.size);
  assert.equal(validateStroke(path, puzzle)?.id, target.id);
  assert.equal(validateStroke([...path].reverse(), puzzle)?.id, target.id);
  assert.equal(validateStroke(path, puzzle, [target.id]), null);
  const wandering = [...path];
  wandering.splice(1, 0, { x: 0, y: 1 });
  assert.equal(validateStroke(wandering, puzzle), null);
});

test("stored freehand strokes remain normalized and survive JSON persistence", () => {
  const puzzle = createWordSearch({ words: ["FAITH", "HOPE", "LOVE"], seed: "assis-persistence" });
  const target = puzzle.words[0];
  const path = pathBetweenCells(target.start, target.end, puzzle.size);
  path.splice(1, 0, { x: (path[0].x + path.at(-1).x) / 2 + 0.01, y: (path[0].y + path.at(-1).y) / 2 });
  const state = {
    foundWordIds: [target.id],
    wordSearchStrokes: [{ wordId: target.id, points: simplifyPath(path) }],
  };
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored, state);
  assert.ok(restored.wordSearchStrokes[0].points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
});

test("a one-letter target remains selectable with accessible endpoint input", () => {
  const puzzle = createWordSearch({ words: ["I", "HOPE", "LOVE"], seed: "single-letter" });
  const target = puzzle.words.find((word) => word.normalized === "I");
  const path = pathBetweenCells(target.start, target.end, puzzle.size);
  assert.equal(path.length, 2);
  assert.equal(validateStroke(path, puzzle)?.id, target.id);
});
