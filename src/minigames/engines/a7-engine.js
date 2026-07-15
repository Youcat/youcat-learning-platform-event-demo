const STATE_VERSION = 1;
const REQUIRED_CONCEPTS = ["trust", "promise", "tenderness", "freedom", "completion"];
const TRAY_SLOTS = [0.12, 0.31, 0.5, 0.69, 0.88];
const ROTATIONS = [-0.1, 0.07, -0.045, 0.11, -0.075];
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
  return Array.isArray(ids) && ids.length === 5 ? ids : [...REQUIRED_CONCEPTS];
}

export function createA7InitialState(instance) {
  const ids = conceptIds(instance);
  const order = shuffled(ids, instance?.seed || "a7-fallback-seed");
  const positions = {};
  order.forEach((id, trayIndex) => {
    positions[id] = {
      x: TRAY_SLOTS[trayIndex],
      y: Number(instance?.layoutOverrides?.trayY) || 0.87,
      rotation: ROTATIONS[(trayIndex + (hashSeed(instance?.seed || "") % ROTATIONS.length)) % ROTATIONS.length],
      placed: false,
    };
  });
  return {
    version: STATE_VERSION,
    positions,
    selectedId: null,
    hintLevel: 0,
    hintTargetId: null,
    rejectedMoves: 0,
    completed: false,
    solutionShown: false,
  };
}

function validSavedState(savedState, instance) {
  if (!isRecord(savedState) || savedState.version !== STATE_VERSION || !isRecord(savedState.positions)) return false;
  const ids = conceptIds(instance);
  if (Object.keys(savedState.positions).sort().join("|") !== [...ids].sort().join("|")) return false;
  return ids.every((id) => {
    const position = savedState.positions[id];
    return isRecord(position) && Number.isFinite(position.x) && position.x >= 0 && position.x <= 1 && Number.isFinite(position.y) && position.y >= 0 && position.y <= 1 && Number.isFinite(position.rotation) && typeof position.placed === "boolean";
  });
}

export function restoreA7State(savedState, instance) {
  if (!validSavedState(savedState, instance)) return createA7InitialState(instance);
  const ids = conceptIds(instance);
  const state = clone(savedState);
  state.selectedId = ids.includes(state.selectedId) && !state.positions[state.selectedId].placed ? state.selectedId : null;
  state.hintLevel = Math.max(0, Math.min(2, Number(state.hintLevel) || 0));
  state.hintTargetId = ids.includes(state.hintTargetId) && !state.positions[state.hintTargetId].placed ? state.hintTargetId : null;
  state.rejectedMoves = Math.max(0, Number(state.rejectedMoves) || 0);
  state.completed = ids.every((id) => state.positions[id].placed);
  state.solutionShown = Boolean(state.solutionShown);
  return state;
}

export function placeA7Shard(state, shardId, targetId, instance) {
  const ids = conceptIds(instance);
  if (!ids.includes(shardId) || !ids.includes(targetId) || state.positions[shardId]?.placed || state.solutionShown) return { accepted: false, reason: "unavailable" };
  if (shardId !== targetId) {
    state.rejectedMoves += 1;
    state.selectedId = shardId;
    return { accepted: false, reason: "mismatch" };
  }
  state.positions[shardId] = { ...state.positions[shardId], x: 0.5, y: 0.33, rotation: 0, placed: true };
  state.selectedId = null;
  state.hintTargetId = null;
  state.completed = ids.every((id) => state.positions[id].placed);
  return { accepted: true, complete: state.completed };
}

