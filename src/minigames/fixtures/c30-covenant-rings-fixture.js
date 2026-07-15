export const C30_FIXTURE_ID = "C30";

const covenantRingsAsset = new URL("../../assets/minigames/c30/covenant-rings.webp", import.meta.url).href;

export const c30CovenantRingsFixture = Object.freeze({
  id: C30_FIXTURE_ID,
  questionNumber: 14,
  missionSlot: 3,
  engineId: "C30",
  engineVersion: "1.0.0",
  seed: "love-forever-c30-covenant-rings-001",
  mode: "lab",
  xp: 0,
  title: {
    en: "Covenant Rings",
    pt: "Anéis da Aliança",
  },
  prompt: {
    en: "Rotate the five concentric bands until the ribbon, gift, and figures form one image. Drag a band, or tap a band and then a rim mark.",
    pt: "Gire as cinco faixas concêntricas até que a fita, o presente e as figuras formem uma só imagem. Arraste uma faixa ou toque nela e depois numa marca da borda.",
  },
  insight: {
    en: "Freedom, totality, fidelity, fruitfulness, and grace belong together in the truthful gift of married love.",
    pt: "Liberdade, totalidade, fidelidade, fecundidade e graça caminham juntas no dom verdadeiro do amor matrimonial.",
  },
  assets: {
    baseImage: covenantRingsAsset,
    layers: [],
    masks: [],
  },
  layoutOverrides: {
    centerX: 0.5,
    centerY: 0.45,
    outerRadius: 0.37,
  },
  payload: {
    concepts: [
      { id: "freedom", label: { en: "Freedom", pt: "Liberdade" } },
      { id: "totality", label: { en: "Totality", pt: "Totalidade" } },
      { id: "fidelity", label: { en: "Fidelity", pt: "Fidelidade" } },
      { id: "fruitfulness", label: { en: "Fruitfulness", pt: "Fecundidade" } },
      { id: "grace", label: { en: "Grace", pt: "Graça" } },
    ],
    sectors: 12,
    solution: "shared-rotation",
  },
});
