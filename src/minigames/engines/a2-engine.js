import { A2_CONCEPTS } from "../fixtures/a2-fixture.js";

const DECISIONS = new Set(["undecided", "keep", "prune"]);
const EXPECTED = new Set(["keep", "prune"]);
const BASE_POSITIONS = Object.freeze([
  { x: 0.372, y: 0.137 }, { x: 0.628, y: 0.137 },
  { x: 0.306, y: 0.211 }, { x: 0.694, y: 0.211 },
  { x: 0.286, y: 0.311 }, { x: 0.706, y: 0.311 },
  { x: 0.275, y: 0.411 }, { x: 0.719, y: 0.411 },
  { x: 0.267, y: 0.5 }, { x: 0.725, y: 0.5 },
]);

function localized(en, pt) { return { en, pt }; }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}
function validPoint(point) {
  return exactKeys(point, ["x", "y"]) && Number.isFinite(point.x) && point.x >= 0.08 && point.x <= 0.92
    && Number.isFinite(point.y) && point.y >= 0.08 && point.y <= 0.94;
}
function validConcept(concept) {
  return exactKeys(concept, ["id", "label", "expected"])
    && typeof concept.id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(concept.id)
    && exactKeys(concept.label, ["en", "pt"])
    && [concept.label.en, concept.label.pt].every((label) => typeof label === "string" && label.trim().length > 0 && label.length <= 24)
    && EXPECTED.has(concept.expected);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "A2-fallback")) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0 || 1;
}
function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function shuffled(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
function selectedIndex(scene) {
  const index = scene.a2Puzzle.branches.findIndex((branch) => branch.id === scene.a2State.selectedId);
  return index >= 0 ? index : 0;
}
function stateLabel(decision, language) {
  const labels = { undecided: localized("on the tree", "na árvore"), keep: localized("on the tree", "na árvore"), prune: localized("in the basket", "no cesto") };
  return labels[decision]?.[language] || labels.keep[language];
}

export function normalizeA2Payload(payload) {
  const concepts = Array.isArray(payload?.concepts) && payload.concepts.length === 10 && payload.concepts.every(validConcept)
    ? clone(payload.concepts) : clone(A2_CONCEPTS);
  const targets = isRecord(payload?.targets) && validPoint(payload.targets.basket)
    ? clone(payload.targets) : { basket: { x: 0.78, y: 0.79 } };
  return { concepts, targets };
}

export function createA2Puzzle(payload, seed) {
  const normalized = normalizeA2Payload(payload);
  const concepts = shuffled(normalized.concepts, seededRandom(seed));
  return { branches: concepts.map((concept, index) => ({ ...concept, position: { ...BASE_POSITIONS[index] } })), targets: normalized.targets };
}

export function createA2InitialState(puzzle) {
  return {
    decisions: Object.fromEntries(puzzle.branches.map((branch) => [branch.id, "keep"])),
    selectedId: null, hintLevel: 0, hintFocus: null, locked: false, completed: false, correct: false, solutionShown: false, notice: "",
  };
}

export function restoreA2State(puzzle, savedState) {
  const initial = createA2InitialState(puzzle);
  if (!isRecord(savedState)) return initial;
  for (const branch of puzzle.branches) {
    const decision = savedState.decisions?.[branch.id];
    if (DECISIONS.has(decision)) initial.decisions[branch.id] = decision === "undecided" ? "keep" : decision;
  }
  if (puzzle.branches.some((branch) => branch.id === savedState.selectedId)) initial.selectedId = savedState.selectedId;
  initial.hintLevel = Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0));
  initial.hintFocus = puzzle.branches.some((branch) => branch.id === savedState.hintFocus) ? savedState.hintFocus : null;
  initial.locked = Boolean(savedState.locked); initial.completed = Boolean(savedState.completed); initial.correct = Boolean(savedState.correct);
  initial.solutionShown = Boolean(savedState.solutionShown); initial.notice = typeof savedState.notice === "string" ? savedState.notice.slice(0, 100) : "";
  return initial;
}

export function applyA2Decision(state, puzzle, conceptId, decision) {
  if (state.locked) return { accepted: false, reason: "locked" };
  if (!DECISIONS.has(decision) || !puzzle.branches.some((branch) => branch.id === conceptId)) return { accepted: false, reason: "impossible" };
  state.decisions[conceptId] = decision === "undecided" ? "keep" : decision;
  state.selectedId = conceptId; state.notice = ""; state.completed = false; state.correct = false; state.solutionShown = false;
  return { accepted: true, reason: "" };
}

