export const A4_ENGINE_ID = "A4";
export const A4_ENGINE_VERSION = "1.0.0";

const OBJECT_COPY = Object.freeze({
  ear: { en: "Listening ear", pt: "Ouvido que escuta" },
  book: { en: "Gospel", pt: "Evangelho" },
  gate: { en: "Open gate", pt: "Portão aberto" },
  compass: { en: "Compass", pt: "Bússola" },
  fruit: { en: "Fruit", pt: "Fruto" },
});

const ZONE_COPY = Object.freeze({
  story: { en: "A life shared", pt: "Uma vida partilhada" },
  light: { en: "Gospel light", pt: "Luz do Evangelho" },
  path: { en: "Freedom to respond", pt: "Liberdade para responder" },
  crossroads: { en: "A call to discern", pt: "Um chamado a discernir" },
  harvest: { en: "Fruits over time", pt: "Frutos ao longo do tempo" },
});

const PAYLOAD_FIELDS = ["objectIds", "zoneIds", "solution"];
const OBJECT_IDS = Object.freeze(Object.keys(OBJECT_COPY));
const ZONE_IDS = Object.freeze(Object.keys(ZONE_COPY));

function localized(en, pt) { return { en, pt }; }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

export function hashA4Seed(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededShuffle(values, seed) {
  const output = [...values];
  let state = hashA4Seed(seed) || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

export function createA4InitialState(instance) {
  const objectIds = instance?.payload?.objectIds || OBJECT_IDS;
  const zoneIds = instance?.payload?.zoneIds || ZONE_IDS;
  return {
    objectOrder: seededShuffle(objectIds, `${instance?.seed || "A4"}:objects`),
    zoneOrder: seededShuffle(zoneIds, `${instance?.seed || "A4"}:zones`),
    placements: Object.fromEntries(objectIds.map((id) => [id, null])),
    selectedId: null,
    hintLevel: 0,
    completed: false,
    locked: false,
    lastInvalid: null,
  };
}

function validStateOrder(values, allowed) {
  return Array.isArray(values) && values.length === allowed.length && new Set(values).size === allowed.length && values.every((id) => allowed.includes(id));
}

export function normalizeA4State(savedState, instance) {
  const initial = createA4InitialState(instance);
  if (!isRecord(savedState)) return initial;
  const objectIds = instance.payload.objectIds;
  const zoneIds = instance.payload.zoneIds;
  const placements = { ...initial.placements };
  if (isRecord(savedState.placements)) {
    for (const id of objectIds) {
      const zoneId = savedState.placements[id];
      if (zoneId === null || instance.payload.solution[id] === zoneId) placements[id] = zoneId;
    }
  }
  const usedZones = new Set();
  for (const id of objectIds) {
    const zoneId = placements[id];
    if (zoneId && usedZones.has(zoneId)) placements[id] = null;
    else if (zoneId) usedZones.add(zoneId);
  }
  const completed = objectIds.every((id) => placements[id] === instance.payload.solution[id]);
  return {
    objectOrder: validStateOrder(savedState.objectOrder, objectIds) ? [...savedState.objectOrder] : initial.objectOrder,
    zoneOrder: validStateOrder(savedState.zoneOrder, zoneIds) ? [...savedState.zoneOrder] : initial.zoneOrder,
    placements,
    selectedId: objectIds.includes(savedState.selectedId) && !completed ? savedState.selectedId : null,
    hintLevel: Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0)),
    completed,
    locked: Boolean(savedState.locked),
    lastInvalid: objectIds.includes(savedState.lastInvalid) ? savedState.lastInvalid : null,
  };
}

export function scoreA4State(state, instance) {
  const placed = instance.payload.objectIds.filter((id) => state?.placements?.[id] === instance.payload.solution[id]).length;
  return { placed, total: instance.payload.objectIds.length, complete: placed === instance.payload.objectIds.length };
}

function zoneCenters(order) {
  const positions = [
    { x: 62, y: 61 }, { x: 180, y: 61 }, { x: 298, y: 61 },
    { x: 120, y: 168 }, { x: 240, y: 168 },
  ];
  return Object.fromEntries(order.map((id, index) => [id, positions[index]]));
}

