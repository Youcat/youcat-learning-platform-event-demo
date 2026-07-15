export const SKELETON_FIXTURE_ID = "foundation-skeleton-v1";

export const skeletonFixture = Object.freeze({
  id: SKELETON_FIXTURE_ID,
  questionNumber: 3,
  missionSlot: 0,
  engineId: "foundation-skeleton",
  engineVersion: "1.0.0",
  seed: "assis-foundation-proof-001",
  mode: "lab",
  xp: 0,
  title: {
    en: "Foundation interaction proof",
    pt: "Prova de interação da fundação",
  },
  prompt: {
    en: "Move the red marker into the graphite target. Drag it, tap the marker and then the target, or use the accessible controls.",
    pt: "Mova o marcador vermelho até o alvo de grafite. Arraste-o, toque no marcador e depois no alvo, ou use os controles acessíveis.",
  },
  insight: {
    en: "This non-production fixture proves the shared shell only; it does not replace a mission game.",
    pt: "Esta fixture não produtiva comprova apenas a estrutura compartilhada; não substitui nenhum jogo de missão.",
  },
  assets: { baseImage: null, layers: [], masks: [] },
  layoutOverrides: {},
  payload: {
    start: { x: 0.22, y: 0.72 },
    target: { x: 0.76, y: 0.3 },
    tolerance: 0.09,
  },
});
