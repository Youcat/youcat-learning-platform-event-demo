const LAYERS = Object.freeze(["roots", "trunk", "branches", "fruit"]);

function localized(en, pt) {
  return { en, pt };
}

export const B14_DEFAULT_PAYLOAD = Object.freeze({
  layers: [
    { id: "roots", label: localized("Roots", "Raízes"), requires: [] },
    { id: "trunk", label: localized("Trunk", "Tronco"), requires: ["roots"] },
    { id: "branches", label: localized("Branches", "Ramos"), requires: ["trunk"] },
    { id: "fruit", label: localized("Fruit", "Fruto"), requires: ["branches"] },
  ],
  items: [
    { id: "grace", label: localized("Grace", "Graça"), layer: "roots" },
    { id: "truth", label: localized("Truth", "Verdade"), layer: "roots" },
    { id: "prayer", label: localized("Prayer", "Oração"), layer: "roots" },
    { id: "decision", label: localized("Decision", "Decisão"), layer: "trunk" },
    { id: "gratitude", label: localized("Gratitude", "Gratidão"), layer: "branches" },
    { id: "forgiveness", label: localized("Forgiveness", "Perdão"), layer: "branches" },
    { id: "respect", label: localized("Respect", "Respeito"), layer: "branches" },
    { id: "care", label: localized("Care", "Cuidado"), layer: "branches" },
    { id: "communion", label: localized("Deeper communion", "Comunhão mais profunda"), layer: "fruit" },
  ],
  targets: [
    { id: "root-left", layer: "roots", x: 0.17, y: 0.74 },
    { id: "root-centre", layer: "roots", x: 0.5, y: 0.8 },
    { id: "root-right", layer: "roots", x: 0.83, y: 0.74 },
    { id: "trunk-centre", layer: "trunk", x: 0.5, y: 0.51 },
    { id: "branch-left", layer: "branches", x: 0.11, y: 0.28 },
    { id: "branch-mid-left", layer: "branches", x: 0.36, y: 0.2 },
    { id: "branch-mid-right", layer: "branches", x: 0.64, y: 0.2 },
    { id: "branch-right", layer: "branches", x: 0.89, y: 0.28 },
    { id: "fruit-top", layer: "fruit", x: 0.5, y: 0.075 },
  ],
});

const FEEDBACK = Object.freeze({
  locked: localized("That layer has not grown yet.", "Essa camada ainda não cresceu."),
  wrongLayer: localized("That word belongs in another layer.", "Essa palavra pertence a outra camada."),
  unknown: localized("That move is not available.", "Esse movimento não está disponível."),
  placed: localized("Placed. Continue growing the tree.", "Colocado. Continue fazendo a árvore crescer."),
});

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

function localizedIsValid(value) {
  return hasExactKeys(value, ["en", "pt"])
    && ["en", "pt"].every((locale) => typeof value[locale] === "string" && value[locale].trim());
}

