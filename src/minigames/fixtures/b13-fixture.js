import {
  B13_CONCEPTS,
  B13_ENGINE_ID,
  B13_ENGINE_VERSION,
  B13_ROUTES,
  B13_SOLUTION,
  B13_STATIONS,
} from "../engines/b13-relationship-metro.js";

export const B13_FIXTURE_ID = "B13";

const clone = (value) => JSON.parse(JSON.stringify(value));
const completionArt = new URL("../assets/b13-self-gift.webp", import.meta.url).href;

export const b13Fixture = Object.freeze({
  id: B13_FIXTURE_ID,
  questionNumber: 14,
  missionSlot: 1,
  engineId: B13_ENGINE_ID,
  engineVersion: B13_ENGINE_VERSION,
  seed: "love-forever-q14-relationship-metro-v1",
  mode: "lab",
  xp: 9,
  title: {
    en: "Relationship Metro",
    pt: "Metrô dos relacionamentos",
  },
  prompt: {
    en: "Place the six concepts on the two routes. Drag a concept to a station, or tap a concept and then a station. Check only when your map is ready.",
    pt: "Posicione os seis conceitos nas duas rotas. Arraste um conceito até uma estação ou toque no conceito e depois na estação. Verifique só quando o mapa estiver pronto.",
  },
  insight: {
    en: "Bodily actions express the person. A truthful gift joins dignity and freedom within a lasting covenant.",
    pt: "Os gestos do corpo expressam a pessoa. Um dom verdadeiro une dignidade e liberdade numa aliança duradoura.",
  },
  assets: { baseImage: completionArt, layers: [], masks: [] },
  layoutOverrides: {},
  payload: {
    schemaVersion: 1,
    concepts: clone(B13_CONCEPTS),
    stations: clone(B13_STATIONS),
    routes: clone(B13_ROUTES),
    solution: clone(B13_SOLUTION),
  },
});
