import { assertGameInstance, GameContractError } from "./contracts.js";
import { createMinigamePersistence } from "./persistence.js";
import { createResultAdapter } from "./result-adapter.js";
import { loadPhaserRuntime } from "./runtime.js";

const copy = {
  en: { back: "Back", lab: "Game Lab", check: "Check", finishChallenge: "Finish challenge", loading: "Loading game…", challengeFinished: "Challenge completed", challengeLocked: "This challenge already has its one submission.", invalid: "That move is not available. Your progress is unchanged.", ringMoved: "Band moved to the selected mark." },
  pt: { back: "Voltar", lab: "Laboratório de Jogos", check: "Verificar", finishChallenge: "Concluir desafio", loading: "Carregando jogo…", challengeFinished: "Desafio concluído", challengeLocked: "Este desafio já recebeu sua única tentativa.", invalid: "Esse movimento não está disponível. Seu progresso não mudou.", ringMoved: "Faixa movida para a marca escolhida." },
};

function tr(value, language) {
  return typeof value === "string" ? value : value?.[language] ?? value?.en ?? value?.pt ?? "";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function validateEnginePayload(engine, instance) {
  const result = engine.validate(instance.payload, instance);
  if (result === true || result?.ok === true) return;
  throw new GameContractError("Engine rejected GameInstance payload", result?.errors || []);
}

function currentEngineStatus(scene, locale) {
  const direct = scene?.accessibleFeedback
    || scene?.accessibleStatus
    || scene?.minigameStatus
    || scene?.c20State?.notice
    || scene?.wellspringState?.interactionMessage;
  if (tr(direct, locale)) return tr(direct, locale);
  if (scene?.c29State?.lastEvent === "wrong-mirror" || scene?.c29State?.lastEvent === "fog-blocks-repair") return copy[locale].invalid;
  if (scene?.covenantState?.statusCode === "invalid") return copy[locale].invalid;
  if (scene?.covenantState?.statusCode === "target") return copy[locale].ringMoved;
  return "";
}

function currentEngineTone(scene) {
  if (scene?.accessibleFeedbackTone || scene?.accessibleFeedbackState) return scene.accessibleFeedbackTone || scene.accessibleFeedbackState;
  if (["wrong-mirror", "fog-blocks-repair"].includes(scene?.c29State?.lastEvent)) return "wrong";
  if (scene?.covenantState?.statusCode === "invalid") return "wrong";
  return "";
}

export function submissionAllowed(instance, submitted) {
  return instance?.mode !== "mission" || !submitted;
}

export function nextSubmissionState({ mode, submitted }) {
  if (mode === "mission" && submitted) return { accepted: false, submitted: true };
  return { accepted: true, submitted: mode === "mission" ? true : Boolean(submitted) };
}

export async function launchGameStage({
  mount,
  instance,
  registry,
  language = "pt",
  persistence = createMinigamePersistence(),
  onResult,
  onClose,
  embedded = false,
}) {
  assertGameInstance(instance);
  const locale = language === "en" ? "en" : "pt";
  const engine = registry.resolve(instance, { allowNonProduction: instance.mode === "lab" });
  validateEnginePayload(engine, instance);
  const canvasSize = engine.canvasSize || { width: 360, height: 350 };
  const saved = persistence.load(instance);
  const hintsUsed = 0;
  let submitted = Boolean(saved?.submitted);
  let resultShown = instance.mode === "mission" && submitted;
  let scene = null;
  let game = null;
  let destroyed = false;
  let automaticSubmissionPending = false;
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const adaptResult = createResultAdapter({ onLabResult: onResult, onMissionResult: onResult });

  document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  mount.innerHTML = `<main class="minigame-stage-shell ${embedded ? "is-embedded" : ""} ${reducedMotion ? "is-reduced-motion" : ""}" data-minigame-mode="${instance.mode}" data-minigame-engine="${escapeHtml(instance.engineId)}">
    ${embedded ? "" : `<header class="minigame-stage-header">
      <button type="button" class="minigame-back" data-stage-action="close">← ${copy[locale].back}</button>
      <p>${instance.mode === "lab" ? copy[locale].lab : `YOUCAT Love Forever ${instance.questionNumber}`}</p>
      <span>${instance.mode === "lab" ? "LAB" : `${instance.xp} XP`}</span>
    </header>
    <section class="minigame-stage-copy" aria-labelledby="minigame-title">
      <h1 id="minigame-title">${escapeHtml(tr(instance.title, locale))}</h1>
      <p id="minigame-prompt">${escapeHtml(tr(instance.prompt, locale))}</p>
    </section>`}
    <section class="minigame-canvas-region" aria-label="${escapeHtml(tr(instance.title, locale))}">
      ${embedded ? `<p id="minigame-prompt" class="sr-only">${escapeHtml(tr(instance.prompt, locale))}</p>` : ""}
      <div class="minigame-loading" data-stage-loading role="status">${copy[locale].loading}</div>
      <div class="minigame-canvas-host" data-stage-canvas></div>
    </section>
    <footer class="minigame-stage-controls">
      <button type="button" class="minigame-check" data-stage-action="check" ${instance.mode === "mission" && submitted ? "disabled" : ""}>${instance.mode === "mission" && submitted ? copy[locale].challengeFinished : instance.mode === "mission" ? copy[locale].finishChallenge : copy[locale].check}</button>
      <p class="minigame-feedback" data-stage-feedback role="status" aria-live="polite">${instance.mode === "mission" && submitted ? copy[locale].challengeLocked : ""}</p>
      <p class="minigame-insight" data-stage-insight ${resultShown ? "" : "hidden"}>${escapeHtml(tr(instance.insight, locale))}</p>
    </footer>
  </main>`;

  const canvasHost = mount.querySelector("[data-stage-canvas]");
  const loading = mount.querySelector("[data-stage-loading]");
  const feedback = mount.querySelector("[data-stage-feedback]");
  const checkButton = mount.querySelector('[data-stage-action="check"]');
  const insight = mount.querySelector("[data-stage-insight]");

  function persist() {
    if (!scene || destroyed) return;
    persistence.save(instance, { hintsUsed, submitted, engineState: engine.serializeState(scene, instance) });
  }

  function renderEngineStatus() {
    if (resultShown) return;
    feedback.textContent = currentEngineStatus(scene, locale);
    feedback.dataset.state = currentEngineTone(scene);
  }

  function reportEngineFeedback(message) {
    resultShown = false;
    feedback.textContent = tr(message, locale);
    feedback.dataset.state = "";
  }

  const Phaser = await loadPhaserRuntime();
  if (destroyed) return { destroy() {} };
  scene = engine.createScene({
    Phaser,
    instance,
    language: locale,
    reducedMotion,
    onStateChange: (changedScene) => {
      if (changedScene) scene = changedScene;
      persist();
      renderEngineStatus();
      if (
        instance.mode === "mission"
        && !submitted
        && !automaticSubmissionPending
        && engine.shouldAutoSubmit?.(scene, instance)
      ) {
        automaticSubmissionPending = true;
        void submit().finally(() => { automaticSubmissionPending = false; });
      }
    },
    onReady: (readyScene) => {
      scene = readyScene;
      loading.hidden = true;
      scene.setLocked?.(instance.mode === "mission" && submitted);
      if (instance.mode === "mission" && submitted) scene.revealSolution?.();
      renderEngineStatus();
      persist();
    },
    onFeedback: reportEngineFeedback,
  });
  engine.restoreState(scene, saved?.engineState || null, instance);
  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: canvasHost,
    width: canvasSize.width,
    height: canvasSize.height,
    backgroundColor: "#ffffff",
    audio: { noAudio: true },
    banner: false,
    render: { antialias: true, roundPixels: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
  });
  const canvas = game.canvas || canvasHost.querySelector("canvas");
  if (canvas) {
    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    if (!canvas.hasAttribute("role")) canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-describedby", "minigame-prompt");
    if (!canvas.hasAttribute("aria-label")) canvas.setAttribute("aria-label", `${tr(instance.title, locale)}. ${tr(instance.prompt, locale)}`);
  }

  async function submit() {
    const submission = nextSubmissionState({ mode: instance.mode, submitted });
    if (!submission.accepted) {
      feedback.textContent = copy[locale].challengeLocked;
      return;
    }
    submitted = submission.submitted;
    const evaluation = engine.evaluate(scene, instance);
    resultShown = true;
    feedback.textContent = tr(evaluation.feedback, locale);
    feedback.dataset.state = evaluation.correct && evaluation.complete ? "correct" : "wrong";
    insight.hidden = !(instance.mode === "mission" || (evaluation.correct && evaluation.complete));
    if (instance.mode === "mission") {
      scene.setLocked?.(true);
      scene.revealSolution?.();
      checkButton.disabled = true;
      checkButton.textContent = copy[locale].challengeFinished;
    }
    persist();
    await adaptResult(instance, evaluation, { hintsUsed });
  }

  async function handleStageClick(event) {
    const button = event.target.closest("[data-stage-action]");
    if (!button) return;
    const action = button.dataset.stageAction;
    if (action === "check") await submit();
    if (action === "close") onClose?.();
  }

  mount.addEventListener("click", handleStageClick);

  return {
    destroy() {
      if (destroyed) return;
      persist();
      destroyed = true;
      mount.removeEventListener("click", handleStageClick);
      engine.destroy(scene, instance);
      game?.destroy(true);
      mount.replaceChildren();
    },
  };
}