function payloadErrors(payload, instance) {
  const errors = [];
  if (!hasExactKeys(payload, ["layers", "items", "targets"])) {
    errors.push("payload must contain exactly {layers, items, targets}");
    return errors;
  }
  if (!Array.isArray(payload.layers) || payload.layers.length !== 4) errors.push("payload.layers must contain four hierarchy layers");
  if (!Array.isArray(payload.items) || payload.items.length !== 9) errors.push("payload.items must contain nine growth items");
  if (!Array.isArray(payload.targets) || payload.targets.length !== 9) errors.push("payload.targets must contain nine target positions");
  if (errors.length) return errors;

  const layerIds = new Set();
  payload.layers.forEach((layer, index) => {
    if (!hasExactKeys(layer, ["id", "label", "requires"])) errors.push(`payload.layers[${index}] has unknown or missing fields`);
    if (layer?.id !== LAYERS[index]) errors.push(`payload.layers[${index}].id must be ${LAYERS[index]}`);
    if (!localizedIsValid(layer?.label)) errors.push(`payload.layers[${index}].label must contain exactly {en, pt}`);
    if (!Array.isArray(layer?.requires) || layer.requires.some((id) => typeof id !== "string")) errors.push(`payload.layers[${index}].requires must be a string array`);
    layerIds.add(layer?.id);
  });
  const expectedRequirements = [[], ["roots"], ["trunk"], ["branches"]];
  payload.layers.forEach((layer, index) => {
    if (JSON.stringify(layer?.requires) !== JSON.stringify(expectedRequirements[index])) errors.push(`payload.layers[${index}].requires breaks the hierarchy`);
  });

  const itemIds = new Set();
  const itemCounts = Object.fromEntries(LAYERS.map((id) => [id, 0]));
  payload.items.forEach((item, index) => {
    if (!hasExactKeys(item, ["id", "label", "layer"])) errors.push(`payload.items[${index}] has unknown or missing fields`);
    if (typeof item?.id !== "string" || !item.id.trim() || itemIds.has(item.id)) errors.push(`payload.items[${index}].id must be unique`);
    if (!localizedIsValid(item?.label)) errors.push(`payload.items[${index}].label must contain exactly {en, pt}`);
    if (!layerIds.has(item?.layer)) errors.push(`payload.items[${index}].layer is unknown`);
    if (itemCounts[item?.layer] !== undefined) itemCounts[item.layer] += 1;
    itemIds.add(item?.id);
  });

  const targetIds = new Set();
  const targetCounts = Object.fromEntries(LAYERS.map((id) => [id, 0]));
  payload.targets.forEach((target, index) => {
    if (!hasExactKeys(target, ["id", "layer", "x", "y"])) errors.push(`payload.targets[${index}] has unknown or missing fields`);
    if (typeof target?.id !== "string" || !target.id.trim() || targetIds.has(target.id)) errors.push(`payload.targets[${index}].id must be unique`);
    if (!layerIds.has(target?.layer)) errors.push(`payload.targets[${index}].layer is unknown`);
    if (!Number.isFinite(target?.x) || target.x < 0.05 || target.x > 0.95 || !Number.isFinite(target?.y) || target.y < 0.04 || target.y > 0.84) {
      errors.push(`payload.targets[${index}] must use safe normalized coordinates`);
    }
    if (targetCounts[target?.layer] !== undefined) targetCounts[target.layer] += 1;
    targetIds.add(target?.id);
  });

  const expectedCounts = { roots: 3, trunk: 1, branches: 4, fruit: 1 };
  for (const layer of LAYERS) {
    if (itemCounts[layer] !== expectedCounts[layer]) errors.push(`${layer} needs ${expectedCounts[layer]} items`);
    if (targetCounts[layer] !== expectedCounts[layer]) errors.push(`${layer} needs ${expectedCounts[layer]} targets`);
  }
  if (instance?.layoutOverrides && Object.keys(instance.layoutOverrides).length) errors.push("B14 does not accept layoutOverrides");
  return errors;
}

export function normalizeB14Payload(payload) {
  return payloadErrors(payload, { layoutOverrides: {} }).length ? clone(B14_DEFAULT_PAYLOAD) : clone(payload);
}

