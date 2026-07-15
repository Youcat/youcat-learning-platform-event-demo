import content from "../src/data/official-content.json" with { type: "json" };
import learning from "../src/data/learning-content.js";
import { bundledMinigameSource, createAppMinigameRegistry } from "../src/minigames/catalog.js";

const expected = new Set([3, 14, 25, 34, 59, 68, 83, 126, 127, 140]);
const official = new Set(content.questions.map((item) => item.number));
const authored = new Set(learning.map((item) => item.number));
const mechanicCounts = new Map();
const approvedMinigameSlots = new Map([
  ["3:0", "B9"], ["3:1", "C29"], ["14:1", "B13"], ["14:3", "C30"],
  ["25:1", "C23"], ["25:3", "A4"], ["34:1", "A2"], ["59:0", "C22"],
  ["68:3", "A7"], ["83:1", "C20"], ["126:0", "C27"], ["127:0", "C21"], ["140:3", "B14"],
]);
const approvedMinigameVersions = new Map([["B13", "2.0.0"]]);
const registry = createAppMinigameRegistry();

for (const number of expected) {
  if (!official.has(number)) throw new Error(`Official Q${number} is missing`);
  if (!authored.has(number)) throw new Error(`Learning content for Q${number} is missing`);
}

for (const item of learning) {
  if (!item.deepDive.length) throw new Error(`Q${item.number} needs verbatim source pages`);
  for (const source of item.deepDive) {
    if (!source.source || !source.body?.pt) throw new Error(`Q${item.number} has an incomplete source page`);
    if (/^(YOUCAT|DOCAT)\b/.test(source.source) && !source.question?.pt) {
      throw new Error(`${source.source} needs its authenticated question`);
    }
  }
  if (item.games.length !== 4) throw new Error(`Q${item.number} must have four games`);
  if (item.quiz.length !== 1) throw new Error(`Q${item.number} must have exactly one quiz`);
  for (const [gameIndex, game] of item.games.entries()) {
    const mechanic = game.type;
    mechanicCounts.set(mechanic, (mechanicCounts.get(mechanic) || 0) + 1);
    if (["order", "move"].includes(game.type) && game.start.join("|") === game.answer.join("|")) {
      throw new Error(`Q${item.number} ${game.type} game must not start solved`);
    }
    if (game.type === "wordsearch") {
      if (!game.seed) throw new Error(`Q${item.number} wordsearch needs a stable seed`);
      if (game.words.length < 3 || game.words.length > 5) throw new Error(`Q${item.number} wordsearch needs 3–5 words`);
      for (const locale of ["en", "pt"]) {
        for (const word of game.words) {
          const length = [...word[locale].normalize("NFC").toLocaleUpperCase(locale)].filter((char) => /\p{L}/u.test(char)).length;
          if (length < 1 || length > 10) throw new Error(`Q${item.number} ${locale} wordsearch word must have 1–10 letters`);
        }
      }
    }
    if (game.type === "minigame") {
      const slotKey = `${item.number}:${gameIndex}`;
      const approvedVersion = approvedMinigameVersions.get(game.engineId) || "1.0.0";
      if (approvedMinigameSlots.get(slotKey) !== game.engineId || game.engineVersion !== approvedVersion) {
        throw new Error(`Unapproved production minigame at Q${item.number} slot ${gameIndex}`);
      }
      const fixture = bundledMinigameSource.get(game.fixtureId || game.definitionId || game.sourceId || game.engineId, { mode: "lab" })
        || bundledMinigameSource.get(game.engineId, { mode: "lab" });
      if (!fixture || fixture.questionNumber !== item.number || fixture.missionSlot !== gameIndex) {
        throw new Error(`Q${item.number} slot ${gameIndex} does not match its bundled fixture`);
      }
      registry.resolve({ ...fixture, mode: "mission" });
    }
  }
  if (!item.quiz[0].feedback?.pt) throw new Error(`Q${item.number} quiz needs Portuguese feedback`);
  if (!item.saintQuote?.text || !item.saintQuote?.author) throw new Error(`Q${item.number} needs a saint quote`);
}

for (const [mechanic, expectedCount] of Object.entries({ order: 3, match: 7, reveal: 5, wordsearch: 5, move: 1, "image-shuffle": 6, minigame: 13 })) {
  if (mechanicCounts.get(mechanic) !== expectedCount) throw new Error(`${mechanic} must appear exactly ${expectedCount} times`);
}
if ([...approvedMinigameSlots.keys()].some((slot) => {
  const [questionNumber, gameIndex] = slot.split(":").map(Number);
  return learning.find((item) => item.number === questionNumber)?.games[gameIndex]?.type !== "minigame";
})) throw new Error("Every approved minigame slot must remain enabled");

console.log("Content checks passed.");
