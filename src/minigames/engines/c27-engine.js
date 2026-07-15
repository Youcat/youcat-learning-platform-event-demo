const INK = 0x22201d;
const MUTED = 0x6f6a61;
const BORDER = 0xd9d2bf;
const LOVE_RED = 0xd60056;
const LOVE_RED_SOFT = 0xf7e4eb;
const ERROR = 0xb3261e;

const PAYLOAD_FIELDS = ["concepts", "fruitCount", "gateCount", "schemaVersion"];
const REQUIRED_CONCEPTS = ["prayer", "first-step", "listening", "repair", "attention"];
const FALLBACK_PAYLOAD = Object.freeze({
  schemaVersion: 1,
  gateCount: 5,
  fruitCount: 3,
  concepts: REQUIRED_CONCEPTS,
});

const COPY = Object.freeze({
  en: {
    concepts: ["Prayer", "First step", "Listening", "Repair", "Again"],
    fruits: ["trust", "peace", "joy"],
    left: "left",
    right: "right",
    canvas: "Wellspring water-gate puzzle. Use Up and Down to choose a gate, and Left or Right to set its channel.",
  },
  pt: {
    concepts: ["Oração", "Primeiro passo", "Escuta", "Reparação", "De novo"],
    fruits: ["confiança", "paz", "alegria"],
    left: "esquerdo",
    right: "direito",
    canvas: "Quebra-cabeça de comportas Nascente. Use as setas para cima e para baixo para escolher uma comporta e esquerda ou direita para definir o canal.",
  },
});

const GATES = Object.freeze([
  { x: 180, y: 56 },
  { x: 78, y: 153 },
  { x: 168, y: 146 },
  { x: 181, y: 229 },
  { x: 286, y: 166 },
]);

const FRUITS = Object.freeze([
  { x: 62, y: 316, gates: [0, 1] },
  { x: 181, y: 316, gates: [0, 2, 3] },
  { x: 298, y: 316, gates: [0, 4] },
]);

function localized(en, pt) {
  return { en, pt };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, fields) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed || "C27-fallback")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeWellspringPayload(payload) {
  const validation = validateWellspringPayload(payload);
  return {
    payload: validation.ok ? safeClone(payload) : safeClone(FALLBACK_PAYLOAD),
    fallbackUsed: !validation.ok,
  };
}

export function validateWellspringPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, PAYLOAD_FIELDS)) errors.push(`payload must contain exactly ${PAYLOAD_FIELDS.join(", ")}`);
  if (payload?.schemaVersion !== 1) errors.push("payload.schemaVersion must be 1");
  if (payload?.gateCount !== 5) errors.push("payload.gateCount must be 5");
  if (payload?.fruitCount !== 3) errors.push("payload.fruitCount must be 3");
  if (!Array.isArray(payload?.concepts) || payload.concepts.length !== 5 || payload.concepts.some((value, index) => value !== REQUIRED_CONCEPTS[index])) {
    errors.push(`payload.concepts must be ${REQUIRED_CONCEPTS.join(", ")}`);
  }
  return { ok: errors.length === 0, errors };
}

export function generateWellspringPuzzle(seed, payload) {
  const normalized = normalizeWellspringPayload(payload);
  const random = seededRandom(seed);
  const solution = Array.from({ length: 5 }, () => random() >= 0.5 ? 1 : 0);
  if (solution.every((value) => value === solution[0])) solution[4] = solution[0] ? 0 : 1;
  const flipOrder = [0, 1, 2, 3, 4];
  for (let index = flipOrder.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [flipOrder[index], flipOrder[other]] = [flipOrder[other], flipOrder[index]];
  }
  const initial = [...solution];
  const flips = 3 + (random() >= 0.5 ? 1 : 0);
  flipOrder.slice(0, flips).forEach((gateIndex) => { initial[gateIndex] = initial[gateIndex] ? 0 : 1; });
  return Object.freeze({
    seed: String(seed || "C27-fallback"),
    payload: normalized.payload,
    fallbackUsed: normalized.fallbackUsed,
    solution: Object.freeze(solution),
    initial: Object.freeze(initial),
    gates: GATES,
    fruits: FRUITS,
  });
}

