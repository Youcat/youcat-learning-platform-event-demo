const ENGINE_ID = "C22";

const DEFAULT_PAYLOAD = Object.freeze({
  scenario: "friendship-attraction-boundary",
  requiredMoves: 6,
  minExplorationDistance: 0.12,
  step: 0.04,
  constraints: Object.freeze({
    minDistance: 0.24,
    maxDistance: 0.4,
    openYMin: 0.54,
    openYMax: 0.82,
    maxVerticalGap: 0.15,
  }),
});

const FIGURE_IDS = Object.freeze(["friend-a", "friend-b"]);
const REFLECTION_IDS = Object.freeze(["transparency", "freedom", "boundary"]);
const FIELD_BOUNDS = Object.freeze({ minX: 0.1, maxX: 0.9, minY: 0.16, maxY: 0.88 });
const MIN_FIGURE_GAP = 0.105;

const words = Object.freeze({
  en: {
    friendA: "Friend A",
    friendB: "Friend B",
    private: "PRIVATE",
    open: "OPEN · TRANSPARENT",
    explored: "explored",
    exploreBoth: "Move both figures to explore the field",
    choosePrinciple: "Choose one guiding principle below",
    invalid: "That move would overlap the figures or leave the field.",
    selectedA: "Friend A selected.",
    selectedB: "Friend B selected.",
    moved: "Figure moved.",
    reflection: "Guiding principle selected.",
  },
  pt: {
    friendA: "Amigo A",
    friendB: "Amigo B",
    private: "PRIVADO",
    open: "ABERTO · TRANSPARENTE",
    explored: "explorado",
    exploreBoth: "Mova as duas figuras para explorar o campo",
    choosePrinciple: "Escolha abaixo um princípio orientador",
    invalid: "Esse movimento sobreporia as figuras ou sairia do campo.",
    selectedA: "Amigo A selecionado.",
    selectedB: "Amigo B selecionado.",
    moved: "Figura movida.",
    reflection: "Princípio orientador selecionado.",
  },
});

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

