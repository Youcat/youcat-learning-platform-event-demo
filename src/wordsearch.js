const DIRECTIONS = [
  { name: "east", dr: 0, dc: 1 },
  { name: "south", dr: 1, dc: 0 },
  { name: "southeast", dr: 1, dc: 1 },
];

const ALPHABETS = {
  de: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  en: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  es: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  fr: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  it: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  nl: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  pl: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  pt: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

function fnv1a(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "word";
}

export function normalizeWord(value, locale = "en") {
  return [...String(value).trim().normalize("NFC").toLocaleUpperCase(locale)]
    .filter((char) => /\p{L}/u.test(char))
    .join("");
}

export function validateWords(labels, locale = "en") {
  if (!Array.isArray(labels) || labels.length < 3 || labels.length > 5) {
    throw new Error("Provide between 3 and 5 words.");
  }
  const words = labels.map((label, index) => {
    const display = String(label).trim();
    const normalized = normalizeWord(display, locale);
    if (!normalized) throw new Error(`Word ${index + 1} has no letters.`);
    const length = [...normalized].length;
    if (length > 10) throw new Error(`“${display}” has ${length} letters after normalization; the maximum is 10.`);
    return { label: display, normalized };
  });
  for (let left = 0; left < words.length; left += 1) {
    for (let right = left + 1; right < words.length; right += 1) {
      const a = words[left].normalized;
      const b = words[right].normalized;
      if (a === b) throw new Error(`“${words[left].label}” and “${words[right].label}” normalize to the same word.`);
      if (a.includes(b) || b.includes(a)) {
        throw new Error(`“${words[left].label}” and “${words[right].label}” create an ambiguous contained word.`);
      }
    }
  }
  const ids = new Map();
  return words.map((word) => {
    const base = slugify(word.label);
    const count = (ids.get(base) || 0) + 1;
    ids.set(base, count);
    return { ...word, id: count === 1 ? base : `${base}-${count}` };
  });
}

function placementCells(word, row, col, direction) {
  return [...word.normalized].map((letter, index) => ({
    row: row + direction.dr * index,
    col: col + direction.dc * index,
    letter,
  }));
}

function candidatesFor(word, size, grid, random) {
  const candidates = [];
  for (const direction of DIRECTIONS) {
    const length = [...word.normalized].length;
    const maxRow = size - 1 - direction.dr * (length - 1);
    const maxCol = size - 1 - direction.dc * (length - 1);
    for (let row = 0; row <= maxRow; row += 1) {
      for (let col = 0; col <= maxCol; col += 1) {
        const cells = placementCells(word, row, col, direction);
        if (cells.every((cell) => !grid[cell.row][cell.col] || grid[cell.row][cell.col] === cell.letter)) {
          const overlaps = cells.filter((cell) => grid[cell.row][cell.col] === cell.letter).length;
          candidates.push({ row, col, direction, cells, overlaps, tie: random() });
        }
      }
    }
  }
  return candidates.sort((a, b) => b.overlaps - a.overlaps || a.tie - b.tie);
}

function placeWords(words, size, random) {
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const ordered = words
    .map((word) => ({ ...word, tie: random() }))
    .sort((a, b) => [...b.normalized].length - [...a.normalized].length || a.tie - b.tie);
  const placed = [];

  function visit(index) {
    if (index === ordered.length) return true;
    const word = ordered[index];
    for (const candidate of candidatesFor(word, size, grid, random)) {
      const previous = candidate.cells.map((cell) => grid[cell.row][cell.col]);
      candidate.cells.forEach((cell) => { grid[cell.row][cell.col] = cell.letter; });
      placed.push({ word, ...candidate });
      if (visit(index + 1)) return true;
      placed.pop();
      candidate.cells.forEach((cell, cellIndex) => { grid[cell.row][cell.col] = previous[cellIndex]; });
    }
    return false;
  }

  return visit(0) ? { grid, placed } : null;
}

function occurrenceKey(start, end) {
  return `${start.row},${start.col}:${end.row},${end.col}`;
}

function findOccurrences(grid, normalized) {
  const size = grid.length;
  const letters = [...normalized];
  const results = new Map();
  for (const direction of DIRECTIONS) {
    const maxRow = size - 1 - direction.dr * (letters.length - 1);
    const maxCol = size - 1 - direction.dc * (letters.length - 1);
    for (let row = 0; row <= maxRow; row += 1) {
      for (let col = 0; col <= maxCol; col += 1) {
        const matches = letters.every((letter, index) => grid[row + direction.dr * index][col + direction.dc * index] === letter);
        if (matches) {
          const result = {
            start: { row, col },
            end: { row: row + direction.dr * (letters.length - 1), col: col + direction.dc * (letters.length - 1) },
          };
          results.set(occurrenceKey(result.start, result.end), result);
        }
      }
    }
  }
  return [...results.values()];
}

function fillGrid(layout, words, locale, random) {
  const baseAlphabet = ALPHABETS[locale?.split("-")[0]] || ALPHABETS.en;
  const targetLetters = new Set(words.flatMap((word) => [...word.normalized]));
  const alphabet = [...new Set([...baseAlphabet, ...targetLetters])];
  const singleLetters = new Set(words.filter((word) => [...word.normalized].length === 1).map((word) => word.normalized));
  const fillerAlphabet = alphabet.filter((letter) => !singleLetters.has(letter));
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const grid = layout.grid.map((row) => row.map((letter) => letter || fillerAlphabet[Math.floor(random() * fillerAlphabet.length)]));
    const unique = layout.placed.every((placement) => {
      const intended = occurrenceKey(
        { row: placement.row, col: placement.col },
        placement.cells.at(-1),
      );
      const occurrences = findOccurrences(grid, placement.word.normalized);
      return occurrences.length === 1 && occurrenceKey(occurrences[0].start, occurrences[0].end) === intended;
    });
    if (unique) return grid;
  }
  return null;
}

