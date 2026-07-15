import { A2_CONCEPTS } from "../fixtures/a2-fixture.js";

const DECISIONS = new Set(["undecided", "keep", "prune"]);
const EXPECTED = new Set(["keep", "prune"]);
const BASE_POSITIONS = Object.freeze([
  { x: 0.19, y: 0.14 }, { x: 0.81, y: 0.15 },
  { x: 0.13, y: 0.29 }, { x: 0.87, y: 0.3 },
  { x: 0.12, y: 0.44 }, { x: 0.88, y: 0.45 },
  { x: 0.14, y: 0.59 }, { x: 0.86, y: 0.6 },
  { x: 0.22, y: 0.72 }, { x: 0.78, y: 0.72 },
]);

function localized(en, pt) {
  return { en, pt };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validPoint(point) {
  return exactKeys(point, ["x", "y"])
    && Number.isFinite(point.x) && point.x >= 0.08 && point.x <= 0.92
    && Number.isFinite(point.y) && point.y >= 0.08 && point.y <= 0.94;
}

function validConcept(concept) {
  return exactKeys(concept, ["id", "label", "expected"])
    && typeof concept.id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(concept.id)
    && exactKeys(concept.label, ["en", "pt"])
    && [concept.label.en, concept.label.pt].every((label) => typeof label === "string" && label.trim().length > 0 && label.length <= 24)
    && EXPECTED.has(concept.expected);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "A2-fallback")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function normalizeA2Payload(payload) {
  const concepts = Array.isArray(payload?.concepts) && payload.concepts.length === 10 && payload.concepts.every(validConcept)
    ? clone(payload.concepts)
    : clone(A2_CONCEPTS);
  const targets = isRecord(payload?.targets) && validPoint(payload.targets.keep) && validPoint(payload.targets.prune)
    ? clone(payload.targets)
    : { keep: { x: 0.24, y: 0.9 }, prune: { x: 0.76, y: 0.9 } };
  return { concepts, targets };
}

export function createA2Puzzle(payload, seed) {
  const normalized = normalizeA2Payload(payload);
  const random = seededRandom(seed);
  const concepts = shuffled(normalized.concepts, random);
  const branches = concepts.map((concept, index) => ({
    ...concept,
    position: {
      x: Math.max(0.1, Math.min(0.9, BASE_POSITIONS[index].x + (random() - 0.5) * 0.018)),
      y: Math.max(0.1, Math.min(0.76, BASE_POSITIONS[index].y + (random() - 0.5) * 0.012)),
    },
  }));
  return { branches, targets: normalized.targets };
}

export function createA2InitialState(puzzle) {
  return {
    decisions: Object.fromEntries(puzzle.branches.map((branch) => [branch.id, "undecided"])),
    selectedId: puzzle.branches[0]?.id || null,
    hintLevel: 0,
    hintFocus: null,
    locked: false,
    completed: false,
    solutionShown: false,
    notice: "",
  };
}

export function restoreA2State(puzzle, savedState) {
  const initial = createA2InitialState(puzzle);
  if (!isRecord(savedState)) return initial;
  for (const branch of puzzle.branches) {
    const decision = savedState.decisions?.[branch.id];
    if (DECISIONS.has(decision)) initial.decisions[branch.id] = decision;
  }
  if (puzzle.branches.some((branch) => branch.id === savedState.selectedId)) initial.selectedId = savedState.selectedId;
  initial.hintLevel = Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0));
  initial.hintFocus = puzzle.branches.some((branch) => branch.id === savedState.hintFocus) ? savedState.hintFocus : null;
  initial.locked = Boolean(savedState.locked);
  initial.completed = Boolean(savedState.completed);
  initial.solutionShown = Boolean(savedState.solutionShown);
  initial.notice = typeof savedState.notice === "string" ? savedState.notice.slice(0, 100) : "";
  return initial;
}

export function applyA2Decision(state, puzzle, conceptId, decision) {
  if (state.locked) return { accepted: false, reason: "locked" };
  if (!DECISIONS.has(decision) || !puzzle.branches.some((branch) => branch.id === conceptId)) {
    return { accepted: false, reason: "impossible" };
  }
  state.decisions[conceptId] = decision;
  state.selectedId = conceptId;
  state.notice = "";
  state.completed = false;
  state.solutionShown = false;
  return { accepted: true, reason: "" };
}