export function waterReachFor(puzzle, gateStates) {
  const states = Array.isArray(gateStates) && gateStates.length === 5
    ? gateStates.map((value) => value === 1 ? 1 : 0)
    : [...puzzle.initial];
  const gateOpen = states.map((value, index) => value === puzzle.solution[index]);
  const fruitReached = puzzle.fruits.map((fruit) => fruit.gates.every((index) => gateOpen[index]));
  return {
    gateOpen,
    fruitReached,
    reachedCount: fruitReached.filter(Boolean).length,
    complete: fruitReached.every(Boolean),
  };
}

export function createWellspringState(puzzle) {
  return {
    gateStates: [...puzzle.initial],
    selectedGate: 0,
    hintLevel: 0,
    moveCount: 0,
    interactionMessage: "",
    lastEvaluation: null,
    showSolution: false,
  };
}

function restoredState(savedState, puzzle) {
  const clean = createWellspringState(puzzle);
  if (!isRecord(savedState)) return clean;
  if (Array.isArray(savedState.gateStates) && savedState.gateStates.length === 5 && savedState.gateStates.every((value) => value === 0 || value === 1)) {
    clean.gateStates = [...savedState.gateStates];
  }
  if (Number.isInteger(savedState.selectedGate)) clean.selectedGate = Math.max(0, Math.min(4, savedState.selectedGate));
  clean.hintLevel = Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0));
  clean.moveCount = Math.max(0, Math.floor(Number(savedState.moveCount) || 0));
  clean.interactionMessage = typeof savedState.interactionMessage === "string" ? savedState.interactionMessage.slice(0, 160) : "";
  clean.lastEvaluation = savedState.lastEvaluation === "correct" || savedState.lastEvaluation === "wrong" ? savedState.lastEvaluation : null;
  clean.showSolution = Boolean(savedState.showSolution);
  return clean;
}

function firstClosedGate(puzzle, state) {
  return waterReachFor(puzzle, state.gateStates).gateOpen.findIndex((open) => !open);
}

function activeSegments(puzzle, state) {
  const flow = waterReachFor(puzzle, state.gateStates);
  const prayer = flow.gateOpen[0];
  return {
    source: true,
    trunk: prayer,
    leftIn: prayer,
    leftOut: prayer && flow.gateOpen[1],
    middleIn: prayer,
    middleMid: prayer && flow.gateOpen[2],
    middleOut: prayer && flow.gateOpen[2] && flow.gateOpen[3],
    rightIn: prayer,
    rightOut: prayer && flow.gateOpen[4],
  };
}

function drawLine(graphics, points, active) {
  graphics.lineStyle(active ? 4 : 2, active ? LOVE_RED : BORDER, active ? 0.78 : 1);
  graphics.beginPath();
  graphics.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => graphics.lineTo(x, y));
  graphics.strokePath();
}

function drawFruit(graphics, fruit, reached) {
  graphics.fillStyle(reached ? LOVE_RED_SOFT : 0xffffff, 1);
  graphics.lineStyle(2, reached ? LOVE_RED : INK, 1);
  graphics.fillCircle(fruit.x, fruit.y, 12);
  graphics.strokeCircle(fruit.x, fruit.y, 12);
  graphics.beginPath();
  graphics.moveTo(fruit.x, fruit.y - 12);
  graphics.lineTo(fruit.x + 4, fruit.y - 22);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(fruit.x + 3, fruit.y - 19);
  graphics.lineTo(fruit.x + 11, fruit.y - 17);
  graphics.lineTo(fruit.x + 5, fruit.y - 13);
  graphics.strokePath();
  if (reached) {
    graphics.fillStyle(LOVE_RED, 1);
    graphics.fillCircle(fruit.x - 4, fruit.y + 1, 2);
    graphics.fillCircle(fruit.x + 4, fruit.y + 4, 2);
  }
}

function gateTarget(gate, direction) {
  return { x: gate.x + (direction === 0 ? -22 : 22), y: gate.y + 21 };
}

