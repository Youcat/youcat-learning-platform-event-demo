import { assertGameInstance, GameContractError } from "./contracts.js";
import { createMinigamePersistence } from "./persistence.js";
import { createResultAdapter } from "./result-adapter.js";
import { loadPhaserRuntime } from "./runtime.js";

const copy = {
  en: { back: "Back", lab: "Game Lab", hint: "Hint", hintLeft: "hint left", hintsLeft: "hints left", check: "Check", reset: "Reset", replay: "Replay", controls: "Accessible controls", loading: "Loading game…", submitted: "Mission submitted", locked: "This mission already has its one submission.", invalid: "That move is not available. Your progress is unchanged.", ringMoved: "Band moved to the selected mark." },
  pt: { back: "Voltar", lab: "Laboratório de Jogos", hint: "Dica", hintLeft: "dica restante", hintsLeft: "dicas restantes", check: "Verificar", reset: "Reiniciar", replay: "Jogar novamente", controls: "Controles acessíveis", loading: "Carregando jogo…", submitted: "Missão enviada", locked: "Esta missão já recebeu sua única resposta.", invalid: "Esse movimento não está disponível. Seu progresso não mudou.", ringMoved: "Faixa movida para a marca escolhida." },
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
}) {
  assertGameInstance(instance);
  const locale = language === "en" ? "en" : "pt";
  const engine = registry.resolve(instance, { allowNonProduction: instance.mode === "lab" });
  validateEnginePayload(engine, instance);
  const saved = persistence.load(instance);
  let hintsUsed = Math.max(0, Math.min(2, Number(saved?.hintsUsed) || 0));
  let submitted = Boolean(saved?.submitted);
  let resultShown = instance.mode === "mission" && submitted;
  let scene = null;
  let game = null;
  let destroyed = false;
  const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const adaptResult = createResultAdapter({ onLabResult: onResult, onMissionResult: onResult });

  document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  mount.innerHTML = `<main class="minigame-stage-shell ${reducedMotion ? "is-reduced-motion" : ""}" data-minigame-mode="${instance.mode}" data-minigame-engine="${escapeHtml(instance.engineId)}">
    <header class="minigame-stage-header">
      <button type="button" class="minigame-back" data-stage-action="close">← ${copy[locale].back}</button>
      <p>${instance.mode === "lab" ? copy[locale].lab : `YOUCAT Love Forever ${instance.questionNumber}`}</p>
      <span>${instance.mode === "lab" ? "LAB" : `${instance.xp} XP`}</span>
    </header>
    <section class="minigame-stage-copy" aria-labelledby="minigame-title">
      <h1 id="minigame-title">${escapeHtml(tr(instance.title, locale))}</h1>
      <p id="minigame-prompt">${escapeHtml(tr(instance.prompt, locale))}</p>
    </section>
    <section class="minigame-canvas-region" aria-label="${escapeHtml(tr(instance.title, locale))}">
      <div class="minigame-loading" data-stage-loading role="status">${copy[locale].loading}</div>
      <div class="minigame-canvas-host" data-stage-canvas></div>
    </section>
    <section class="minigame-access-panel" aria-labelledby="minigame-access-title">
      <h2 id="minigame-access-title">${copy[locale].controls}</h2>
      <div class="minigame-access-actions" data-stage-access></div>
      <p class="minigame-engine-status" data-stage-engine-status role="status" aria-live="polite"></p>
    </section>
    <footer class="minigame-stage-controls">
      <div class="minigame-secondary-controls">
        ${instance.mode === "lab" ? `<button type="button" data-stage-action="reset">↺ ${copy[locale].reset}</button><button type="button" data-stage-action="replay">${copy[locale].replay}</button>` : ""}
        <button type="button" data-stage-action="hint">${copy[locale].hint} · <span data-stage-hints>${2 - hintsUsed}</span> <span data-stage-hint-label>${2 - hintsUsed === 1 ? copy[locale].hintLeft : copy[locale].hintsLeft}</span></button>
      </div>
      <button type="button" class="minigame-check" data-stage-action="check" ${instance.mode === "mission" && submitted ? "disabled" : ""}>${instance.mode === "mission" && submitted ? copy[locale].submitted : copy[locale].check}</button>
      <p class="minigame-feedback" data-stage-feedback role="status" aria-live="polite">${instance.mode === "mission" && submitted ? copy[locale].locked : ""}</p>
      <p class="minigame-insight" data-stage-insight ${resultShown ? "" : "hidden"}>${escapeHtml(tr(instance.insight, locale))}</p>
    </footer>
  </main>`;

  const canvasHost = mount.querySelector("[data-stage-canvas]");
  const loading = mount.querySelector("[data-stage-loading]");
  const feedback = mount.querySelector("[data-stage-feedback]");
  const engineStatus = mount.querySelector("[data-stage-engine-status]");
  const accessPanel = mount.querySelector(".minigame-access-panel");
  const access = mount.querySelector("[data-stage-access]");
  const hintButton = mount.querySelector('[data-stage-action="hint"]');
  const hintCount = mount.querySelector("[data-stage-hints]");
  const hintLabel = mount.querySelector("[data-stage-hint-label]");
  const checkButton = mount.querySelector('[data-stage-action="check"]');
  const insight = mount.querySelector("[data-stage-insight]");

  function persist() {
    if (!scene || destroyed) return;
    persistence.save(instance, { hintsUsed, submitted, engineState: engine.serializeState(scene, instance) });
  }

  function updateHintControl() {
    const remaining = Math.max(0, 2 - hintsUsed);
    hintCount.textContent = String(remaining);
    hintLabel.textContent = remaining === 1 ? copy[locale].hintLeft : copy[locale].hintsLeft;
    hintButton.disabled = remaining === 0 || (instance.mode === "mission" && submitted);
  }

  function renderEngineStatus() {
    if (resultShown) return;
    engineStatus.textContent = currentEngineStatus(scene, locale);
    engineStatus.dataset.state = currentEngineTone(scene);
  }

  function reportEngineFeedback(message) {
    resultShown = false;
    engineStatus.textContent = tr(message, locale);
    engineStatus.dataset.state = "";
  }

  function renderAccessibleActions() {
    access.replaceChildren();
    const actions = engine.getAccessibleActions(scene, instance) || [];
    accessPanel.hidden = actions.length === 0;
    actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tr(action.label, locale);
      button.disabled = Boolean(action.disabled) || (instance.mode === "mission" && submitted);
      button.addEventListener("click", () => {
        action.run();
        persist();
        renderAccessibleActions();
        renderEngineStatus();
      });
      access.append(button);
    });
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
      renderAccessibleActions();
      renderEngineStatus();
    },
    onReady: (readyScene) => {
      scene = readyScene;
      loading.hidden = true;
      scene.setLocked?.(instance.mode === "mission" && submitted);
      if (instance.mode === "mission" && submitted) scene.revealSolution?.();
      renderAccessibleActions();
      renderEngineStatus();
      persist();
    },
    onFeedback: reportEngineFeedback,
  });
  engine.restoreState(scene, saved?.engineState || null, instance);
  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: canvasHost,
    width: 360,
    height: 350,
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
      feedback.textContent = copy[locale].locked;
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
      checkButton.textContent = copy[locale].submitted;
    }
    renderAccessibleActions();
    updateHintControl();
    persist();
    await adaptResult(instance, evaluation, { hintsUsed });
  }

  function reset() {
    if (instance.mode !== "lab") return;
    persistence.clear(instance);
    hintsUsed = 0;
    submitted = false;
    resultShown = false;
    engine.restoreState(scene, null, instance);
    scene.setLocked?.(false);
    feedback.textContent = "";
    feedback.dataset.state = "";
    engineStatus.textContent = "";
    engineStatus.dataset.state = "";
    insight.hidden = true;
    checkButton.disabled = false;
    checkButton.textContent = copy[locale].check;
    updateHintControl();
    renderAccessibleActions();
    renderEngineStatus();
    persist();
  }

  async function handleStageClick(event) {
    const button = event.target.closest("[data-stage-action]");
    if (!button) return;
    const action = button.dataset.stageAction;
    if (action === "check") await submit();
    if (action === "hint" && hintsUsed < 2 && !(instance.mode === "mission" && submitted)) {
      resultShown = false;
      const message = engine.showHint(scene, hintsUsed, instance);
      hintsUsed += 1;
      feedback.textContent = tr(message, locale);
      feedback.dataset.state = "";
      updateHintControl();
      renderAccessibleActions();
      persist();
    }
    if (action === "reset" || action === "replay") reset();
    if (action === "close") onClose?.();
  }

  mount.addEventListener("click", handleStageClick);
  updateHintControl();

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
