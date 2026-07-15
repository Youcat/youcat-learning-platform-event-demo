const SUPPORTED_SIZES = new Set([3, 4]);

export const DEFAULT_REWARDS = Object.freeze({ 3: 3, 4: 5 });
export const DEFAULT_SHUFFLE_MOVES = Object.freeze({ 3: 80, 4: 160 });

function assertSize(size) {
  if (!SUPPORTED_SIZES.has(size)) {
    throw new RangeError(`Puzzle size must be 3 or 4; received ${size}`);
  }
}

function assertBoard(board, size) {
  assertSize(size);
  const expectedLength = size * size;
  if (!Array.isArray(board) || board.length !== expectedLength) {
    throw new TypeError(`Board must contain ${expectedLength} cells`);
  }
  const sorted = [...board].sort((a, b) => a - b);
  if (sorted.some((value, index) => value !== index)) {
    throw new TypeError(`Board must be a permutation of 0..${expectedLength - 1}`);
  }
}

export function createSolvedBoard(size) {
  assertSize(size);
  return Array.from({ length: size * size }, (_, index) =>
    index === size * size - 1 ? 0 : index + 1,
  );
}

export function isSolved(board, size) {
  assertBoard(board, size);
  return board.every((tile, index) =>
    index === board.length - 1 ? tile === 0 : tile === index + 1,
  );
}

export function movableTileIndices(board, size) {
  assertBoard(board, size);
  const blank = board.indexOf(0);
  const row = Math.floor(blank / size);
  const column = blank % size;
  const indices = [];

  if (row > 0) indices.push(blank - size);
  if (column < size - 1) indices.push(blank + 1);
  if (row < size - 1) indices.push(blank + size);
  if (column > 0) indices.push(blank - 1);

  return indices;
}

export function moveTile(board, tileIndex, size) {
  assertBoard(board, size);
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= board.length) {
    throw new RangeError(`Tile index is outside the board: ${tileIndex}`);
  }
  if (!movableTileIndices(board, size).includes(tileIndex)) return null;

  const next = [...board];
  const blank = next.indexOf(0);
  [next[blank], next[tileIndex]] = [next[tileIndex], next[blank]];
  return next;
}

export function shuffleBoard(
  size,
  { moves = DEFAULT_SHUFFLE_MOVES[size], random = Math.random } = {},
) {
  assertSize(size);
  if (!Number.isInteger(moves) || moves < 1) {
    throw new RangeError("Shuffle moves must be a positive integer");
  }
  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }

  let board = createSolvedBoard(size);
  let previousBlank = -1;

  for (let step = 0; step < moves; step += 1) {
    const candidates = movableTileIndices(board, size);
    const withoutImmediateUndo = candidates.filter((index) => index !== previousBlank);
    const pool = withoutImmediateUndo.length ? withoutImmediateUndo : candidates;
    const randomValue = Number(random());
    const normalized = Number.isFinite(randomValue)
      ? Math.min(Math.max(randomValue, 0), 0.999999999999)
      : 0;
    const tileIndex = pool[Math.floor(normalized * pool.length)];
    const oldBlank = board.indexOf(0);
    board = moveTile(board, tileIndex, size);
    previousBlank = oldBlank;
  }

  if (isSolved(board, size)) {
    board = moveTile(board, movableTileIndices(board, size)[0], size);
  }
  return board;
}

export function tileBackground(tile, size) {
  assertSize(size);
  if (!Number.isInteger(tile) || tile < 1 || tile >= size * size) {
    throw new RangeError(`Visible tile must be between 1 and ${size * size - 1}`);
  }
  const solvedIndex = tile - 1;
  const row = Math.floor(solvedIndex / size);
  const column = solvedIndex % size;
  const denominator = size - 1;

  return {
    backgroundSize: `${size * 100}% ${size * 100}%`,
    backgroundPosition: `${(column / denominator) * 100}% ${(row / denominator) * 100}%`,
  };
}

export function rewardForSize(size, rewards = DEFAULT_REWARDS) {
  assertSize(size);
  const easyReward = Number(rewards[3]);
  const hardReward = Number(rewards[4]);
  if (!Number.isFinite(easyReward) || easyReward < 0 || !Number.isFinite(hardReward) || hardReward < 0) {
    throw new TypeError("Rewards must contain valid non-negative XP for both sizes");
  }
  const reward = Number(rewards[size]);
  if (hardReward <= easyReward) {
    throw new RangeError("The 4x4 reward must be greater than the 3x3 reward");
  }
  return reward;
}
