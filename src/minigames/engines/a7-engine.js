const STATE_VERSION = 2;
const REQUIRED_CONCEPTS = ["trust", "promise", "tenderness", "freedom", "truth", "covenant", "wholeness"];
const TRAY_SLOTS = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92];
const ROTATIONS = [-0.1, 0.07, -0.045, 0.11, -0.075, 0.055, -0.12];
const ART_WIDTH = 246;
const ART_HEIGHT = 336;

const localized = (en, pt) => ({ en, pt });
const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isLocalized = (value) => isRecord(value) && Object.keys(value).sort().join("|") === "en|pt" && ["en", "pt"].every((locale) => typeof value[locale] === "string" && value[locale].trim());
const isPoint = (point) => Array.isArray(point) && point.length === 2 && point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1);

function hashSeed(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed) {
  let value = hashSeed(seed) || 1;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, seed) {
  const result = [...values];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function conceptIds(instance) {
  const ids = instance?.payload?.concepts?.map((concept) => concept.id);
  return Array.isArray(ids) && ids.length === REQUIRED_CONCEPTS.length ? ids : [...REQUIRED_CONCEPTS];
}

export function createA7InitialState(instance) {
  const ids = conceptIds(instance);
  const order = shuffled(ids, instance?.seed || "a7-fallback-seed");
  const positions = {};
  order.forEach((id, trayIndex) => {
    const homeX = TRAY_SLOTS[trayIndex];
    const homeY = Number(instance?.layoutOverrides?.trayY) || 0.84;
    positions[id] = {
      x: homeX, y: homeY, homeX, homeY,
      rotation: ROTATIONS[(trayIndex + (hashSeed(instance?.seed || "") % ROTATIONS.length)) % ROTATIONS.length],
      placed: false,
    };
  });
  return { version: STATE_VERSION, positions, selectedId: null, rejectedMoves: 0, completed: false, solutionShown: false, referenceVisible: true };
}

function validSavedState(savedState, instance) {
  if (!isRecord(savedState) || savedState.version !== STATE_VERSION || !isRecord(savedState.positions)) return false;
  const ids = conceptIds(instance);
  if (Object.keys(savedState.positions).sort().join("|") !== [...ids].sort().join("|")) return false;
  return ids.every((id) => {
    const position = savedState.positions[id];
    return isRecord(position) && [position.x, position.y, position.homeX, position.homeY, position.rotation].every(Number.isFinite) && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1 && position.homeX >= 0 && position.homeX <= 1 && position.homeY >= 0 && position.homeY <= 1 && typeof position.placed === "boolean";
  }) && typeof savedState.referenceVisible === "boolean";
}

export function restoreA7State(savedState, instance) {
  if (!validSavedState(savedState, instance)) return createA7InitialState(instance);
  const ids = conceptIds(instance);
  const state = clone(savedState);
  state.selectedId = ids.includes(state.selectedId) ? state.selectedId : null;
  state.rejectedMoves = Math.max(0, Number(state.rejectedMoves) || 0);
  state.completed = ids.every((id) => state.positions[id].placed);
  state.solutionShown = Boolean(state.solutionShown);
  state.referenceVisible = Boolean(state.referenceVisible) && !state.solutionShown && !state.completed;
  return state;
}

export function placeA7Shard(state, shardId, targetId, instance) {
  const ids = conceptIds(instance);
  if (!ids.includes(shardId) || !ids.includes(targetId) || state.solutionShown || state.referenceVisible) return { accepted: false, reason: "unavailable" };
  if (shardId !== targetId) {
    state.rejectedMoves += 1;
    state.selectedId = shardId;
    return { accepted: false, reason: "mismatch" };
  }
  state.positions[shardId] = { ...state.positions[shardId], x: 0.5, y: 0.33, rotation: 0, placed: true };
  state.selectedId = null;
  state.completed = ids.every((id) => state.positions[id].placed);
  return { accepted: true, complete: state.completed };
}

function polygonCentroid(points) {
  const sum = points.reduce((total, [x, y]) => ({ x: total.x + x, y: total.y + y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function paneLayout(instance, width, height) {
  const scale = Number(instance.layoutOverrides?.pane?.scale) || 0.62;
  const paneWidth = ART_WIDTH * scale;
  const paneHeight = ART_HEIGHT * scale;
  const centerX = (Number(instance.layoutOverrides?.pane?.x) || 0.5) * width;
  const centerY = (Number(instance.layoutOverrides?.pane?.y) || 0.33) * height;
  return { scale, paneWidth, paneHeight, centerX, centerY, left: centerX - paneWidth / 2, top: centerY - paneHeight / 2 };
}

function targetCenter(concept, layout) {
  const centroid = polygonCentroid(concept.polygon);
  return { x: layout.left + centroid.x * layout.paneWidth, y: layout.top + centroid.y * layout.paneHeight };
}

function validationErrors(payload, instance) {
  const errors = [];
  if (!isRecord(payload)) return ["payload must be an object"];
  const allowed = ["concepts", "conclusion", "snapTolerance"];
  if (Object.keys(payload).some((key) => !allowed.includes(key))) errors.push("payload contains unsupported fields");
  if (!Array.isArray(payload.concepts) || payload.concepts.length !== REQUIRED_CONCEPTS.length) {
    errors.push("payload.concepts must contain exactly seven shards");
  } else {
    const ids = payload.concepts.map((concept) => concept?.id);
    if (ids.join("|") !== REQUIRED_CONCEPTS.join("|")) errors.push(`payload.concepts must be ordered ${REQUIRED_CONCEPTS.join(", ")}`);
    payload.concepts.forEach((concept, index) => {
      if (!isRecord(concept) || Object.keys(concept).sort().join("|") !== "id|label|polygon") errors.push(`payload.concepts[${index}] must contain exactly {id, label, polygon}`);
      if (!isLocalized(concept?.label)) errors.push(`payload.concepts[${index}].label must contain non-empty {en, pt}`);
      if (!Array.isArray(concept?.polygon) || concept.polygon.length < 4 || !concept.polygon.every(isPoint)) errors.push(`payload.concepts[${index}].polygon must contain normalized points`);
    });
  }
  if (!isLocalized(payload.conclusion)) errors.push("payload.conclusion must contain non-empty {en, pt}");
  if (!Number.isFinite(payload.snapTolerance) || payload.snapTolerance < 0.03 || payload.snapTolerance > 0.08) errors.push("payload.snapTolerance must be from 0.03 to 0.08");
  const layout = instance?.layoutOverrides;
  if (!isRecord(layout) || Object.keys(layout).sort().join("|") !== "pane|showSecondaryControls|trayY") errors.push("layoutOverrides must contain exactly {pane, trayY, showSecondaryControls}");
  if (!isRecord(layout?.pane) || Object.keys(layout.pane).sort().join("|") !== "scale|x|y" || ![layout.pane.x, layout.pane.y].every((value) => Number.isFinite(value) && value > 0 && value < 1) || !Number.isFinite(layout.pane.scale) || layout.pane.scale < 0.45 || layout.pane.scale > 0.75) errors.push("layoutOverrides.pane must contain normalized x/y and a scale from 0.45 to 0.75");
  if (!Number.isFinite(layout?.trayY) || layout.trayY < 0.75 || layout.trayY > 0.95) errors.push("layoutOverrides.trayY must be from 0.75 to 0.95");
  if (layout?.showSecondaryControls !== false) errors.push("layoutOverrides.showSecondaryControls must be false for A7");
  if (instance?.assets?.layers?.length !== 7 || instance?.assets?.masks?.length !== 7 || !instance?.assets?.baseImage) errors.push("A7 requires one base image, seven layers, and seven masks");
  return errors;
}

export const a7Engine = Object.freeze({
  validate(payload, instance) { const errors = validationErrors(payload, instance); return { ok: errors.length === 0, errors }; },

  createScene({ Phaser, instance, language, onStateChange, onReady }) {
    const concepts = instance.payload.concepts;
    const labels = new Map(concepts.map((concept) => [concept.id, concept.label]));
    class StainedGlassRestorationScene extends Phaser.Scene {
      constructor() { super({ key: `a7-${instance.id}` }); this.a7State = createA7InitialState(instance); this.a7Sprites = new Map(); this.a7Dragging = false; this.accessibleFeedback = null; }
      preload() { this.load.image("a7-base", instance.assets.baseImage); instance.assets.layers.forEach((url, index) => this.load.image(`a7-layer-${index}`, url)); }
      create() {
        this.a7Graphics = this.add.graphics();
        const layout = paneLayout(instance, this.scale.width, this.scale.height);
        this.a7Base = this.add.image(layout.centerX, layout.centerY, "a7-base").setDepth(1).setScale(layout.scale);
        concepts.forEach((concept, index) => {
          const sprite = this.add.image(0, 0, `a7-layer-${index}`).setDepth(4).setInteractive({ cursor: "grab" });
          sprite.setData("shardId", concept.id); this.input.setDraggable(sprite);
          sprite.on("pointerdown", () => { if (!this.a7State.referenceVisible && !this.a7State.solutionShown) this.selectShard(concept.id); });
          this.a7Sprites.set(concept.id, sprite);
        });
        this.input.on("pointerdown", (pointer, objects) => {
          if (this.a7State.referenceVisible && !objects.length) this.beginRestoration();
          else if (this.a7State.selectedId && !this.a7State.solutionShown && !objects.length) this.tryDrop(this.a7State.selectedId, pointer.x, pointer.y);
        });
        this.input.on("dragstart", (_pointer, object) => {
          const id = object.getData("shardId"); if (!id || this.a7State.referenceVisible || this.a7State.solutionShown) return;
          this.a7Dragging = true; this.a7DragOrigin = { x: object.x, y: object.y }; this.selectShard(id);
          if (this.a7State.positions[id].placed) this.a7State.positions[id].placed = false;
          object.setDepth(9).setScale(0.34).setRotation(0);
        });
        this.input.on("drag", (_pointer, object, x, y) => { const id = object.getData("shardId"); if (id && !this.a7State.referenceVisible && !this.a7State.solutionShown) object.setPosition(x, y); });
        this.input.on("dragend", (_pointer, object) => {
          const id = object.getData("shardId"); if (!id || this.a7State.referenceVisible || this.a7State.solutionShown) return;
          const moved = this.a7DragOrigin ? Math.hypot(object.x - this.a7DragOrigin.x, object.y - this.a7DragOrigin.y) : 0;
          if (moved >= 6) this.tryDrop(id, object.x, object.y); else this.redraw();
          this.a7Dragging = false;
        });
        this.a7KeyboardHandler = (event) => {
          if (this.a7State.referenceVisible) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.beginRestoration(); } return; }
          if (this.a7State.solutionShown) return;
          if (/^[1-7]$/.test(event.key)) { this.selectShard(conceptIds(instance)[Number(event.key) - 1]); return; }
          if (event.key === "Escape") { this.a7State.selectedId = null; this.accessibleFeedback = localized("Selection cleared.", "Seleção cancelada."); this.redraw(); this.notify(); return; }
          if (!this.a7State.selectedId) return;
          const position = this.a7State.positions[this.a7State.selectedId];
          const step = 0.025;
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault(); position.placed = false;
            if (event.key === "ArrowLeft") position.x = Math.max(0.04, position.x - step);
            if (event.key === "ArrowRight") position.x = Math.min(0.96, position.x + step);
            if (event.key === "ArrowUp") position.y = Math.max(0.05, position.y - step);
            if (event.key === "ArrowDown") position.y = Math.min(0.93, position.y + step);
            this.redraw(); this.notify();
          } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); this.tryDrop(this.a7State.selectedId, position.x * this.scale.width, position.y * this.scale.height); }
        };
        this.game.canvas.addEventListener("keydown", this.a7KeyboardHandler); this.redraw(); onReady(this);
      }
      beginRestoration() { this.a7State.referenceVisible = false; this.accessibleFeedback = localized("The picture is hidden. Rebuild it from the seven fragments.", "A imagem foi ocultada. Reconstrua-a com os sete fragmentos."); this.redraw(); this.notify(); }
      selectShard(id) { if (!this.a7State.positions[id] || this.a7State.referenceVisible || this.a7State.solutionShown) return; this.a7State.selectedId = id; this.accessibleFeedback = localized(`Fragment ${conceptIds(instance).indexOf(id) + 1} selected. Drag it, tap its place, or use arrow keys.`, `Fragmento ${conceptIds(instance).indexOf(id) + 1} selecionado. Arraste-o, toque no lugar ou use as setas.`); this.redraw(); this.notify(); }
      tryDrop(shardId, x, y) {
        const layout = paneLayout(instance, this.scale.width, this.scale.height);
        const tolerance = instance.payload.snapTolerance * Math.min(layout.paneWidth, layout.paneHeight);
        const target = concepts.find((concept) => { const center = targetCenter(concept, layout); return Math.hypot(center.x - x, center.y - y) <= tolerance; });
        if (!target) return this.rejectPlacement(shardId);
        const result = placeA7Shard(this.a7State, shardId, target.id, instance);
        if (!result.accepted) return this.rejectPlacement(shardId, target.id);
        this.accessibleFeedback = result.complete ? localized("All seven fragments are restored. Press Check when you are ready.", "Os sete fragmentos foram restaurados. Pressione Verificar quando estiver pronto.") : localized("The fragment is in place.", "O fragmento está no lugar.");
        this.redraw(); this.notify(); return result;
      }
      rejectPlacement(shardId, targetId = null) {
        const position = this.a7State.positions[shardId]; if (!position) return { accepted: false, reason: "unavailable" };
        position.x = position.homeX; position.y = position.homeY; position.placed = false; this.a7State.selectedId = shardId; this.a7State.rejectedMoves += targetId ? 0 : 1;
        this.accessibleFeedback = targetId ? localized("This fragment does not belong there. It returned to the tray.", "Este fragmento não pertence ali. Ele voltou para a bandeja.") : localized("That place does not receive the fragment. It returned to the tray.", "Esse lugar não recebe o fragmento. Ele voltou para a bandeja.");
        this.redraw(); this.notify(); return { accepted: false, reason: targetId ? "mismatch" : "outside" };
      }
      notify() { onStateChange(this); }
      redraw() {
        if (!this.a7Graphics || !this.a7Base) return;
        const width = this.scale.width, height = this.scale.height, layout = paneLayout(instance, width, height);
        this.a7Graphics.clear();
        if (!this.a7State.referenceVisible) {
          // One quiet frame gives the assembled image a clear home without revealing the seven shard contours.
          this.a7Graphics.lineStyle(1.5, 0x1c1b18, 0.72);
          this.a7Graphics.strokeRect(layout.left, layout.top, layout.paneWidth, layout.paneHeight);
        }
        this.a7Base.setPosition(layout.centerX, layout.centerY).setScale(layout.scale).setAlpha(this.a7State.referenceVisible || this.a7State.solutionShown || this.a7State.completed ? 1 : 0);
        concepts.forEach((concept, index) => {
          const sprite = this.a7Sprites.get(concept.id); const position = this.a7State.positions[concept.id]; if (!sprite) return;
          if (this.a7State.referenceVisible) { sprite.setVisible(false); return; }
          sprite.setVisible(true);
          if (position.placed || this.a7State.solutionShown) sprite.setPosition(layout.centerX, layout.centerY).setScale(layout.scale).setRotation(0).setAlpha(this.a7State.solutionShown && !position.placed ? 0.62 : 1).setDepth(4 + index);
          else if (!this.a7Dragging || this.a7State.selectedId !== concept.id) sprite.setPosition(position.x * width, position.y * height).setScale(this.a7State.selectedId === concept.id ? 0.245 : 0.225).setRotation(position.rotation).setAlpha(1).setDepth(this.a7State.selectedId === concept.id ? 8 : 4);
        });
        const selected = this.a7State.selectedId && this.a7Sprites.get(this.a7State.selectedId);
        if (selected && !this.a7State.referenceVisible && !this.a7Dragging) { this.a7Graphics.lineStyle(2, 0xd60056, 0.9); this.a7Graphics.strokeRect(selected.x - 26, selected.y - 36, 52, 72); }
      }
    }
    return new StainedGlassRestorationScene();
  },
  serializeState(scene) { return clone(scene?.a7State || null); },
  restoreState(scene, savedState, instance) { scene.a7State = restoreA7State(savedState, instance); scene.accessibleFeedback = null; scene.redraw?.(); },
  evaluate(scene, instance) {
    const correct = conceptIds(instance).every((id) => scene.a7State.positions[id]?.placed);
    if (!correct && instance.mode === "mission") { scene.a7State.solutionShown = true; scene.a7State.referenceVisible = false; scene.a7State.selectedId = null; scene.redraw?.(); }
    return { correct, complete: correct, feedback: correct ? localized(`The relationship is restored. ${instance.payload.conclusion.en}`, `A relação foi restaurada. ${instance.payload.conclusion.pt}`) : instance.mode === "mission" ? localized("The restoration was unfinished. The complete image is now shown with its theological conclusion.", "A restauração ficou incompleta. A imagem completa agora aparece com sua conclusão teológica.") : localized("The relationship is not complete yet. Keep placing fragments, then check again.", "A relação ainda não está completa. Continue colocando os fragmentos e verifique novamente.") };
  },
  getAccessibleActions(scene, instance) {
    if (!scene?.a7State || scene.a7State.solutionShown || scene.a7State.completed) return [];
    if (scene.a7State.referenceVisible) return [{ id: "begin-restoration", label: localized("I have studied the picture; begin restoration", "Já observei a imagem; começar a restauração"), run: () => scene.beginRestoration() }];
    const selected = scene.a7State.selectedId;
    if (selected) {
      const move = (axis, amount) => () => { const p = scene.a7State.positions[selected]; p[axis] = Math.max(axis === "x" ? 0.04 : 0.05, Math.min(axis === "x" ? 0.96 : 0.93, p[axis] + amount)); p.placed = false; scene.redraw(); scene.notify(); };
      return [
        { id: "move-left", label: localized("Move selected fragment left", "Mover fragmento selecionado para a esquerda"), run: move("x", -0.025) },
        { id: "move-right", label: localized("Move selected fragment right", "Mover fragmento selecionado para a direita"), run: move("x", 0.025) },
        { id: "move-up", label: localized("Move selected fragment up", "Mover fragmento selecionado para cima"), run: move("y", -0.025) },
        { id: "move-down", label: localized("Move selected fragment down", "Mover fragmento selecionado para baixo"), run: move("y", 0.025) },
        { id: "try-position", label: localized("Try this position", "Tentar esta posição"), run: () => scene.tryDrop(selected, scene.a7State.positions[selected].x * scene.scale.width, scene.a7State.positions[selected].y * scene.scale.height) },
        { id: "clear-selection", label: localized("Choose another fragment", "Escolher outro fragmento"), run: () => { scene.a7State.selectedId = null; scene.redraw(); scene.notify(); } },
      ];
    }
    return instance.payload.concepts.map((concept, index) => ({ id: `select-${concept.id}`, label: localized(`Select fragment ${index + 1}`, `Selecionar fragmento ${index + 1}`), run: () => scene.selectShard(concept.id) }));
  },
  showHint() { return localized("This restoration has no hints. Study the picture before beginning.", "Esta restauração não tem dicas. Observe a imagem antes de começar."); },
  destroy(scene) { if (!scene) return; if (scene.a7KeyboardHandler && scene.game?.canvas) scene.game.canvas.removeEventListener("keydown", scene.a7KeyboardHandler); scene.input?.removeAllListeners(); scene.input?.keyboard?.removeAllListeners(); scene.a7Sprites?.forEach((sprite) => sprite.removeAllListeners()); },
});