function drawGate(graphics, gate, state, solution, selected, showSolution) {
  const left = gateTarget(gate, 0);
  const right = gateTarget(gate, 1);
  graphics.lineStyle(1.5, BORDER, 1);
  graphics.lineBetween(gate.x, gate.y + 4, left.x, left.y);
  graphics.lineBetween(gate.x, gate.y + 4, right.x, right.y);
  graphics.fillStyle(0xffffff, 1);
  graphics.lineStyle(selected ? 3 : 1.5, selected ? LOVE_RED : INK, 1);
  graphics.fillCircle(gate.x, gate.y, selected ? 9 : 8);
  graphics.strokeCircle(gate.x, gate.y, selected ? 9 : 8);
  const target = gateTarget(gate, state);
  graphics.lineStyle(4, INK, 1);
  graphics.lineBetween(gate.x, gate.y, target.x, target.y);
  graphics.fillStyle(selected ? LOVE_RED : INK, 1);
  graphics.fillCircle(target.x, target.y, 4);
  if (showSolution && state !== solution) {
    const correct = gateTarget(gate, solution);
    graphics.lineStyle(2, ERROR, 1);
    graphics.strokeCircle(correct.x, correct.y, 7);
  }
}

export const c27Engine = Object.freeze({
  validate(payload, instance) {
    const result = validateWellspringPayload(payload);
    const errors = [...result.errors];
    if (instance?.layoutOverrides?.canvasHeight !== undefined && instance.layoutOverrides.canvasHeight !== 350) {
      errors.push("layoutOverrides.canvasHeight must be 350 when provided");
    }
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const puzzle = generateWellspringPuzzle(instance.seed, instance.payload);
    const locale = language === "pt" ? "pt" : "en";

    class WellspringScene extends Phaser.Scene {
      constructor() {
        super({ key: `C27-${instance.id}` });
        this.wellspringPuzzle = puzzle;
        this.wellspringInitialState = createWellspringState(puzzle);
        this.wellspringState = createWellspringState(puzzle);
        this.dragStarts = new Map();
        this.reducedMotion = Boolean(reducedMotion);
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("c27-prayer-fidelity", instance.assets.baseImage);
      }

      create() {
        this.artwork = instance.assets.baseImage
          ? this.add.image(180, 184, "c27-prayer-fidelity").setDisplaySize(144, 144).setAlpha(0).setDepth(0)
          : null;
        this.graphics = this.add.graphics().setDepth(1);
        this.labels = GATES.map((gate, index) => this.add.text(gate.x, gate.y - 18, COPY[locale].concepts[index], {
          fontFamily: "Fira Sans, sans-serif",
          fontSize: "11px",
          fontStyle: "600",
          color: "#6f6a61",
          backgroundColor: "#ffffff",
          padding: { x: 2, y: 1 },
        }).setOrigin(0.5, 1).setDepth(2));
        this.fruitLabels = FRUITS.map((fruit, index) => this.add.text(fruit.x, 340, COPY[locale].fruits[index], {
          fontFamily: "Fira Sans, sans-serif",
          fontSize: "11px",
          color: "#6f6a61",
        }).setOrigin(0.5, 1).setDepth(2));
        this.statusText = this.add.text(180, 286, "", {
          fontFamily: "Fira Sans, sans-serif",
          fontSize: "11px",
          fontStyle: "600",
          color: "#b3261e",
          backgroundColor: "#ffffff",
          padding: { x: 4, y: 2 },
          align: "center",
          wordWrap: { width: 310 },
        }).setOrigin(0.5, 1).setDepth(3);

        this.gateZones = GATES.map((gate, index) => {
          const zone = this.add.zone(gate.x, gate.y + 8, 52, 52).setInteractive({ cursor: "grab" });
          this.input.setDraggable(zone);
          zone.on("pointerdown", (pointer) => {
            this.dragStarts.set(index, pointer.x);
            this.selectGate(index);
          });
          zone.on("dragend", (pointer) => {
            const startX = this.dragStarts.get(index) ?? pointer.x;
            const distance = pointer.x - startX;
            if (Math.abs(distance) < 10) return;
            this.setGate(index, distance < 0 ? 0 : 1);
          });
          return zone;
        });

        this.targetZones = GATES.flatMap((gate, gateIndex) => [0, 1].map((direction) => {
          const target = gateTarget(gate, direction);
          return this.add.zone(target.x, target.y, 30, 30).setInteractive({ cursor: "pointer" }).on("pointerdown", () => {
            if (this.wellspringState.selectedGate !== gateIndex) {
              this.rejectMove();
              return;
            }
            this.setGate(gateIndex, direction);
          });
        }));

        const canvas = this.game.canvas;
        canvas.tabIndex = 0;
        canvas.setAttribute("role", "application");
        canvas.setAttribute("aria-label", COPY[locale].canvas);
        this.input.keyboard.on("keydown-UP", (event) => { event.preventDefault(); this.cycleGate(-1); });
        this.input.keyboard.on("keydown-DOWN", (event) => { event.preventDefault(); this.cycleGate(1); });
        this.input.keyboard.on("keydown-LEFT", (event) => { event.preventDefault(); this.setGate(this.wellspringState.selectedGate, 0); });
        this.input.keyboard.on("keydown-RIGHT", (event) => { event.preventDefault(); this.setGate(this.wellspringState.selectedGate, 1); });
        this.input.keyboard.on("keydown-ENTER", (event) => { event.preventDefault(); this.toggleGate(this.wellspringState.selectedGate); });
        this.input.keyboard.on("keydown-SPACE", (event) => { event.preventDefault(); this.toggleGate(this.wellspringState.selectedGate); });
        this.redraw();
        onReady(this);
      }

      selectGate(index) {
        this.wellspringState.selectedGate = Math.max(0, Math.min(4, index));
        this.wellspringState.interactionMessage = "";
        this.redraw();
        this.notify();
      }

      cycleGate(direction) {
        const next = (this.wellspringState.selectedGate + direction + 5) % 5;
        this.selectGate(next);
      }

      setGate(index, direction) {
        if (!Number.isInteger(index) || index < 0 || index >= 5 || (direction !== 0 && direction !== 1)) {
          this.rejectMove();
          return false;
        }
        this.wellspringState.selectedGate = index;
        if (this.wellspringState.gateStates[index] !== direction) this.wellspringState.moveCount += 1;
        this.wellspringState.gateStates[index] = direction;
        this.wellspringState.interactionMessage = "";
        this.wellspringState.lastEvaluation = null;
        this.wellspringState.showSolution = false;
        this.redraw();
        this.notify();
        return true;
      }

      toggleGate(index) {
        return this.setGate(index, this.wellspringState.gateStates[index] ? 0 : 1);
      }

      rejectMove() {
        this.wellspringState.interactionMessage = locale === "pt"
          ? "Primeiro selecione a comporta ligada a esse canal."
          : "Select the gate connected to that channel first.";
        this.redraw();
        this.notify();
        return false;
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.graphics) return;
        const graphics = this.graphics;
        const state = this.wellspringState;
        const flow = waterReachFor(puzzle, state.gateStates);
        const segments = activeSegments(puzzle, state);
        graphics.clear();
        this.artwork?.setAlpha(state.lastEvaluation === "correct" ? 0.13 : 0);
        this.statusText?.setText(state.interactionMessage || "");

        graphics.lineStyle(2, INK, 1);
        graphics.beginPath();
        graphics.moveTo(163, 18);
        graphics.lineTo(180, 8);
        graphics.lineTo(197, 18);
        graphics.strokePath();
        graphics.fillStyle(LOVE_RED_SOFT, 1);
        graphics.fillCircle(180, 15, 8);
        graphics.lineStyle(1.5, LOVE_RED, 1);
        graphics.strokeCircle(180, 15, 8);

        drawLine(graphics, [[180, 23], [180, 48]], segments.source);
        drawLine(graphics, [[180, 78], [180, 102]], segments.trunk);
        drawLine(graphics, [[180, 102], [112, 123], [78, 143]], segments.leftIn);
        drawLine(graphics, [[78, 175], [67, 236], [62, 298]], segments.leftOut);
        drawLine(graphics, [[180, 102], [168, 136]], segments.middleIn);
        drawLine(graphics, [[168, 168], [181, 219]], segments.middleMid);
        drawLine(graphics, [[181, 251], [181, 298]], segments.middleOut);
        drawLine(graphics, [[180, 102], [246, 126], [286, 156]], segments.rightIn);
        drawLine(graphics, [[286, 188], [296, 238], [298, 298]], segments.rightOut);

        GATES.forEach((gate, index) => drawGate(
          graphics,
          gate,
          state.gateStates[index],
          puzzle.solution[index],
          state.selectedGate === index,
          state.showSolution,
        ));
        FRUITS.forEach((fruit, index) => drawFruit(graphics, fruit, flow.fruitReached[index]));

        if (state.hintLevel > 0) {
          const gateIndex = firstClosedGate(puzzle, state);
          if (gateIndex >= 0) {
            const gate = GATES[gateIndex];
            graphics.lineStyle(2, LOVE_RED, this.reducedMotion ? 0.55 : 0.85);
            graphics.strokeCircle(gate.x, gate.y, 15);
          }
        }
      }
    }

    return new WellspringScene();
  },

  serializeState(scene) {
    if (!scene?.wellspringState) return null;
    return safeClone(scene.wellspringState);
  },

  restoreState(scene, savedState, instance) {
    if (!scene) return;
    const puzzle = scene.wellspringPuzzle || generateWellspringPuzzle(instance?.seed, instance?.payload);
    scene.wellspringPuzzle = puzzle;
    scene.wellspringInitialState = createWellspringState(puzzle);
    scene.wellspringState = restoredState(savedState, puzzle);
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const puzzle = scene?.wellspringPuzzle || generateWellspringPuzzle(instance?.seed, instance?.payload);
    const state = scene?.wellspringState || createWellspringState(puzzle);
    const flow = waterReachFor(puzzle, state.gateStates);
    state.lastEvaluation = flow.complete ? "correct" : "wrong";
    state.showSolution = instance?.mode === "mission" && !flow.complete;
    scene?.redraw?.();
    const remaining = 3 - flow.reachedCount;
    return {
      correct: flow.complete,
      complete: flow.complete,
      feedback: flow.complete
        ? localized(
          "All three fruits receive water. Grace becomes visible in faithful, repeated acts.",
          "Os três frutos recebem água. A graça torna-se visível em gestos fiéis e repetidos.",
        )
        : localized(
          `${remaining} ${remaining === 1 ? "fruit is" : "fruits are"} still dry. The marked channel shows the solution.`,
          `${remaining} ${remaining === 1 ? "fruto ainda está seco" : "frutos ainda estão secos"}. O canal marcado mostra a solução.`,
        ),
    };
  },

  getAccessibleActions(scene) {
    if (!scene?.wellspringState || !scene?.wellspringPuzzle) return [];
    return REQUIRED_CONCEPTS.map((_concept, index) => {
      const direction = scene.wellspringState.gateStates[index];
      return {
        id: `gate-${index}`,
        label: {
          en: `${COPY.en.concepts[index]} gate: ${direction ? COPY.en.right : COPY.en.left}. Toggle`,
          pt: `${COPY.pt.concepts[index]}: ${direction ? COPY.pt.right : COPY.pt.left}. Alternar`,
        },
        run: () => scene.toggleGate(index),
      };
    });
  },

  showHint(scene, hintIndex) {
    const state = scene.wellspringState;
    const puzzle = scene.wellspringPuzzle;
    state.hintLevel = Math.max(state.hintLevel, Math.max(0, Math.min(1, hintIndex)) + 1);
    const gateIndex = firstClosedGate(puzzle, state);
    if (hintIndex === 1 && gateIndex >= 0) scene.setGate(gateIndex, puzzle.solution[gateIndex]);
    else {
      state.selectedGate = gateIndex >= 0 ? gateIndex : state.selectedGate;
      scene.redraw?.();
      scene.notify?.();
    }
    if (gateIndex < 0) return localized("Every fruit already receives water. Check your work.", "Todos os frutos já recebem água. Verifique sua resposta.");
    return hintIndex === 0
      ? localized(
        `Begin with the ${COPY.en.concepts[gateIndex].toLowerCase()} gate marked in pink. Follow the water from the spring.`,
        `Comece pela comporta ${COPY.pt.concepts[gateIndex].toLowerCase()} marcada em rosa. Siga a água desde a nascente.`,
      )
      : localized(
        `The ${COPY.en.concepts[gateIndex].toLowerCase()} gate has been set correctly. Continue downstream.`,
        `A comporta ${COPY.pt.concepts[gateIndex].toLowerCase()} foi colocada corretamente. Continue seguindo o curso da água.`,
      );
  },

  destroy(scene) {
    scene?.gateZones?.forEach((zone) => zone.removeAllListeners());
    scene?.targetZones?.forEach((zone) => zone.removeAllListeners());
    scene?.input?.keyboard?.removeAllListeners();
    scene?.input?.removeAllListeners();
    scene?.graphics?.destroy();
    scene?.labels?.forEach((label) => label.destroy());
    scene?.fruitLabels?.forEach((label) => label.destroy());
    scene?.statusText?.destroy();
    scene?.artwork?.destroy();
  },
});
