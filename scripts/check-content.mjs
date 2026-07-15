import content from "../src/data/official-content.json" with { type: "json" };
import learning from "../src/data/learning-content.js";

const expected = new Set([3, 14, 25, 34, 59, 68, 83, 126, 127, 140]);
const official = new Set(content.questions.map((item) => item.number));
const authored = new Set(learning.map((item) => item.number));
const mechanicCounts = new Map();

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
  for (const game of item.games) {
    const mechanic = game.engineId || game.type;
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
    if (game.type === "minigame" && (item.number !== 25 || game.engineId !== "A4" || game.engineVersion !== "1.0.0")) {
      throw new Error("Only Q25 game 4 may use the A4 production minigame");
    }
  }
  if (!item.quiz[0].feedback?.pt) throw new Error(`Q${item.number} quiz needs Portuguese feedback`);
  if (!item.saintQuote?.text || !item.saintQuote?.author) throw new Error(`Q${item.number} needs a saint quote`);
}

for (const [mechanic, expectedCount] of Object.entries({ order: 8, match: 8, reveal: 8, wordsearch: 7, move: 1, "image-shuffle": 7, minigame: 1 })) {
  if (mechanicCounts.get(mechanic) !== expectedCount) throw new Error(`${mechanic} must appear exactly ${expectedCount} times`);
}

console.log("Content checks passed.");
