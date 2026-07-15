import { C23_DEFAULT_PAYLOAD } from "../engines/c23-engine.js";

const approvedArtwork = new URL("../assets/c23/emmaus-guide-360.webp", import.meta.url).href;

export const C23_FIXTURE_ID = "C23";

export const c23Fixture = Object.freeze({
  id: C23_FIXTURE_ID,
  questionNumber: 25,
  missionSlot: 1,
  engineId: "C23",
  engineVersion: "1.0.0",
  seed: "love-forever-q25-compass-001",
  mode: "lab",
  xp: 0,
  title: {
    en: "Compass of Discernment",
    pt: "Bússola do Discernimento",
  },
  prompt: {
    en: "Arrange the six cues so the whole compass points forward. Drag one cue onto another to swap them, tap a cue and then its target, or use the accessible controls.",
    pt: "Organize as seis pistas para que toda a bússola aponte para a frente. Arraste uma pista sobre outra para trocá-las, toque numa pista e depois no destino, ou use os controles acessíveis.",
  },
  insight: {
    en: "Good counsel receives concrete experience, reads it in the light of the Gospel, protects freedom and responsibility, and reviews the fruits over time.",
    pt: "Um bom conselho acolhe a experiência concreta, lê-a à luz do Evangelho, protege a liberdade e a responsabilidade e revê os frutos ao longo do tempo.",
  },
  assets: { baseImage: approvedArtwork, layers: [], masks: [] },
  layoutOverrides: {},
  payload: C23_DEFAULT_PAYLOAD,
});
