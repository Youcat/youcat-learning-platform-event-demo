import { B14_DEFAULT_PAYLOAD } from "../engines/b14.js";

export const B14_FIXTURE_ID = "B14";

const baseImage = new URL("../../assets/minigames/b14/real-growth-tree.webp", import.meta.url).href;

const shared = {
  questionNumber: 140,
  missionSlot: 3,
  engineId: "B14",
  engineVersion: "1.0.0",
  seed: "assis-q140-b14-001",
  title: {
    en: "Roots, trunk, branches & fruit",
    pt: "Raízes, tronco, ramos e fruto",
  },
  prompt: {
    en: "Place every word on the living tree. Drag a word to its place, tap a word and then its place, or use the keyboard.",
    pt: "Coloque cada palavra na árvore viva. Arraste uma palavra até o seu lugar, toque numa palavra e depois no seu lugar, ou use o teclado.",
  },
  insight: {
    en: "God sustains love at its roots. Decision gives it form; gratitude, forgiveness, respect, and care open a deeper communion.",
    pt: "Deus sustenta o amor desde as raízes. A decisão lhe dá forma; gratidão, perdão, respeito e cuidado abrem uma comunhão mais profunda.",
  },
  assets: { baseImage, layers: [], masks: [] },
  layoutOverrides: {},
  payload: B14_DEFAULT_PAYLOAD,
};

export const b14Fixture = Object.freeze({
  id: B14_FIXTURE_ID,
  ...shared,
  mode: "lab",
  xp: 0,
});

export const b14MissionDefinition = Object.freeze({
  id: "q140-mission-slot-3-b14",
  ...shared,
  mode: "mission",
  xp: 8,
});
