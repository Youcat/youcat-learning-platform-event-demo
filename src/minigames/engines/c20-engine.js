import { C20_SAFE_PAYLOAD } from "../fixtures/c20-fixture.js";

const COLORS = Object.freeze({
  white: 0xffffff,
  ink: 0x151515,
  graphite: 0x22201d,
  muted: 0x6f6a61,
  border: 0xd9d2bf,
  borderSoft: 0xece4cf,
  loveRed: 0xd60056,
  loveSoft: 0xf7e4eb,
  error: 0xb3261e,
});

const PAYLOAD_KEYS = ["schemaVersion", "stages", "approvedRoutes", "feedback"];
const STAGE_KEYS = ["id", "title", "options"];
const OPTION_KEYS = ["id", "label", "short", "outcome", "debrief"];
const ROUTE_KEYS = ["id", "choices", "feedback"];
const OUTCOMES = new Set(["acceptable", "harmful", "incomplete"]);

function t(en, pt) {
  return { en, pt };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function validLocalized(value, { allowEmpty = false } = {}) {
  return hasExactKeys(value, ["en", "pt"])
    && ["en", "pt"].every((locale) => typeof value[locale] === "string" && (allowEmpty || value[locale].trim()));
}

function validatePayload(payload, instance) {
  const errors = [];
  if (!hasExactKeys(payload, PAYLOAD_KEYS)) errors.push(`payload must contain exactly ${PAYLOAD_KEYS.join(", ")}`);
  if (!isRecord(payload)) return errors;
  if (payload.schemaVersion !== 1) errors.push("payload.schemaVersion must be 1");
  if (!Array.isArray(payload.stages) || payload.stages.length !== 3) errors.push("payload.stages must contain exactly three forks");
  if (!Array.isArray(payload.approvedRoutes) || payload.approvedRoutes.length < 2) errors.push("payload.approvedRoutes must contain at least two routes");
  if (!hasExactKeys(payload.feedback, ["incomplete"]) || !validLocalized(payload.feedback?.incomplete)) {
    errors.push("payload.feedback.incomplete must be exact localized text");
  }
  if (isRecord(instance?.layoutOverrides) && Object.keys(instance.layoutOverrides).length) {
    errors.push("C20 layoutOverrides must be empty");
  }

  const stageIds = new Set();
  const optionById = new Map();
  for (const [stageIndex, stage] of (Array.isArray(payload.stages) ? payload.stages : []).entries()) {
    if (!hasExactKeys(stage, STAGE_KEYS)) errors.push(`stage ${stageIndex + 1} must contain exactly ${STAGE_KEYS.join(", ")}`);
    if (typeof stage?.id !== "string" || !stage.id.trim() || stageIds.has(stage.id)) errors.push(`stage ${stageIndex + 1} needs a unique id`);
    else stageIds.add(stage.id);
    if (!validLocalized(stage?.title)) errors.push(`stage ${stageIndex + 1}.title must contain exact localized text`);
    if (!Array.isArray(stage?.options) || stage.options.length !== 3) errors.push(`stage ${stageIndex + 1} must contain exactly three options`);
    let acceptableCount = 0;
    for (const [optionIndex, option] of (Array.isArray(stage?.options) ? stage.options : []).entries()) {
      const path = `stage ${stageIndex + 1} option ${optionIndex + 1}`;
      if (!hasExactKeys(option, OPTION_KEYS)) errors.push(`${path} must contain exactly ${OPTION_KEYS.join(", ")}`);
      if (typeof option?.id !== "string" || !option.id.trim() || optionById.has(option.id)) errors.push(`${path} needs a unique id`);
      else optionById.set(option.id, { option, stageId: stage.id });
      if (!validLocalized(option?.label)) errors.push(`${path}.label must contain exact localized text`);
      if (!validLocalized(option?.short)) errors.push(`${path}.short must contain exact localized text`);
      if (!OUTCOMES.has(option?.outcome)) errors.push(`${path}.outcome is invalid`);
      if (option?.outcome === "acceptable") acceptableCount += 1;
      if (!validLocalized(option?.debrief, { allowEmpty: option?.outcome === "acceptable" })) errors.push(`${path}.debrief is invalid`);
      if (option?.outcome !== "acceptable" && (!option?.debrief?.en?.trim() || !option?.debrief?.pt?.trim())) errors.push(`${path}.debrief is required`);
    }
    if (!acceptableCount) errors.push(`stage ${stageIndex + 1} has no acceptable choice`);
  }

  const routeIds = new Set();
  for (const [routeIndex, route] of (Array.isArray(payload.approvedRoutes) ? payload.approvedRoutes : []).entries()) {
    const path = `approved route ${routeIndex + 1}`;
    if (!hasExactKeys(route, ROUTE_KEYS)) errors.push(`${path} must contain exactly ${ROUTE_KEYS.join(", ")}`);
    if (typeof route?.id !== "string" || !route.id.trim() || routeIds.has(route.id)) errors.push(`${path} needs a unique id`);
    else routeIds.add(route.id);
    if (!Array.isArray(route?.choices) || route.choices.length !== 3) errors.push(`${path}.choices must contain three option ids`);
    if (!validLocalized(route?.feedback)) errors.push(`${path}.feedback must contain exact localized text`);
    for (const [stageIndex, optionId] of (Array.isArray(route?.choices) ? route.choices : []).entries()) {
      const reference = optionById.get(optionId);
      const expectedStage = payload.stages?.[stageIndex]?.id;
      if (!reference || reference.stageId !== expectedStage || reference.option.outcome !== "acceptable") {
        errors.push(`${path} must use an acceptable option from fork ${stageIndex + 1}`);
      }
    }
  }
  return errors;
}

function normalizedPayload(instance) {
  return validatePayload(instance?.payload, instance).length ? clone(C20_SAFE_PAYLOAD) : clone(instance.payload);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value || "c20-safe-seed")) {
    hash ^= character.charCodeAt(0);
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

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function optionMap(payload) {
  return new Map(payload.stages.flatMap((stage) => stage.options.map((option) => [option.id, { stage, option }])));
}

function safeNotice(value) {
  return validLocalized(value, { allowEmpty: true }) ? clone(value) : t("", "");
}

export function createC20InitialState(instance) {
  const payload = normalizedPayload(instance);
  const random = seededRandom(instance?.seed);
  return {
    choices: Object.fromEntries(payload.stages.map((stage) => [stage.id, null])),
    optionOrder: payload.stages.map((stage) => shuffled(stage.options.map((option) => option.id), random)),
    selectedOptionId: null,
    keyboardIndex: 0,
    hintLevel: 0,
    notice: t("", ""),
    revision: 0,
  };
}

export function restoreC20State(savedState, instance) {
  const payload = normalizedPayload(instance);
  const fresh = createC20InitialState(instance);
  if (!isRecord(savedState)) return fresh;
  const options = optionMap(payload);
  for (const stage of payload.stages) {
    const optionId = savedState.choices?.[stage.id];
    if (optionId && options.get(optionId)?.stage.id === stage.id) fresh.choices[stage.id] = optionId;
  }
  if (options.has(savedState.selectedOptionId)) fresh.selectedOptionId = savedState.selectedOptionId;
  fresh.keyboardIndex = Math.max(0, Math.min(8, Number.isInteger(savedState.keyboardIndex) ? savedState.keyboardIndex : 0));
  fresh.hintLevel = Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0));
  fresh.notice = safeNotice(savedState.notice);
  fresh.revision = Math.max(0, Number.isInteger(savedState.revision) ? savedState.revision : 0);
  return fresh;
}

