const c21Artwork = new URL("../../assets/minigames/c21/balance-of-love.webp", import.meta.url).href;

export const C21_FIXTURE_ID = "C21";
export const C21_ENGINE_ID = "C21";
export const C21_ENGINE_VERSION = "1.0.0";

const payload = {
  concepts: [
    { id: "love", label: { en: "Love", pt: "Amor" } },
    { id: "truth", label: { en: "Truth", pt: "Verdade" } },
    { id: "safety", label: { en: "Safety", pt: "Segurança" } },
    { id: "help", label: { en: "Qualified help", pt: "Ajuda qualificada" } },
    { id: "boundaries", label: { en: "Boundaries", pt: "Limites" } },
  ],
  slots: [
    { id: "support-1", label: { en: "Support 1", pt: "Apoio 1" } },
    { id: "support-2", label: { en: "Support 2", pt: "Apoio 2" } },
    { id: "support-3", label: { en: "Support 3", pt: "Apoio 3" } },
    { id: "support-4", label: { en: "Support 4", pt: "Apoio 4" } },
    { id: "support-5", label: { en: "Support 5", pt: "Apoio 5" } },
  ],
  minimumMoves: 7,
  minimumReconsidered: 2,
};

const shared = {
  questionNumber: 127,
  missionSlot: 0,
  engineId: C21_ENGINE_ID,
  engineVersion: C21_ENGINE_VERSION,
  seed: "assis-c21-balance-of-love-127-001",
  xp: 5,
  title: {
    en: "Balance of Love",
    pt: "O equilíbrio do amor",
  },
  prompt: {
    en: "Arrange love, truth, safety, qualified help, and boundaries on the balance. Drag, or select a concept and then a numbered support. Reconsider at least two before Check.",
    pt: "Organize amor, verdade, segurança, ajuda qualificada e limites na balança. Arraste ou selecione um conceito e depois um apoio numerado. Reconsidere pelo menos dois antes de verificar.",
  },
  insight: {
    en: "Love does not ask us to deny reality. In a grave crisis, safety, truth, qualified help, and firm boundaries can all serve faithful care. Your arrangement is a reflection, not a verdict.",
    pt: "O amor não pede que neguemos a realidade. Numa crise grave, segurança, verdade, ajuda qualificada e limites firmes podem servir ao cuidado fiel. Sua organização é uma reflexão, não um veredito.",
  },
  assets: { baseImage: c21Artwork, layers: [], masks: [] },
  layoutOverrides: {},
  payload,
};

export const c21LabFixture = Object.freeze({
  id: C21_FIXTURE_ID,
  ...shared,
  mode: "lab",
});

export const c21MissionDefinition = Object.freeze({
  id: "c21-q127-slot0",
  ...shared,
  mode: "mission",
});