export function evaluateA2State(state, puzzle) {
  let correctCount = 0;
  const incorrectIds = [];
  for (const branch of puzzle.branches) {
    if (state.decisions[branch.id] === branch.expected) correctCount += 1;
    else incorrectIds.push(branch.id);
  }
  return { correct: correctCount === puzzle.branches.length, complete: true, decided: puzzle.branches.length, remaining: 0, correctCount, incorrectIds };
}

function notifyInvalid(scene, onFeedback, language) {
  const message = localized("Drop a leaf in the basket, or return it to its branch.", "Solte uma folha no cesto ou devolva-a ao ramo.");
  scene.a2State.notice = message[language]; onFeedback(message); scene.redraw();
}

export const a2Engine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!exactKeys(payload, ["concepts", "targets"])) errors.push("payload must contain exactly {concepts, targets}");
    if (!Array.isArray(payload?.concepts) || payload.concepts.length !== 10) errors.push("payload.concepts must contain exactly ten concepts");
    else {
      if (payload.concepts.some((concept) => !validConcept(concept))) errors.push("each concept must contain a valid id, {en, pt} label, and keep/prune expectation");
      if (new Set(payload.concepts.map((concept) => concept.id)).size !== payload.concepts.length) errors.push("concept ids must be unique");
      if (payload.concepts.filter((concept) => concept.expected === "keep").length !== 5 || payload.concepts.filter((concept) => concept.expected === "prune").length !== 5) errors.push("concepts must contain five keep and five prune answers");
    }
    if (!exactKeys(payload?.targets, ["basket"]) || !validPoint(payload?.targets?.basket)) errors.push("payload.targets must contain one normalized basket point");
    if (isRecord(instance?.layoutOverrides) && Object.keys(instance.layoutOverrides).length > 0) errors.push("A2 1.0.0 does not accept layout overrides");
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady, onFeedback = () => {} }) {
    const puzzle = createA2Puzzle(instance.payload, instance.seed);
    const initialState = createA2InitialState(puzzle);
    const treeKey = `a2-tree-${instance.id}`;
    class A2Scene extends Phaser.Scene {
      constructor() { super({ key: `a2-${instance.id}` }); this.a2Puzzle = puzzle; this.a2InitialState = initialState; this.a2State = clone(initialState); this.leafViews = new Map(); this.draggingId = null; this.pointerCandidateId = null; this.pointerStart = null; }
      preload() { if (instance.assets.baseImage) this.load.image(treeKey, instance.assets.baseImage); }
      create() {
        const width = this.scale.width; const height = this.scale.height;
        if (this.textures.exists(treeKey)) this.add.image(width / 2, height * 0.49, treeKey).setDisplaySize(232, 348).setAlpha(0.48);
        this.targetGraphics = this.add.graphics(); this.solutionGraphics = this.add.graphics();
        for (const branch of puzzle.branches) {
          const graphics = this.add.graphics();
          const text = this.add.text(0, 0, branch.label[language], { align: "center", color: "#22201d", fontFamily: "Fira Sans", fontSize: branch.label[language].length > 13 ? "9px" : "10px", fontStyle: "600", lineSpacing: -2, wordWrap: { width: 66, useAdvancedWrap: true } }).setOrigin(0.5);
          const container = this.add.container(0, 0, [graphics, text]).setSize(78, 36).setInteractive({ cursor: "grab" });
          container.on("pointerdown", (pointer) => { if (this.a2State.locked) return; this.selectBranch(branch.id); this.pointerCandidateId = branch.id; this.pointerStart = { x: pointer.x, y: pointer.y }; });
          this.leafViews.set(branch.id, { container, graphics, text });
        }
        this.input.on("pointermove", (pointer) => {
          if (this.a2State.locked || !this.pointerCandidateId || !this.pointerStart) return;
          if (!this.draggingId && Math.hypot(pointer.x - this.pointerStart.x, pointer.y - this.pointerStart.y) < 7) return;
          this.draggingId = this.pointerCandidateId; this.leafViews.get(this.draggingId)?.container.setPosition(pointer.x, pointer.y).setAlpha(0.82);
        });
        this.input.on("pointerup", (pointer) => {
          const id = this.draggingId; this.pointerCandidateId = null; this.pointerStart = null; this.draggingId = null;
          if (!id || this.a2State.locked) return;
          this.leafViews.get(id)?.container.setAlpha(1);
          const normalized = { x: pointer.x / width, y: pointer.y / height };
          const branch = puzzle.branches.find((item) => item.id === id);
          const basketDistance = Math.hypot(normalized.x - puzzle.targets.basket.x, normalized.y - puzzle.targets.basket.y);
          const returnDistance = Math.hypot(normalized.x - branch.position.x, normalized.y - branch.position.y);
          if (basketDistance <= 0.16) this.decide(id, "prune");
          else if (returnDistance <= 0.18) this.decide(id, "keep");
          else { notifyInvalid(this, onFeedback, language); onStateChange(this); }
        });
        const canvas = this.game.canvas; canvas.tabIndex = 0; canvas.setAttribute("role", "application");
        canvas.setAttribute("aria-label", language === "pt" ? "Árvore com dez folhas e um cesto. Use as setas para escolher uma folha; P poda para o cesto e Enter devolve-a ao ramo." : "Tree with ten leaves and a wastebasket. Use arrows to choose a leaf; P prunes it into the basket and Enter returns it to the branch.");
        this.a2CanvasKeydown = (event) => {
          if (document.activeElement !== canvas || this.a2State.locked) return;
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) { event.preventDefault(); this.selectOffset(-1); }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) { event.preventDefault(); this.selectOffset(1); }
          if (["p", "P", "x", "X"].includes(event.key)) { event.preventDefault(); this.decideSelected("prune"); }
          if (["Enter", "k", "K", "Delete", "Backspace"].includes(event.key)) { event.preventDefault(); this.decideSelected("keep"); }
        };
        canvas.addEventListener("keydown", this.a2CanvasKeydown); this.redraw(); onReady(this);
      }
      selectBranch(id) { if (this.a2State.locked) return; this.a2State.selectedId = id; this.a2State.notice = ""; this.redraw(); onFeedback(localized("", "")); onStateChange(this); }
      selectOffset(offset) { const branches = this.a2Puzzle.branches; this.selectBranch(branches[(selectedIndex(this) + offset + branches.length) % branches.length].id); }
      decideSelected(decision) { if (this.a2State.selectedId) this.decide(this.a2State.selectedId, decision); }
      decide(id, decision) {
        const result = applyA2Decision(this.a2State, this.a2Puzzle, id, decision);
        if (!result.accepted) { onFeedback(result.reason === "locked" ? localized("This result is locked.", "Este resultado está bloqueado.") : localized("That move is not available.", "Esse movimento não está disponível.")); return; }
        if (decision === "prune") {
          const view = this.leafViews.get(id);
          const basket = { x: puzzle.targets.basket.x * this.scale.width, y: puzzle.targets.basket.y * this.scale.height };
          const finish = () => { this.redraw(); onStateChange(this); };
          if (reducedMotion || !view) finish();
          else this.tweens.add({ targets: view.container, x: basket.x, y: basket.y - 8, alpha: 0, scaleX: 0.25, scaleY: 0.25, duration: 260, ease: "Cubic.easeIn", onComplete: finish });
        } else { this.redraw(); onStateChange(this); }
        onFeedback(localized("", ""));
      }
      redraw() {
        if (!this.targetGraphics) return;
        const width = this.scale.width; const height = this.scale.height; const basket = { x: puzzle.targets.basket.x * width, y: puzzle.targets.basket.y * height };
        this.targetGraphics.clear(); this.solutionGraphics.clear();
        this.targetGraphics.lineStyle(2, 0x22201d, 0.82);
        this.targetGraphics.beginPath(); this.targetGraphics.moveTo(basket.x - 32, basket.y - 21); this.targetGraphics.lineTo(basket.x + 31, basket.y - 21); this.targetGraphics.lineTo(basket.x + 23, basket.y + 27); this.targetGraphics.lineTo(basket.x - 23, basket.y + 27); this.targetGraphics.closePath(); this.targetGraphics.strokePath();
        this.targetGraphics.lineBetween(basket.x - 37, basket.y - 28, basket.x + 36, basket.y - 28);
        this.targetGraphics.lineBetween(basket.x - 12, basket.y - 35, basket.x + 12, basket.y - 35);
        this.targetGraphics.lineStyle(1, 0x22201d, 0.52);
        [-12, 0, 12].forEach((offset) => this.targetGraphics.lineBetween(basket.x + offset, basket.y - 15, basket.x + offset * 0.72, basket.y + 20));
        for (const branch of puzzle.branches) {
          const view = this.leafViews.get(branch.id); const decision = this.a2State.decisions[branch.id]; const shown = this.a2State.solutionShown ? branch.expected : decision;
          const endpoint = { x: branch.position.x * width, y: branch.position.y * height };
          const side = branch.position.x < 0.5 ? -1 : 1;
          const x = endpoint.x + side * 38; const y = endpoint.y;
          view.container.setVisible(shown !== "prune");
          if (shown !== "prune" && this.draggingId !== branch.id) view.container.setPosition(x, y).setAlpha(1).setScale(1);
          if (shown === "prune") continue;
          const selected = branch.id === this.a2State.selectedId; const hinted = branch.id === this.a2State.hintFocus;
          view.graphics.clear(); view.graphics.fillStyle(this.a2State.correct ? 0xdff2dc : 0xfcebf1, 1); view.graphics.fillEllipse(0, 0, 76, 31);
          view.graphics.lineStyle(selected ? 2.5 : 1.5, selected || hinted ? 0xd60056 : 0x22201d, selected || hinted ? 0.92 : 0.76); view.graphics.strokeEllipse(0, 0, 77, 32);
          if (hinted) { view.graphics.lineStyle(3.5, 0xd60056, reducedMotion ? 0.55 : 0.9); view.graphics.strokeEllipse(0, 0, 84, 38); }
          view.text.setColor("#22201d");
        }
      }
    }
    return new A2Scene();
  },
  serializeState(scene) { return scene?.a2State ? clone(scene.a2State) : null; },
  restoreState(scene, savedState) { const puzzle = scene?.a2Puzzle || createA2Puzzle({}, "A2-fallback"); scene.a2State = restoreA2State(puzzle, savedState); scene.redraw?.(); },
  evaluate(scene, instance) {
    const result = evaluateA2State(scene.a2State, scene.a2Puzzle);
    scene.a2State.correct = result.correct;
    if (instance.mode === "mission" || result.correct) { scene.a2State.locked = true; scene.a2State.completed = true; scene.a2State.solutionShown = true; scene.redraw?.(); }
    return result.correct ? { correct: true, complete: true, feedback: localized("The tree can breathe.", "A árvore pode respirar.") } : { correct: false, complete: true, feedback: localized("A few leaves still choke love. Look again before you check.", "Algumas folhas ainda sufocam o amor. Olhe de novo antes de verificar.") };
  },
  getAccessibleActions(scene) {
    if (!scene?.a2Puzzle) return [];
    const branch = scene.a2Puzzle.branches[selectedIndex(scene)]; const state = { en: stateLabel(scene.a2State.decisions[branch.id], "en"), pt: stateLabel(scene.a2State.decisions[branch.id], "pt") }; const locked = scene.a2State.locked;
    return [
      { id: "previous", label: localized("Previous leaf", "Folha anterior"), disabled: locked, run: () => scene.selectOffset(-1) },
      { id: "next", label: localized("Next leaf", "Próxima folha"), disabled: locked, run: () => scene.selectOffset(1) },
      { id: "keep", label: localized(`Return ${branch.label.en} to its branch; currently ${state.en}`, `Devolver ${branch.label.pt} ao ramo; agora ${state.pt}`), disabled: locked, run: () => scene.decideSelected("keep") },
      { id: "prune", label: localized(`Prune ${branch.label.en}; currently ${state.en}`, `Podar ${branch.label.pt}; agora ${state.pt}`), disabled: locked, run: () => scene.decideSelected("prune") },
    ];
  },
  showHint(scene, hintIndex) {
    scene.a2State.hintLevel = Math.max(scene.a2State.hintLevel, Math.min(2, hintIndex + 1));
    if (hintIndex === 1) { const focus = scene.a2Puzzle.branches.find((branch) => branch.id === "isolation") || scene.a2Puzzle.branches.find((branch) => branch.expected === "prune"); scene.a2State.hintFocus = focus?.id || null; scene.a2State.selectedId = focus?.id || scene.a2State.selectedId; }
    scene.redraw?.();
    return hintIndex === 0 ? localized("Ask which leaves close you in rather than opening you to love.", "Pergunte quais folhas fecham você em si, em vez de abrir você ao amor.") : localized("Isolation is highlighted: it belongs in the basket.", "O isolamento está destacado: ele pertence ao cesto.");
  },
  destroy(scene) { if (!scene) return; if (scene.a2CanvasKeydown && scene.game?.canvas) scene.game.canvas.removeEventListener("keydown", scene.a2CanvasKeydown); scene.leafViews?.forEach(({ container }) => container.removeAllListeners()); scene.input?.removeAllListeners(); },
});
