const DEFAULT_CONCEPTS = Object.freeze([
  Object.freeze({ id: "attraction", label: Object.freeze({ en: "Attraction", pt: "Atração" }) }),
  Object.freeze({ id: "reality", label: Object.freeze({ en: "Reality", pt: "Realidade" }) }),
  Object.freeze({ id: "good", label: Object.freeze({ en: "Concrete good", pt: "Bem concreto" }) }),
  Object.freeze({ id: "fidelity", label: Object.freeze({ en: "Fidelity", pt: "Fidelidade" }) }),
]);
const DEFAULT_ANSWER = Object.freeze(DEFAULT_CONCEPTS.map(({ id }) => id));
const SLOT_X = Object.freeze([52, 137, 223, 308]);
const SLOT_Y = 211;

function localized(en, pt) {
  return { en, pt };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validLocalizedLabel(value) {
  return exactKeys(value, ["en", "pt"])
    && ["en", "pt"].every((locale) => typeof value[locale] === "string" && value[locale].trim());
}

function validConcepts(concepts) {
  if (!Array.isArray(concepts) || concepts.length !== 4) return false;
  const ids = new Set();
  for (const item of concepts) {
    if (!exactKeys(item, ["id", "label"]) || typeof item.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(item.id) || !validLocalizedLabel(item.label)) return false;
    ids.add(item.id);
  }
  return ids.size === concepts.length;
}

export function normalizeB9Payload(payload) {
  if (!exactKeys(payload, ["concepts", "answer"]) || !validConcepts(payload.concepts)) {
    return { concepts: DEFAULT_CONCEPTS.map((item) => ({ id: item.id, label: { ...item.label } })), answer: [...DEFAULT_ANSWER] };
  }
  const ids = new Set(payload.concepts.map(({ id }) => id));
  const validAnswer = Array.isArray(payload.answer)
    && payload.answer.length === 4
    && new Set(payload.answer).size === 4
    && payload.answer.every((id) => ids.has(id));
  if (!validAnswer) return { concepts: DEFAULT_CONCEPTS.map((item) => ({ id: item.id, label: { ...item.label } })), answer: [...DEFAULT_ANSWER] };
  return {
    concepts: payload.concepts.map((item) => ({ id: item.id, label: { ...item.label } })),
    answer: [...payload.answer],
  };
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed || "B9-fallback")) {
    hash ^= char.codePointAt(0);
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

export function deriveB9Order(seed, answer = DEFAULT_ANSWER) {
  const order = [...answer];
  const random = seededRandom(seed);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }
  if (order.every((id, index) => id === answer[index])) order.push(order.shift());
  return order;
}

export function createB9State(instance) {
  const payload = normalizeB9Payload(instance?.payload);
  return {
    order: deriveB9Order(instance?.seed, payload.answer),
    selected: null,
    hintLevel: 0,
    checks: 0,
    complete: false,
    revealedSolution: false,
    submittedOrder: null,
    crossingProgress: 0,
    status: localized("", ""),
  };
}

function isPermutation(order, answer) {
  return Array.isArray(order)
    && order.length === answer.length
    && new Set(order).size === answer.length
    && order.every((id) => answer.includes(id));
}

export function swapB9Slots(state, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= state.order.length || to >= state.order.length || from === to || state.complete) return false;
  [state.order[from], state.order[to]] = [state.order[to], state.order[from]];
  state.selected = null;
  state.status = localized(`Positions ${from + 1} and ${to + 1} exchanged.`, `Posições ${from + 1} e ${to + 1} trocadas.`);
  return true;
}