export function evaluateC20State(state, instance) {
  const payload = normalizedPayload(instance);
  const choices = payload.stages.map((stage) => state?.choices?.[stage.id] || null);
  if (choices.some((choice) => !choice)) {
    return { correct: false, complete: false, feedback: clone(payload.feedback.incomplete), routeId: null };
  }
  const options = optionMap(payload);
  const firstNonAcceptable = choices.map((id) => options.get(id)?.option).find((option) => option?.outcome !== "acceptable");
  if (firstNonAcceptable) {
    return {
      correct: false,
      complete: firstNonAcceptable.outcome === "harmful",
      feedback: clone(firstNonAcceptable.debrief),
      routeId: null,
    };
  }
  const route = payload.approvedRoutes.find((candidate) => candidate.choices.every((choice, index) => choice === choices[index]));
  if (!route) {
    return {
      correct: false,
      complete: true,
      feedback: t(
        "This crossing is coherent in parts, but it is not one of the approved complete routes. Review how pressure, discernment, and covenant connect.",
        "Esta travessia é coerente em partes, mas não é um dos caminhos completos aprovados. Reveja como pressão, discernimento e aliança se conectam.",
      ),
      routeId: null,
    };
  }
  return { correct: true, complete: true, feedback: clone(route.feedback), routeId: route.id };
}

function localeText(value, language) {
  return value?.[language] ?? value?.en ?? value?.pt ?? "";
}

function wrapShort(value) {
  const words = String(value).split(/\s+/);
  if (words.length < 3) return value;
  const middle = Math.ceil(words.length / 2);
  return `${words.slice(0, middle).join(" ")}\n${words.slice(middle).join(" ")}`;
}

