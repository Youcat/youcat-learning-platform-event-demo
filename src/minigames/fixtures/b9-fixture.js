const concept = (id, en, pt) => Object.freeze({
  id,
  label: Object.freeze({ en, pt }),
});
export const B9_ENGINE_ID = "B9";
export const B9_ENGINE_VERSION = "1.0.0";
export const B9_FIXTURE_ID = "B9";

export const b9Fixture = Object.freeze({
  id: B9_FIXTURE_ID,
  questionNumber: 3,
  missionSlot: 0,
  engineId: B9_ENGINE_ID,
  engineVersion: B9_ENGINE_VERSION,
  seed: "assis-b9-bridge-fidelity-001",
  mode: "lab",
  xp: 6,
  title: {
    en: "Bridge of Fidelity",
    pt: "Ponte da Fidelidade",
  },
  prompt: {
    en: "Arrange all four stones so the bridge grows from attraction to fidelity. Drag one stone onto another to swap them, tap two stones, or use the controls. Revise freely, then Check.",
    pt: "Organize as quatro pedras para que a ponte avance da atração à fidelidade. Arraste uma pedra sobre outra para trocá-las, toque em duas pedras ou use os controles. Revise à vontade e depois verifique.",
  },
  insight: {
    en: "Feelings can begin love’s movement, but mature love grows through reality, concrete decisions for the other’s good, and repeated fidelity.",
    pt: "Os sentimentos podem iniciar o movimento do amor, mas o amor maduro cresce com a realidade, decisões concretas pelo bem do outro e fidelidade repetida.",
  },
  assets: {
    baseImage: new URL("../../assets/minigames/b9-crossing.webp", import.meta.url).href,
    layers: [],
    masks: [],
  },
  layoutOverrides: {},
  payload: {
    concepts: [
      concept("attraction", "Attraction", "Atração"),
      concept("reality", "Reality", "Realidade"),
      concept("good", "Concrete good", "Bem concreto"),
      concept("fidelity", "Fidelity", "Fidelidade"),
    ],
    answer: ["attraction", "reality", "good", "fidelity"],
  },
});
