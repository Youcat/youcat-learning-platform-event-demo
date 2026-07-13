import content from "../src/data/official-content.json" with { type: "json" };
import learning from "../src/data/learning-content.js";

const expected = new Set([3, 14, 25, 34, 59, 68, 83, 126, 127, 140]);
const official = new Set(content.questions.map((item) => item.number));
const authored = new Set(learning.map((item) => item.number));

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
  if (item.games.length !== 3) throw new Error(`Q${item.number} must have three games`);
  if (item.quiz.length < 2) throw new Error(`Q${item.number} must have at least two quiz items`);
  if (!item.saintQuote?.text || !item.saintQuote?.author) throw new Error(`Q${item.number} needs a saint quote`);
}

console.log("Content checks passed.");
