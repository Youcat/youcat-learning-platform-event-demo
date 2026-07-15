import {
  B13_ENGINE_ID,
  B13_ENGINE_VERSION,
  B13_PAIRS,
} from "../engines/b13-matching-pairs.js";

export const B13_FIXTURE_ID = "B13";

const clone = (value) => JSON.parse(JSON.stringify(value));
export const b13Fixture = Object.freeze({
  id: B13_FIXTURE_ID,
  questionNumber: 14,
  missionSlot: 1,
  engineId: B13_ENGINE_ID,
  engineVersion: B13_ENGINE_VERSION,
  seed: "love-forever-q14-matching-pairs-v2",
  mode: "lab",
  xp: 9,
  title: {
    en: "Words that belong together",
    pt: "Palavras que pertencem uma à outra",
  },
  prompt: {
    en: "Match the three pairs: tap two words, drag one word onto another, or use the keyboard.",
    pt: "Forme os três pares: toque em duas palavras, arraste uma palavra sobre outra ou use o teclado.",
  },
  insight: {
    en: "The person is body and soul. Dignity needs freedom, and a true gift finds its lasting form in covenant.",
    pt: "A pessoa é corpo e alma. A dignidade precisa de liberdade, e um verdadeiro dom encontra sua forma duradoura na aliança.",
  },
  assets: { baseImage: null, layers: [], masks: [] },
  layoutOverrides: {},
  payload: {
    schemaVersion: 2,
    pairs: clone(B13_PAIRS),
  },
});