export function createWordSearch({ words: labels, title = "Find the words", locale = "en", seed, target = "mobile", id } = {}) {
  const words = validateWords(labels, locale);
  const stableSeed = String(seed || words.map((word) => word.normalized).join("-"));
  const longest = Math.max(...words.map((word) => [...word.normalized].length));
  for (let size = Math.max(7, longest); size <= 10; size += 1) {
    for (let layoutAttempt = 0; layoutAttempt < 80; layoutAttempt += 1) {
      const random = mulberry32(fnv1a(`${stableSeed}:${size}:${layoutAttempt}`));
      const layout = placeWords(words, size, random);
      if (!layout) continue;
      const grid = fillGrid(layout, words, locale, random);
      if (!grid) continue;
      const byId = new Map(layout.placed.map((placement) => [placement.word.id, placement]));
      return {
        schemaVersion: 1,
        id: id || `${slugify(title)}-${fnv1a(stableSeed).toString(16).slice(0, 8)}`,
        title,
        locale,
        seed: stableSeed,
        target,
        size,
        directions: DIRECTIONS.map((direction) => direction.name),
        grid,
        words: words.map((word) => {
          const placement = byId.get(word.id);
          const end = placement.cells.at(-1);
          return {
            id: word.id,
            label: word.label,
            normalized: word.normalized,
            start: { row: placement.row, col: placement.col },
            end: { row: end.row, col: end.col },
            direction: placement.direction.name,
          };
        }),
      };
    }
  }
  throw new Error("Unable to place these words in a 10 × 10 grid. Try a different seed or word set.");
}

function pointSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function endpointCell(point, size) {
  return {
    row: Math.max(0, Math.min(size - 1, Math.floor(point.y * size))),
    col: Math.max(0, Math.min(size - 1, Math.floor(point.x * size))),
  };
}

function sameCell(left, right) {
  return left.row === right.row && left.col === right.col;
}

export function validateStroke(points, puzzle, foundWordIds = []) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const startCell = endpointCell(points[0], puzzle.size);
  const endCell = endpointCell(points.at(-1), puzzle.size);
  const found = new Set(foundWordIds);
  const target = puzzle.words.find((word) => !found.has(word.id) && (
    (sameCell(startCell, word.start) && sameCell(endCell, word.end)) ||
    (sameCell(startCell, word.end) && sameCell(endCell, word.start))
  ));
  if (!target) return null;
  const segmentStart = { x: target.start.col + 0.5, y: target.start.row + 0.5 };
  const segmentEnd = { x: target.end.col + 0.5, y: target.end.row + 0.5 };
  const distances = points.map((point) => pointSegmentDistance(
    { x: point.x * puzzle.size, y: point.y * puzzle.size },
    segmentStart,
    segmentEnd,
  ));
  const within = distances.filter((distance) => distance <= 0.75).length / distances.length;
  return within >= 0.8 && Math.max(...distances) <= 1.25 ? target : null;
}

function perpendicularDistance(point, start, end) {
  return pointSegmentDistance(point, start, end);
}

export function simplifyPath(points, tolerance = 0.006) {
  if (!Array.isArray(points) || points.length <= 2) return points || [];
  const start = points[0];
  const end = points.at(-1);
  let maxDistance = 0;
  let index = 0;
  for (let cursor = 1; cursor < points.length - 1; cursor += 1) {
    const distance = perpendicularDistance(points[cursor], start, end);
    if (distance > maxDistance) {
      index = cursor;
      maxDistance = distance;
    }
  }
  if (maxDistance <= tolerance) return [start, end];
  return [
    ...simplifyPath(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyPath(points.slice(index), tolerance),
  ];
}

export function pathBetweenCells(start, end, size) {
  const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;
  const points = Array.from({ length }, (_, index) => {
    const ratio = length === 1 ? 0 : index / (length - 1);
    return {
      x: (start.col + 0.5 + (end.col - start.col) * ratio) / size,
      y: (start.row + 0.5 + (end.row - start.row) * ratio) / size,
    };
  });
  return points.length === 1 ? [points[0], { ...points[0] }] : points;
}

export { DIRECTIONS };
