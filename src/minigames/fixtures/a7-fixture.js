const asset = (name) => new URL(`../../assets/minigames/a7/${name}`, import.meta.url).href;
const baseImage = asset("a7-restoration.webp");

export const A7_FIXTURE_ID = "A7";
export const A7_ENGINE_ID = "A7";
export const A7_ENGINE_VERSION = "1.0.0";

const localized = (en, pt) => ({ en, pt });
const shard = (id) => asset(`a7-shard-${id}.png`);
const mask = (id) => asset(`a7-mask-${id}.png`);

const concepts = [
  { id: "trust", label: localized("Trust", "Confiança"), polygon: [[0, 0], [0.378, 0], [0.431, 0.22], [0.248, 0.369], [0, 0.339]] },
  { id: "promise", label: localized("Promise", "Promessa"), polygon: [[0.378, 0], [0.679, 0], [0.72, 0.241], [0.431, 0.22]] },
  { id: "tenderness", label: localized("Tenderness", "Ternura"), polygon: [[0.679, 0], [1, 0], [1, 0.351], [0.72, 0.241]] },
  { id: "freedom", label: localized("Freedom", "Liberdade"), polygon: [[0, 0.339], [0.248, 0.369], [0.431, 0.22], [0.549, 0.47], [0.321, 0.619], [0, 0.56]] },
  { id: "truth", label: localized("Truth", "Verdade"), polygon: [[0.431, 0.22], [0.72, 0.241], [0.679, 0.521], [0.549, 0.47]] },
  { id: "covenant", label: localized("Covenant", "Aliança"), polygon: [[0.72, 0.241], [1, 0.351], [1, 0.679], [0.65, 0.649], [0.679, 0.521]] },
  { id: "wholeness", label: localized("Wholeness", "Totalidade"), polygon: [[0, 0.56], [0.321, 0.619], [0.549, 0.47], [0.679, 0.521], [0.65, 0.649], [1, 0.679], [1, 1], [0, 1]] },
];

export const a7Fixture = Object.freeze({
  id: A7_FIXTURE_ID,
  questionNumber: 68,
  missionSlot: 3,
  engineId: A7_ENGINE_ID,
  engineVersion: A7_ENGINE_VERSION,
  seed: "love-forever-68-a7-v2",
  mode: "lab",
  xp: 0,
  title: localized("Restore the relationship", "Restaure a relação"),
  prompt: localized(
    "Study the picture. Then rebuild it from seven fragments inside the rectangular frame.",
    "Observe a imagem. Depois, reconstrua-a com sete fragmentos dentro do quadro retangular.",
  ),
  insight: localized(
    "Love is not assembled from isolated virtues. In a covenant, truth, trust, tenderness, freedom, promise, and wholeness receive the other person as a gift.",
    "O amor não se constrói com virtudes isoladas. Numa aliança, verdade, confiança, ternura, liberdade, promessa e totalidade acolhem a outra pessoa como dom.",
  ),
  assets: {
    baseImage,
    layers: concepts.map((concept) => shard(concept.id)),
    masks: concepts.map((concept) => mask(concept.id)),
  },
  layoutOverrides: {
    pane: { x: 0.5, y: 0.33, scale: 0.68 },
    trayY: 0.84,
    showSecondaryControls: false,
  },
  payload: {
    concepts,
    conclusion: localized(
      "The restoration points beyond a task: faithful love receives the other person whole. It is a free covenant in which truth and tenderness belong together.",
      "A restauração aponta para mais do que uma tarefa: o amor fiel acolhe a outra pessoa por inteiro. É uma aliança livre, em que verdade e ternura caminham juntas.",
    ),
    snapTolerance: 0.045,
  },
});