function nextUnplaced(state, instance) {
  return conceptIds(instance).find((id) => !state.positions[id]?.placed) || null;
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

function worldPolygon(concept, layout) {
  return concept.polygon.map(([x, y]) => ({ x: layout.left + x * layout.paneWidth, y: layout.top + y * layout.paneHeight }));
}

function validationErrors(payload, instance) {
  const errors = [];
  if (!isRecord(payload)) return ["payload must be an object"];
  const allowed = ["concepts", "reflection", "snapTolerance"];
  if (Object.keys(payload).some((key) => !allowed.includes(key))) errors.push("payload contains unsupported fields");
  if (!Array.isArray(payload.concepts) || payload.concepts.length !== 5) {
    errors.push("payload.concepts must contain exactly five shards");
  } else {
    const ids = payload.concepts.map((concept) => concept?.id);
    if (ids.join("|") !== REQUIRED_CONCEPTS.join("|")) errors.push(`payload.concepts must be ordered ${REQUIRED_CONCEPTS.join(", ")}`);
    payload.concepts.forEach((concept, index) => {
      if (!isRecord(concept) || Object.keys(concept).sort().join("|") !== "id|label|polygon") errors.push(`payload.concepts[${index}] must contain exactly {id, label, polygon}`);
      if (!isLocalized(concept?.label)) errors.push(`payload.concepts[${index}].label must contain non-empty {en, pt}`);
      if (!Array.isArray(concept?.polygon) || concept.polygon.length < 4 || !concept.polygon.every(isPoint)) errors.push(`payload.concepts[${index}].polygon must contain normalized points`);
    });
  }
  if (!isLocalized(payload.reflection)) errors.push("payload.reflection must contain non-empty {en, pt}");
  if (!Number.isFinite(payload.snapTolerance) || payload.snapTolerance < 0.05 || payload.snapTolerance > 0.2) errors.push("payload.snapTolerance must be from 0.05 to 0.2");
  const layout = instance?.layoutOverrides;
  if (!isRecord(layout) || Object.keys(layout).sort().join("|") !== "pane|trayY") errors.push("layoutOverrides must contain exactly {pane, trayY}");
  if (!isRecord(layout?.pane) || Object.keys(layout.pane).sort().join("|") !== "scale|x|y" || ![layout.pane.x, layout.pane.y].every((value) => Number.isFinite(value) && value > 0 && value < 1) || !Number.isFinite(layout.pane.scale) || layout.pane.scale < 0.45 || layout.pane.scale > 0.75) errors.push("layoutOverrides.pane must contain normalized x/y and a scale from 0.45 to 0.75");
  if (!Number.isFinite(layout?.trayY) || layout.trayY < 0.75 || layout.trayY > 0.95) errors.push("layoutOverrides.trayY must be from 0.75 to 0.95");
  if (instance?.assets?.layers?.length !== 5 || instance?.assets?.masks?.length !== 5 || !instance?.assets?.baseImage) errors.push("A7 requires one base image, five layers, and five masks");
  return errors;
}

export const a7Engine = Object.freeze({
  validate(payload, instance) {
    const errors = validationErrors(payload, instance);
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const concepts = instance.payload.concepts;
    const labels = new Map(concepts.map((concept) => [concept.id, concept.label]));

    class StainedGlassRestorationScene extends Phaser.Scene {
      constructor() {
        super({ key: `a7-${instance.id}` });
        this.a7State = createA7InitialState(instance);
        this.a7InitialState = clone(this.a7State);
        this.a7Sprites = new Map();
        this.a7Dragging = false;
        this.accessibleFeedback = null;
      }

      preload() {
        this.load.image("a7-base", instance.assets.baseImage);
        instance.assets.layers.forEach((url, index) => this.load.image(`a7-layer-${index}`, url));
      }

      create() {
        this.a7Graphics = this.add.graphics();
        this.a7Base = this.add.image(0, 0, "a7-base").setDepth(1);
        const layout = paneLayout(instance, this.scale.width, this.scale.height);
        this.a7Base.setPosition(layout.centerX, layout.centerY).setScale(layout.scale).setAlpha(0.08);

        concepts.forEach((concept, index) => {
          const sprite = this.add.image(0, 0, `a7-layer-${index}`).setDepth(4).setInteractive({ cursor: "grab" });
          sprite.setData("shardId", concept.id);
          this.input.setDraggable(sprite);
          sprite.on("pointerdown", () => {
            if (this.a7State.positions[concept.id].placed || this.a7State.solutionShown) return;
            this.selectShard(concept.id);
          });
          this.a7Sprites.set(concept.id, sprite);

        });

        this.input.on("pointerdown", (pointer) => {
          if (!this.a7State.selectedId || this.a7State.solutionShown) return;
          const target = concepts.find((concept) => Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(worldPolygon(concept, layout)), pointer.x, pointer.y));
          if (target) this.tryPlacement(this.a7State.selectedId, target.id);
        });

        this.input.on("dragstart", (_pointer, object) => {
          const id = object.getData("shardId");
          if (!id || this.a7State.positions[id].placed || this.a7State.solutionShown) return;
          this.a7Dragging = true;
          this.a7DragOrigin = { x: object.x, y: object.y };
          this.selectShard(id);
          object.setDepth(8).setScale(0.34).setRotation(0);
        });
        this.input.on("drag", (_pointer, object, x, y) => {
          const id = object.getData("shardId");
          if (!id || this.a7State.positions[id].placed || this.a7State.solutionShown) return;
          object.setPosition(x, y);
        });
        this.input.on("dragend", (_pointer, object) => {
          const id = object.getData("shardId");
          if (!id || this.a7State.positions[id].placed || this.a7State.solutionShown) return;
          const moved = this.a7DragOrigin ? Math.hypot(object.x - this.a7DragOrigin.x, object.y - this.a7DragOrigin.y) : 0;
          if (moved < 6) {
            this.a7Dragging = false;
            this.redraw();
            return;
          }
          const target = concepts.find((concept) => Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(worldPolygon(concept, layout)), object.x, object.y));
          if (target) this.tryPlacement(id, target.id);
          else {
            this.rejectPlacement(id, null);
            this.notify();
          }
          this.a7Dragging = false;
        });

        this.a7KeyboardHandler = (event) => {
          const unplaced = conceptIds(instance).filter((id) => !this.a7State.positions[id].placed);
          if (!unplaced.length || this.a7State.solutionShown) return;
          if (/^[1-5]$/.test(event.key)) {
            const id = conceptIds(instance)[Number(event.key) - 1];
            if (!this.a7State.positions[id].placed) this.selectShard(id);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const current = Math.max(0, unplaced.indexOf(this.a7State.selectedId));
            const delta = event.key === "ArrowRight" ? 1 : -1;
            this.selectShard(unplaced[(current + delta + unplaced.length) % unplaced.length]);
          } else if ((event.key === "Enter" || event.key === " ") && this.a7State.selectedId) {
            event.preventDefault();
            this.tryPlacement(this.a7State.selectedId, this.a7State.selectedId);
          } else if (event.key === "Escape") {
            this.a7State.selectedId = null;
            this.accessibleFeedback = localized("Selection cleared.", "Seleção cancelada.");
            this.redraw();
            this.notify();
          }
        };
        this.game.canvas.addEventListener("keydown", this.a7KeyboardHandler);
        this.redraw();
        onReady(this);
      }

      selectShard(id) {
        if (!this.a7State.positions[id] || this.a7State.positions[id].placed || this.a7State.solutionShown) return;
        this.a7State.selectedId = id;
        this.accessibleFeedback = localized(`${labels.get(id).en} shard selected. Choose its matching silhouette.`, `Fragmento ${labels.get(id).pt.toLowerCase()} selecionado. Escolha a silhueta correspondente.`);
        this.redraw();
        this.notify();
      }

      tryPlacement(shardId, targetId) {
        const result = placeA7Shard(this.a7State, shardId, targetId, instance);
        if (!result.accepted) {
          this.rejectPlacement(shardId, targetId);
        } else {
          this.accessibleFeedback = result.complete
            ? localized("All five shards are restored. Press Check when you are ready.", "Os cinco fragmentos foram restaurados. Pressione Verificar quando estiver pronto.")
            : localized(`${labels.get(shardId).en} is in place.`, `${labels.get(shardId).pt} está no lugar.`);
        }
        this.redraw();
        this.notify();
        return result;
      }

      rejectPlacement(shardId, targetId) {
        this.a7State.rejectedMoves += targetId ? 0 : 1;
        this.a7State.selectedId = shardId;
        this.accessibleFeedback = targetId
          ? localized("That silhouette cannot accept this shard. The piece returned safely.", "Essa silhueta não aceita este fragmento. A peça voltou com segurança.")
          : localized("Place the shard inside one of the five silhouettes.", "Coloque o fragmento dentro de uma das cinco silhuetas.");
        this.redraw();
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.a7Graphics || !this.a7Base) return;
        const width = this.scale.width;
        const height = this.scale.height;
        const layout = paneLayout(instance, width, height);
        this.a7Graphics.clear();
        concepts.forEach((concept, index) => {
          const points = worldPolygon(concept, layout);
          const placed = this.a7State.positions[concept.id].placed || this.a7State.solutionShown;
          const hinted = this.a7State.hintTargetId === concept.id;
          this.a7Graphics.fillStyle(placed ? 0xf9dce7 : 0xf7f3f4, placed ? 0.34 : 0.55);
          this.a7Graphics.fillPoints(points, true);
          this.a7Graphics.lineStyle(hinted ? 4 : 1.4, hinted ? 0xd60056 : 0x77716b, hinted ? 0.9 : 0.66);
          this.a7Graphics.strokePoints(points, true);
          if (!placed) {
            const centroid = polygonCentroid(concept.polygon);
            this.a7Graphics.fillStyle(0xffffff, 0.9);
            this.a7Graphics.fillCircle(layout.left + centroid.x * layout.paneWidth, layout.top + centroid.y * layout.paneHeight, 10);
            this.a7Graphics.lineStyle(1.2, 0x77716b, 0.75);
            this.a7Graphics.strokeCircle(layout.left + centroid.x * layout.paneWidth, layout.top + centroid.y * layout.paneHeight, 10);
          }
          const sprite = this.a7Sprites.get(concept.id);
          if (!sprite) return;
          if (placed) {
            sprite.setPosition(layout.centerX, layout.centerY).setScale(layout.scale).setRotation(0).setAlpha(this.a7State.solutionShown && !this.a7State.positions[concept.id].placed ? 0.62 : 1).setDepth(4 + index);
          } else if (!this.a7Dragging || this.a7State.selectedId !== concept.id) {
            const position = this.a7State.positions[concept.id];
            sprite.setPosition(position.x * width, position.y * height).setScale(this.a7State.selectedId === concept.id ? 0.255 : 0.24).setRotation(position.rotation).setAlpha(1).setDepth(this.a7State.selectedId === concept.id ? 7 : 4);
          }
        });
        this.a7Base.setAlpha(this.a7State.completed || this.a7State.solutionShown ? 0.22 : 0.08);
        const selected = this.a7State.selectedId && this.a7Sprites.get(this.a7State.selectedId);
        if (selected && !this.a7State.positions[this.a7State.selectedId].placed && !this.a7Dragging) {
          this.a7Graphics.lineStyle(2.5, 0xd60056, 0.9);
          this.a7Graphics.strokeRect(selected.x - 31, selected.y - 42, 62, 84);
        }
      }
    }

    return new StainedGlassRestorationScene();
  },

  serializeState(scene) {
    return clone(scene?.a7State || null);
  },

  restoreState(scene, savedState, instance) {
    scene.a7State = restoreA7State(savedState, instance);
    scene.accessibleFeedback = null;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const correct = conceptIds(instance).every((id) => scene.a7State.positions[id]?.placed);
    if (!correct && instance.mode === "mission") {
      scene.a7State.solutionShown = true;
      scene.a7State.selectedId = null;
      scene.redraw?.();
    }
    return {
      correct,
      complete: correct,
      feedback: correct
        ? localized(`The whole image is restored. ${instance.payload.reflection.en}`, `A imagem inteira foi restaurada. ${instance.payload.reflection.pt}`)
        : instance.mode === "mission"
          ? localized("The restoration was unfinished. The complete image is now shown for reflection.", "A restauração ficou incompleta. A imagem completa agora aparece para reflexão.")
          : localized("The image is not complete yet. Keep placing shards, then check again.", "A imagem ainda não está completa. Continue colocando os fragmentos e verifique novamente."),
    };
  },

  getAccessibleActions(scene, instance) {
    if (!scene || !scene.a7State) return [];
    const concepts = instance.payload.concepts;
    if (scene.a7State.solutionShown || scene.a7State.completed) return [];
    const selected = scene.a7State.selectedId;
    if (selected) {
      const concept = concepts.find((item) => item.id === selected);
      return [
        { id: `place-${selected}`, label: localized(`Place ${concept.label.en} in its matching silhouette`, `Colocar ${concept.label.pt.toLowerCase()} na silhueta correspondente`), run: () => scene.tryPlacement(selected, selected) },
        { id: "clear-selection", label: localized("Choose another shard", "Escolher outro fragmento"), run: () => { scene.a7State.selectedId = null; scene.accessibleFeedback = localized("Choose a shard.", "Escolha um fragmento."); scene.redraw(); scene.notify(); } },
      ];
    }
    return concepts
      .filter((concept) => !scene.a7State.positions[concept.id].placed)
      .map((concept, index) => ({
        id: `select-${concept.id}`,
        label: localized(`Select shard ${index + 1}: ${concept.label.en}`, `Selecionar fragmento ${index + 1}: ${concept.label.pt}`),
        run: () => scene.selectShard(concept.id),
      }));
  },

  showHint(scene, hintIndex, instance) {
    const id = nextUnplaced(scene.a7State, instance);
    if (!id) return localized("The image is already restored. Press Check.", "A imagem já está restaurada. Pressione Verificar.");
    const concept = instance.payload.concepts.find((item) => item.id === id);
    scene.a7State.hintLevel = Math.max(scene.a7State.hintLevel, Math.min(2, hintIndex + 1));
    scene.a7State.hintTargetId = id;
    if (hintIndex === 0) {
      scene.a7State.selectedId = id;
      scene.accessibleFeedback = localized(`The ${concept.label.en.toLowerCase()} silhouette is outlined in pink.`, `A silhueta de ${concept.label.pt.toLowerCase()} está contornada em rosa.`);
    } else {
      placeA7Shard(scene.a7State, id, id, instance);
      scene.accessibleFeedback = localized(`${concept.label.en} was placed for you.`, `${concept.label.pt} foi colocada para você.`);
    }
    scene.redraw?.();
    scene.notify?.();
    return scene.accessibleFeedback;
  },

  destroy(scene) {
    if (!scene) return;
    if (scene.a7KeyboardHandler && scene.game?.canvas) scene.game.canvas.removeEventListener("keydown", scene.a7KeyboardHandler);
    scene.input?.removeAllListeners();
    scene.input?.keyboard?.removeAllListeners();
    scene.a7Sprites?.forEach((sprite) => sprite.removeAllListeners());
  },
});
