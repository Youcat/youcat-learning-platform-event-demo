const ENGINE_STATE_VERSION = 1;
const RING_COUNT = 5;
const DEFAULT_SECTORS = 12;
const TAU = Math.PI * 2;
const INNER_RADII = [0, 28, 52, 77, 103];
const OUTER_RADII = [28, 52, 77, 103, 132];

function localized(en, pt) {
  return { en, pt };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validLocalizedLabel(value) {
  return hasExactKeys(value, ["en", "pt"])
    && ["en", "pt"].every((language) => typeof value[language] === "string" && value[language].trim());
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "C30-fallback")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createC30StartSteps(seed, sectors = DEFAULT_SECTORS) {
  const random = seededRandom(seed);
  const steps = Array.from({ length: RING_COUNT }, () => 1 + Math.floor(random() * (sectors - 1)));
  if (steps.every((step) => step === steps[0])) steps[RING_COUNT - 1] = (steps[0] + Math.floor(sectors / 2)) % sectors;
  return steps;
}

function normalizeStep(value, sectors) {
  const integer = Math.round(Number(value) || 0);
  return ((integer % sectors) + sectors) % sectors;
}

function circularDistance(a, b, sectors) {
  const distance = Math.abs(normalizeStep(a - b, sectors));
  return Math.min(distance, sectors - distance);
}

function mostCommonStep(steps) {
  const counts = new Map();
  for (const step of steps) counts.set(step, (counts.get(step) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

export function isC30Solved(steps) {
  return Array.isArray(steps) && steps.length === RING_COUNT && steps.every((step) => step === steps[0]);
}

function fallbackConcepts() {
  return [
    { id: "freedom", label: localized("Freedom", "Liberdade") },
    { id: "totality", label: localized("Totality", "Totalidade") },
    { id: "fidelity", label: localized("Fidelity", "Fidelidade") },
    { id: "fruitfulness", label: localized("Fruitfulness", "Fecundidade") },
    { id: "grace", label: localized("Grace", "Graça") },
  ];
}

function normalizePayload(payload) {
  const concepts = Array.isArray(payload?.concepts) && payload.concepts.length === RING_COUNT
    ? payload.concepts.map((concept, index) => ({
      id: typeof concept?.id === "string" && concept.id ? concept.id : fallbackConcepts()[index].id,
      label: validLocalizedLabel(concept?.label) ? { ...concept.label } : fallbackConcepts()[index].label,
    }))
    : fallbackConcepts();
  const sectors = Number.isInteger(payload?.sectors) && payload.sectors >= 8 && payload.sectors <= 16
    ? payload.sectors
    : DEFAULT_SECTORS;
  return { sectors, concepts, solution: "shared-rotation" };
}

function layoutFor(instance) {
  const overrides = instance?.layoutOverrides || {};
  return {
    centerX: Number.isFinite(overrides.centerX) ? overrides.centerX : 0.5,
    centerY: Number.isFinite(overrides.centerY) ? overrides.centerY : 0.45,
    outerRadius: Number.isFinite(overrides.outerRadius) ? overrides.outerRadius : 0.37,
  };
}

function cleanSavedState(savedState, initialState, sectors, mode) {
  if (!isRecord(savedState)) return structuredClone(initialState);
  const ringSteps = Array.isArray(savedState.ringSteps)
    && savedState.ringSteps.length === RING_COUNT
    && savedState.ringSteps.every((step) => Number.isInteger(step) && step >= 0 && step < sectors)
    ? [...savedState.ringSteps]
    : [...initialState.ringSteps];
  const selectedRing = Number.isInteger(savedState.selectedRing) && savedState.selectedRing >= 0 && savedState.selectedRing < RING_COUNT
    ? savedState.selectedRing
    : initialState.selectedRing;
  const solutionShown = mode === "mission" && Boolean(savedState.solutionShown);
  return {
    version: ENGINE_STATE_VERSION,
    ringSteps,
    selectedRing,
    tapArmed: Boolean(savedState.tapArmed) && !solutionShown,
    hintLevel: Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0)),
    moveCount: Math.max(0, Math.floor(Number(savedState.moveCount) || 0)),
    completed: Boolean(savedState.completed),
    locked: Boolean(savedState.locked) || solutionShown,
    solutionShown,
    lastCorrect: typeof savedState.lastCorrect === "boolean" ? savedState.lastCorrect : null,
    statusCode: typeof savedState.statusCode === "string" ? savedState.statusCode : "ready",
  };
}

function stateLabel(scene, language) {
  const state = scene.covenantState;
  if (state.solutionShown) return language === "pt" ? "Solução mostrada" : "Solution shown";
  if (state.completed) return language === "pt" ? "Imagem alinhada" : "Image aligned";
  if (state.statusCode === "locked") return language === "pt" ? "A resposta já foi enviada" : "The answer was already submitted";
  if (state.statusCode === "target") return language === "pt" ? "Faixa girada até a marca escolhida" : "Band turned to the chosen mark";
  if (state.statusCode === "invalid") return language === "pt" ? "Esse movimento não é possível" : "That move is not possible";
  if (state.tapArmed) return language === "pt" ? "Agora escolha uma marca na borda" : "Now choose a mark on the rim";
  return language === "pt" ? "Selecione e gire uma faixa" : "Select and turn a band";
}

function conceptLabel(scene, index, language) {
  return scene.covenantPayload.concepts[index]?.label?.[language]
    || scene.covenantPayload.concepts[index]?.label?.en
    || "";
}

export const c30CovenantRingsEngine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!hasExactKeys(payload, ["concepts", "sectors", "solution"])) {
      errors.push("payload must contain exactly {concepts, sectors, solution}");
    }
    if (!Number.isInteger(payload?.sectors) || payload.sectors < 8 || payload.sectors > 16) {
      errors.push("payload.sectors must be an integer from 8 to 16");
    }
    if (payload?.solution !== "shared-rotation") errors.push('payload.solution must be "shared-rotation"');
    if (!Array.isArray(payload?.concepts) || payload.concepts.length !== RING_COUNT) {
      errors.push("payload.concepts must contain exactly five concepts");
    } else {
      const ids = new Set();
      payload.concepts.forEach((concept, index) => {
        if (!hasExactKeys(concept, ["id", "label"])) errors.push(`payload.concepts[${index}] must contain exactly {id, label}`);
        if (typeof concept?.id !== "string" || !concept.id.trim() || ids.has(concept.id)) errors.push(`payload.concepts[${index}].id must be unique and non-empty`);
        ids.add(concept?.id);
        if (!validLocalizedLabel(concept?.label)) errors.push(`payload.concepts[${index}].label must contain exactly non-empty {en, pt}`);
      });
    }
    if (!instance?.assets?.baseImage) errors.push("assets.baseImage is required");
    if (!hasExactKeys(instance?.layoutOverrides, ["centerX", "centerY", "outerRadius"])) {
      errors.push("layoutOverrides must contain exactly {centerX, centerY, outerRadius}");
    } else {
      for (const key of ["centerX", "centerY", "outerRadius"]) {
        if (!Number.isFinite(instance.layoutOverrides[key]) || instance.layoutOverrides[key] <= 0 || instance.layoutOverrides[key] >= 1) {
          errors.push(`layoutOverrides.${key} must be between 0 and 1`);
        }
      }
    }
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const payload = normalizePayload(instance.payload);
    const layout = layoutFor(instance);
    const assetKey = `c30-source-${hashSeed(instance.id)}`;
    const textureKeys = Array.from({ length: RING_COUNT }, (_, index) => `${assetKey}-ring-${index}`);
    const initialState = {
      version: ENGINE_STATE_VERSION,
      ringSteps: createC30StartSteps(instance.seed, payload.sectors),
      selectedRing: 2,
      tapArmed: false,
      hintLevel: 0,
      moveCount: 0,
      completed: false,
      locked: false,
      solutionShown: false,
      lastCorrect: null,
      statusCode: "ready",
    };

    class CovenantRingsScene extends Phaser.Scene {
      constructor() {
        super({ key: `c30-${hashSeed(instance.id)}` });
        this.covenantPayload = payload;
        this.covenantInitialState = structuredClone(initialState);
        this.covenantState = structuredClone(initialState);
        this.covenantLanguage = language;
        this.covenantReducedMotion = reducedMotion;
        this.covenantImages = [];
        this.covenantTextureKeys = textureKeys;
        this.covenantPointer = null;
      }

      preload() {
        this.load.image(assetKey, instance.assets.baseImage);
      }

      create() {
        const width = this.scale.width;
        const height = this.scale.height;
        this.covenantCenter = { x: width * layout.centerX, y: height * layout.centerY };
        this.covenantOuterRadius = Math.min(132, width * layout.outerRadius, height * 0.39);
        this.covenantScale = this.covenantOuterRadius / OUTER_RADII.at(-1);
        this.covenantGraphics = this.add.graphics();
        this.createRingTextures(assetKey);
        this.covenantSelectedText = this.add.text(width / 2, height - 35, "", {
          fontFamily: '"Fira Sans", sans-serif',
          fontSize: "15px",
          fontStyle: "600",
          color: "#22201d",
          align: "center",
        }).setOrigin(0.5);
        this.covenantStatusText = this.add.text(width / 2, height - 14, "", {
          fontFamily: '"Fira Sans", sans-serif',
          fontSize: "12px",
          color: "#6f6a61",
          align: "center",
        }).setOrigin(0.5);
        this.input.on("pointerdown", this.handlePointerDown, this);
        this.input.on("pointermove", this.handlePointerMove, this);
        this.input.on("pointerup", this.handlePointerUp, this);
        this.input.on("pointerupoutside", this.handlePointerUp, this);
        this.installKeyboard();
        this.redraw();
        onReady(this);
      }

      createRingTextures(sourceKey) {
        const source = this.textures.get(sourceKey).getSourceImage();
        const size = Math.min(source.width, source.height);
        const sourceX = (source.width - size) / 2;
        const sourceY = (source.height - size) / 2;
        const center = size / 2;
        for (let index = 0; index < RING_COUNT; index += 1) {
          if (this.textures.exists(textureKeys[index])) this.textures.remove(textureKeys[index]);
          const texture = this.textures.createCanvas(textureKeys[index], size, size);
          const context = texture.context;
          const outer = OUTER_RADII[index] / OUTER_RADII.at(-1) * center;
          const inner = INNER_RADII[index] / OUTER_RADII.at(-1) * center;
          context.save();
          context.beginPath();
          context.arc(center, center, outer, 0, TAU, false);
          if (inner > 0) context.arc(center, center, inner, 0, TAU, true);
          context.clip("evenodd");
          context.drawImage(source, sourceX, sourceY, size, size, 0, 0, size, size);
          context.restore();
          texture.refresh();
          const image = this.add.image(this.covenantCenter.x, this.covenantCenter.y, textureKeys[index]);
          image.setDisplaySize(this.covenantOuterRadius * 2, this.covenantOuterRadius * 2);
          this.covenantImages.push(image);
        }
      }

      installKeyboard() {
        const canvas = this.game.canvas;
        canvas.tabIndex = 0;
        canvas.setAttribute("role", "group");
        canvas.setAttribute("aria-label", language === "pt"
          ? "Cinco faixas concêntricas giratórias. Use as setas esquerda e direita para girar e as setas acima e abaixo para mudar de faixa."
          : "Five rotatable concentric bands. Use Left and Right to turn, and Up and Down to change bands.");
        this.covenantKeyboardHandler = (event) => {
          if (document.activeElement !== canvas || this.covenantState.locked) return;
          const handled = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "]);
          if (!handled.has(event.key)) return;
          event.preventDefault();
          if (event.key === "ArrowLeft") this.rotateSelected(-1);
          if (event.key === "ArrowRight") this.rotateSelected(1);
          if (event.key === "ArrowUp") this.selectRelative(-1);
          if (event.key === "ArrowDown") this.selectRelative(1);
          if (event.key === "Enter" || event.key === " ") {
            this.covenantState.tapArmed = !this.covenantState.tapArmed;
            this.covenantState.statusCode = "ready";
            this.redraw();
            this.notify();
          }
        };
        canvas.addEventListener("keydown", this.covenantKeyboardHandler);
      }

      pointMetrics(pointer) {
        const dx = pointer.x - this.covenantCenter.x;
        const dy = pointer.y - this.covenantCenter.y;
        return { dx, dy, radius: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
      }

      ringAtRadius(radius) {
        for (let index = 0; index < RING_COUNT; index += 1) {
          if (radius >= INNER_RADII[index] * this.covenantScale && radius <= OUTER_RADII[index] * this.covenantScale) return index;
        }
        return -1;
      }

      handlePointerDown(pointer) {
        if (this.covenantState.locked) {
          this.covenantState.statusCode = "locked";
          this.redraw();
          return;
        }
        const metrics = this.pointMetrics(pointer);
        const ring = this.ringAtRadius(metrics.radius);
        const rimMin = this.covenantOuterRadius + 5;
        const rimMax = this.covenantOuterRadius + 24;
        if (ring < 0 && this.covenantState.tapArmed && metrics.radius >= rimMin && metrics.radius <= rimMax) {
          const targetStep = normalizeStep(Math.round((metrics.angle + Math.PI / 2) / (TAU / payload.sectors)), payload.sectors);
          this.setRingStep(this.covenantState.selectedRing, targetStep, "target");
          this.covenantState.tapArmed = false;
          return;
        }
        if (ring < 0) {
          this.covenantState.statusCode = "invalid";
          this.redraw();
          this.notify();
          return;
        }
        this.selectRing(ring, { arm: true });
        this.covenantPointer = {
          id: pointer.id,
          ring,
          startAngle: metrics.angle,
          startStep: this.covenantState.ringSteps[ring],
          dragged: false,
        };
      }

      handlePointerMove(pointer) {
        const active = this.covenantPointer;
        if (!active || active.id !== pointer.id || this.covenantState.locked) return;
        const metrics = this.pointMetrics(pointer);
        const delta = metrics.angle - active.startAngle;
        if (Math.abs(delta) < 0.08 && !active.dragged) return;
        active.dragged = true;
        this.covenantState.tapArmed = false;
        const deltaSteps = Math.round(delta / (TAU / payload.sectors));
        this.setRingStep(active.ring, active.startStep + deltaSteps, "drag", { countMove: false });
      }

      handlePointerUp(pointer) {
        const active = this.covenantPointer;
        if (!active || active.id !== pointer.id) return;
        this.covenantPointer = null;
        if (active.dragged) {
          this.covenantState.moveCount += 1;
          this.covenantState.statusCode = "ready";
          this.redraw();
          this.notify();
        }
      }

      selectRing(index, { arm = false } = {}) {
        if (!Number.isInteger(index) || index < 0 || index >= RING_COUNT || this.covenantState.locked) return false;
        this.covenantState.selectedRing = index;
        this.covenantState.tapArmed = arm;
        this.covenantState.statusCode = "ready";
        this.redraw();
        this.notify();
        return true;
      }

      selectRelative(delta) {
        return this.selectRing(normalizeStep(this.covenantState.selectedRing + delta, RING_COUNT));
      }

      setRingStep(index, step, statusCode = "ready", { countMove = true } = {}) {
        if (!Number.isInteger(index) || index < 0 || index >= RING_COUNT || !Number.isFinite(step) || this.covenantState.locked) {
          this.covenantState.statusCode = this.covenantState.locked ? "locked" : "invalid";
          this.redraw();
          return false;
        }
        const next = normalizeStep(step, payload.sectors);
        if (next === this.covenantState.ringSteps[index]) return true;
        this.covenantState.ringSteps[index] = next;
        this.covenantState.lastCorrect = null;
        this.covenantState.completed = false;
        this.covenantState.statusCode = statusCode;
        if (countMove) this.covenantState.moveCount += 1;
        this.redraw();
        this.notify();
        return true;
      }

      rotateSelected(delta) {
        return this.setRingStep(
          this.covenantState.selectedRing,
          this.covenantState.ringSteps[this.covenantState.selectedRing] + delta,
        );
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.covenantGraphics) return;
        const state = this.covenantState;
        const stepAngle = TAU / payload.sectors;
        this.covenantImages.forEach((image, index) => image.setRotation(state.ringSteps[index] * stepAngle));
        const graphics = this.covenantGraphics;
        graphics.clear();
        for (let index = RING_COUNT - 1; index >= 0; index -= 1) {
          const radius = OUTER_RADII[index] * this.covenantScale;
          graphics.lineStyle(index === state.selectedRing ? 3 : 1, index === state.selectedRing ? 0xd60056 : 0x22201d, index === state.selectedRing ? 1 : 0.65);
          graphics.strokeCircle(this.covenantCenter.x, this.covenantCenter.y, radius);
        }
        for (let step = 0; step < payload.sectors; step += 1) {
          const angle = -Math.PI / 2 + step * stepAngle;
          const inner = this.covenantOuterRadius + 7;
          const outer = this.covenantOuterRadius + (step % 3 === 0 ? 17 : 13);
          graphics.lineStyle(step === 0 ? 3 : 1.5, step === 0 ? 0xd60056 : 0x6f6a61, step === 0 ? 1 : 0.7);
          graphics.lineBetween(
            this.covenantCenter.x + Math.cos(angle) * inner,
            this.covenantCenter.y + Math.sin(angle) * inner,
            this.covenantCenter.x + Math.cos(angle) * outer,
            this.covenantCenter.y + Math.sin(angle) * outer,
          );
        }
        if (state.hintLevel > 0 && !state.completed) {
          const selectedRadius = (INNER_RADII[state.selectedRing] + OUTER_RADII[state.selectedRing]) / 2 * this.covenantScale;
          graphics.lineStyle(3, 0xd60056, reducedMotion ? 0.55 : 0.8);
          graphics.strokeCircle(this.covenantCenter.x, this.covenantCenter.y, selectedRadius);
        }
        this.covenantSelectedText?.setText(`${state.selectedRing + 1}/5 · ${conceptLabel(this, state.selectedRing, language)}`);
        this.covenantStatusText?.setText(stateLabel(this, language));
      }
    }

    return new CovenantRingsScene();
  },

  serializeState(scene) {
    if (!scene?.covenantState) return null;
    const state = scene.covenantState;
    return JSON.parse(JSON.stringify({
      version: ENGINE_STATE_VERSION,
      ringSteps: [...state.ringSteps],
      selectedRing: state.selectedRing,
      tapArmed: state.tapArmed,
      hintLevel: state.hintLevel,
      moveCount: state.moveCount,
      completed: state.completed,
      locked: state.locked,
      solutionShown: state.solutionShown,
      lastCorrect: state.lastCorrect,
      statusCode: state.statusCode,
    }));
  },

  restoreState(scene, savedState, instance) {
    if (!scene) return;
    const sectors = scene.covenantPayload?.sectors || DEFAULT_SECTORS;
    scene.covenantState = cleanSavedState(savedState, scene.covenantInitialState, sectors, instance?.mode);
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const state = scene.covenantState;
    const correct = isC30Solved(state.ringSteps);
    state.lastCorrect = correct;
    state.completed = correct || instance.mode === "mission";
    state.locked = correct || instance.mode === "mission";
    if (instance.mode === "mission") {
      state.solutionShown = true;
      if (!correct) state.ringSteps = Array(RING_COUNT).fill(0);
    }
    state.tapArmed = false;
    state.statusCode = correct ? "complete" : "ready";
    scene.redraw?.();
    scene.notify?.();
    return {
      correct,
      complete: correct || instance.mode === "mission",
      feedback: correct
        ? localized("The five dimensions form one covenant image.", "As cinco dimensões formam uma única imagem da aliança.")
        : instance.mode === "mission"
          ? localized("The bands were not yet aligned. The complete image is now shown.", "As faixas ainda não estavam alinhadas. Agora mostramos a imagem completa.")
          : localized("Some ribbon and figure lines still break between bands. Keep turning, then Check again.", "Algumas linhas da fita e das figuras ainda se interrompem entre as faixas. Continue girando e verifique novamente."),
    };
  },

  getAccessibleActions(scene) {
    if (!scene?.covenantState) return [];
    const languageLabel = (index) => scene.covenantPayload.concepts[index].label;
    const selected = scene.covenantState.selectedRing;
    return [
      {
        id: "previous-band",
        label: localized(`Previous band from ${languageLabel(selected).en}`, `Faixa anterior a ${languageLabel(selected).pt}`),
        disabled: scene.covenantState.locked,
        run: () => scene.selectRelative(-1),
      },
      {
        id: "turn-left",
        label: localized(`Turn ${languageLabel(selected).en} left`, `Girar ${languageLabel(selected).pt} para a esquerda`),
        disabled: scene.covenantState.locked,
        run: () => scene.rotateSelected(-1),
      },
      {
        id: "turn-right",
        label: localized(`Turn ${languageLabel(selected).en} right`, `Girar ${languageLabel(selected).pt} para a direita`),
        disabled: scene.covenantState.locked,
        run: () => scene.rotateSelected(1),
      },
      {
        id: "next-band",
        label: localized(`Next band from ${languageLabel(selected).en}`, `Faixa seguinte a ${languageLabel(selected).pt}`),
        disabled: scene.covenantState.locked,
        run: () => scene.selectRelative(1),
      },
    ];
  },

  showHint(scene, hintIndex) {
    const state = scene.covenantState;
    if (state.locked) return localized("This round is complete.", "Esta rodada terminou.");
    const anchor = mostCommonStep(state.ringSteps);
    const misaligned = state.ringSteps
      .map((step, index) => ({ index, distance: circularDistance(step, anchor, scene.covenantPayload.sectors) }))
      .filter((item) => item.distance > 0)
      .sort((a, b) => b.distance - a.distance || a.index - b.index);
    const target = misaligned[0]?.index ?? state.selectedRing;
    state.selectedRing = target;
    state.hintLevel = Math.max(state.hintLevel, hintIndex + 1);
    state.tapArmed = false;
    if (hintIndex === 1 && misaligned.length) {
      scene.setRingStep(target, anchor, "target");
      state.hintLevel = 2;
      scene.redraw?.();
      scene.notify?.();
      return localized(
        `${conceptLabel(scene, target, "en")} was aligned with the strongest shared line. Continue from that seam.`,
        `${conceptLabel(scene, target, "pt")} foi alinhada à linha comum mais clara. Continue a partir dessa junção.`,
      );
    }
    scene.redraw?.();
    scene.notify?.();
    return localized(
      `Compare the ribbon at the edge of ${conceptLabel(scene, target, "en")} with the band beside it.`,
      `Compare a fita na borda de ${conceptLabel(scene, target, "pt")} com a faixa ao lado.`,
    );
  },

  destroy(scene) {
    if (!scene) return;
    const canvas = scene.game?.canvas;
    if (canvas && scene.covenantKeyboardHandler) canvas.removeEventListener("keydown", scene.covenantKeyboardHandler);
    scene.input?.removeAllListeners();
    scene.covenantImages?.forEach((image) => image.destroy?.());
    scene.covenantTextureKeys?.forEach((key) => {
      if (scene.textures?.exists(key)) scene.textures.remove(key);
    });
  },
});
