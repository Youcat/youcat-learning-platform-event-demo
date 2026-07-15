import { C22_DEFAULT_PAYLOAD, C22_ENGINE_ID, C22_ENGINE_VERSION } from "../engines/c22-magnetic-field.js";

const friendshipArtwork = new URL("../../assets/minigames/c22/transparent-friendship.webp", import.meta.url).href;

export const C22_FIXTURE_ID = "C22";

export const c22Fixture = Object.freeze({
  id: C22_FIXTURE_ID,
  questionNumber: 59,
  missionSlot: 0,
  engineId: C22_ENGINE_ID,
  engineVersion: C22_ENGINE_VERSION,
  seed: "love-forever-q59-c22-v1",
  mode: "lab",
  xp: 8,
  title: {
    en: "Magnetic Field",
    pt: "Campo Magnético",
  },
  prompt: {
    en: "There is real attraction. Move both friends into a field that keeps friendship warm, transparent, free, and bounded. Drag, tap a figure then a target, or use the controls below.",
    pt: "Existe uma atração real. Mova os dois amigos para um campo que mantenha a amizade calorosa, transparente, livre e com limites. Arraste, toque numa figura e depois no destino, ou use os controles abaixo.",
  },
  insight: {
    en: "Attraction need not end a friendship. Naming it truthfully and choosing a proportionate boundary can protect both people’s freedom.",
    pt: "A atração não precisa acabar com uma amizade. Reconhecê-la com sinceridade e escolher um limite proporcional pode proteger a liberdade de ambos.",
  },
  assets: { baseImage: friendshipArtwork, layers: [], masks: [] },
  layoutOverrides: { figureScale: 0.95 },
  payload: JSON.parse(JSON.stringify(C22_DEFAULT_PAYLOAD)),
});
