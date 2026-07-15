const treeBaseImage = new URL("../../assets/minigames/a2/prune-tree-base.png", import.meta.url).href;

export const A2_ENGINE_ID = "A2";
export const A2_ENGINE_VERSION = "1.0.0";
export const A2_FIXTURE_ID = "A2";
export const A2_MISSION_DEFINITION_ID = "a2-q34-slot1";

export const A2_CONCEPTS = Object.freeze([
  { id: "plan", label: { en: "Plan", pt: "Plano" }, expected: "keep" },
  { id: "friend", label: { en: "Friend", pt: "Amigo" }, expected: "keep" },
  { id: "prayer", label: { en: "Prayer", pt: "Oração" }, expected: "keep" },
  { id: "filter", label: { en: "Filter", pt: "Filtro" }, expected: "keep" },
  { id: "begin-again", label: { en: "Begin again", pt: "Recomeçar" }, expected: "keep" },
  { id: "trigger-loops", label: { en: "Trigger loops", pt: "Ciclos de gatilho" }, expected: "prune" },
  { id: "isolation", label: { en: "Isolation", pt: "Isolamento" }, expected: "prune" },
  { id: "secrecy", label: { en: "Secrecy", pt: "Segredo" }, expected: "prune" },
  { id: "passivity", label: { en: "Passivity", pt: "Passividade" }, expected: "prune" },
  { id: "despair", label: { en: "Despair", pt: "Desespero" }, expected: "prune" },
]);

const sharedDefinition = {
  questionNumber: 34,
  missionSlot: 1,
  engineId: A2_ENGINE_ID,
  engineVersion: A2_ENGINE_VERSION,
  seed: "assis-a2-prune-love-001",
  xp: 9,
  title: {
    en: "Prune what chokes love",
    pt: "Pode o que sufoca o amor",
  },
  prompt: {
    en: "Drag each leaf to Keep or Prune. Keep what opens freedom; prune what feeds isolation or defeat. You can also tap a leaf, then a target.",
    pt: "Arraste cada folha para Manter ou Podar. Mantenha o que abre à liberdade; pode o que alimenta isolamento ou derrota. Também pode tocar numa folha e depois num alvo.",
  },
  insight: {
    en: "Freedom grows through a concrete plan, friendship, prayer, wise filters, and the courage to begin again. Trigger loops, isolation, secrecy, passivity, and despair choke it.",
    pt: "A liberdade cresce com um plano concreto, amizade, oração, filtros prudentes e a coragem de recomeçar. Ciclos de gatilho, isolamento, segredo, passividade e desespero a sufocam.",
  },
  assets: { baseImage: treeBaseImage, layers: [], masks: [] },
  layoutOverrides: {},
  payload: {
    concepts: A2_CONCEPTS,
    targets: {
      keep: { x: 0.24, y: 0.9 },
      prune: { x: 0.76, y: 0.9 },
    },
  },
};

export const a2Fixture = Object.freeze({
  id: A2_FIXTURE_ID,
  ...sharedDefinition,
  mode: "lab",
  xp: 0,
});

export const a2MissionDefinition = Object.freeze({
  id: A2_MISSION_DEFINITION_ID,
  ...sharedDefinition,
  mode: "mission",
});