export function evaluateA2State(state, puzzle) {
  let decided = 0;
  let correctCount = 0;
  const incorrectIds = [];
  for (const branch of puzzle.branches) {
    const decision = state.decisions[branch.id];
    if (decision !== "undecided") decided += 1;
    if (decision === branch.expected) correctCount += 1;
    else incorrectIds.push(branch.id);
  }
  const complete = decided === puzzle.branches.length;
  return {
    correct: complete && correctCount === puzzle.branches.length,
    complete,
    decided,
    remaining: puzzle.branches.length - decided,
    correctCount,
    incorrectIds,
  };
}

function selectedIndex(scene) {
  const index = scene.a2Puzzle.branches.findIndex((branch) => branch.id === scene.a2State.selectedId);
  return index >= 0 ? index : 0;
}

function stateLabel(decision, language) {
  const labels = {
    undecided: localized("undecided", "sem decisão"),
    keep: localized("kept", "mantida"),
    prune: localized("pruned", "podada"),
  };
  return labels[decision]?.[language] || labels.undecided[language];
}

function notifyInvalid(scene, onFeedback, language) {
  const message = localized(
    "Move the leaf fully onto Keep or Prune.",
    "Mova a folha completamente para Manter ou Podar.",
  );
  scene.a2State.notice = message[language];
  onFeedback(message);
  scene.redraw();
}