function finiteBetween(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validPoint(point) {
  return isRecord(point)
    && finiteBetween(point.x, FIELD_BOUNDS.minX, FIELD_BOUNDS.maxX)
    && finiteBetween(point.y, FIELD_BOUNDS.minY, FIELD_BOUNDS.maxY);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "c22-safe-fallback")) {
    hash ^= character.codePointAt(0);
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

function payloadErrors(payload) {
  const errors = [];
  if (!hasExactKeys(payload, ["scenario", "requiredMoves", "minExplorationDistance", "step", "constraints"])) {
    errors.push("payload must contain exactly {scenario, requiredMoves, minExplorationDistance, step, constraints}");
    return errors;
  }
  if (payload.scenario !== DEFAULT_PAYLOAD.scenario) errors.push(`payload.scenario must be ${DEFAULT_PAYLOAD.scenario}`);
  if (!Number.isInteger(payload.requiredMoves) || payload.requiredMoves < 2 || payload.requiredMoves > 20) errors.push("payload.requiredMoves must be an integer from 2 to 20");
  if (!finiteBetween(payload.minExplorationDistance, 0.06, 0.3)) errors.push("payload.minExplorationDistance must be from 0.06 to 0.3");
  if (!finiteBetween(payload.step, 0.02, 0.08)) errors.push("payload.step must be from 0.02 to 0.08");
  if (!hasExactKeys(payload.constraints, ["minDistance", "maxDistance", "openYMin", "openYMax", "maxVerticalGap"])) {
    errors.push("payload.constraints has an invalid shape");
    return errors;
  }
  const constraints = payload.constraints;
  if (!finiteBetween(constraints.minDistance, 0.16, 0.34)) errors.push("constraints.minDistance must be from 0.16 to 0.34");
  if (!finiteBetween(constraints.maxDistance, 0.3, 0.56) || constraints.maxDistance <= constraints.minDistance) errors.push("constraints.maxDistance must be greater than minDistance and at most 0.56");
  if (!finiteBetween(constraints.openYMin, 0.42, 0.7)) errors.push("constraints.openYMin must be from 0.42 to 0.7");
  if (!finiteBetween(constraints.openYMax, 0.7, FIELD_BOUNDS.maxY) || constraints.openYMax <= constraints.openYMin) errors.push("constraints.openYMax must be greater than openYMin and at most 0.88");
  if (!finiteBetween(constraints.maxVerticalGap, 0.08, 0.24)) errors.push("constraints.maxVerticalGap must be from 0.08 to 0.24");
  return errors;
}

export function normalizeC22Payload(payload) {
  return payloadErrors(payload).length ? clone(DEFAULT_PAYLOAD) : clone(payload);
}

export function isHealthyC22Arrangement(positions, payload = DEFAULT_PAYLOAD) {
  const normalized = normalizeC22Payload(payload);
  const a = positions?.[FIGURE_IDS[0]];
  const b = positions?.[FIGURE_IDS[1]];
  if (!validPoint(a) || !validPoint(b)) return false;
  const gap = distance(a, b);
  const { constraints } = normalized;
  return gap >= constraints.minDistance
    && gap <= constraints.maxDistance
    && a.y >= constraints.openYMin
    && a.y <= constraints.openYMax
    && b.y >= constraints.openYMin
    && b.y <= constraints.openYMax
    && Math.abs(a.y - b.y) <= constraints.maxVerticalGap;
}

export function generateC22Field(seed, payload = DEFAULT_PAYLOAD) {
  const normalized = normalizeC22Payload(payload);
  const random = seededRandom(seed);
  const mirror = random() >= 0.5;
  const jitter = () => (random() - 0.5) * 0.024;
  const starts = {
    "friend-a": { x: (mirror ? 0.55 : 0.37) + jitter(), y: 0.3 + jitter() },
    "friend-b": { x: (mirror ? 0.39 : 0.53) + jitter(), y: 0.34 + jitter() },
  };
  const solution = {
    "friend-a": { x: (mirror ? 0.64 : 0.36) + jitter(), y: 0.67 + jitter() },
    "friend-b": { x: (mirror ? 0.36 : 0.64) + jitter(), y: 0.69 + jitter() },
  };
  return Object.freeze({
    seed: String(seed || "c22-safe-fallback"),
    payload: normalized,
    starts,
    solution,
    solvable: isHealthyC22Arrangement(solution, normalized),
  });
}

function initialState(field) {
  return {
    positions: clone(field.starts),
    selected: "friend-a",
    explored: { "friend-a": false, "friend-b": false },
    moveCount: 0,
    reflection: null,
    hintLevel: 0,
    showSolution: false,
    lastNotice: null,
  };
}

function explorationReady(state, payload) {
  return state.moveCount >= payload.requiredMoves && FIGURE_IDS.every((id) => state.explored[id]);
}

function moveIsPossible(state, figureId, point) {
  if (!validPoint(point)) return false;
  const otherId = FIGURE_IDS.find((id) => id !== figureId);
  return distance(point, state.positions[otherId]) >= MIN_FIGURE_GAP;
}

export function isC22MovePossible(positions, figureId, point) {
  if (!FIGURE_IDS.includes(figureId)) return false;
  const state = { positions };
  return FIGURE_IDS.every((id) => validPoint(positions?.[id])) && moveIsPossible(state, figureId, point);
}

function restoredState(scene, savedState) {
  const fallback = initialState(scene.c22Field);
  if (!isRecord(savedState)) return fallback;
  const positions = {};
  for (const id of FIGURE_IDS) positions[id] = validPoint(savedState.positions?.[id]) ? { ...savedState.positions[id] } : { ...fallback.positions[id] };
  if (distance(positions["friend-a"], positions["friend-b"]) < MIN_FIGURE_GAP) return fallback;
  const reflection = REFLECTION_IDS.includes(savedState.reflection) ? savedState.reflection : null;
  return {
    positions,
    selected: FIGURE_IDS.includes(savedState.selected) ? savedState.selected : fallback.selected,
    explored: {
      "friend-a": Boolean(savedState.explored?.["friend-a"]),
      "friend-b": Boolean(savedState.explored?.["friend-b"]),
    },
    moveCount: Math.max(0, Math.min(999, Math.floor(Number(savedState.moveCount) || 0))),
    reflection,
    hintLevel: Math.max(0, Math.min(2, Math.floor(Number(savedState.hintLevel) || 0))),
    showSolution: Boolean(savedState.showSolution),
    lastNotice: typeof savedState.lastNotice === "string" ? savedState.lastNotice.slice(0, 120) : null,
  };
}

function drawDashedLine(graphics, x1, y1, x2, y2, dash = 7, gap = 5) {
  const total = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / total;
  const dy = (y2 - y1) / total;
  for (let start = 0; start < total; start += dash + gap) {
    const end = Math.min(total, start + dash);
    graphics.lineBetween(x1 + dx * start, y1 + dy * start, x1 + dx * end, y1 + dy * end);
  }
}

function drawFigure(graphics, x, y, selected, color, scale = 1) {
  const headY = y - 20 * scale;
  graphics.fillStyle(0xffffff, 1);
  graphics.fillEllipse(x, headY, 24 * scale, 31 * scale);
  graphics.lineStyle(selected ? 3 : 2, color, 1);
  graphics.strokeEllipse(x + 0.8, headY, 24 * scale, 31 * scale);
  graphics.lineBetween(x - 1, y - 4 * scale, x - 3, y + 24 * scale);
  graphics.lineBetween(x - 2, y + 4 * scale, x - 17 * scale, y + 13 * scale);
  graphics.lineBetween(x - 1, y + 4 * scale, x + 16 * scale, y + 11 * scale);
  graphics.lineBetween(x - 3, y + 24 * scale, x - 14 * scale, y + 42 * scale);
  graphics.lineBetween(x - 3, y + 24 * scale, x + 10 * scale, y + 42 * scale);
  if (selected) {
    graphics.lineStyle(1.5, 0xd60056, 0.95);
    graphics.strokeEllipse(x, y + 7, 58 * scale, 78 * scale);
  }
}

function evaluationFor(scene, instance) {
  const state = scene.c22State;
  const payload = scene.c22Field.payload;
  const explored = explorationReady(state, payload);
  const reflected = REFLECTION_IDS.includes(state.reflection);
  const healthy = isHealthyC22Arrangement(state.positions, payload);
  const correct = explored && reflected && healthy;

  if (!explored) {
    return { correct: false, complete: false, feedback: localized(
      "Explore the field by moving both figures before you check.",
      "Explore o campo movendo as duas figuras antes de verificar.",
    ) };
  }
  if (!reflected) {
    return { correct: false, complete: false, feedback: localized(
      "Choose transparency, freedom, or boundary as your guiding principle, then check again.",
      "Escolha transparência, liberdade ou limite como princípio orientador e verifique novamente.",
    ) };
  }
  if (!healthy) {
    const { constraints } = payload;
    const a = state.positions["friend-a"];
    const b = state.positions["friend-b"];
    const gap = distance(a, b);
    let feedback = localized(
      "Keep both figures in the open field, with warm closeness and visible freedom.",
      "Mantenha as duas figuras no campo aberto, com proximidade calorosa e liberdade visível.",
    );
    if (a.y < constraints.openYMin || b.y < constraints.openYMin) feedback = localized(
      "Move both figures toward the open, transparent part of the field.",
      "Mova as duas figuras para a parte aberta e transparente do campo.",
    );
    else if (gap < constraints.minDistance) feedback = localized(
      "Leave a little more space so attraction does not remove freedom.",
      "Deixe um pouco mais de espaço para que a atração não retire a liberdade.",
    );
    else if (gap > constraints.maxDistance) feedback = localized(
      "Bring the figures a little closer so the friendship remains warm.",
      "Aproxime um pouco as figuras para que a amizade permaneça calorosa.",
    );
    return { correct: false, complete: false, feedback };
  }
  return { correct, complete: correct, feedback: localized(
    "The field holds friendship, acknowledged attraction, transparency, freedom, and a clear boundary together.",
    "O campo mantém juntos amizade, atração reconhecida, transparência, liberdade e um limite claro.",
  ) };
}

export const c22MagneticFieldEngine = Object.freeze({
  validate(payload, instance) {
    const errors = payloadErrors(payload);
    const overrides = instance?.layoutOverrides;
    if (!isRecord(overrides)) errors.push("layoutOverrides must be an object");
    else {
      const unknown = Object.keys(overrides).filter((key) => key !== "figureScale");
      if (unknown.length) errors.push(`unsupported layoutOverrides: ${unknown.join(", ")}`);
      if ("figureScale" in overrides && !finiteBetween(overrides.figureScale, 0.85, 1.15)) errors.push("layoutOverrides.figureScale must be from 0.85 to 1.15");
    }
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const locale = language === "pt" ? "pt" : "en";
    const field = generateC22Field(instance?.seed, instance?.payload);
    const figureScale = finiteBetween(instance?.layoutOverrides?.figureScale, 0.85, 1.15) ? instance.layoutOverrides.figureScale : 1;

    class C22MagneticFieldScene extends Phaser.Scene {
      constructor() {
        super({ key: `c22-${instance?.id || "fallback"}` });
        this.c22Field = field;
        this.c22InitialState = initialState(field);
        this.c22State = initialState(field);
        this.c22Locale = locale;
        this.c22ReducedMotion = Boolean(reducedMotion);
        this.c22KeyboardHandlers = [];
      }

      preload() {
        if (instance?.assets?.baseImage) this.load.image("c22-approved-friendship", instance.assets.baseImage);
      }

      create() {
        const width = this.scale.width;
        const height = this.scale.height;
        if (this.textures.exists("c22-approved-friendship")) {
          this.referenceArt = this.add.image(width - 48, 51, "c22-approved-friendship").setDisplaySize(86, 86).setAlpha(0.12);
        }
        this.graphics = this.add.graphics();
        this.statusText = this.add.text(18, height - 27, "", {
          fontFamily: "Fira Sans, sans-serif",
          fontSize: "12px",
          color: "#6f6a61",
        });
        this.labels = {
          private: this.add.text(18, 19, words[locale].private, { fontFamily: "Fira Sans, sans-serif", fontSize: "11px", fontStyle: "600", color: "#6f6a61" }),
          open: this.add.text(18, 153, words[locale].open, { fontFamily: "Fira Sans, sans-serif", fontSize: "11px", fontStyle: "600", color: "#d60056" }),
          a: this.add.text(0, 0, words[locale].friendA, { fontFamily: "Fira Sans, sans-serif", fontSize: "11px", fontStyle: "600", color: "#22201d" }).setOrigin(0.5, 0),
          b: this.add.text(0, 0, words[locale].friendB, { fontFamily: "Fira Sans, sans-serif", fontSize: "11px", fontStyle: "600", color: "#22201d" }).setOrigin(0.5, 0),
        };

        this.figureZones = {};
        for (const id of FIGURE_IDS) {
          const zone = this.add.zone(0, 0, 70, 92).setInteractive({ cursor: "grab" });
          this.input.setDraggable(zone);
          zone.on("pointerdown", () => {
            this.game.canvas?.focus();
            this.selectFigure(id);
          });
          zone.on("drag", (_pointer, x, y) => this.tryMove(id, { x: x / width, y: y / height }));
          this.figureZones[id] = zone;
        }

        this.input.on("pointerdown", (pointer, over) => {
          this.game.canvas?.focus();
          if (over.length) return;
          this.tryMove(this.c22State.selected, { x: pointer.x / width, y: pointer.y / height });
        });

        const bindKey = (eventName, handler) => {
          const wrapped = (event) => {
            if (document.activeElement !== this.game.canvas) return;
            event.preventDefault();
            handler();
          };
          this.input.keyboard.on(eventName, wrapped);
          this.c22KeyboardHandlers.push([eventName, wrapped]);
        };
        bindKey("keydown-LEFT", () => this.nudge(-field.payload.step, 0));
        bindKey("keydown-RIGHT", () => this.nudge(field.payload.step, 0));
        bindKey("keydown-UP", () => this.nudge(0, -field.payload.step));
        bindKey("keydown-DOWN", () => this.nudge(0, field.payload.step));
        bindKey("keydown-A", () => this.selectFigure("friend-a"));
        bindKey("keydown-B", () => this.selectFigure("friend-b"));
        bindKey("keydown-ONE", () => this.setReflection("transparency"));
        bindKey("keydown-TWO", () => this.setReflection("freedom"));
        bindKey("keydown-THREE", () => this.setReflection("boundary"));
        this.redraw();
        onReady(this);
      }

      selectFigure(id) {
        if (!FIGURE_IDS.includes(id)) return localized("Choose one of the two figures.", "Escolha uma das duas figuras.");
        this.c22State.selected = id;
        this.c22State.lastNotice = null;
        this.redraw();
        this.notify();
        return id === "friend-a" ? localized(words.en.selectedA, words.pt.selectedA) : localized(words.en.selectedB, words.pt.selectedB);
      }

      canMove(id, point) {
        return moveIsPossible(this.c22State, id, point);
      }

      tryMove(id, point) {
        const next = { x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 };
        if (!moveIsPossible(this.c22State, id, next)) {
          this.c22State.lastNotice = "invalid";
          this.redraw();
          this.notify();
          return localized(words.en.invalid, words.pt.invalid);
        }
        this.c22State.positions[id] = next;
        this.c22State.selected = id;
        this.c22State.moveCount += 1;
        this.c22State.explored[id] ||= distance(next, this.c22Field.starts[id]) >= this.c22Field.payload.minExplorationDistance;
        this.c22State.lastNotice = null;
        this.c22State.showSolution = false;
        this.redraw();
        this.notify();
        return localized(words.en.moved, words.pt.moved);
      }

      nudge(dx, dy) {
        const id = this.c22State.selected;
        const current = this.c22State.positions[id];
        return this.tryMove(id, { x: current.x + dx, y: current.y + dy });
      }

      setReflection(id) {
        if (!explorationReady(this.c22State, this.c22Field.payload)) {
          return localized("Move both figures before choosing a guiding principle.", "Mova as duas figuras antes de escolher um princípio orientador.");
        }
        if (!REFLECTION_IDS.includes(id)) return localized("Choose a listed principle.", "Escolha um dos princípios apresentados.");
        this.c22State.reflection = id;
        this.c22State.lastNotice = null;
        this.redraw();
        this.notify();
        return localized(words.en.reflection, words.pt.reflection);
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.graphics) return;
        const graphics = this.graphics;
        const width = this.scale.width;
        const height = this.scale.height;
        const state = this.c22State;
        const payload = this.c22Field.payload;
        const a = state.positions["friend-a"];
        const b = state.positions["friend-b"];
        const ax = a.x * width;
        const ay = a.y * height;
        const bx = b.x * width;
        const by = b.y * height;
        const midpoint = { x: (ax + bx) / 2, y: (ay + by) / 2 };

        graphics.clear();
        graphics.fillStyle(0xd60056, state.hintLevel > 0 ? 0.1 : 0.055);
        graphics.fillRect(0, payload.constraints.openYMin * height, width, (payload.constraints.openYMax - payload.constraints.openYMin) * height);
        graphics.lineStyle(1.5, 0xd9d2bf, 1);
        drawDashedLine(graphics, 16, payload.constraints.openYMin * height, width - 16, payload.constraints.openYMin * height);
        graphics.lineStyle(1.5, 0xd60056, 0.6);
        drawDashedLine(graphics, 36, 54, 36, height - 42, 5, 6);
        drawDashedLine(graphics, width - 36, 54, width - 36, height - 42, 5, 6);

        const gap = distance(a, b);
        const fieldAlpha = Math.max(0.22, Math.min(0.72, 0.78 - gap));
        graphics.lineStyle(1.4, 0x22201d, fieldAlpha);
        for (const spread of [18, 30, 44]) {
          graphics.strokeEllipse(midpoint.x, midpoint.y + 2, Math.max(42, Math.abs(bx - ax) + spread), Math.max(34, Math.abs(by - ay) + spread * 0.72));
        }
        graphics.lineStyle(2, 0xd60056, 0.72);
        graphics.lineBetween(ax + (bx > ax ? 15 : -15), ay, bx + (bx > ax ? -15 : 15), by);

        if (state.hintLevel >= 2 || state.showSolution) {
          graphics.lineStyle(state.showSolution ? 2.5 : 1.8, 0xd60056, state.showSolution ? 0.95 : 0.7);
          for (const point of Object.values(this.c22Field.solution)) {
            graphics.strokeEllipse(point.x * width, point.y * height + 6, 57, 78);
          }
        }

        drawFigure(graphics, ax, ay, state.selected === "friend-a", 0x22201d, figureScale);
        drawFigure(graphics, bx, by, state.selected === "friend-b", 0x22201d, figureScale);
        this.figureZones?.["friend-a"]?.setPosition(ax, ay + 5);
        this.figureZones?.["friend-b"]?.setPosition(bx, by + 5);
        this.labels?.a?.setPosition(ax, Math.min(height - 45, ay + 47));
        this.labels?.b?.setPosition(bx, Math.min(height - 45, by + 47));

        const moved = FIGURE_IDS.filter((id) => state.explored[id]).length;
        const ready = explorationReady(state, payload);
        const status = state.lastNotice === "invalid"
          ? words[this.c22Locale].invalid
          : ready ? words[this.c22Locale].choosePrinciple : `${words[this.c22Locale].exploreBoth} · ${moved}/2`;
        this.statusText?.setText(status).setColor(state.lastNotice === "invalid" ? "#b3261e" : "#6f6a61");
      }
    }

    return new C22MagneticFieldScene();
  },

  serializeState(scene) {
    if (!scene?.c22State) return null;
    return clone(scene.c22State);
  },

  restoreState(scene, savedState) {
    if (!scene?.c22Field) return;
    scene.c22State = restoredState(scene, savedState);
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const result = evaluationFor(scene, instance);
    if (instance?.mode === "mission" || result.complete) scene.c22State.showSolution = true;
    scene.c22State.lastNotice = null;
    scene.redraw?.();
    scene.notify?.();
    return result;
  },

  getAccessibleActions(scene) {
    if (!scene?.c22State) return [];
    const state = scene.c22State;
    const payload = scene.c22Field.payload;
    const selected = state.selected;
    const current = state.positions[selected];
    const selectedWord = (id, en, pt) => id === selected ? localized(`${en} (selected)`, `${pt} (selecionado)`) : localized(en, pt);
    const moves = [
      ["left", "Move selected figure left", "Mover a figura selecionada para a esquerda", -payload.step, 0],
      ["up", "Move selected figure up", "Mover a figura selecionada para cima", 0, -payload.step],
      ["down", "Move selected figure down", "Mover a figura selecionada para baixo", 0, payload.step],
      ["right", "Move selected figure right", "Mover a figura selecionada para a direita", payload.step, 0],
    ];
    const actions = [
      { id: "select-a", label: selectedWord("friend-a", "Select Friend A", "Selecionar Amigo A"), run: () => scene.selectFigure("friend-a") },
      { id: "select-b", label: selectedWord("friend-b", "Select Friend B", "Selecionar Amigo B"), run: () => scene.selectFigure("friend-b") },
      ...moves.map(([id, en, pt, dx, dy]) => ({
        id,
        label: localized(en, pt),
        disabled: !scene.canMove(selected, { x: current.x + dx, y: current.y + dy }),
        run: () => scene.nudge(dx, dy),
      })),
    ];
    if (explorationReady(state, payload)) {
      const reflectionLabels = {
        transparency: localized("Debrief: Transparency", "Reflexão: Transparência"),
        freedom: localized("Debrief: Freedom", "Reflexão: Liberdade"),
        boundary: localized("Debrief: Boundary", "Reflexão: Limite"),
      };
      for (const id of REFLECTION_IDS) {
        const label = reflectionLabels[id];
        actions.push({
          id: `reflection-${id}`,
          label: state.reflection === id ? localized(`✓ ${label.en}`, `✓ ${label.pt}`) : label,
          run: () => scene.setReflection(id),
        });
      }
    }
    return actions;
  },

  showHint(scene, hintIndex) {
    const index = hintIndex === 1 ? 1 : 0;
    scene.c22State.hintLevel = Math.max(scene.c22State.hintLevel, index + 1);
    scene.c22State.lastNotice = null;
    scene.redraw?.();
    scene.notify?.();
    return index === 0
      ? localized(
        "Transparency belongs in the open lower field. Move both figures there, but keep visible space between them.",
        "A transparência pertence ao campo aberto inferior. Mova as duas figuras para lá, mantendo um espaço visível entre elas.",
      )
      : localized(
        "The red outlines show one healthy balance of warmth and freedom. You still choose the final positions.",
        "Os contornos vermelhos mostram um equilíbrio saudável entre proximidade e liberdade. Você ainda escolhe as posições finais.",
      );
  },

  destroy(scene) {
    for (const [eventName, handler] of scene?.c22KeyboardHandlers || []) scene.input?.keyboard?.off(eventName, handler);
    for (const zone of Object.values(scene?.figureZones || {})) zone.removeAllListeners?.();
    scene?.input?.removeAllListeners();
    scene?.graphics?.destroy?.();
    scene?.statusText?.destroy?.();
    Object.values(scene?.labels || {}).forEach((label) => label.destroy?.());
    scene?.referenceArt?.destroy?.();
  },
});

export const C22_ENGINE_ID = ENGINE_ID;
export const C22_ENGINE_VERSION = "1.0.0";
export const C22_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
export const C22_REFLECTION_IDS = REFLECTION_IDS;