function dockCenters(order) {
  return Object.fromEntries(order.map((id, index) => [id, { x: 38 + index * 71, y: 298 }]));
}

function insideZone(point, center) {
  return Math.abs(point.x - center.x) <= 51 && Math.abs(point.y - center.y) <= 42;
}

export const a4Engine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!exactKeys(payload, PAYLOAD_FIELDS)) errors.push(`payload must contain exactly ${PAYLOAD_FIELDS.join(", ")}`);
    if (!validStateOrder(payload?.objectIds, OBJECT_IDS)) errors.push(`payload.objectIds must contain exactly ${OBJECT_IDS.join(", ")}`);
    if (!validStateOrder(payload?.zoneIds, ZONE_IDS)) errors.push(`payload.zoneIds must contain exactly ${ZONE_IDS.join(", ")}`);
    if (!exactKeys(payload?.solution, OBJECT_IDS)) errors.push("payload.solution must map every object and no others");
    else {
      const targets = Object.values(payload.solution);
      if (!validStateOrder(targets, ZONE_IDS)) errors.push("payload.solution must use each zone exactly once");
    }
    if (!isRecord(instance?.layoutOverrides) || Object.keys(instance.layoutOverrides).some((key) => !["objectScale"].includes(key))) {
      errors.push("layoutOverrides supports only objectScale");
    }
    if (instance?.layoutOverrides?.objectScale !== undefined && (!Number.isFinite(instance.layoutOverrides.objectScale) || instance.layoutOverrides.objectScale < 0.7 || instance.layoutOverrides.objectScale > 1.25)) {
      errors.push("layoutOverrides.objectScale must be between 0.7 and 1.25");
    }
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const initial = createA4InitialState(instance);
    const objectScale = instance.layoutOverrides.objectScale || 1;
    const locale = language === "pt" ? "pt" : "en";

    class LivingSymbolsScene extends Phaser.Scene {
      constructor() {
        super({ key: `a4-${instance.id}` });
        this.a4InitialState = initial;
        this.a4State = normalizeA4State(null, instance);
        this.accessibleFeedback = null;
        this.accessibleFeedbackTone = "";
        this.dragging = false;
      }

      preload() {
        instance.payload.objectIds.forEach((id, index) => this.load.image(`a4-object-${id}`, instance.assets.layers[index]));
      }

      create() {
        this.graphics = this.add.graphics();
        this.zoneObjects = new Map();
        this.symbols = new Map();
        this.labels = [];
        this.zoneCenters = zoneCenters(this.a4State.zoneOrder);
        this.dockCenters = dockCenters(this.a4State.objectOrder);

        for (const zoneId of this.a4State.zoneOrder) {
          const center = this.zoneCenters[zoneId];
          const zone = this.add.zone(center.x, center.y, 104, 84).setInteractive({ cursor: "pointer" });
          zone.on("pointerdown", () => this.placeSelected(zoneId));
          this.zoneObjects.set(zoneId, zone);
          const label = this.add.text(center.x, center.y + 34, ZONE_COPY[zoneId][locale], {
            fontFamily: '"Fira Sans", sans-serif', fontSize: "11px", color: "#22201d", align: "center", wordWrap: { width: 96 },
          }).setOrigin(0.5, 0);
          this.labels.push(label);
        }

        instance.payload.objectIds.forEach((id) => {
          const sprite = this.add.image(0, 0, `a4-object-${id}`).setDisplaySize(54 * objectScale, 54 * objectScale).setInteractive({ cursor: "grab", draggable: true });
          this.input.setDraggable(sprite);
          sprite.setData("objectId", id);
          sprite.on("pointerdown", () => {
            if (this.a4State.locked || this.dragging) return;
            this.selectObject(this.a4State.selectedId === id ? null : id);
          });
          sprite.on("dragstart", () => { if (!this.a4State.locked) this.dragging = true; });
          sprite.on("drag", (_pointer, x, y) => {
            if (this.a4State.locked) return;
            sprite.setPosition(Math.max(28, Math.min(332, x)), Math.max(28, Math.min(322, y)));
          });
          sprite.on("dragend", () => {
            if (this.a4State.locked) return;
            const point = { x: sprite.x, y: sprite.y };
            const zoneId = this.a4State.zoneOrder.find((candidate) => insideZone(point, this.zoneCenters[candidate]));
            if (zoneId) this.placeObject(id, zoneId);
            else if (point.y > 245) this.returnToDock(id);
            else this.rejectMove(id);
            this.dragging = false;
          });
          this.symbols.set(id, sprite);
        });

        this.input.keyboard?.on("keydown-LEFT", (event) => { event.preventDefault(); this.cycleObject(-1); });
        this.input.keyboard?.on("keydown-RIGHT", (event) => { event.preventDefault(); this.cycleObject(1); });
        this.input.keyboard?.on("keydown-ENTER", (event) => { event.preventDefault(); this.placeSelected(this.expectedZoneForSelected()); });
        this.input.keyboard?.on("keydown-SPACE", (event) => { event.preventDefault(); this.placeSelected(this.expectedZoneForSelected()); });
        this.redraw();
        onReady(this);
      }

      expectedZoneForSelected() { return this.a4State.selectedId ? instance.payload.solution[this.a4State.selectedId] : null; }

      cycleObject(direction) {
        if (this.a4State.locked) return;
        const available = this.a4State.objectOrder.filter((id) => !this.a4State.placements[id]);
        if (!available.length) return;
        const current = available.indexOf(this.a4State.selectedId);
        const next = current < 0 ? 0 : (current + direction + available.length) % available.length;
        this.selectObject(available[next]);
      }

      selectObject(id) {
        if (this.a4State.locked) return;
        this.a4State.selectedId = id;
        this.a4State.lastInvalid = null;
        this.accessibleFeedback = id ? localized(`${OBJECT_COPY[id].en} selected. Choose a scene.`, `${OBJECT_COPY[id].pt} selecionado. Escolha uma cena.`) : null;
        this.accessibleFeedbackTone = "";
        this.redraw();
        this.notify();
      }

      placeSelected(zoneId) {
        if (!this.a4State.selectedId || !zoneId || this.a4State.locked) return;
        this.placeObject(this.a4State.selectedId, zoneId);
      }

      placeObject(id, zoneId) {
        if (this.a4State.locked || !instance.payload.objectIds.includes(id) || !instance.payload.zoneIds.includes(zoneId)) return false;
        if (instance.payload.solution[id] !== zoneId) {
          this.rejectMove(id, zoneId);
          return false;
        }
        this.a4State.placements[id] = zoneId;
        this.a4State.selectedId = null;
        this.a4State.lastInvalid = null;
        this.a4State.completed = scoreA4State(this.a4State, instance).complete;
        this.accessibleFeedback = localized(`${OBJECT_COPY[id].en} now belongs in ${ZONE_COPY[zoneId].en}.`, `${OBJECT_COPY[id].pt} agora pertence a ${ZONE_COPY[zoneId].pt}.`);
        this.accessibleFeedbackTone = "";
        this.redraw();
        this.notify();
        return true;
      }

      rejectMove(id) {
        this.a4State.lastInvalid = id;
        this.accessibleFeedback = localized("That symbol cannot live there. It returned safely.", "Esse símbolo não pode viver aí. Ele voltou com segurança.");
        this.accessibleFeedbackTone = "wrong";
        this.redraw();
        if (!reducedMotion) this.tweens.add({ targets: this.symbols.get(id), angle: { from: -4, to: 4 }, yoyo: true, duration: 90, repeat: 1, onComplete: () => { this.symbols.get(id)?.setAngle(0); this.redraw(); } });
        this.notify();
      }

      returnToDock(id) {
        if (this.a4State.locked) return;
        this.a4State.placements[id] = null;
        this.a4State.completed = false;
        this.a4State.selectedId = id;
        this.a4State.lastInvalid = null;
        this.accessibleFeedback = localized(`${OBJECT_COPY[id].en} returned to the tray.`, `${OBJECT_COPY[id].pt} voltou para a bandeja.`);
        this.accessibleFeedbackTone = "";
        this.redraw();
        this.notify();
      }

      setLocked(locked) {
        this.a4State.locked = Boolean(locked);
        for (const sprite of this.symbols?.values?.() || []) sprite.disableInteractive();
        if (!locked) for (const sprite of this.symbols?.values?.() || []) sprite.setInteractive({ cursor: "grab", draggable: true });
        this.redraw();
      }

      revealSolution() {
        for (const id of instance.payload.objectIds) this.a4State.placements[id] = instance.payload.solution[id];
        this.a4State.completed = true;
        this.a4State.selectedId = null;
        this.redraw();
      }

      notify() { onStateChange(this); }

      redraw() {
        if (!this.graphics || !this.symbols.size) return;
        const state = this.a4State;
        this.graphics.clear();
        this.graphics.lineStyle(1, 0xd9d2bf, 1);
        this.graphics.lineBetween(18, 245, 342, 245);
        for (const zoneId of state.zoneOrder) {
          const center = this.zoneCenters[zoneId];
          const occupied = Object.values(state.placements).includes(zoneId);
          this.graphics.fillStyle(occupied ? 0xfcebf1 : 0xffffff, occupied ? 0.7 : 1);
          this.graphics.fillRoundedRect(center.x - 51, center.y - 40, 102, 78, 6);
          this.graphics.lineStyle(occupied ? 2 : 1, occupied ? 0xd60056 : 0x918b80, 1);
          this.graphics.strokeRoundedRect(center.x - 51, center.y - 40, 102, 78, 6);
          if (state.hintLevel > 0 && state.selectedId && instance.payload.solution[state.selectedId] === zoneId) {
            this.graphics.lineStyle(3, 0xd60056, 0.8);
            this.graphics.strokeRoundedRect(center.x - 47, center.y - 36, 94, 70, 4);
          }
        }

        for (const id of state.objectOrder) {
          const sprite = this.symbols.get(id);
          const zoneId = state.placements[id];
          const center = zoneId ? this.zoneCenters[zoneId] : this.dockCenters[id];
          sprite.setPosition(center.x, center.y - (zoneId ? 5 : 0));
          sprite.setScale((zoneId ? 0.34 : 0.32) * objectScale);
          sprite.setAlpha(state.locked && !zoneId ? 0.45 : 1);
          sprite.setAngle(zoneId === "path" ? -12 : zoneId === "crossroads" ? 8 : 0);
          if (state.selectedId === id) {
            this.graphics.lineStyle(3, 0xd60056, 1);
            this.graphics.strokeCircle(center.x, center.y, 31);
          }
          if (state.lastInvalid === id) {
            this.graphics.lineStyle(3, 0xb3261e, 1);
            this.graphics.lineBetween(center.x - 12, center.y - 12, center.x + 12, center.y + 12);
            this.graphics.lineBetween(center.x + 12, center.y - 12, center.x - 12, center.y + 12);
          }
          if (zoneId) {
            this.graphics.lineStyle(2, 0xd60056, 0.75);
            if (id === "ear") { this.graphics.strokeCircle(center.x + 21, center.y - 5, 8); this.graphics.strokeCircle(center.x + 21, center.y - 5, 14); }
            if (id === "book") { this.graphics.lineBetween(center.x - 24, center.y - 26, center.x - 31, center.y - 34); this.graphics.lineBetween(center.x + 24, center.y - 26, center.x + 31, center.y - 34); }
            if (id === "gate") { this.graphics.lineBetween(center.x + 20, center.y + 17, center.x + 36, center.y + 8); }
            if (id === "compass") { this.graphics.lineBetween(center.x, center.y + 24, center.x + 20, center.y + 31); }
            if (id === "fruit") { this.graphics.strokeCircle(center.x, center.y, 30); }
          }
        }

        if (state.completed) {
          this.graphics.lineStyle(2, 0xd60056, 0.65);
          this.graphics.lineBetween(62, 103, 120, 126);
          this.graphics.lineBetween(180, 103, 120, 126);
          this.graphics.lineBetween(298, 103, 240, 126);
          this.graphics.lineBetween(120, 210, 240, 210);
        }
      }
    }

    return new LivingSymbolsScene();
  },

  serializeState(scene) {
    const state = scene?.a4State;
    if (!state) return null;
    return JSON.parse(JSON.stringify({
      objectOrder: state.objectOrder,
      zoneOrder: state.zoneOrder,
      placements: state.placements,
      selectedId: state.selectedId,
      hintLevel: state.hintLevel,
      completed: state.completed,
      locked: state.locked,
      lastInvalid: state.lastInvalid,
    }));
  },

  restoreState(scene, savedState, instance) {
    scene.a4State = normalizeA4State(savedState, instance);
    scene.accessibleFeedback = null;
    scene.accessibleFeedbackTone = "";
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const score = scoreA4State(scene?.a4State, instance);
    if (score.complete) return {
      correct: true,
      complete: true,
      feedback: localized("The five signs now serve one living path of accompaniment.", "Os cinco sinais agora servem a um caminho vivo de acompanhamento."),
    };
    return {
      correct: false,
      complete: false,
      feedback: localized(`${score.total - score.placed} symbol${score.total - score.placed === 1 ? "" : "s"} still need a meaningful place.`, `${score.total - score.placed} símbolo${score.total - score.placed === 1 ? " ainda precisa" : "s ainda precisam"} de um lugar significativo.`),
    };
  },

  getAccessibleActions(scene, instance) {
    if (!scene || scene.a4State.locked) return [];
    const selected = scene.a4State.selectedId;
    if (!selected) return scene.a4State.objectOrder.map((id) => ({
      id: `select-${id}`,
      label: localized(`Select ${OBJECT_COPY[id].en}`, `Selecionar ${OBJECT_COPY[id].pt}`),
      disabled: Boolean(scene.a4State.placements[id]),
      run: () => scene.selectObject(id),
    }));
    return [
      ...scene.a4State.zoneOrder.map((zoneId) => ({
        id: `place-${selected}-${zoneId}`,
        label: localized(`Place in ${ZONE_COPY[zoneId].en}`, `Colocar em ${ZONE_COPY[zoneId].pt}`),
        run: () => scene.placeObject(selected, zoneId),
      })),
      { id: `cancel-${selected}`, label: localized("Cancel selection", "Cancelar seleção"), run: () => scene.selectObject(null) },
    ];
  },

  showHint(scene, hintIndex, instance) {
    scene.a4State.hintLevel = Math.max(scene.a4State.hintLevel, hintIndex + 1);
    scene.accessibleFeedbackTone = "";
    const remaining = scene.a4State.objectOrder.filter((id) => !scene.a4State.placements[id]);
    if (!scene.a4State.selectedId && remaining.length) scene.a4State.selectedId = remaining[0];
    if (hintIndex === 1 && scene.a4State.selectedId) {
      const id = scene.a4State.selectedId;
      const zoneId = instance.payload.solution[id];
      scene.accessibleFeedback = localized(`${OBJECT_COPY[id].en} belongs with “${ZONE_COPY[zoneId].en}.”`, `${OBJECT_COPY[id].pt} pertence a “${ZONE_COPY[zoneId].pt}”.`);
    }
    scene.redraw();
    scene.notify();
    if (!remaining.length) return localized("All five symbols are already alive in the scene. Use Check.", "Os cinco símbolos já estão vivos na cena. Use Verificar.");
    if (hintIndex === 0) return localized("Notice what each scene needs: attention, light, freedom, direction, or a fruit that can be tested.", "Observe o que cada cena precisa: atenção, luz, liberdade, direção ou um fruto que possa ser reconhecido.");
    const id = scene.a4State.selectedId;
    const zoneId = instance.payload.solution[id];
    return localized(`${OBJECT_COPY[id].en} belongs with “${ZONE_COPY[zoneId].en}.”`, `${OBJECT_COPY[id].pt} pertence a “${ZONE_COPY[zoneId].pt}”.`);
  },

  destroy(scene) {
    scene?.tweens?.killAll();
    scene?.input?.keyboard?.removeAllListeners();
    scene?.input?.removeAllListeners();
    scene?.zoneObjects?.forEach((zone) => zone.removeAllListeners());
    scene?.symbols?.forEach((symbol) => symbol.removeAllListeners());
  },
});