function seedHash(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "B14")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seedHash(seed) || 1;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededB14ItemOrder(payload, seed) {
  const random = seededRandom(seed);
  const ids = normalizeB14Payload(payload).items.map((item) => item.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  return ids;
}

export function createB14InitialState(payload, seed) {
  return {
    placements: {},
    selectedItemId: null,
    hintLevel: 0,
    completed: false,
    solutionShown: false,
    itemOrder: seededB14ItemOrder(payload, seed),
    messageKey: "",
  };
}

function itemsForLayer(payload, layerId) {
  return payload.items.filter((item) => item.layer === layerId);
}

function targetsForLayer(payload, layerId) {
  return payload.targets.filter((target) => target.layer === layerId);
}

export function isB14LayerComplete(state, payload, layerId) {
  const placed = new Set(Object.values(state?.placements || {}));
  return itemsForLayer(payload, layerId).every((item) => placed.has(item.id));
}

export function isB14LayerUnlocked(state, payload, layerId) {
  const layer = payload.layers.find((candidate) => candidate.id === layerId);
  return Boolean(layer) && layer.requires.every((required) => isB14LayerComplete(state, payload, required));
}

export function activeB14Layer(state, payload) {
  return LAYERS.find((layerId) => isB14LayerUnlocked(state, payload, layerId) && !isB14LayerComplete(state, payload, layerId)) || null;
}

export function isB14Complete(state, payload) {
  return LAYERS.every((layerId) => isB14LayerComplete(state, payload, layerId));
}

export function restoreB14State(savedState, payloadInput, seed) {
  const payload = normalizeB14Payload(payloadInput);
  const clean = createB14InitialState(payload, seed);
  if (!isRecord(savedState)) return clean;
  const incoming = isRecord(savedState.placements) ? savedState.placements : {};
  const used = new Set();

  for (const layerId of LAYERS) {
    if (!isB14LayerUnlocked(clean, payload, layerId)) break;
    for (const target of targetsForLayer(payload, layerId)) {
      const itemId = incoming[target.id];
      const item = payload.items.find((candidate) => candidate.id === itemId);
      if (item?.layer === layerId && !used.has(itemId)) {
        clean.placements[target.id] = itemId;
        used.add(itemId);
      }
    }
  }

  clean.selectedItemId = payload.items.some((item) => item.id === savedState.selectedItemId) ? savedState.selectedItemId : null;
  clean.hintLevel = Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0));
  clean.solutionShown = Boolean(savedState.solutionShown);
  clean.completed = isB14Complete(clean, payload);
  clean.messageKey = typeof savedState.messageKey === "string" && FEEDBACK[savedState.messageKey] ? savedState.messageKey : "";
  return clean;
}

export function applyB14Move(state, payloadInput, itemId, targetId) {
  const payload = normalizeB14Payload(payloadInput);
  const item = payload.items.find((candidate) => candidate.id === itemId);
  const target = payload.targets.find((candidate) => candidate.id === targetId);
  if (!item || !target) return { ok: false, reason: "unknown", feedback: FEEDBACK.unknown };
  if (!isB14LayerUnlocked(state, payload, target.layer)) return { ok: false, reason: "locked", feedback: FEEDBACK.locked };
  if (item.layer !== target.layer) return { ok: false, reason: "wrongLayer", feedback: FEEDBACK.wrongLayer };

  const currentTargetId = Object.keys(state.placements).find((id) => state.placements[id] === itemId);
  const displacedItemId = state.placements[targetId];
  if (currentTargetId && currentTargetId !== targetId) {
    if (displacedItemId) state.placements[currentTargetId] = displacedItemId;
    else delete state.placements[currentTargetId];
  }
  state.placements[targetId] = itemId;
  state.selectedItemId = null;
  state.completed = isB14Complete(state, payload);
  state.messageKey = "placed";
  return { ok: true, reason: "placed", feedback: FEEDBACK.placed };
}

export function completeB14Solution(state, payloadInput) {
  const payload = normalizeB14Payload(payloadInput);
  for (const layerId of LAYERS) {
    const layerItems = itemsForLayer(payload, layerId);
    const layerTargets = targetsForLayer(payload, layerId);
    layerTargets.forEach((target, index) => { state.placements[target.id] = layerItems[index].id; });
  }
  state.selectedItemId = null;
  state.completed = true;
  state.solutionShown = true;
  return state;
}

function labelFor(value, language) {
  return value?.[language] || value?.en || value?.pt || "";
}

function layerProgress(state, payload, layerId) {
  const placed = new Set(Object.values(state.placements));
  const items = itemsForLayer(payload, layerId);
  return { placed: items.filter((item) => placed.has(item.id)).length, total: items.length };
}