export const c20Engine = Object.freeze({
  validate(payload, instance) {
    const errors = validatePayload(payload, instance);
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const payload = normalizedPayload(instance);
    const initialState = createC20InitialState(instance);
    const options = optionMap(payload);

    class RiverOfDecisionsScene extends Phaser.Scene {
      constructor() {
        super({ key: `c20-${instance.id}` });
        this.c20InitialState = clone(initialState);
        this.c20State = clone(initialState);
        this.c20ReducedMotion = Boolean(reducedMotion);
        this.optionViews = new Map();
        this.slotViews = new Map();
        this.homePositions = new Map();
        this.minigameFeedback = null;
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("c20-approved-art", instance.assets.baseImage);
      }

      create() {
        const width = this.scale.width;
        if (instance.assets.baseImage && this.textures.exists("c20-approved-art")) {
          this.add.image(width / 2, 180, "c20-approved-art").setDisplaySize(350, 350).setAlpha(0.055);
        }
        this.background = this.add.graphics();
        this.background.fillStyle(COLORS.loveSoft, 0.88);
        this.background.fillPoints([
          new Phaser.Geom.Point(0, 58), new Phaser.Geom.Point(90, 50), new Phaser.Geom.Point(180, 61),
          new Phaser.Geom.Point(270, 52), new Phaser.Geom.Point(360, 62), new Phaser.Geom.Point(360, 132),
          new Phaser.Geom.Point(270, 126), new Phaser.Geom.Point(180, 136), new Phaser.Geom.Point(90, 127),
          new Phaser.Geom.Point(0, 136),
        ], true);
        this.background.lineStyle(1.5, COLORS.graphite, 0.55);
        this.background.strokePoints([
          new Phaser.Geom.Point(0, 58), new Phaser.Geom.Point(90, 50), new Phaser.Geom.Point(180, 61),
          new Phaser.Geom.Point(270, 52), new Phaser.Geom.Point(360, 62),
        ], false);
        this.background.strokePoints([
          new Phaser.Geom.Point(0, 136), new Phaser.Geom.Point(90, 127), new Phaser.Geom.Point(180, 136),
          new Phaser.Geom.Point(270, 126), new Phaser.Geom.Point(360, 132),
        ], false);

        const xPositions = [58, 180, 302];
        payload.stages.forEach((stage, stageIndex) => {
          const x = xPositions[stageIndex];
          this.add.text(x, 15, `${stageIndex + 1} · ${localeText(stage.title, language)}`, {
            fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600", color: "#22201d", align: "center",
            wordWrap: { width: 106 },
          }).setOrigin(0.5, 0);
          const slot = this.add.rectangle(x, 94, 100, 58, COLORS.white, 0.96).setStrokeStyle(1.5, COLORS.graphite, 1);
          const slotText = this.add.text(x, 94, language === "pt" ? "Solte aqui" : "Drop here", {
            fontFamily: "Fira Sans", fontSize: "12px", color: "#6f6a61", align: "center", wordWrap: { width: 88 },
          }).setOrigin(0.5);
          const zone = this.add.zone(x, 94, 108, 66).setInteractive({ cursor: "pointer" });
          zone.on("pointerdown", () => this.placeSelectedAt(stage.id));
          this.slotViews.set(stage.id, { slot, slotText, zone });

          this.c20State.optionOrder[stageIndex].forEach((optionId, rowIndex) => {
            const option = options.get(optionId).option;
            const y = 178 + rowIndex * 56;
            const card = this.add.rectangle(0, 0, 104, 46, COLORS.white, 0.98).setStrokeStyle(1, COLORS.border, 1);
            const number = stageIndex * 3 + rowIndex + 1;
            const numberText = this.add.text(-45, -17, String(number), {
              fontFamily: "Fira Sans", fontSize: "9px", fontStyle: "600", color: "#918b80",
            });
            const label = this.add.text(3, 0, wrapShort(localeText(option.short, language)), {
              fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600", color: "#22201d", align: "center",
              lineSpacing: -2, wordWrap: { width: 84 },
            }).setOrigin(0.5);
            const container = this.add.container(x, y, [card, numberText, label]);
            container.setSize(104, 46).setInteractive({ cursor: "grab" });
            this.input.setDraggable(container);
            let dragMoved = false;
            container.on("pointerdown", () => this.selectOption(optionId));
            container.on("dragstart", () => {
              dragMoved = false;
              this.selectOption(optionId, false);
              container.setDepth(20);
            });
            container.on("drag", (_pointer, dragX, dragY) => {
              if (Math.hypot(dragX - x, dragY - y) > 5) dragMoved = true;
              container.setPosition(dragX, dragY);
            });
            container.on("dragend", () => {
              if (dragMoved) this.finishDrag(optionId, container.x, container.y);
              const home = this.homePositions.get(optionId);
              container.setPosition(home.x, home.y).setDepth(1);
            });
            this.homePositions.set(optionId, { x, y });
            this.optionViews.set(optionId, { container, card, label, numberText });
          });
        });

        this.noticeText = this.add.text(180, 342, "", {
          fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600", color: "#6f6a61", align: "center",
          wordWrap: { width: 332 },
        }).setOrigin(0.5, 1);

        this.c20KeyHandler = (event) => {
          if (globalThis.document?.activeElement !== this.game.canvas) return;
          const flattened = this.c20State.optionOrder.flat();
          const columns = 3;
          let next = this.c20State.keyboardIndex;
          if (event.key === "ArrowLeft") next -= columns;
          else if (event.key === "ArrowRight") next += columns;
          else if (event.key === "ArrowUp") next -= 1;
          else if (event.key === "ArrowDown") next += 1;
          else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const optionId = flattened[this.c20State.keyboardIndex];
            this.chooseOption(options.get(optionId).stage.id, optionId);
            return;
          } else return;
          event.preventDefault();
          this.c20State.keyboardIndex = (next + flattened.length) % flattened.length;
          this.c20State.selectedOptionId = flattened[this.c20State.keyboardIndex];
          this.c20State.revision += 1;
          this.notify(t(
            `Selected ${options.get(this.c20State.selectedOptionId).option.label.en}. Press Enter to place it.`,
            `${options.get(this.c20State.selectedOptionId).option.label.pt} selecionado. Pressione Enter para posicionar.`,
          ));
        };
        this.input.keyboard.on("keydown", this.c20KeyHandler);
        this.redraw();
        onReady(this);
      }

      selectOption(optionId, announce = true) {
        if (!options.has(optionId)) return;
        this.c20State.selectedOptionId = optionId;
        this.c20State.keyboardIndex = this.c20State.optionOrder.flat().indexOf(optionId);
        this.c20State.revision += 1;
        if (announce) {
          const option = options.get(optionId).option;
          this.notify(t(
            `Selected ${option.label.en}. Now tap its fork.`,
            `${option.label.pt} selecionado. Agora toque na etapa correspondente.`,
          ));
        } else {
          this.redraw();
        }
      }

      placeSelectedAt(stageId) {
        if (!this.c20State.selectedOptionId) {
          this.notify(t("Select a decision first.", "Selecione primeiro uma decisão."), true);
          return;
        }
        this.chooseOption(stageId, this.c20State.selectedOptionId);
      }

      chooseOption(stageId, optionId) {
        const reference = options.get(optionId);
        if (!reference || reference.stage.id !== stageId) {
          this.notify(t(
            "That decision belongs at a different fork. Nothing was changed.",
            "Essa decisão pertence a outra etapa. Nada foi alterado.",
          ), true);
          return false;
        }
        this.c20State.choices[stageId] = optionId;
        this.c20State.selectedOptionId = null;
        this.c20State.revision += 1;
        const stageNumber = payload.stages.findIndex((stage) => stage.id === stageId) + 1;
        this.notify(t(
          `Decision placed at fork ${stageNumber}. You can replace it before checking.`,
          `Decisão posicionada na etapa ${stageNumber}. Você pode substituí-la antes de verificar.`,
        ));
        return true;
      }

      finishDrag(optionId, x, y) {
        const xPositions = [58, 180, 302];
        const targetIndex = xPositions.findIndex((targetX) => Math.abs(targetX - x) <= 55 && Math.abs(94 - y) <= 48);
        if (targetIndex < 0) {
          this.notify(t(
            "Place the decision on one of the three river forks. Nothing was changed.",
            "Coloque a decisão numa das três etapas do rio. Nada foi alterado.",
          ), true);
          return false;
        }
        return this.chooseOption(payload.stages[targetIndex].id, optionId);
      }

      notify(message, isError = false) {
        this.c20State.notice = clone(message);
        this.minigameFeedback = clone(message);
        this.c20NoticeIsError = Boolean(isError);
        this.redraw();
        onStateChange(this);
      }

      redraw() {
        if (!this.optionViews.size) return;
        const selected = this.c20State.selectedOptionId;
        const placed = new Set(Object.values(this.c20State.choices).filter(Boolean));
        for (const stage of payload.stages) {
          const view = this.slotViews.get(stage.id);
          const optionId = this.c20State.choices[stage.id];
          const option = optionId ? options.get(optionId).option : null;
          view.slot.setFillStyle(option ? COLORS.loveSoft : COLORS.white, 0.98);
          view.slot.setStrokeStyle(option ? 2 : 1.5, option ? COLORS.loveRed : COLORS.graphite, 1);
          view.slotText.setText(option ? wrapShort(localeText(option.short, language)) : (language === "pt" ? "Solte aqui" : "Drop here"));
          view.slotText.setColor(option ? "#22201d" : "#6f6a61").setFontStyle(option ? "600" : "400");
        }
        for (const [optionId, view] of this.optionViews) {
          const option = options.get(optionId).option;
          const isSelected = optionId === selected;
          const isPlaced = placed.has(optionId);
          const hintHarmful = this.c20State.hintLevel >= 1 && option.outcome === "harmful";
          const hintCovenant = this.c20State.hintLevel >= 2 && optionId === "public-covenant";
          view.card.setFillStyle(isPlaced || hintCovenant ? COLORS.loveSoft : COLORS.white, 0.98);
          view.card.setStrokeStyle(isSelected ? 2.5 : (hintHarmful || hintCovenant ? 2 : 1), isSelected || hintCovenant ? COLORS.loveRed : (hintHarmful ? COLORS.error : COLORS.border), 1);
          view.label.setColor(hintHarmful ? "#b3261e" : "#22201d");
          view.numberText.setColor(isSelected ? "#d60056" : "#918b80");
        }
        this.noticeText?.setText(localeText(this.c20State.notice, language));
        this.noticeText?.setColor(this.c20NoticeIsError ? "#b3261e" : "#6f6a61");
      }
    }

    return new RiverOfDecisionsScene();
  },

  serializeState(scene) {
    const state = scene?.c20State;
    if (!state) return null;
    return clone({
      choices: state.choices,
      optionOrder: state.optionOrder,
      selectedOptionId: state.selectedOptionId,
      keyboardIndex: state.keyboardIndex,
      hintLevel: state.hintLevel,
      notice: state.notice,
      revision: state.revision,
    });
  },

  restoreState(scene, savedState, instance) {
    if (!scene) return;
    scene.c20State = restoreC20State(savedState, instance);
    scene.minigameFeedback = null;
    scene.c20NoticeIsError = false;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    return evaluateC20State(scene?.c20State, instance);
  },

  getAccessibleActions(scene, instance) {
    if (!scene?.c20State) return [];
    const payload = normalizedPayload(instance);
    const options = optionMap(payload);
    return scene.c20State.optionOrder.map((orderedIds, stageIndex) => {
      const stage = payload.stages[stageIndex];
      const currentId = scene.c20State.choices[stage.id];
      const currentIndex = orderedIds.indexOf(currentId);
      const nextId = orderedIds[(currentIndex + 1) % orderedIds.length];
      const nextOption = options.get(nextId).option;
      return {
        id: `cycle-${stage.id}`,
        label: t(
          `${currentId ? "Next" : "Choose"} for ${stage.title.en}: ${nextOption.short.en}`,
          `${currentId ? "Próxima" : "Escolher"} para ${stage.title.pt}: ${nextOption.short.pt}`,
        ),
        run: () => scene.chooseOption(stage.id, nextId),
      };
    });
  },

  showHint(scene, hintIndex) {
    if (!scene?.c20State) return t("", "");
    scene.c20State.hintLevel = Math.max(scene.c20State.hintLevel, Math.min(2, hintIndex + 1));
    scene.c20State.revision += 1;
    const message = hintIndex === 0
      ? t(
        "Notice which choices let urgency or momentum make the relationship decision.",
        "Observe quais escolhas deixam a urgência ou o impulso tomar a decisão sobre a relação.",
      )
      : t(
        "A complete crossing answers the practical pressure, protects free discernment, and reaches a public covenant before total shared life.",
        "Uma travessia completa responde à pressão prática, protege o discernimento livre e chega a uma aliança pública antes da vida totalmente comum.",
      );
    scene.c20State.notice = clone(message);
    scene.redraw?.();
    scene.notify?.(message);
    return message;
  },

  destroy(scene) {
    if (!scene) return;
    if (scene.c20KeyHandler) scene.input?.keyboard?.off("keydown", scene.c20KeyHandler);
    scene.optionViews?.forEach(({ container }) => container.removeAllListeners());
    scene.slotViews?.forEach(({ zone }) => zone.removeAllListeners());
    scene.input?.removeAllListeners();
    scene.minigameFeedback = null;
  },
});
