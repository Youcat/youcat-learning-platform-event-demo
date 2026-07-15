export const C29_ENGINE_ID = "C29";
export const C29_ENGINE_VERSION = "1.0.0";

const localized = (en, pt) => ({ en, pt });
const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
const validLocalized = (value) => exactKeys(value, ["en", "pt"]) && ["en", "pt"].every((locale) => typeof value[locale] === "string" && value[locale].trim());

const FALLBACK_PAYLOAD = Object.freeze({
  fogPatchCount: 3,
  distortions: [
    { id: "idealisation", label: localized("Idealisation hides the real person.", "A idealização esconde a pessoa real."), clarificationId: "reality" },
    { id: "fading-feeling", label: localized("Changing feelings are mistaken for the end of love.", "A mudança dos sentimentos é confundida com o fim do amor."), clarificationId: "maturing-love" },
  ],
  clarifications: [
    { id: "reality", label: localized("Reality: see the person truthfully.", "Realidade: ver a pessoa com verdade.") },
    { id: "maturing-love", label: localized("Maturing love: choose truthful care.", "Amor maduro: escolher um cuidado verdadeiro.") },
  ],
});

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "C29-fallback")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFrom(seed) {
  let value = hashSeed(seed) || 0x9e3779b9;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
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

function validPayload(payload) {
  if (!exactKeys(payload, ["fogPatchCount", "distortions", "clarifications"])) return false;
  if (!Number.isInteger(payload.fogPatchCount) || payload.fogPatchCount < 2 || payload.fogPatchCount > 5) return false;
  if (!Array.isArray(payload.distortions) || payload.distortions.length !== 2) return false;
  if (!Array.isArray(payload.clarifications) || payload.clarifications.length !== 2) return false;
  const clarificationIds = new Set();
  for (const item of payload.clarifications) {
    if (!exactKeys(item, ["id", "label"]) || typeof item.id !== "string" || !item.id || !validLocalized(item.label) || clarificationIds.has(item.id)) return false;
    clarificationIds.add(item.id);
  }
  const distortionIds = new Set();
  for (const item of payload.distortions) {
    if (!exactKeys(item, ["id", "label", "clarificationId"]) || typeof item.id !== "string" || !item.id || !validLocalized(item.label) || distortionIds.has(item.id)) return false;
    if (!clarificationIds.has(item.clarificationId)) return false;
    distortionIds.add(item.id);
  }
  return distortionIds.size === 2 && clarificationIds.size === 2;
}

function payloadOrFallback(payload) {
  return clone(validPayload(payload) ? payload : FALLBACK_PAYLOAD);
}

export function createC29Model(payload, seed = "C29-fallback") {
  const safe = payloadOrFallback(payload);
  const random = randomFrom(seed);
  const mirrorOrder = shuffled(safe.distortions.map((item) => item.id), random);
  const clarificationOrder = shuffled(safe.clarifications.map((item) => item.id), random);
  const fog = Object.fromEntries(safe.distortions.map((item, distortionIndex) => [
    item.id,
    Array.from({ length: safe.fogPatchCount }, (_, patchIndex) => ({
      x: 0.2 + random() * 0.6,
      y: 0.2 + random() * 0.58,
      radius: 0.13 + ((distortionIndex + patchIndex) % 2) * 0.025,
    })),
  ]));
  return {
    payload: safe,
    mirrorOrder,
    clarificationOrder,
    fog,
    usedFallback: !validPayload(payload),
  };
}

export function isC29Solvable(model) {
  if (!model?.payload || model.mirrorOrder?.length !== 2 || model.clarificationOrder?.length !== 2) return false;
  const clarifications = new Set(model.payload.clarifications.map((item) => item.id));
  return model.payload.distortions.every((item) => model.mirrorOrder.includes(item.id) && clarifications.has(item.clarificationId))
    && model.clarificationOrder.every((id) => clarifications.has(id));
}

export function createInitialC29State(model) {
  return {
    fogCleared: Object.fromEntries(model.mirrorOrder.map((id) => [id, 0])),
    placements: Object.fromEntries(model.mirrorOrder.map((id) => [id, null])),
    selected: null,
    hintLevel: 0,
    hintTarget: null,
    rejectedMoves: 0,
    lastEvent: "ready",
    completed: false,
  };
}

function validSelected(selected, model) {
  if (selected === null) return null;
  if (!exactKeys(selected, ["type", "id"])) return null;
  if (selected.type === "cloth" && selected.id === "cloth") return selected;
  if (selected.type === "clarification" && model.clarificationOrder.includes(selected.id)) return selected;
  return null;
}

export function restoreC29State(savedState, model) {
  const initial = createInitialC29State(model);
  if (!isRecord(savedState)) return initial;
  for (const id of model.mirrorOrder) {
    const count = Number(savedState.fogCleared?.[id]);
    initial.fogCleared[id] = Number.isFinite(count) ? Math.max(0, Math.min(model.payload.fogPatchCount, Math.floor(count))) : 0;
    const placed = savedState.placements?.[id];
    const expected = model.payload.distortions.find((item) => item.id === id)?.clarificationId;
    initial.placements[id] = placed === expected ? placed : null;
  }
  initial.selected = validSelected(savedState.selected, model);
  initial.hintLevel = Math.max(0, Math.min(2, Math.floor(Number(savedState.hintLevel) || 0)));
  initial.hintTarget = model.mirrorOrder.includes(savedState.hintTarget) ? savedState.hintTarget : null;
  initial.rejectedMoves = Math.max(0, Math.floor(Number(savedState.rejectedMoves) || 0));
  initial.lastEvent = typeof savedState.lastEvent === "string" ? savedState.lastEvent.slice(0, 64) : "ready";
  initial.completed = Boolean(savedState.completed) && isC29Complete(initial, model);
  return initial;
}

export function isC29Complete(state, model) {
  return model.payload.distortions.every((item) => state.fogCleared[item.id] === model.payload.fogPatchCount && state.placements[item.id] === item.clarificationId);
}

function distortionFor(model, id) {
  return model.payload.distortions.find((item) => item.id === id);
}

export function applyC29Action(state, model, action) {
  const next = restoreC29State(state, model);
  if (!isRecord(action)) return { state: next, accepted: false, reason: "malformed" };
  if (next.completed) return { state: next, accepted: false, reason: "completed" };

  if (action.type === "select-cloth") {
    next.selected = next.selected?.type === "cloth" ? null : { type: "cloth", id: "cloth" };
    next.lastEvent = next.selected ? "cloth-selected" : "selection-cleared";
    return { state: next, accepted: true, reason: next.lastEvent };
  }
  if (action.type === "select-clarification" && model.clarificationOrder.includes(action.id)) {
    next.selected = next.selected?.type === "clarification" && next.selected.id === action.id ? null : { type: "clarification", id: action.id };
    next.lastEvent = next.selected ? "clarification-selected" : "selection-cleared";
    return { state: next, accepted: true, reason: next.lastEvent };
  }
  if (action.type === "clear-fog" && model.mirrorOrder.includes(action.distortionId)) {
    const current = next.fogCleared[action.distortionId];
    if (current >= model.payload.fogPatchCount) return { state: next, accepted: false, reason: "already-clear" };
    next.fogCleared[action.distortionId] = current + 1;
    next.selected = action.keepSelected ? { type: "cloth", id: "cloth" } : null;
    next.hintTarget = null;
    next.lastEvent = "fog-cleared";
    return { state: next, accepted: true, reason: "fog-cleared" };
  }
  if (action.type === "place" && model.mirrorOrder.includes(action.distortionId) && model.clarificationOrder.includes(action.clarificationId)) {
    if (next.fogCleared[action.distortionId] < model.payload.fogPatchCount) {
      next.rejectedMoves += 1;
      next.lastEvent = "fog-blocks-repair";
      return { state: next, accepted: false, reason: next.lastEvent };
    }
    const expected = distortionFor(model, action.distortionId)?.clarificationId;
    if (action.clarificationId !== expected) {
      next.rejectedMoves += 1;
      next.selected = { type: "clarification", id: action.clarificationId };
      next.lastEvent = "wrong-mirror";
      return { state: next, accepted: false, reason: next.lastEvent };
    }
    for (const id of model.mirrorOrder) if (next.placements[id] === action.clarificationId) next.placements[id] = null;
    next.placements[action.distortionId] = action.clarificationId;
    next.selected = null;
    next.lastEvent = "repair-placed";
    next.completed = isC29Complete(next, model);
    return { state: next, accepted: true, reason: "repair-placed" };
  }
  return { state: next, accepted: false, reason: "impossible" };
}

export function evaluateC29State(state, model) {
  const complete = isC29Complete(state, model);
  if (complete) return { correct: true, complete: true, feedback: localized("Both distortions are exposed and repaired. Truth makes love more human, not less.", "As duas distorções foram expostas e corrigidas. A verdade torna o amor mais humano, não menos.") };
  const fogLeft = model.mirrorOrder.reduce((sum, id) => sum + model.payload.fogPatchCount - state.fogCleared[id], 0);
  if (fogLeft > 0) return { correct: false, complete: false, feedback: localized(`Clear ${fogLeft} remaining fog ${fogLeft === 1 ? "patch" : "patches"} before checking.`, `Limpe ${fogLeft} ${fogLeft === 1 ? "mancha" : "manchas"} de névoa antes de verificar.`) };
  const repaired = model.mirrorOrder.filter((id) => state.placements[id]).length;
  if (repaired === 0) return { correct: false, complete: false, feedback: localized("The distortions are visible. Now repair both with truthful clarifications.", "As distorções estão visíveis. Agora corrija as duas com esclarecimentos verdadeiros.") };
  const repairedId = model.mirrorOrder.find((id) => state.placements[id]);
  return repairedId === "idealisation"
    ? { correct: false, complete: false, feedback: localized("Reality is repaired. Now clarify what changing feelings can become.", "A realidade foi corrigida. Agora esclareça em que a mudança dos sentimentos pode se transformar.") }
    : { correct: false, complete: false, feedback: localized("Maturing love is repaired. Now bring idealisation back to reality.", "O amor maduro foi corrigido. Agora traga a idealização de volta à realidade.") };
}

function tr(value, language) {
  return value?.[language] ?? value?.en ?? value?.pt ?? "";
}

function canvasCopy(language, key) {
  const copy = {
    wipe: localized("WIPE", "LIMPAR"),
    fog: localized("fog", "névoa"),
    repairs: localized("repairs", "correções"),
    wrong: localized("That truth belongs in the other mirror.", "Essa verdade pertence ao outro espelho."),
    blocked: localized("Clear this mirror before repairing it.", "Limpe este espelho antes de corrigi-lo."),
    done: localized("Mirror repaired", "Espelho corrigido"),
  };
  return tr(copy[key], language);
}

function panelRect(index) {
  return { x: index === 0 ? 9 : 185, y: 10, width: 166, height: 194 };
}

function pointInside(pointer, rect) {
  return pointer.x >= rect.x && pointer.x <= rect.x + rect.width && pointer.y >= rect.y && pointer.y <= rect.y + rect.height;
}

function makeSceneState(scene, next, notify = true) {
  scene.c29State = next;
  scene.redraw?.();
  if (notify) scene.notify?.();
}

export const c29Engine = Object.freeze({
  validate(payload, instance) {
    const errors = [];
    if (!validPayload(payload)) errors.push("payload must contain exactly two valid distortions, two matching clarifications, and fogPatchCount 2–5");
    const overrides = instance?.layoutOverrides;
    if (!exactKeys(overrides, ["mirrorInset"]) || !Number.isFinite(overrides.mirrorInset) || overrides.mirrorInset < 8 || overrides.mirrorInset > 24) errors.push("layoutOverrides must contain only mirrorInset from 8 to 24");
    if (!Array.isArray(instance?.assets?.layers) || instance.assets.layers.length !== 2) errors.push("assets.layers must contain exactly two optimized illustrations");
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const model = createC29Model(instance.payload, instance.seed);
    const initial = createInitialC29State(model);

    class MirrorOfTruthScene extends Phaser.Scene {
      constructor() {
        super({ key: `c29-${instance.id}` });
        this.c29Model = model;
        this.c29InitialState = initial;
        this.c29State = clone(initial);
        this.dragVisuals = {};
      }

      preload() {
        instance.assets.layers.forEach((asset, index) => this.load.image(`c29-layer-${index}`, asset));
      }

      create() {
        this.graphics = this.add.graphics();
        this.images = model.mirrorOrder.map((_, index) => this.add.image(0, 0, `c29-layer-${index}`).setAlpha(0.24));
        this.texts = [];
        this.mirrorZones = model.mirrorOrder.map((id, index) => {
          const rect = panelRect(index);
          const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height).setInteractive({ cursor: "pointer" });
          zone.on("pointerdown", () => this.activateMirror(id));
          return zone;
        });
        this.clothZone = this.add.zone(180, 220, 52, 44).setInteractive({ cursor: "grab" });
        this.input.setDraggable(this.clothZone);
        this.clothZone.on("pointerdown", () => {
          makeSceneState(this, applyC29Action(this.c29State, model, { type: "select-cloth" }).state);
        });
        this.clothZone.on("dragstart", () => {
          if (this.c29State.selected?.type !== "cloth") {
            const result = applyC29Action(this.c29State, model, { type: "select-cloth" });
            makeSceneState(this, result.state);
          }
        });
        this.clothZone.on("drag", (_pointer, x, y) => {
          this.dragVisuals.cloth = { x, y };
          this.clearFogAt(x, y, true);
          this.redraw();
        });
        this.clothZone.on("dragend", () => {
          this.dragVisuals.cloth = null;
          this.redraw();
        });
        this.clarificationZones = model.clarificationOrder.map((id, index) => {
          const y = 262 + index * 43;
          const zone = this.add.zone(180, y, 326, 38).setInteractive({ cursor: "grab" });
          this.input.setDraggable(zone);
          zone.on("pointerdown", () => {
            makeSceneState(this, applyC29Action(this.c29State, model, { type: "select-clarification", id }).state);
          });
          zone.on("dragstart", () => {
            if (this.c29State.selected?.type !== "clarification" || this.c29State.selected.id !== id) {
              const result = applyC29Action(this.c29State, model, { type: "select-clarification", id });
              makeSceneState(this, result.state);
            }
          });
          zone.on("drag", (_pointer, x, dragY) => {
            this.dragVisuals[id] = { x, y: dragY };
            this.redraw();
          });
          zone.on("dragend", (pointer) => {
            this.dragVisuals[id] = null;
            const targetIndex = model.mirrorOrder.findIndex((_, mirrorIndex) => pointInside(pointer, panelRect(mirrorIndex)));
            if (targetIndex >= 0) this.placeClarification(id, model.mirrorOrder[targetIndex]);
            else this.redraw();
          });
          return zone;
        });
        this.redraw();
        onReady(this);
      }

      notify() {
        onStateChange(this);
      }

      activateMirror(distortionId) {
        const selected = this.c29State.selected;
        if (selected?.type === "clarification") this.placeClarification(selected.id, distortionId);
        else {
          const result = applyC29Action(this.c29State, model, { type: "clear-fog", distortionId, keepSelected: true });
          if (selected?.type === "cloth" && result.accepted) makeSceneState(this, result.state);
        }
      }

      clearFogAt(x, y, keepSelected) {
        for (let index = 0; index < model.mirrorOrder.length; index += 1) {
          const id = model.mirrorOrder[index];
          const rect = panelRect(index);
          const patchIndex = this.c29State.fogCleared[id];
          const patch = model.fog[id][patchIndex];
          if (!patch) continue;
          const patchX = rect.x + patch.x * rect.width;
          const patchY = rect.y + patch.y * 150;
          if (Math.hypot(x - patchX, y - patchY) <= 42) {
            const result = applyC29Action(this.c29State, model, { type: "clear-fog", distortionId: id, keepSelected });
            if (result.accepted) makeSceneState(this, result.state);
            return;
          }
        }
      }

      placeClarification(clarificationId, distortionId) {
        const result = applyC29Action(this.c29State, model, { type: "place", clarificationId, distortionId });
        makeSceneState(this, result.state);
      }

      clearNext(distortionId) {
        const result = applyC29Action(this.c29State, model, { type: "clear-fog", distortionId });
        if (result.accepted) makeSceneState(this, result.state);
      }

      chooseClarification(id) {
        makeSceneState(this, applyC29Action(this.c29State, model, { type: "select-clarification", id }).state);
      }

      redraw() {
        if (!this.graphics) return;
        this.texts.forEach((text) => text.destroy());
        this.texts = [];
        const addText = (x, y, text, style = {}) => {
          const item = this.add.text(x, y, text, { fontFamily: "Fira Sans", color: "#22201d", ...style });
          this.texts.push(item);
          return item;
        };
        this.graphics.clear();
        model.mirrorOrder.forEach((id, index) => {
          const rect = panelRect(index);
          const distortion = distortionFor(model, id);
          const clearCount = this.c29State.fogCleared[id];
          const isClear = clearCount === model.payload.fogPatchCount;
          const repaired = this.c29State.placements[id];
          this.graphics.fillStyle(0xffffff, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
          this.graphics.lineStyle(this.c29State.hintTarget === id ? 3 : 2, this.c29State.hintTarget === id ? 0xd60056 : 0x22201d, 1).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 5);
          const image = this.images[index];
          image.setPosition(rect.x + rect.width / 2, rect.y + 63).setDisplaySize(142, 116).setVisible(true).setAlpha(repaired ? 0.48 : 0.22);
          const label = addText(rect.x + 10, rect.y + 116, tr(distortion.label, language), { fontSize: "12px", lineSpacing: 2, wordWrap: { width: rect.width - 20 }, align: "center" });
          label.setOrigin(0, 0);
          if (repaired) {
            this.graphics.fillStyle(0xf7e4eb, 0.96).fillRoundedRect(rect.x + 8, rect.y + 113, rect.width - 16, 70, 5);
            const clarification = model.payload.clarifications.find((item) => item.id === repaired);
            label.setText(tr(clarification.label, language)).setStyle({ fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "bold", color: "#22201d", wordWrap: { width: rect.width - 24 }, align: "center" }).setPosition(rect.x + 12, rect.y + 120);
          }
          for (let patchIndex = clearCount; patchIndex < model.payload.fogPatchCount; patchIndex += 1) {
            const patch = model.fog[id][patchIndex];
            const x = rect.x + patch.x * rect.width;
            const y = rect.y + patch.y * 150;
            this.graphics.fillStyle(0xe8e3dc, 0.94).fillCircle(x, y, patch.radius * rect.width);
            this.graphics.fillStyle(0xf5f1eb, 0.92).fillCircle(x + 13, y + 5, patch.radius * rect.width * 0.72);
          }
          if (!isClear) addText(rect.x + rect.width / 2, rect.y + 86, `${model.payload.fogPatchCount - clearCount} ${canvasCopy(language, "fog")}`, { fontSize: "11px", fontStyle: "bold", color: "#6f6a61" }).setOrigin(0.5);
          if (repaired) addText(rect.x + rect.width / 2, rect.y + 187, `✓ ${canvasCopy(language, "done")}`, { fontSize: "10px", fontStyle: "bold", color: "#d60056" }).setOrigin(0.5, 1);
        });

        const cloth = this.dragVisuals.cloth || { x: 180, y: 221 };
        this.graphics.fillStyle(0xd60056, this.c29State.selected?.type === "cloth" ? 1 : 0.82).fillPoints([{ x: cloth.x - 22, y: cloth.y + 5 }, { x: cloth.x - 15, y: cloth.y - 13 }, { x: cloth.x + 21, y: cloth.y - 8 }, { x: cloth.x + 15, y: cloth.y + 14 }], true);
        addText(cloth.x, cloth.y, canvasCopy(language, "wipe"), { fontSize: "9px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
        this.clothZone?.setPosition(cloth.x, cloth.y);

        model.clarificationOrder.forEach((id, index) => {
          const clarification = model.payload.clarifications.find((item) => item.id === id);
          const placed = Object.values(this.c29State.placements).includes(id);
          const position = this.dragVisuals[id] || { x: 180, y: 262 + index * 43 };
          this.graphics.fillStyle(placed ? 0xf7e4eb : 0xffffff, 1).fillRoundedRect(position.x - 163, position.y - 18, 326, 36, 5);
          this.graphics.lineStyle(this.c29State.selected?.id === id ? 3 : 1.5, this.c29State.selected?.id === id ? 0xd60056 : 0x22201d, 1).strokeRoundedRect(position.x - 163, position.y - 18, 326, 36, 5);
          addText(position.x, position.y, tr(clarification.label, language), { fontSize: language === "pt" ? "10px" : "11px", fontStyle: "bold", wordWrap: { width: 304 }, align: "center", color: placed ? "#6f6a61" : "#22201d" }).setOrigin(0.5);
          this.clarificationZones?.[index]?.setPosition(position.x, position.y);
        });

        const fogCleared = Object.values(this.c29State.fogCleared).reduce((sum, count) => sum + count, 0);
        const repairs = Object.values(this.c29State.placements).filter(Boolean).length;
        let status = `${fogCleared}/${model.payload.fogPatchCount * 2} ${canvasCopy(language, "fog")} · ${repairs}/2 ${canvasCopy(language, "repairs")}`;
        if (this.c29State.lastEvent === "wrong-mirror") status = canvasCopy(language, "wrong");
        if (this.c29State.lastEvent === "fog-blocks-repair") status = canvasCopy(language, "blocked");
        addText(180, 340, status, { fontSize: "11px", fontStyle: "bold", color: this.c29State.lastEvent.startsWith("wrong") || this.c29State.lastEvent.startsWith("fog-blocks") ? "#b3261e" : "#6f6a61" }).setOrigin(0.5, 1);
      }
    }

    return new MirrorOfTruthScene();
  },

  serializeState(scene) {
    return clone(scene?.c29State || null);
  },

  restoreState(scene, savedState) {
    if (!scene?.c29Model) return;
    scene.c29State = restoreC29State(savedState, scene.c29Model);
    scene.dragVisuals = {};
    scene.redraw?.();
  },

  evaluate(scene) {
    const evaluation = evaluateC29State(scene.c29State, scene.c29Model);
    scene.c29State.completed = evaluation.correct && evaluation.complete;
    scene.c29State.lastEvent = scene.c29State.completed ? "completed" : "checked-incomplete";
    scene.redraw?.();
    scene.notify?.();
    return evaluation;
  },

  getAccessibleActions(scene) {
    if (!scene?.c29Model) return [];
    const model = scene.c29Model;
    const state = scene.c29State;
    const actions = [];
    for (const id of model.mirrorOrder) {
      const distortion = distortionFor(model, id);
      if (state.fogCleared[id] < model.payload.fogPatchCount) {
        const clearLabel = id === "idealisation"
          ? localized("Clear idealisation fog", "Limpar névoa da idealização")
          : localized("Clear changing feelings fog", "Limpar névoa dos sentimentos que mudam");
        actions.push({ id: `clear-${id}`, label: clearLabel, run: () => scene.clearNext(id) });
      }
    }
    for (const clarification of model.payload.clarifications) {
      if (Object.values(state.placements).includes(clarification.id)) continue;
      const distortion = model.payload.distortions.find((item) => item.clarificationId === clarification.id);
      const ready = state.fogCleared[distortion.id] === model.payload.fogPatchCount;
      actions.push({
        id: `repair-${distortion.id}`,
        label: distortion.id === "idealisation"
          ? localized("Repair idealisation with reality", "Corrigir idealização com realidade")
          : localized("Repair changing feelings with maturing love", "Corrigir sentimentos com amor maduro"),
        disabled: !ready,
        run: () => scene.placeClarification(clarification.id, distortion.id),
      });
    }
    return actions;
  },

  showHint(scene, hintIndex) {
    const model = scene.c29Model;
    const state = restoreC29State(scene.c29State, model);
    state.hintLevel = Math.max(state.hintLevel, hintIndex + 1);
    const unfinished = model.mirrorOrder.find((id) => state.fogCleared[id] < model.payload.fogPatchCount) || model.mirrorOrder.find((id) => !state.placements[id]);
    state.hintTarget = unfinished || null;
    if (hintIndex === 1 && unfinished && state.fogCleared[unfinished] < model.payload.fogPatchCount) {
      state.fogCleared[unfinished] += 1;
      state.lastEvent = "hint-cleared-fog";
    }
    makeSceneState(scene, state);
    return hintIndex === 0
      ? localized("The fog hides two different confusions: an idealised person, and a feeling expected never to change. Work on the outlined mirror.", "A névoa esconde duas confusões diferentes: uma pessoa idealizada e um sentimento que nunca deveria mudar. Trabalhe no espelho contornado.")
      : localized("One fog patch was cleared. Match reality with idealisation, and maturing love with changing feelings.", "Uma mancha de névoa foi limpa. Associe realidade à idealização e amor maduro à mudança dos sentimentos.");
  },

  destroy(scene) {
    scene?.input?.keyboard?.removeAllListeners();
    scene?.input?.removeAllListeners();
    scene?.mirrorZones?.forEach((zone) => zone.removeAllListeners());
    scene?.clarificationZones?.forEach((zone) => zone.removeAllListeners());
    scene?.clothZone?.removeAllListeners();
  },
});