function hintCopy(state, payload, hintIndex) {
  const layerId = activeB14Layer(state, payload);
  const layer = payload.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return localized("The tree is complete. Check your work.", "A árvore está completa. Verifique o seu trabalho.");
  const progress = layerProgress(state, payload, layerId);
  if (hintIndex === 0) {
    return localized(
      `Work on ${layer.label.en.toLowerCase()} next: ${progress.total - progress.placed} placement${progress.total - progress.placed === 1 ? "" : "s"} remain.`,
      `Agora complete ${layer.label.pt.toLowerCase()}: falt${progress.total - progress.placed === 1 ? "a" : "am"} ${progress.total - progress.placed} colocaç${progress.total - progress.placed === 1 ? "ão" : "ões"}.`,
    );
  }
  return localized("One fitting word has been placed for you.", "Uma palavra adequada foi colocada para você.");
}

function targetSize(layerId) {
  if (layerId === "fruit") return { width: 168, height: 40 };
  if (layerId === "trunk") return { width: 106, height: 36 };
  if (layerId === "roots") return { width: 96, height: 34 };
  return { width: 78, height: 38 };
}

function trayPositions(layerId, count) {
  if (layerId === "branches") return [48, 136, 224, 312].slice(0, count).map((x) => ({ x, y: 328 }));
  if (layerId === "roots") return [58, 180, 302].slice(0, count).map((x) => ({ x, y: 328 }));
  return [{ x: 180, y: 328 }];
}

function sceneFeedback(scene, feedback) {
  scene.accessibleFeedback = feedback;
  scene.b14State.messageKey = Object.entries(FEEDBACK).find(([, value]) => value === feedback)?.[0] || "";
}

