const asset = (name) => new URL(`../../assets/minigames/a7/${name}`, import.meta.url).href;
const baseImage = asset("a7-restoration.webp");
const completionLayer = asset("a7-shard-completion.png");
const freedomLayer = asset("a7-shard-freedom.png");
const promiseLayer = asset("a7-shard-promise.png");
const tendernessLayer = asset("a7-shard-tenderness.png");
const trustLayer = asset("a7-shard-trust.png");
const completionMask = asset("a7-mask-completion.png");
const freedomMask = asset("a7-mask-freedom.png");
const promiseMask = asset("a7-mask-promise.png");
const tendernessMask = asset("a7-mask-tenderness.png");
const trustMask = asset("a7-mask-trust.png");

export const A7_FIXTURE_ID = "A7";
export const A7_ENGINE_ID = "A7";
export const A7_ENGINE_VERSION = "1.0.0";

const localized = (en, pt) => ({ en, pt });

export const a7Fixture = Object.freeze({
  id: A7_FIXTURE_ID,
  questionNumber: 68,
  missionSlot: 3,
  engineId: A7_ENGINE_ID,
  engineVersion: A7_ENGINE_VERSION,
  seed: "love-forever-68-a7-v1",
  mode: "lab",
  xp: 0,
  title: localized("Restore the whole person", "Restaure a pessoa inteira"),
  prompt: localized(
    "Place the five shards—trust, promise, tenderness, freedom, and completion—into their matching silhouettes. Drag a shard into place, or tap a shard and then its place.",
    "Coloque os cinco fragmentos — confiança, promessa, ternura, liberdade e plenitude — nas silhuetas correspondentes. Arraste um fragmento até o lugar ou toque no fragmento e depois no seu lugar.",
  ),
  insight: localized(
    "Love receives the whole person. Trust, tenderness, freedom, and a definitive promise belong together in complete self-gift.",
    "O amor acolhe a pessoa inteira. Confiança, ternura, liberdade e uma promessa definitiva caminham juntas no dom completo de si.",
  ),
  assets: {
    baseImage,
    layers: [trustLayer, promiseLayer, tendernessLayer, freedomLayer, completionLayer],
    masks: [trustMask, promiseMask, tendernessMask, freedomMask, completionMask],
  },
  layoutOverrides: {
    pane: { x: 0.5, y: 0.33, scale: 0.68 },
    trayY: 0.87,
  },
  payload: {
    concepts: [
      { id: "trust", label: localized("Trust", "Confiança"), polygon: [[0, 0], [0.55, 0], [0.42, 0.35], [0, 0.42]] },
      { id: "promise", label: localized("Promise", "Promessa"), polygon: [[0.55, 0], [1, 0], [1, 0.38], [0.68, 0.42], [0.42, 0.35]] },
      { id: "tenderness", label: localized("Tenderness", "Ternura"), polygon: [[0, 0.42], [0.42, 0.35], [0.68, 0.42], [0.58, 0.65], [0.18, 0.72], [0, 0.62]] },
      { id: "freedom", label: localized("Freedom", "Liberdade"), polygon: [[0, 0.62], [0.18, 0.72], [0.58, 0.65], [0.52, 1], [0, 1]] },
      { id: "completion", label: localized("Completion", "Plenitude"), polygon: [[0.58, 0.65], [0.68, 0.42], [1, 0.38], [1, 1], [0.52, 1]] },
    ],
    reflection: localized(
      "Which of these helps you receive another person as a whole, rather than testing only one part?",
      "Qual destes elementos ajuda você a acolher a outra pessoa por inteiro, em vez de testar apenas uma parte?",
    ),
    snapTolerance: 0.12,
  },
});