export const a2Engine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!exactKeys(payload, ["concepts", "targets"])) errors.push("payload must contain exactly {concepts, targets}");
    if (!Array.isArray(payload?.concepts) || payload.concepts.length !== 10) {
      errors.push("payload.concepts must contain exactly ten concepts");
    } else {
      if (payload.concepts.some((concept) => !validConcept(concept))) errors.push("each concept must contain a valid id, {en, pt} label, and keep/prune expectation");
      if (new Set(payload.concepts.map((concept) => concept.id)).size !== payload.concepts.length) errors.push("concept ids must be unique");
      const keepCount = payload.concepts.filter((concept) => concept.expected === "keep").length;
      const pruneCount = payload.concepts.filter((concept) => concept.expected === "prune").length;
      if (keepCount !== 5 || pruneCount !== 5) errors.push("concepts must contain five keep and five prune answers");
    }
    if (!exactKeys(payload?.targets, ["keep", "prune"]) || !validPoint(payload?.targets?.keep) || !validPoint(payload?.targets?.prune)) {
      errors.push("payload.targets must contain normalized keep and prune points");
    }
    if (isRecord(instance?.layoutOverrides) && Object.keys(instance.layoutOverrides).length > 0) {
      errors.push("A2 1.0.0 does not accept layout overrides");
    }
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady, onFeedback = () => {} }) {
    const puzzle = createA2Puzzle(instance.payload, instance.seed);
    const initialState = createA2InitialState(puzzle);
    const treeKey = `a2-tree-${instance.id}`;

    class A2Scene extends Phaser.Scene {
      constructor() {
        super({ key: `a2-${instance.id}` });
        this.a2Puzzle = puzzle;
        this.a2InitialState = initialState;
        this.a2State = clone(initialState);
        this.leafViews = new Map();
        this.draggingId = null;
        this.pointerCandidateId = null;
        this.pointerStart = null;
      }

      preload() {
        if (instance.assets.baseImage) this.load.image(treeKey, instance.assets.baseImage);
      }

      create() {
        const width = this.scale.width;
        const height = this.scale.height;
        if (this.textures.exists(treeKey)) {
          this.add.image(width / 2, height * 0.49, treeKey).setDisplaySize(232, 348).setAlpha(0.42);
        }
        this.branchGraphics = this.add.graphics();
        this.targetGraphics = this.add.graphics();
        this.solutionGraphics = this.add.graphics();
        this.keepLabel = this.add.text(0, 0, language === "pt" ? "MANTER" : "KEEP", {
          fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600", color: "#22201d",
        }).setOrigin(0.5);
        this.pruneLabel = this.add.text(0, 0, language === "pt" ? "PODAR" : "PRUNE", {
          fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600", color: "#22201d",
        }).setOrigin(0.5);

        for (const branch of puzzle.branches) {
          const leafGraphics = this.add.graphics();
          const text = this.add.text(0, 0, branch.label[language], {
            align: "center",
            color: "#22201d",
            fontFamily: "Fira Sans",
            fontSize: branch.label[language].length > 13 ? "9px" : "10px",
            fontStyle: "600",
            lineSpacing: -2,
            wordWrap: { width: 68, useAdvancedWrap: true },
          }).setOrigin(0.5);
          const container = this.add.container(0, 0, [leafGraphics, text]).setSize(82, 36);
          container.setInteractive({ cursor: "grab" });
          container.on("pointerdown", (pointer) => {
            if (this.a2State.locked) return;
            this.selectBranch(branch.id);
            this.pointerCandidateId = branch.id;
            this.pointerStart = { x: pointer.x, y: pointer.y };
          });
          this.leafViews.set(branch.id, { container, graphics: leafGraphics, text });
        }

        this.input.on("pointermove", (pointer) => {
          if (this.a2State.locked || !this.pointerCandidateId || !this.pointerStart) return;
          if (!this.draggingId && Math.hypot(pointer.x - this.pointerStart.x, pointer.y - this.pointerStart.y) < 7) return;
          this.draggingId = this.pointerCandidateId;
          const view = this.leafViews.get(this.draggingId);
          view?.container.setPosition(pointer.x, pointer.y).setAlpha(0.82);
        });
        this.input.on("pointerup", (pointer) => {
          const id = this.draggingId;
          this.pointerCandidateId = null;
          this.pointerStart = null;
          this.draggingId = null;
          if (!id || this.a2State.locked) return;
          const view = this.leafViews.get(id);
          view?.container.setAlpha(1);
          const normalized = { x: pointer.x / width, y: pointer.y / height };
          const keepDistance = Math.hypot(normalized.x - puzzle.targets.keep.x, normalized.y - puzzle.targets.keep.y);
          const pruneDistance = Math.hypot(normalized.x - puzzle.targets.prune.x, normalized.y - puzzle.targets.prune.y);
          if (Math.min(keepDistance, pruneDistance) > 0.17) {
            notifyInvalid(this, onFeedback, language);
            onStateChange(this);
            return;
          }
          this.decide(id, keepDistance < pruneDistance ? "keep" : "prune");
        });

        this.keepZone = this.add.zone(keepTarget().x, keepTarget().y, 112, 62).setInteractive({ cursor: "pointer" });
        this.pruneZone = this.add.zone(pruneTarget().x, pruneTarget().y, 112, 62).setInteractive({ cursor: "pointer" });
        this.keepZone.on("pointerdown", () => this.decideSelected("keep"));
        this.pruneZone.on("pointerdown", () => this.decideSelected("prune"));

        const canvas = this.game.canvas;
        canvas.tabIndex = 0;
        canvas.setAttribute("role", "application");
        canvas.setAttribute("aria-label", language === "pt"
          ? "Árvore com dez folhas. Use as setas para escolher uma folha; K mantém, P poda e Delete limpa."
          : "Tree with ten leaves. Use arrow keys to choose a leaf; K keeps, P prunes, and Delete clears.");
        this.a2CanvasKeydown = (event) => {
          if (document.activeElement !== canvas || this.a2State.locked) return;
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) { event.preventDefault(); this.selectOffset(-1); }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) { event.preventDefault(); this.selectOffset(1); }
          if (["k", "K", "Enter"].includes(event.key)) { event.preventDefault(); this.decideSelected("keep"); }
          if (["p", "P", "x", "X"].includes(event.key)) { event.preventDefault(); this.decideSelected("prune"); }
          if (["Delete", "Backspace"].includes(event.key)) { event.preventDefault(); this.decideSelected("undecided"); }
        };
        canvas.addEventListener("keydown", this.a2CanvasKeydown);
        this.redraw();
        onReady(this);

        function keepTarget() { return { x: puzzle.targets.keep.x * width, y: puzzle.targets.keep.y * height }; }
        function pruneTarget() { return { x: puzzle.targets.prune.x * width, y: puzzle.targets.prune.y * height }; }
      }

      selectBranch(id) {
        if (this.a2State.locked) return;
        this.a2State.selectedId = id;
        this.a2State.notice = "";
        this.redraw();
        onFeedback(localized("", ""));
        onStateChange(this);
      }

      selectOffset(offset) {
        const branches = this.a2Puzzle.branches;
        const next = (selectedIndex(this) + offset + branches.length) % branches.length;
        this.selectBranch(branches[next].id);
      }

      decideSelected(decision) {
        if (!this.a2State.selectedId) return;
        this.decide(this.a2State.selectedId, decision);
      }

      decide(id, decision) {
        const result = applyA2Decision(this.a2State, this.a2Puzzle, id, decision);
        if (!result.accepted) {
          onFeedback(result.reason === "locked"
            ? localized("This result is locked.", "Este resultado está bloqueado.")
            : localized("That move is not available.", "Esse movimento não está disponível."));
          return;
        }
        this.redraw();
        onFeedback(localized("", ""));
        onStateChange(this);
      }

      redraw() {
        if (!this.branchGraphics) return;
        const width = this.scale.width;
        const height = this.scale.height;
        const keep = { x: puzzle.targets.keep.x * width, y: puzzle.targets.keep.y * height };
        const prune = { x: puzzle.targets.prune.x * width, y: puzzle.targets.prune.y * height };
        this.branchGraphics.clear();
        this.targetGraphics.clear();
        this.solutionGraphics.clear();

        this.targetGraphics.lineStyle(2, 0x22201d, 0.82);
        this.targetGraphics.strokeEllipse(keep.x, keep.y, 104, 54);
        this.targetGraphics.lineStyle(3, 0xd60056, 0.9);
        this.targetGraphics.strokeEllipse(keep.x - 3, keep.y + 1, 91, 45);
        this.targetGraphics.lineStyle(2, 0x22201d, 0.82);
        this.targetGraphics.strokeEllipse(prune.x, prune.y, 104, 54);
        this.targetGraphics.lineBetween(prune.x - 18, prune.y - 8, prune.x + 15, prune.y + 10);
        this.targetGraphics.lineBetween(prune.x - 16, prune.y + 10, prune.x + 18, prune.y - 9);
        this.keepLabel.setPosition(keep.x, keep.y);
        this.pruneLabel.setPosition(prune.x, prune.y);

        for (const branch of puzzle.branches) {
          const view = this.leafViews.get(branch.id);
          const x = branch.position.x * width;
          const y = branch.position.y * height;
          const decision = this.a2State.decisions[branch.id];
          const shownDecision = this.a2State.solutionShown ? branch.expected : decision;
          const selected = branch.id === this.a2State.selectedId;
          const hinted = branch.id === this.a2State.hintFocus;
          if (this.draggingId !== branch.id) view.container.setPosition(x, y).setAlpha(shownDecision === "prune" ? 0.62 : 1);

          const trunkX = width / 2 + (x < width / 2 ? -10 : 10);
          const trunkY = Math.min(height * 0.69, y + 58);
          const endX = shownDecision === "prune" ? x + (x < width / 2 ? 16 : -16) : x;
          const endY = shownDecision === "prune" ? y + 9 : y;
          this.branchGraphics.lineStyle(shownDecision === "prune" ? 1.5 : 2, 0x22201d, shownDecision === "prune" ? 0.38 : 0.72);
          this.branchGraphics.beginPath();
          this.branchGraphics.moveTo(trunkX, trunkY);
          this.branchGraphics.lineTo((trunkX + endX) / 2 + (x < width / 2 ? -4 : 4), (trunkY + endY) / 2);
          this.branchGraphics.lineTo(endX, endY);
          this.branchGraphics.strokePath();
          if (shownDecision === "prune") {
            this.branchGraphics.lineStyle(2, 0x22201d, 0.9);
            this.branchGraphics.lineBetween(endX - 4, endY - 5, endX + 4, endY + 5);
          }

          view.graphics.clear();
          if (shownDecision === "keep") {
            view.graphics.fillStyle(0xfcebf1, 1);
            view.graphics.fillEllipse(-2, 1, 78, 31);
            view.graphics.lineStyle(3, 0xd60056, 0.76);
          } else {
            view.graphics.fillStyle(0xffffff, 0.95);
            view.graphics.fillEllipse(0, 0, 78, 31);
            view.graphics.lineStyle(selected ? 3 : 1.5, selected ? 0xd60056 : 0x22201d, shownDecision === "prune" ? 0.55 : 0.86);
          }
          view.graphics.strokeEllipse(0, 0, 79, 32);
          view.graphics.lineStyle(1, 0x22201d, 0.65);
          view.graphics.lineBetween(-33, 2, 33, -2);
          if (shownDecision === "prune") {
            view.graphics.lineStyle(2.5, 0x22201d, 0.82);
            view.graphics.lineBetween(-28, -12, 28, 12);
          }
          if (selected || hinted) {
            view.graphics.lineStyle(hinted ? 4 : 2.5, hinted ? 0xd60056 : 0x22201d, hinted && reducedMotion ? 0.55 : 0.9);
            view.graphics.strokeEllipse(0, 0, 86, 38);
          }
          view.text.setColor(shownDecision === "prune" ? "#6f6a61" : "#22201d");
        }

        if (this.a2State.solutionShown) {
          this.solutionGraphics.fillStyle(0xfcebf1, 0.82);
          this.solutionGraphics.fillEllipse(width / 2, height * 0.78, 100, 18);
          this.solutionGraphics.lineStyle(2, 0xd60056, 0.72);
          this.solutionGraphics.lineBetween(width / 2 - 26, height * 0.78, width / 2 + 24, height * 0.78 - 2);
        }
      }
    }

    return new A2Scene();
  },

  serializeState(scene) {
    if (!scene?.a2State) return null;
    return clone(scene.a2State);
  },

  restoreState(scene, savedState) {
    const puzzle = scene?.a2Puzzle || createA2Puzzle({}, "A2-fallback");
    scene.a2State = restoreA2State(puzzle, savedState);
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const result = evaluateA2State(scene.a2State, scene.a2Puzzle);
    if (instance.mode === "mission" || result.correct) {
      scene.a2State.locked = true;
      scene.a2State.completed = result.complete;
      scene.a2State.solutionShown = true;
      scene.redraw?.();
    }
    if (result.correct) {
      return {
        correct: true,
        complete: true,
        feedback: localized(
          "The tree can breathe: five supports remain, and five choking patterns are pruned.",
          "A árvore pode respirar: cinco apoios permanecem e cinco padrões sufocantes foram podados.",
        ),
      };
    }
    if (!result.complete) {
      return {
        correct: false,
        complete: false,
        feedback: localized(
          `${result.remaining} ${result.remaining === 1 ? "branch still needs" : "branches still need"} a decision.`,
          `${result.remaining} ${result.remaining === 1 ? "ramo ainda precisa" : "ramos ainda precisam"} de uma decisão.`,
        ),
      };
    }
    return {
      correct: false,
      complete: true,
      feedback: localized(
        "Some choices still choke love. Compare your pink ties with the cut marks, then revise.",
        "Algumas escolhas ainda sufocam o amor. Compare as fitas rosa com os cortes e depois reveja.",
      ),
    };
  },

  getAccessibleActions(scene) {
    if (!scene?.a2Puzzle) return [];
    const branch = scene.a2Puzzle.branches[selectedIndex(scene)];
    const languageState = {
      en: stateLabel(scene.a2State.decisions[branch.id], "en"),
      pt: stateLabel(scene.a2State.decisions[branch.id], "pt"),
    };
    const locked = scene.a2State.locked;
    return [
      { id: "previous", label: localized("Previous leaf", "Folha anterior"), disabled: locked, run: () => scene.selectOffset(-1) },
      { id: "next", label: localized("Next leaf", "Próxima folha"), disabled: locked, run: () => scene.selectOffset(1) },
      {
        id: "keep",
        label: localized(`Keep ${branch.label.en}; currently ${languageState.en}`, `Manter ${branch.label.pt}; agora ${languageState.pt}`),
        disabled: locked,
        run: () => scene.decideSelected("keep"),
      },
      {
        id: "prune",
        label: localized(`Prune ${branch.label.en}; currently ${languageState.en}`, `Podar ${branch.label.pt}; agora ${languageState.pt}`),
        disabled: locked,
        run: () => scene.decideSelected("prune"),
      },
    ];
  },

  showHint(scene, hintIndex) {
    scene.a2State.hintLevel = Math.max(scene.a2State.hintLevel, Math.min(2, hintIndex + 1));
    if (hintIndex === 1) {
      const focus = scene.a2Puzzle.branches.find((branch) => branch.id === "isolation") || scene.a2Puzzle.branches.find((branch) => branch.expected === "prune");
      scene.a2State.hintFocus = focus?.id || null;
      scene.a2State.selectedId = focus?.id || scene.a2State.selectedId;
    }
    scene.redraw?.();
    return hintIndex === 0
      ? localized(
        "Ask which branches open you to God, another person, or a concrete plan.",
        "Pergunte quais ramos abrem você a Deus, a outra pessoa ou a um plano concreto.",
      )
      : localized(
        "Isolation is highlighted: it closes freedom in, so prune it.",
        "O isolamento está destacado: ele fecha a liberdade em si mesma; pode-o.",
      );
  },

  destroy(scene) {
    if (!scene) return;
    if (scene.a2CanvasKeydown && scene.game?.canvas) scene.game.canvas.removeEventListener("keydown", scene.a2CanvasKeydown);
    scene.leafViews?.forEach(({ container }) => container.removeAllListeners());
    scene.keepZone?.removeAllListeners();
    scene.pruneZone?.removeAllListeners();
    scene.input?.removeAllListeners();
  },
});
