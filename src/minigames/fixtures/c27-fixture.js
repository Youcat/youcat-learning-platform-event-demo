const prayerFidelityArtwork = new URL("../../assets/minigames/c27/prayer-fidelity.webp", import.meta.url).href;

export const C27_FIXTURE_ID = "C27";

export const c27Fixture = Object.freeze({
  id: C27_FIXTURE_ID,
  questionNumber: 126,
  missionSlot: 0,
  engineId: "C27",
  engineVersion: "1.0.0",
  seed: "love-126-wellspring-v1",
  mode: "lab",
  xp: 0,
  title: { en: "Wellspring", pt: "Nascente" },
  prompt: {
    en: "Guide water to all three fruits. Drag a gate, or tap a gate and then its left or right channel. Check when every fruit is reached.",
    pt: "Conduza a água até os três frutos. Arraste uma comporta ou toque nela e depois no canal esquerdo ou direito. Verifique quando todos forem alcançados.",
  },
  insight: {
    en: "God’s grace strengthens faithful love through prayer, a first step, listening, repair, and beginning again.",
    pt: "A graça de Deus fortalece o amor fiel por meio da oração, do primeiro passo, da escuta, da reparação e de um novo começo.",
  },
  assets: {
    baseImage: prayerFidelityArtwork,
    layers: [],
    masks: [],
  },
  layoutOverrides: {
    canvasHeight: 350,
  },
  payload: {
    schemaVersion: 1,
    gateCount: 5,
    fruitCount: 3,
    concepts: ["prayer", "first-step", "listening", "repair", "attention"],
  },
});

export const c27Activity = Object.freeze({
  type: "minigame",
  fixtureId: C27_FIXTURE_ID,
  engineId: c27Fixture.engineId,
  engineVersion: c27Fixture.engineVersion,
  xp: 8,
  title: c27Fixture.title,
  prompt: c27Fixture.prompt,
  insight: c27Fixture.insight,
});