export function isB9Correct(state, instance) {
  const { answer } = normalizeB9Payload(instance?.payload);
  return answer.every((id, index) => state?.order?.[index] === id);
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function nearestSlot(x, y) {
  let best = null;
  SLOT_X.forEach((slotX, index) => {
    const distance = Math.hypot(x - slotX, y - SLOT_Y);
    if (!best || distance < best.distance) best = { index, distance };
  });
  return best?.distance <= 57 ? best.index : null;
}

function localizedLabel(instance, id, language) {
  const item = normalizeB9Payload(instance?.payload).concepts.find((concept) => concept.id === id);
  return item?.label?.[language] || item?.label?.en || id;
}

function drawIrregularStone(graphics, x, y, selected, hint, complete) {
  const fill = complete ? 0xfce7ee : selected ? 0xf8c6d5 : hint ? 0xffeff3 : 0xffffff;
  graphics.fillStyle(fill, 1);
  graphics.lineStyle(selected ? 3 : 2, selected ? 0xd60056 : 0x22201d, 1);
  const points = [
    { x: x - 38, y: y - 29 },
    { x: x + 35, y: y - 31 },
    { x: x + 39, y: y + 26 },
    { x: x - 34, y: y + 30 },
  ];
  graphics.fillPoints(points, true);
  graphics.strokePoints(points, true);
}

export const b9Engine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!exactKeys(payload, ["concepts", "answer"])) errors.push("payload must contain exactly {concepts, answer}");
    if (!validConcepts(payload?.concepts)) errors.push("payload.concepts must contain four unique localized concepts");
    const ids = validConcepts(payload?.concepts) ? new Set(payload.concepts.map(({ id }) => id)) : new Set();
    if (!Array.isArray(payload?.answer) || payload.answer.length !== 4 || new Set(payload.answer).size !== 4 || payload.answer.some((id) => !ids.has(id))) {
      errors.push("payload.answer must order every concept exactly once");
    }
    if (!isRecord(instance?.layoutOverrides) || Object.keys(instance.layoutOverrides).length) errors.push("layoutOverrides must be an empty object for B9 1.0.0");
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const initial = createB9State(instance);
    const assetKey = `b9-crossing-${instance.id}`;

    class BridgeOfFidelityScene extends Phaser.Scene {
      constructor() {
        super({ key: `b9-${instance.id}` });
        this.b9InitialState = cloneState(initial);
        this.b9State = cloneState(initial);
        this.drag = null;
        this.stoneZones = [];
        this.stoneLabels = [];
      }

      preload() {
        if (instance.assets.baseImage) this.load.image(assetKey, instance.assets.baseImage);
      }

      create() {
        this.graphics = this.add.graphics();
        this.crossingArt = instance.assets.baseImage ? this.add.image(302, 74, assetKey).setDisplaySize(106, 106).setAlpha(0) : null;
        this.heading = this.add.text(24, 20, language === "pt" ? "Construa um caminho que permaneça" : "Build a path that can remain", {
          fontFamily: "Fira Sans, sans-serif", fontSize: "15px", fontStyle: "600", color: "#22201d",
        });
        this.direction = this.add.text(24, 48, language === "pt" ? "início" : "beginning", {
          fontFamily: "Fira Sans, sans-serif", fontSize: "12px", color: "#6f6a61",
        });
        this.destination = this.add.text(290, 48, language === "pt" ? "permanecer" : "remain", {
          fontFamily: "Fira Sans, sans-serif", fontSize: "12px", color: "#6f6a61",
        }).setOrigin(0.5, 0);

        SLOT_X.forEach((x, index) => {
          const zone = this.add.zone(x, SLOT_Y, 78, 66).setInteractive({ cursor: "grab" });
          zone.setData("slot", index);
          this.input.setDraggable(zone);
          zone.on("dragstart", () => {
            if (this.b9State.complete) return;
            this.drag = { from: index, x, y: SLOT_Y, moved: false };
          });
          zone.on("drag", (_pointer, dragX, dragY) => {
            if (!this.drag || this.b9State.complete) return;
            this.drag.x = dragX;
            this.drag.y = dragY;
            this.drag.moved = Math.hypot(dragX - x, dragY - SLOT_Y) > 8;
            this.redraw();
          });
          zone.on("dragend", (pointer) => {
            if (!this.drag || this.b9State.complete) return;
            const dragged = this.drag;
            this.drag = null;
            this.suppressTap = true;
            this.time.delayedCall(0, () => { this.suppressTap = false; });
            if (!dragged.moved) {
              this.tapSlot(index);
              return;
            }
            const target = nearestSlot(pointer.x, pointer.y);
            if (target === null || target === dragged.from) {
              this.b9State.status = localized("Place the stone on a different bridge position.", "Coloque a pedra em outra posição da ponte.");
            } else {
              swapB9Slots(this.b9State, dragged.from, target);
            }
            this.redraw();
            this.notify();
          });
          zone.on("pointerup", () => {
            if (!this.suppressTap && !this.drag && !this.b9State.complete) this.tapSlot(index);
          });
          this.stoneZones.push(zone);
          const label = this.add.text(x, SLOT_Y, "", {
            align: "center", color: "#22201d", fontFamily: "Fira Sans, sans-serif", fontSize: "13px", fontStyle: "600", lineSpacing: 1, wordWrap: { width: 66 },
          }).setOrigin(0.5);
          this.stoneLabels.push(label);
        });
        this.redraw();
        onReady(this);
      }

      tapSlot(index) {
        if (this.b9State.complete) return false;
        if (this.b9State.selected === null) {
          this.b9State.selected = index;
          this.b9State.status = localized(`Position ${index + 1} selected. Choose another position.`, `Posição ${index + 1} selecionada. Escolha outra posição.`);
        } else if (this.b9State.selected === index) {
          this.b9State.selected = null;
          this.b9State.status = localized("Selection cleared.", "Seleção cancelada.");
        } else {
          swapB9Slots(this.b9State, this.b9State.selected, index);
        }
        this.redraw();
        this.notify();
        return true;
      }

      notify() {
        onStateChange(this);
      }

      playCrossing() {
        if (reducedMotion || !this.tweens) {
          this.b9State.crossingProgress = 1;
          this.redraw();
          return;
        }
        this.tweens.addCounter({
          from: this.b9State.crossingProgress,
          to: 1,
          duration: 900,
          ease: "Sine.easeInOut",
          onUpdate: (tween) => {
            this.b9State.crossingProgress = tween.getValue();
            this.redraw();
          },
          onComplete: () => this.notify(),
        });
      }

      redraw() {
        if (!this.graphics) return;
        const graphics = this.graphics;
        const state = this.b9State;
        this.accessibleStatus = state.status;
        const answer = normalizeB9Payload(instance.payload).answer;
        graphics.clear();
        graphics.lineStyle(2, 0xd60056, 0.42);
        graphics.beginPath();
        graphics.moveTo(12, 279);
        graphics.lineTo(70, 269);
        graphics.lineTo(128, 284);
        graphics.lineTo(190, 271);
        graphics.lineTo(250, 286);
        graphics.lineTo(348, 270);
        graphics.strokePath();
        graphics.lineStyle(2, 0x22201d, 0.65);
        graphics.lineBetween(12, 244, 34, 231);
        graphics.lineBetween(326, 231, 348, 244);
        graphics.lineStyle(1, 0x918b80, 0.6);
        graphics.lineBetween(42, 95, 318, 95);
        graphics.lineStyle(2, 0xd60056, 0.75);
        graphics.lineBetween(42, 95, 62, 95);
        graphics.lineBetween(298, 95, 318, 95);

        state.order.forEach((id, index) => {
          const x = SLOT_X[index];
          const selected = state.selected === index;
          const hint = state.hintLevel > 0 && answer[index] === id;
          drawIrregularStone(graphics, x, SLOT_Y, selected, hint, state.complete);
          graphics.fillStyle(0xd60056, 1);
          graphics.fillCircle(x - 28, SLOT_Y - 22, 9);
          this.stoneLabels[index]?.setText(localizedLabel(instance, id, language));
          this.stoneLabels[index]?.setColor(selected ? "#d60056" : "#22201d");
          this.stoneLabels[index]?.setAlpha(this.drag?.from === index ? 0.25 : 1);
          this.stoneZones[index]?.setPosition(x, SLOT_Y);
        });

        state.order.forEach((_id, index) => {
          this.addedNumbers ||= [];
          if (!this.addedNumbers[index]) {
            this.addedNumbers[index] = this.add.text(SLOT_X[index] - 28, SLOT_Y - 22, String(index + 1), {
              color: "#ffffff", fontFamily: "Fira Sans, sans-serif", fontSize: "11px", fontStyle: "700",
            }).setOrigin(0.5);
          }
        });

        if (this.drag) {
          graphics.fillStyle(0xf8c6d5, 0.9);
          graphics.lineStyle(3, 0xd60056, 1);
          graphics.fillRect(this.drag.x - 37, this.drag.y - 29, 74, 58);
          graphics.strokeRect(this.drag.x - 37, this.drag.y - 29, 74, 58);
        }

        if (state.crossingProgress > 0) {
          const x = 23 + state.crossingProgress * 314;
          const y = 151 - Math.sin(state.crossingProgress * Math.PI) * 18;
          graphics.lineStyle(2, 0x22201d, 1);
          graphics.strokeCircle(x, y - 13, 7);
          graphics.lineBetween(x, y - 6, x, y + 11);
          graphics.lineBetween(x, y, x - 9, y + 6);
          graphics.lineBetween(x, y, x + 9, y + 5);
          graphics.lineBetween(x, y + 11, x - 8, y + 21);
          graphics.lineBetween(x, y + 11, x + 9, y + 21);
        }
        this.crossingArt?.setAlpha(state.complete && state.crossingProgress >= 1 ? 0.72 : 0);
      }
    }

    return new BridgeOfFidelityScene();
  },

  serializeState(scene) {
    if (!scene?.b9State) return null;
    const state = cloneState(scene.b9State);
    state.crossingProgress = state.complete ? 1 : 0;
    return state;
  },

  restoreState(scene, savedState, instance) {
    const initial = createB9State(instance);
    const { answer } = normalizeB9Payload(instance?.payload);
    const order = isPermutation(savedState?.order, answer) ? [...savedState.order] : [...initial.order];
    scene.b9InitialState = cloneState(initial);
    scene.b9State = {
      order,
      selected: Number.isInteger(savedState?.selected) && savedState.selected >= 0 && savedState.selected < 4 ? savedState.selected : null,
      hintLevel: Math.max(0, Math.min(2, Number(savedState?.hintLevel) || 0)),
      checks: Math.max(0, Number(savedState?.checks) || 0),
      complete: Boolean(savedState?.complete),
      revealedSolution: Boolean(savedState?.revealedSolution),
      submittedOrder: isPermutation(savedState?.submittedOrder, answer) ? [...savedState.submittedOrder] : null,
      crossingProgress: savedState?.complete && !savedState?.revealedSolution ? 1 : 0,
      status: validLocalizedLabel(savedState?.status) ? { ...savedState.status } : localized("", ""),
    };
    if (scene.b9State.complete) scene.b9State.selected = null;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const state = scene.b9State;
    const { answer } = normalizeB9Payload(instance?.payload);
    const correct = isB9Correct(state, instance);
    state.checks += 1;
    state.selected = null;
    if (correct) {
      state.complete = true;
      state.revealedSolution = false;
      state.status = localized("The bridge holds. The crossing can begin.", "A ponte está firme. A travessia pode começar.");
      scene.redraw?.();
      scene.playCrossing?.();
      scene.notify?.();
      return {
        correct: true,
        complete: true,
        feedback: localized("The bridge holds: attraction meets reality, chooses a concrete good, and becomes fidelity.", "A ponte está firme: a atração encontra a realidade, escolhe um bem concreto e se torna fidelidade."),
      };
    }

    if (instance.mode === "mission") {
      state.submittedOrder = [...state.order];
      state.order = [...answer];
      state.complete = true;
      state.revealedSolution = true;
      state.status = localized("Solution shown after your one submission.", "Solução mostrada após sua única resposta.");
      scene.redraw?.();
      scene.notify?.();
      return {
        correct: false,
        complete: true,
        feedback: localized("Not yet. The faithful path is attraction → reality → concrete good → fidelity.", "Ainda não. O caminho fiel é atração → realidade → bem concreto → fidelidade."),
      };
    }

    state.status = localized("The bridge is not stable yet. Revise the order and check again.", "A ponte ainda não está firme. Revise a ordem e verifique novamente.");
    scene.redraw?.();
    scene.notify?.();
    return {
      correct: false,
      complete: false,
      feedback: localized("The bridge is not stable yet. Revise freely; every stone must take part.", "A ponte ainda não está firme. Revise à vontade; todas as pedras devem participar."),
    };
  },

  getAccessibleActions(scene, instance) {
    if (!scene?.b9State) return [];
    const state = scene.b9State;
    return state.order.map((id, index) => {
      const enLabel = localizedLabel(instance, id, "en");
      const ptLabel = localizedLabel(instance, id, "pt");
      const selected = state.selected;
      return {
        id: `slot-${index + 1}`,
        label: selected === null
          ? localized(`Select ${enLabel}, position ${index + 1}`, `Selecionar ${ptLabel}, posição ${index + 1}`)
          : selected === index
            ? localized(`Cancel selection of ${enLabel}`, `Cancelar seleção de ${ptLabel}`)
            : localized(`Swap with ${enLabel}, position ${index + 1}`, `Trocar com ${ptLabel}, posição ${index + 1}`),
        disabled: state.complete,
        run: () => scene.tapSlot?.(index),
      };
    });
  },

  showHint(scene, hintIndex, instance) {
    const state = scene.b9State;
    const { answer } = normalizeB9Payload(instance?.payload);
    state.hintLevel = Math.max(state.hintLevel, Math.min(2, hintIndex + 1));
    if (hintIndex >= 1 && !state.complete) {
      const incorrectIndex = answer.findIndex((id, index) => state.order[index] !== id);
      if (incorrectIndex >= 0) {
        const source = state.order.indexOf(answer[incorrectIndex]);
        swapB9Slots(state, source, incorrectIndex);
      }
    }
    state.selected = null;
    state.status = hintIndex === 0
      ? localized("Attraction begins the crossing; fidelity belongs on the far bank.", "A atração inicia a travessia; a fidelidade fica na outra margem.")
      : localized("One stone moved home. Reality follows attraction; concrete good prepares fidelity.", "Uma pedra foi ao lugar certo. A realidade segue a atração; o bem concreto prepara a fidelidade.");
    scene.redraw?.();
    scene.notify?.();
    return state.status;
  },

  destroy(scene) {
    scene?.tweens?.killAll?.();
    for (const zone of scene?.stoneZones || []) zone.removeAllListeners?.();
    scene?.input?.removeAllListeners?.();
  },
});