export const b14Engine = Object.freeze({
  validate(payload, instance) {
    const errors = payloadErrors(payload, instance);
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const payload = normalizeB14Payload(instance.payload);

    class B14Scene extends Phaser.Scene {
      constructor() {
        super({ key: `B14-${instance.id}` });
        this.b14Payload = payload;
        this.b14InitialState = createB14InitialState(payload, instance.seed);
        this.b14State = clone(this.b14InitialState);
        this.b14Language = language;
        this.b14ReducedMotion = reducedMotion;
        this.b14Objects = [];
        this.accessibleFeedback = null;
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("b14-approved-tree", instance.assets.baseImage);
      }

      create() {
        if (this.textures.exists("b14-approved-tree")) {
          this.b14Artwork = this.add.image(180, 174, "b14-approved-tree").setDisplaySize(350, 350).setAlpha(0.075);
        }
        this.b14Tree = this.add.graphics();
        this.b14LayerLabel = this.add.text(10, 7, "", {
          color: "#6f6a61",
          fontFamily: "Fira Sans, Source Sans 3, sans-serif",
          fontSize: "12px",
          fontStyle: "600",
        });
        this.redraw();
        this.b14Keydown = (event) => {
          if (event.key === "Enter" || event.key === " ") this.keyboardAdvance(event);
          if (event.key === "ArrowLeft") this.keyboardSelect(event, -1);
          if (event.key === "ArrowRight") this.keyboardSelect(event, 1);
        };
        this.game.canvas.addEventListener("keydown", this.b14Keydown);
        onReady(this);
      }

      keyboardHasFocus() {
        return globalThis.document?.activeElement === this.game?.canvas;
      }

      keyboardSelect(event, direction) {
        if (!this.keyboardHasFocus()) return;
        event.preventDefault();
        const activeLayerId = activeB14Layer(this.b14State, this.b14Payload);
        const candidates = this.b14State.itemOrder.filter((id) => this.b14Payload.items.find((item) => item.id === id)?.layer === activeLayerId);
        if (!candidates.length) return;
        const current = Math.max(0, candidates.indexOf(this.b14State.selectedItemId));
        this.b14State.selectedItemId = candidates[(current + direction + candidates.length) % candidates.length];
        this.redraw();
        this.notify();
      }

      keyboardAdvance(event) {
        if (!this.keyboardHasFocus()) return;
        event.preventDefault();
        const activeLayerId = activeB14Layer(this.b14State, this.b14Payload);
        if (!activeLayerId) return;
        const placed = new Set(Object.values(this.b14State.placements));
        const pending = this.b14State.itemOrder.filter((id) => {
          const item = this.b14Payload.items.find((candidate) => candidate.id === id);
          return item?.layer === activeLayerId && !placed.has(id);
        });
        if (!this.b14State.selectedItemId) {
          this.b14State.selectedItemId = pending[0] || itemsForLayer(this.b14Payload, activeLayerId)[0]?.id || null;
          this.redraw();
          this.notify();
          return;
        }
        const target = targetsForLayer(this.b14Payload, activeLayerId).find((candidate) => !this.b14State.placements[candidate.id]);
        if (target) this.placeItem(this.b14State.selectedItemId, target.id);
      }

      notify() {
        onStateChange(this);
      }

      placeItem(itemId, targetId) {
        const result = applyB14Move(this.b14State, this.b14Payload, itemId, targetId);
        sceneFeedback(this, result.feedback);
        this.redraw();
        this.notify();
        return result;
      }

      selectItem(itemId) {
        this.b14State.selectedItemId = this.b14State.selectedItemId === itemId ? null : itemId;
        this.redraw();
        this.notify();
      }

      clearObjects() {
        this.b14Objects.forEach((object) => object.destroy());
        this.b14Objects = [];
      }

      drawTree() {
        const point = (id) => {
          const target = this.b14Payload.targets.find((candidate) => candidate.id === id);
          return { x: target.x * 360, y: target.y * 350 };
        };
        const trunk = point("trunk-centre");
        const fruit = point("fruit-top");
        this.b14Tree.clear();
        this.b14Tree.lineStyle(3, 0x22201d, 0.72);
        this.b14Tree.lineBetween(trunk.x - 9, 258, trunk.x - 4, 106);
        this.b14Tree.lineBetween(trunk.x + 9, 258, trunk.x + 4, 106);
        for (const target of targetsForLayer(this.b14Payload, "branches")) {
          const end = { x: target.x * 360, y: target.y * 350 };
          this.b14Tree.lineBetween(trunk.x, 134, end.x, end.y + 9);
        }
        for (const target of targetsForLayer(this.b14Payload, "roots")) {
          const end = { x: target.x * 360, y: target.y * 350 };
          this.b14Tree.lineBetween(trunk.x, 245, end.x, end.y - 7);
        }
        this.b14Tree.lineBetween(trunk.x, 106, fruit.x, fruit.y + 12);
      }

      addTarget(target) {
        const { width, height } = targetSize(target.layer);
        const x = target.x * 360;
        const y = target.y * 350;
        const unlocked = isB14LayerUnlocked(this.b14State, this.b14Payload, target.layer);
        const active = activeB14Layer(this.b14State, this.b14Payload) === target.layer;
        const occupied = Boolean(this.b14State.placements[target.id]);
        const outline = this.add.graphics();
        outline.fillStyle(0xffffff, occupied ? 0.96 : 0.74);
        outline.fillRoundedRect(x - width / 2, y - height / 2, width, height, 6);
        outline.lineStyle(active && this.b14State.hintLevel ? 3 : 1.5, active ? 0xd60056 : 0x6f6a61, unlocked ? 0.9 : 0.28);
        outline.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 6);
        this.b14Objects.push(outline);

        const zone = this.add.zone(x, y, Math.max(52, width), Math.max(52, height)).setInteractive({ cursor: unlocked ? "pointer" : "default" });
        zone.on("pointerdown", () => {
          if (this.b14State.selectedItemId) this.placeItem(this.b14State.selectedItemId, target.id);
          else if (!unlocked) {
            sceneFeedback(this, FEEDBACK.locked);
            this.notify();
          }
        });
        this.b14Objects.push(zone);

        if (!occupied) {
          const layer = this.b14Payload.layers.find((candidate) => candidate.id === target.layer);
          const emptyLabel = this.add.text(x, y, labelFor(layer.label, this.b14Language), {
            color: unlocked ? "#6f6a61" : "#918b80",
            fontFamily: "Fira Sans, Source Sans 3, sans-serif",
            fontSize: target.layer === "branches" ? "10px" : "11px",
            align: "center",
          }).setOrigin(0.5).setAlpha(unlocked ? 0.8 : 0.42);
          this.b14Objects.push(emptyLabel);
        }
      }

      addItem(item, x, y, placed) {
        const { width, height } = targetSize(item.layer);
        const selected = this.b14State.selectedItemId === item.id;
        const chip = this.add.graphics();
        chip.fillStyle(placed ? 0xf7e4eb : 0xffffff, 0.98);
        chip.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
        chip.lineStyle(selected ? 3 : 1.5, selected ? 0xd60056 : 0x22201d, 1);
        chip.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);
        const text = this.add.text(0, 0, labelFor(item.label, this.b14Language), {
          color: "#22201d",
          fontFamily: "Fira Sans, Source Sans 3, sans-serif",
          fontSize: item.layer === "branches" ? "10px" : "11px",
          fontStyle: "600",
          align: "center",
          wordWrap: { width: width - 8, useAdvancedWrap: true },
        }).setOrigin(0.5);
        const container = this.add.container(x, y, [chip, text]).setSize(Math.max(52, width), Math.max(52, height)).setInteractive({ cursor: "grab" });
        this.input.setDraggable(container);
        container.on("pointerdown", () => {
          this.b14State.selectedItemId = this.b14State.selectedItemId === item.id ? null : item.id;
          container.setAlpha(this.b14State.selectedItemId === item.id ? 0.78 : 1);
          this.notify();
        });
        container.on("dragstart", () => { this.b14State.selectedItemId = item.id; });
        container.on("drag", (_pointer, dragX, dragY) => container.setPosition(dragX, dragY));
        container.on("dragend", () => {
          const nearest = this.b14Payload.targets
            .map((target) => ({ target, distance: Math.hypot(container.x - target.x * 360, container.y - target.y * 350) }))
            .sort((a, b) => a.distance - b.distance)[0];
          if (nearest?.distance <= 58) this.placeItem(item.id, nearest.target.id);
          else {
            sceneFeedback(this, FEEDBACK.unknown);
            this.redraw();
            this.notify();
          }
        });
        this.b14Objects.push(container);
      }

      redraw() {
        if (!this.b14Tree) return;
        this.clearObjects();
        this.drawTree();
        this.b14Artwork?.setAlpha(this.b14State.completed || this.b14State.solutionShown ? 0.17 : 0.075);
        const activeLayerId = activeB14Layer(this.b14State, this.b14Payload);
        const activeLayer = this.b14Payload.layers.find((layer) => layer.id === activeLayerId);
        this.b14LayerLabel.setText(activeLayer
          ? localized(`Growing now: ${activeLayer.label.en}`, `Crescendo agora: ${activeLayer.label.pt}`)[this.b14Language]
          : localized("Hierarchy complete", "Hierarquia completa")[this.b14Language]);

        this.b14Payload.targets.forEach((target) => this.addTarget(target));
        const positionsByItem = new Map();
        Object.entries(this.b14State.placements).forEach(([targetId, itemId]) => {
          const target = this.b14Payload.targets.find((candidate) => candidate.id === targetId);
          if (target) positionsByItem.set(itemId, { x: target.x * 360, y: target.y * 350 });
        });
        this.b14Payload.items.forEach((item) => {
          const position = positionsByItem.get(item.id);
          if (position) this.addItem(item, position.x, position.y, true);
        });
        if (activeLayerId) {
          const placed = new Set(Object.values(this.b14State.placements));
          const pending = this.b14State.itemOrder
            .map((id) => this.b14Payload.items.find((item) => item.id === id))
            .filter((item) => item?.layer === activeLayerId && !placed.has(item.id));
          const tray = trayPositions(activeLayerId, pending.length);
          pending.forEach((item, index) => this.addItem(item, tray[index].x, tray[index].y, false));
        }
      }
    }

    return new B14Scene();
  },

  serializeState(scene) {
    if (!scene?.b14State) return null;
    return clone({
      placements: scene.b14State.placements,
      selectedItemId: scene.b14State.selectedItemId,
      hintLevel: scene.b14State.hintLevel,
      completed: scene.b14State.completed,
      solutionShown: scene.b14State.solutionShown,
      itemOrder: scene.b14State.itemOrder,
      messageKey: scene.b14State.messageKey,
    });
  },

  restoreState(scene, savedState, instance) {
    const payload = scene?.b14Payload || normalizeB14Payload(instance?.payload);
    const seed = instance?.seed || "B14";
    scene.b14Payload = payload;
    scene.b14InitialState ||= createB14InitialState(payload, seed);
    scene.b14State = restoreB14State(savedState, payload, seed);
    scene.accessibleFeedback = scene.b14State.messageKey ? FEEDBACK[scene.b14State.messageKey] : null;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const payload = scene.b14Payload || normalizeB14Payload(instance.payload);
    const correct = isB14Complete(scene.b14State, payload);
    if (correct) {
      scene.b14State.completed = true;
      scene.accessibleFeedback = localized(
        "The whole tree is growing: roots, trunk, branches, and fruit belong together.",
        "A árvore inteira está crescendo: raízes, tronco, ramos e fruto estão unidos.",
      );
    } else if (instance.mode === "mission") {
      completeB14Solution(scene.b14State, payload);
      scene.accessibleFeedback = localized(
        "This attempt is complete. The full hierarchy is now shown.",
        "Esta tentativa terminou. Agora você vê a hierarquia completa.",
      );
    } else {
      const layerId = activeB14Layer(scene.b14State, payload);
      const layer = payload.layers.find((candidate) => candidate.id === layerId);
      scene.accessibleFeedback = localized(
        `The hierarchy is not complete. Finish ${layer?.label.en.toLowerCase() || "the tree"} before checking again.`,
        `A hierarquia ainda não está completa. Termine ${layer?.label.pt.toLowerCase() || "a árvore"} antes de verificar novamente.`,
      );
    }
    scene.redraw?.();
    scene.notify?.();
    return { correct, complete: correct, feedback: scene.accessibleFeedback };
  },

  getAccessibleActions(scene) {
    if (!scene?.b14State || scene.b14State.completed || scene.b14State.solutionShown) return [];
    const payload = scene.b14Payload;
    const layerId = activeB14Layer(scene.b14State, payload);
    if (!layerId) return [];
    const placed = new Set(Object.values(scene.b14State.placements));
    const openTargets = targetsForLayer(payload, layerId).filter((target) => !scene.b14State.placements[target.id]);
    const pending = scene.b14State.itemOrder
      .map((id) => payload.items.find((item) => item.id === id))
      .filter((item) => item?.layer === layerId && !placed.has(item.id));
    return pending.map((item, index) => ({
      id: `place-${item.id}`,
      label: localized(`Place ${item.label.en}`, `Colocar ${item.label.pt}`),
      disabled: !openTargets.length,
      run: () => scene.placeItem(item.id, openTargets[Math.min(index, openTargets.length - 1)]?.id),
    }));
  },

  showHint(scene, hintIndex) {
    const payload = scene.b14Payload;
    const normalizedIndex = hintIndex === 1 ? 1 : 0;
    const message = hintCopy(scene.b14State, payload, normalizedIndex);
    scene.b14State.hintLevel = Math.max(scene.b14State.hintLevel, normalizedIndex + 1);
    if (normalizedIndex === 1) {
      const layerId = activeB14Layer(scene.b14State, payload);
      const placed = new Set(Object.values(scene.b14State.placements));
      const itemId = scene.b14State.itemOrder.find((id) => {
        const item = payload.items.find((candidate) => candidate.id === id);
        return item?.layer === layerId && !placed.has(id);
      });
      const target = targetsForLayer(payload, layerId).find((candidate) => !scene.b14State.placements[candidate.id]);
      if (itemId && target) applyB14Move(scene.b14State, payload, itemId, target.id);
    }
    scene.accessibleFeedback = message;
    scene.redraw?.();
    scene.notify?.();
    return message;
  },

  destroy(scene) {
    if (scene?.b14Keydown) scene.game?.canvas?.removeEventListener("keydown", scene.b14Keydown);
    scene?.input?.removeAllListeners();
    scene?.b14Objects?.forEach((object) => object.destroy());
    if (scene) scene.b14Objects = [];
  },
});
