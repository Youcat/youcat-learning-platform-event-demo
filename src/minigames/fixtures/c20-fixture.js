const t = (en, pt) => ({ en, pt });

export const C20_FIXTURE_ID = "C20";
export const C20_ENGINE_ID = "C20";
export const C20_ENGINE_VERSION = "1.0.0";

export const C20_SAFE_PAYLOAD = {
  schemaVersion: 1,
  stages: [
    {
      id: "pressure",
      title: t("Practical pressure", "Pressão prática"),
      options: [
        {
          id: "make-room",
          label: t("Create practical breathing room", "Criar espaço prático para decidir"),
          short: t("Make room", "Criar espaço"),
          outcome: "acceptable",
          debrief: t("", ""),
        },
        {
          id: "name-pressure",
          label: t("Name the pressure together", "Nomear juntos a pressão"),
          short: t("Name pressure", "Nomear pressão"),
          outcome: "acceptable",
          debrief: t("", ""),
        },
        {
          id: "move-now",
          label: t("Move in now because costs are rising", "Morar juntos agora porque os custos aumentaram"),
          short: t("Move now", "Mudar já"),
          outcome: "harmful",
          debrief: t(
            "The financial pressure is real, but moving first lets urgency decide the relationship. Seek a practical alternative that protects freedom.",
            "A pressão financeira é real, mas mudar primeiro deixa a urgência decidir a relação. Busquem uma alternativa prática que proteja a liberdade.",
          ),
        },
      ],
    },
    {
      id: "discernment",
      title: t("Discernment", "Discernimento"),
      options: [
        {
          id: "seek-counsel",
          label: t("Discern readiness with wise counsel", "Discernir a preparação com um bom conselho"),
          short: t("Seek counsel", "Buscar conselho"),
          outcome: "acceptable",
          debrief: t("", ""),
        },
        {
          id: "set-decision",
          label: t("Set a clear and free decision point", "Definir um momento claro e livre para decidir"),
          short: t("Set decision", "Definir decisão"),
          outcome: "acceptable",
          debrief: t("", ""),
        },
        {
          id: "let-drift",
          label: t("Let the living arrangement settle the question", "Deixar que a convivência resolva a questão"),
          short: t("Let it drift", "Deixar levar"),
          outcome: "harmful",
          debrief: t(
            "Momentum can feel like a decision while making freedom harder to see. Discern the relationship before dependence decides it.",
            "O impulso pode parecer uma decisão enquanto torna a liberdade mais difícil de perceber. Discernam a relação antes que a dependência decida.",
          ),
        },
      ],
    },
    {
      id: "covenant",
      title: t("Shared future", "Futuro comum"),
      options: [
        {
          id: "public-covenant",
          label: t("Make a free public covenant, then build the shared home", "Assumir uma aliança pública e livre, depois construir o lar comum"),
          short: t("Public covenant", "Aliança pública"),
          outcome: "acceptable",
          debrief: t("", ""),
        },
        {
          id: "stay-provisional",
          label: t("Keep the arrangement provisional without a decision", "Manter a convivência provisória sem uma decisão"),
          short: t("Stay provisional", "Manter provisório"),
          outcome: "incomplete",
          debrief: t(
            "This route avoids a harmful shortcut, but it never reaches a clear promise. Add a free, public decision about the shared future.",
            "Este caminho evita um atalho prejudicial, mas não chega a uma promessa clara. Acrescentem uma decisão livre e pública sobre o futuro comum.",
          ),
        },
        {
          id: "trial-first",
          label: t("Use shared life as the trial before commitment", "Usar a vida comum como teste antes do compromisso"),
          short: t("Trial first", "Testar primeiro"),
          outcome: "harmful",
          debrief: t(
            "A shared home can deepen bonds and dependence, so it cannot be a neutral trial. Let it express a covenant rather than replace one.",
            "Um lar comum pode aprofundar vínculos e dependência; por isso, não é um teste neutro. Que ele expresse uma aliança, em vez de substituí-la.",
          ),
        },
      ],
    },
  ],
  approvedRoutes: [
    {
      id: "room-counsel-covenant",
      choices: ["make-room", "seek-counsel", "public-covenant"],
      feedback: t(
        "You protected freedom from practical pressure, sought wise counsel, and let the shared home follow a public covenant.",
        "Vocês protegeram a liberdade diante da pressão prática, buscaram um bom conselho e fizeram o lar comum seguir uma aliança pública.",
      ),
    },
    {
      id: "room-decision-covenant",
      choices: ["make-room", "set-decision", "public-covenant"],
      feedback: t(
        "You made room for freedom, set a clear decision point, and placed the public covenant before total shared life.",
        "Vocês criaram espaço para a liberdade, definiram um momento claro de decisão e colocaram a aliança pública antes da vida totalmente comum.",
      ),
    },
    {
      id: "name-counsel-covenant",
      choices: ["name-pressure", "seek-counsel", "public-covenant"],
      feedback: t(
        "You faced the pressure honestly, tested readiness with counsel, and made the shared future publicly accountable.",
        "Vocês enfrentaram a pressão com honestidade, discerniram a preparação com conselho e tornaram público o compromisso com o futuro comum.",
      ),
    },
    {
      id: "name-decision-covenant",
      choices: ["name-pressure", "set-decision", "public-covenant"],
      feedback: t(
        "You named the pressure without obeying it, chose a clear decision point, and crossed through a public covenant.",
        "Vocês nomearam a pressão sem obedecer a ela, escolheram um momento claro de decisão e atravessaram por meio de uma aliança pública.",
      ),
    },
  ],
  feedback: {
    incomplete: t(
      "The route is not complete yet. Choose one decision at each fork before checking.",
      "O caminho ainda não está completo. Escolha uma decisão em cada bifurcação antes de verificar.",
    ),
  },
};

const optimizedArtwork = new URL("../../assets/minigames/c20/choosing-not-drifting-720.webp", import.meta.url).href;

export const c20Fixture = Object.freeze({
  id: C20_FIXTURE_ID,
  questionNumber: 83,
  missionSlot: 1,
  engineId: C20_ENGINE_ID,
  engineVersion: C20_ENGINE_VERSION,
  seed: "assis-c20-river-decisions-001",
  mode: "lab",
  xp: 8,
  title: t("River of Decisions", "Rio das Decisões"),
  prompt: t(
    "Build a route across three forks. Drag a decision to its fork, or tap a decision and then its target. Several careful routes are possible.",
    "Construa um caminho por três bifurcações. Arraste uma decisão até sua etapa ou toque nela e depois no destino. Há vários caminhos prudentes.",
  ),
  insight: t(
    "Practical pressure deserves a practical response, but it should not silently replace free discernment and a public covenant.",
    "A pressão prática merece uma resposta prática, mas não deve substituir silenciosamente o discernimento livre e uma aliança pública.",
  ),
  assets: { baseImage: optimizedArtwork, layers: [], masks: [] },
  layoutOverrides: {},
  payload: C20_SAFE_PAYLOAD,
});
