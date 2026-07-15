const earAsset = new URL("../../assets/minigames/a4/ear.webp", import.meta.url).href;
const bookAsset = new URL("../../assets/minigames/a4/book.webp", import.meta.url).href;
const gateAsset = new URL("../../assets/minigames/a4/gate.webp", import.meta.url).href;
const compassAsset = new URL("../../assets/minigames/a4/compass.webp", import.meta.url).href;
const fruitAsset = new URL("../../assets/minigames/a4/fruit.webp", import.meta.url).href;

export const A4_FIXTURE_ID = "A4";

const definition = {
  id: A4_FIXTURE_ID,
  questionNumber: 25,
  missionSlot: 3,
  engineId: "A4",
  engineVersion: "1.0.0",
  seed: "assis-q25-living-symbols-v1",
  mode: "lab",
  xp: 10,
  title: {
    en: "Living Symbols",
    pt: "Símbolos vivos",
  },
  prompt: {
    en: "Place each symbol where it becomes part of healthy spiritual accompaniment. Drag it, or select a symbol and then a scene.",
    pt: "Coloque cada símbolo onde ele se torna parte de um acompanhamento espiritual saudável. Arraste-o ou selecione um símbolo e depois uma cena.",
  },
  insight: {
    en: "A good guide listens, opens life to the Gospel, protects freedom, serves a person’s vocation, and helps test the fruits over time.",
    pt: "Um bom orientador escuta, abre a vida ao Evangelho, protege a liberdade, serve à vocação da pessoa e ajuda a reconhecer os frutos ao longo do tempo.",
  },
  assets: {
    baseImage: null,
    layers: [earAsset, bookAsset, gateAsset, compassAsset, fruitAsset],
    masks: [],
  },
  layoutOverrides: { objectScale: 1 },
  payload: {
    objectIds: ["ear", "book", "gate", "compass", "fruit"],
    zoneIds: ["story", "light", "path", "crossroads", "harvest"],
    solution: {
      ear: "story",
      book: "light",
      gate: "path",
      compass: "crossroads",
      fruit: "harvest",
    },
  },
};

export const a4Fixture = Object.freeze(definition);

export const a4MissionDefinition = Object.freeze({
  ...definition,
  id: "a4-q25-mission-slot-3",
  mode: "mission",
});
