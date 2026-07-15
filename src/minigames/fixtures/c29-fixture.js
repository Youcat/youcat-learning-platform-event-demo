const loveRemainsImage = new URL("../../assets/minigames/c29/love-remains.webp", import.meta.url).href;
const loveMaturesImage = new URL("../../assets/minigames/c29/love-matures.webp", import.meta.url).href;

export const C29_FIXTURE_ID = "C29";

export const c29Fixture = Object.freeze({
  id: C29_FIXTURE_ID,
  questionNumber: 3,
  missionSlot: 1,
  engineId: "C29",
  engineVersion: "1.0.0",
  seed: "mirror-of-truth-q3-v1",
  mode: "lab",
  xp: 8,
  title: {
    en: "Mirror of Truth",
    pt: "Espelho da Verdade",
  },
  prompt: {
    en: "Clear all six fog patches. Then drag each truthful clarification to the distortion it repairs. You can also tap a tool, then its target.",
    pt: "Limpe as seis manchas de névoa. Depois, arraste cada esclarecimento verdadeiro até a distorção que ele corrige. Você também pode tocar numa ferramenta e depois no alvo.",
  },
  insight: {
    en: "Mature love sees a real person, not an ideal. Feelings can change while truthful care and fidelity deepen.",
    pt: "O amor maduro vê uma pessoa real, não um ideal. Os sentimentos podem mudar enquanto o cuidado verdadeiro e a fidelidade se aprofundam.",
  },
  assets: {
    baseImage: null,
    layers: [loveRemainsImage, loveMaturesImage],
    masks: [],
  },
  layoutOverrides: {
    mirrorInset: 14,
  },
  payload: {
    fogPatchCount: 3,
    distortions: [
      {
        id: "idealisation",
        label: {
          en: "Idealisation hides limits and disappointments.",
          pt: "A idealização esconde limites e decepções.",
        },
        clarificationId: "reality",
      },
      {
        id: "fading-feeling",
        label: {
          en: "Lower intensity is treated as proof that love ended.",
          pt: "A menor intensidade é tratada como prova de que o amor acabou.",
        },
        clarificationId: "maturing-love",
      },
    ],
    clarifications: [
      {
        id: "reality",
        label: {
          en: "Reality: love sees the real person and seeks their good.",
          pt: "Realidade: o amor vê a pessoa real e procura o seu bem.",
        },
      },
      {
        id: "maturing-love",
        label: {
          en: "Maturing love: feelings change; care and fidelity can deepen.",
          pt: "Amor maduro: os sentimentos mudam; o cuidado e a fidelidade podem crescer.",
        },
      },
    ],
  },
});
