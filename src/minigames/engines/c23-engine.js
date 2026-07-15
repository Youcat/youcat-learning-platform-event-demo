const LOCALES = ["en", "pt"];
const SYMBOLS = new Set(["path", "book", "counsel", "gate", "key", "branch"]);
const ANGLES = [210, 270, 330, 30, 90, 150];

function localized(en, pt) {
  return { en, pt };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function validLocalized(value) {
  return exactKeys(value, LOCALES) && LOCALES.every((locale) => typeof value[locale] === "string" && value[locale].trim());
}

export const C23_DEFAULT_PAYLOAD = Object.freeze({
  concepts: [
    { id: "experience", label: localized("Experience", "Experiência"), symbol: "path" },
    { id: "gospel", label: localized("Gospel", "Evangelho"), symbol: "book" },
    { id: "counsel", label: localized("Counsel", "Conselho"), symbol: "counsel" },
    { id: "freedom", label: localized("Freedom", "Liberdade"), symbol: "gate" },
    { id: "responsibility", label: localized("Responsibility", "Responsabilidade"), symbol: "key" },
    { id: "fruits", label: localized("Fruits", "Frutos"), symbol: "branch" },
  ],
  slots: [
    { id: "bring", clue: localized("Bring honestly", "Trazer com verdade") },
    { id: "light", clue: localized("Receive light", "Receber luz") },
    { id: "listen", clue: localized("Listen wisely", "Escutar com sabedoria") },
    { id: "protect", clue: localized("Keep free", "Manter livre") },
    { id: "own", clue: localized("Choose and own", "Escolher e assumir") },
    { id: "review", clue: localized("Review over time", "Rever com o tempo") },
  ],
  solution: ["experience", "gospel", "counsel", "freedom", "responsibility", "fruits"],
  forwardCueId: "gospel",
});

export function validateC23Payload(payload, instance = {}) {
  const errors = [];
  if (!exactKeys(payload, ["concepts", "slots", "solution", "forwardCueId"])) {
    errors.push("payload must contain exactly {concepts, slots, solution, forwardCueId}");
  }
  const concepts = Array.isArray(payload?.concepts) ? payload.concepts : [];
  const slots = Array.isArray(payload?.slots) ? payload.slots : [];
  if (concepts.length !== 6) errors.push("payload.concepts must contain exactly six cues");
  if (slots.length !== 6) errors.push("payload.slots must contain exactly six bearings");

  const conceptIds = [];
  concepts.forEach((concept, index) => {
    if (!exactKeys(concept, ["id", "label", "symbol"])) errors.push(`payload.concepts[${index}] must contain exactly {id, label, symbol}`);
    if (typeof concept?.id !== "string" || !concept.id.trim()) errors.push(`payload.concepts[${index}].id must be a non-empty string`);
    else conceptIds.push(concept.id);
    if (!validLocalized(concept?.label)) errors.push(`payload.concepts[${index}].label must contain non-empty {en, pt}`);
    if (!SYMBOLS.has(concept?.symbol)) errors.push(`payload.concepts[${index}].symbol is not supported`);
  });
  if (new Set(conceptIds).size !== conceptIds.length) errors.push("payload concept ids must be unique");

  const slotIds = [];
  slots.forEach((slot, index) => {
    if (!exactKeys(slot, ["id", "clue"])) errors.push(`payload.slots[${index}] must contain exactly {id, clue}`);
    if (typeof slot?.id !== "string" || !slot.id.trim()) errors.push(`payload.slots[${index}].id must be a non-empty string`);
    else slotIds.push(slot.id);
    if (!validLocalized(slot?.clue)) errors.push(`payload.slots[${index}].clue must contain non-empty {en, pt}`);
  });
  if (new Set(slotIds).size !== slotIds.length) errors.push("payload slot ids must be unique");

  if (!Array.isArray(payload?.solution) || payload.solution.length !== 6 || new Set(payload.solution).size !== 6 || payload.solution.some((id) => !conceptIds.includes(id))) {
    errors.push("payload.solution must be a permutation of the six cue ids");
  }
  if (typeof payload?.forwardCueId !== "string" || !conceptIds.includes(payload.forwardCueId)) errors.push("payload.forwardCueId must reference a cue id");
  if (payload?.solution?.[1] !== payload?.forwardCueId) errors.push("payload.forwardCueId must occupy the forward bearing");
  if (isRecord(instance.layoutOverrides) && Object.keys(instance.layoutOverrides).length) errors.push("C23 does not accept layoutOverrides");
  return { ok: errors.length === 0, errors };
}

export function normalizeC23Payload(payload) {
  return validateC23Payload(payload).ok ? clone(payload) : clone(C23_DEFAULT_PAYLOAD);
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "C23-fallback-seed")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createC23InitialState(payload, seed) {
  const model = normalizeC23Payload(payload);
  const placements = [...model.solution];
  const random = seededRandom(seed);
  for (let index = placements.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [placements[index], placements[target]] = [placements[target], placements[index]];
  }
  if (placements.every((id, index) => id === model.solution[index])) placements.push(placements.shift());
  return {
    placements,
    selectedCueId: null,
    targetIndex: 0,
    hintLevel: 0,
    completed: false,
    solutionShown: false,
    lastCheck: null,
    notice: localized("", ""),
  };
}

export function isC23Solvable(placements, payload = C23_DEFAULT_PAYLOAD) {
  const model = normalizeC23Payload(payload);
  return Array.isArray(placements)
    && placements.length === model.solution.length
    && new Set(placements).size === model.solution.length
    && placements.every((id) => model.solution.includes(id));
}

export function scoreC23Placements(placements, payload = C23_DEFAULT_PAYLOAD) {
  const model = normalizeC23Payload(payload);
  if (!isC23Solvable(placements, model)) return { correctSlots: 0, alignedPairs: 0, forwardAligned: false, points: 0, maximum: 14 };
  const correctSlots = placements.filter((id, index) => id === model.solution[index]).length;
  let alignedPairs = 0;
  model.solution.forEach((id, index) => {
    const next = model.solution[(index + 1) % model.solution.length];
    const at = placements.indexOf(id);
    if (placements[(at + 1) % placements.length] === next) alignedPairs += 1;
  });
  const forwardAligned = placements[1] === model.forwardCueId;
  return { correctSlots, alignedPairs, forwardAligned, points: correctSlots + alignedPairs + (forwardAligned ? 2 : 0), maximum: 14 };
}

function validSavedState(savedState, model) {
  return isRecord(savedState)
    && isC23Solvable(savedState.placements, model)
    && (savedState.selectedCueId === null || model.solution.includes(savedState.selectedCueId));
}

function pointAt(centerX, centerY, radius, angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;
  return { x: centerX + Math.cos(radians) * radius, y: centerY + Math.sin(radians) * radius };
}

function drawSymbol(graphics, symbol, x, y, color) {
  graphics.lineStyle(1.8, color, 1);
  if (symbol === "path") {
    graphics.beginPath(); graphics.moveTo(x - 7, y + 7); graphics.lineTo(x - 2, y + 2); graphics.lineTo(x - 5, y - 3); graphics.lineTo(x + 5, y - 8); graphics.strokePath();
    graphics.fillStyle(color, 1); graphics.fillCircle(x - 8, y + 8, 1.8); graphics.fillCircle(x + 6, y - 9, 1.8);
  } else if (symbol === "book") {
    graphics.beginPath(); graphics.moveTo(x - 9, y - 6); graphics.lineTo(x - 1, y - 3); graphics.lineTo(x, y + 7); graphics.lineTo(x + 1, y - 3); graphics.lineTo(x + 9, y - 6); graphics.lineTo(x + 8, y + 5); graphics.lineTo(x, y + 8); graphics.lineTo(x - 8, y + 5); graphics.closePath(); graphics.strokePath();
  } else if (symbol === "counsel") {
    graphics.strokeCircle(x - 4, y - 2, 5); graphics.strokeCircle(x + 5, y + 2, 5); graphics.lineBetween(x - 7, y + 3, x - 9, y + 7); graphics.lineBetween(x + 8, y + 7, x + 10, y + 9);
  } else if (symbol === "gate") {
    graphics.lineBetween(x - 8, y + 8, x - 8, y - 7); graphics.lineBetween(x + 8, y + 8, x + 8, y - 7); graphics.lineBetween(x - 8, y - 7, x + 8, y - 7); graphics.lineBetween(x, y - 7, x + 4, y + 5);
  } else if (symbol === "key") {
    graphics.strokeCircle(x - 5, y - 3, 4.5); graphics.lineBetween(x - 2, y, x + 8, y + 8); graphics.lineBetween(x + 4, y + 4, x + 7, y + 1);
  } else if (symbol === "branch") {
    graphics.lineBetween(x - 8, y + 7, x + 7, y - 7); graphics.lineBetween(x - 2, y + 1, x - 7, y - 3); graphics.lineBetween(x + 2, y - 2, x + 7, y + 2); graphics.fillStyle(color, 1); graphics.fillCircle(x - 7, y - 4, 2.2); graphics.fillCircle(x + 8, y + 2, 2.2); graphics.fillCircle(x + 7, y - 8, 2.2);
  }
}

export const c23Engine = Object.freeze({
  validate(payload, instance) {
    return validateC23Payload(payload, instance);
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const model = normalizeC23Payload(instance.payload);
    const initialState = createC23InitialState(model, instance.seed);
    const locale = language === "pt" ? "pt" : "en";

    class CompassDiscernmentScene extends Phaser.Scene {
      constructor() {
        super({ key: `c23-${instance.id}` });
        this.c23Model = model;
        this.c23InitialState = clone(initialState);
        this.c23State = clone(initialState);
        this.minigameStatus = localized("", "");
        this.textObjects = [];
        this.dragged = false;
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("c23-approved-art", instance.assets.baseImage);
      }

      create() {
        this.graphics = this.add.graphics();
        if (instance.assets.baseImage && this.textures.exists("c23-approved-art")) {
          this.approvedArt = this.add.image(180, 175, "c23-approved-art").setDisplaySize(132, 132).setAlpha(0.09);
        }
        this.tokenZones = model.solution.map((_, index) => {
          const zone = this.add.zone(0, 0, 78, 46).setInteractive({ cursor: "grab" });
          zone.slotIndex = index;
          this.input.setDraggable(zone);
          zone.on("pointerdown", (pointer) => {
            this.dragged = false;
            this.dragCueId = this.c23State.placements[zone.slotIndex];
            this.dragStartPoint = { x: pointer.x, y: pointer.y };
            this.dragOrigin = { x: zone.x, y: zone.y };
            this.selectedBeforePointer = this.c23State.selectedCueId;
          });
          zone.on("dragstart", () => {
            this.dragged = false;
          });
          zone.on("drag", (pointer, x, y) => {
            if (!this.dragged && Math.hypot(x - this.dragOrigin.x, y - this.dragOrigin.y) < 7) return;
            if (!this.dragged) this.selectCue(this.dragCueId, false);
            this.dragged = true;
            zone.setPosition(x, y);
          });
          zone.on("dragend", () => {
            const targetIndex = this.nearestSlot(zone.x, zone.y);
            if (targetIndex < 0) this.rejectMove();
            else this.placeCue(this.dragCueId, targetIndex);
          });
          zone.on("pointerup", () => {
            if (this.dragged) return;
            this.c23State.selectedCueId = this.selectedBeforePointer;
            const cueId = this.c23State.placements[zone.slotIndex];
            if (this.c23State.selectedCueId && this.c23State.selectedCueId !== cueId) this.placeCue(this.c23State.selectedCueId, zone.slotIndex);
            else this.selectCue(cueId);
          });
          return zone;
        });
        this.input.keyboard.on("keydown", (event) => this.handleKeyboard(event));
        this.redraw();
        onReady(this);
      }

      canvasFocused() {
        return typeof document === "undefined" || document.activeElement === this.game?.canvas;
      }

      handleKeyboard(event) {
        if (!this.canvasFocused()) return;
        const key = event.key;
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " ", "Escape"].includes(key)) return;
        event.preventDefault();
        if (key === "ArrowLeft") this.selectByOffset(-1);
        if (key === "ArrowRight") this.selectByOffset(1);
        if (key === "ArrowUp") this.selectTarget(-1);
        if (key === "ArrowDown") this.selectTarget(1);
        if (key === "Enter") this.placeCue(this.c23State.selectedCueId, this.c23State.targetIndex);
        if (key === " ") this.selectCue(this.c23State.placements[this.c23State.targetIndex]);
        if (key === "Escape") this.selectCue(null);
      }

      nearestSlot(x, y) {
        let best = { index: -1, distance: Infinity };
        ANGLES.forEach((angle, index) => {
          const point = pointAt(180, 175, 132, angle);
          const distance = Math.hypot(x - point.x, y - point.y);
          if (distance < best.distance) best = { index, distance };
        });
        return best.distance <= 56 ? best.index : -1;
      }

      selectCue(cueId, notify = true) {
        if (this.c23State.completed || this.c23State.solutionShown) return false;
        this.c23State.selectedCueId = model.solution.includes(cueId) ? cueId : null;
        if (this.c23State.selectedCueId) this.c23State.targetIndex = this.c23State.placements.indexOf(this.c23State.selectedCueId);
        this.clearNotice();
        this.redraw();
        if (notify) this.notify();
        return true;
      }

      selectByOffset(offset) {
        const current = Math.max(0, this.c23State.placements.indexOf(this.c23State.selectedCueId));
        const next = (current + offset + this.c23State.placements.length) % this.c23State.placements.length;
        this.selectCue(this.c23State.placements[next]);
      }

      selectTarget(offset) {
        if (this.c23State.completed || this.c23State.solutionShown) return false;
        this.c23State.targetIndex = (this.c23State.targetIndex + offset + model.slots.length) % model.slots.length;
        this.clearNotice();
        this.redraw();
        this.notify();
        return true;
      }

      placeCue(cueId, targetIndex) {
        if (this.c23State.completed || this.c23State.solutionShown) return false;
        const sourceIndex = this.c23State.placements.indexOf(cueId);
        if (sourceIndex < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= model.slots.length) return this.rejectMove();
        if (sourceIndex !== targetIndex) {
          [this.c23State.placements[sourceIndex], this.c23State.placements[targetIndex]] = [this.c23State.placements[targetIndex], this.c23State.placements[sourceIndex]];
        }
        this.c23State.selectedCueId = cueId;
        this.c23State.targetIndex = targetIndex;
        this.c23State.lastCheck = null;
        this.c23State.solutionShown = false;
        this.clearNotice();
        this.redraw();
        this.notify();
        return true;
      }

      rejectMove() {
        this.c23State.notice = localized("That is outside the compass. Choose one of its six bearings.", "Isso está fora da bússola. Escolha uma das seis direções.");
        this.minigameStatus = this.c23State.notice;
        this.redraw();
        this.notify();
        return false;
      }

      clearNotice() {
        this.c23State.notice = localized("", "");
        this.minigameStatus = this.c23State.notice;
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.graphics) return;
        this.textObjects.forEach((item) => item.destroy());
        this.textObjects = [];
        const g = this.graphics;
        const ink = 0x22201d;
        const muted = 0x6f6a61;
        const border = 0xd9d2bf;
        const accent = 0xd60056;
        g.clear();
        g.lineStyle(1.4, border, 1);
        g.strokeCircle(180, 175, 92);
        g.lineStyle(2, ink, 1);
        g.strokeCircle(180, 175, 65);
        g.lineStyle(1, ink, 0.55);
        ANGLES.forEach((angle) => {
          const inner = pointAt(180, 175, 58, angle);
          const outer = pointAt(180, 175, 82, angle);
          g.lineBetween(inner.x, inner.y, outer.x, outer.y);
        });

        const solved = this.c23State.completed || this.c23State.solutionShown;
        const needleAngle = solved ? -90 : -112;
        const needle = pointAt(180, 175, 53, needleAngle);
        g.lineStyle(3, solved ? accent : ink, 1);
        g.lineBetween(180, 175, needle.x, needle.y);
        g.fillStyle(solved ? accent : ink, 1);
        g.fillCircle(180, 175, 5);
        g.beginPath(); g.moveTo(needle.x, needle.y); g.lineTo(needle.x - 5, needle.y + 10); g.lineTo(needle.x + 5, needle.y + 10); g.closePath(); g.fillPath();
        if (this.approvedArt) this.approvedArt.setAlpha(solved ? 0.22 : 0.08);

        model.slots.forEach((slot, index) => {
          const angle = ANGLES[index];
          const cluePoint = pointAt(180, 175, 83, angle);
          const tokenPoint = pointAt(180, 175, 132, angle);
          const selectedTarget = index === this.c23State.targetIndex;
          if (selectedTarget) {
            g.lineStyle(1.5, accent, 0.65);
            g.strokeCircle(cluePoint.x, cluePoint.y, 23);
          }
          const clue = this.add.text(cluePoint.x, cluePoint.y, slot.clue[locale], {
            fontFamily: "Fira Sans", fontSize: locale === "pt" ? "8px" : "9px", color: `#${muted.toString(16).padStart(6, "0")}`,
            align: "center", wordWrap: { width: 62 }, lineSpacing: -2,
          }).setOrigin(0.5);
          this.textObjects.push(clue);

          const cueId = this.c23State.placements[index];
          const cue = model.concepts.find((item) => item.id === cueId);
          const selected = cueId === this.c23State.selectedCueId;
          g.fillStyle(0xffffff, 1); g.fillRoundedRect(tokenPoint.x - 39, tokenPoint.y - 21, 78, 42, 6);
          g.lineStyle(selected ? 2.6 : 1.3, selected ? accent : ink, 1); g.strokeRoundedRect(tokenPoint.x - 39, tokenPoint.y - 21, 78, 42, 6);
          if (selected) { g.fillStyle(accent, 0.12); g.fillRect(tokenPoint.x - 36, tokenPoint.y + 8, 72, 7); }
          drawSymbol(g, cue.symbol, tokenPoint.x - 25, tokenPoint.y, ink);
          const label = this.add.text(tokenPoint.x + 7, tokenPoint.y, cue.label[locale], {
            fontFamily: "Fira Sans", fontStyle: "600", fontSize: cueId === "responsibility" ? "7px" : "10px", color: "#22201d",
            align: "center", wordWrap: { width: 49 }, lineSpacing: -2,
          }).setOrigin(0.5);
          this.textObjects.push(label);
          this.tokenZones[index]?.setPosition(tokenPoint.x, tokenPoint.y);
        });

        if (this.c23State.hintLevel > 0) {
          const forward = pointAt(180, 175, 104, ANGLES[1]);
          g.lineStyle(2.4, accent, reducedMotion ? 0.55 : 0.8);
          g.strokeCircle(forward.x, forward.y, 27);
        }
        if (solved) {
          const word = this.add.text(180, 175, locale === "pt" ? "AVANTE" : "FORWARD", { fontFamily: "Fira Sans", fontStyle: "700", fontSize: "11px", color: "#d60056" }).setOrigin(0.5);
          this.textObjects.push(word);
        }
      }
    }

    return new CompassDiscernmentScene();
  },

  serializeState(scene) {
    const state = scene?.c23State;
    if (!state) return null;
    return clone({
      placements: state.placements,
      selectedCueId: state.selectedCueId,
      targetIndex: state.targetIndex,
      hintLevel: state.hintLevel,
      completed: state.completed,
      solutionShown: state.solutionShown,
      lastCheck: state.lastCheck,
      notice: state.notice,
    });
  },

  restoreState(scene, savedState) {
    if (!scene) return;
    const model = scene.c23Model || C23_DEFAULT_PAYLOAD;
    const initial = clone(scene.c23InitialState || createC23InitialState(model, "C23-fallback-seed"));
    if (!validSavedState(savedState, model)) scene.c23State = initial;
    else {
      scene.c23State = {
        placements: [...savedState.placements],
        selectedCueId: savedState.selectedCueId,
        targetIndex: Number.isInteger(savedState.targetIndex) ? Math.max(0, Math.min(5, savedState.targetIndex)) : 0,
        hintLevel: Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0)),
        completed: Boolean(savedState.completed),
        solutionShown: Boolean(savedState.solutionShown),
        lastCheck: ["correct", "wrong"].includes(savedState.lastCheck) ? savedState.lastCheck : null,
        notice: validLocalized(savedState.notice) ? clone(savedState.notice) : localized("", ""),
      };
    }
    scene.minigameStatus = scene.c23State.notice;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const model = scene.c23Model || normalizeC23Payload(instance.payload);
    const score = scoreC23Placements(scene.c23State.placements, model);
    const correct = score.correctSlots === model.solution.length;
    scene.c23State.lastCheck = correct ? "correct" : "wrong";
    scene.c23State.completed = correct;
    if (instance.mode === "mission") {
      scene.c23State.solutionShown = true;
      if (!correct) scene.c23State.placements = [...model.solution];
    } else scene.c23State.solutionShown = correct;
    scene.c23State.notice = localized("", "");
    scene.minigameStatus = scene.c23State.notice;
    scene.redraw?.();
    scene.notify?.();
    const feedback = correct
      ? localized("The six bearings agree. The compass points forward.", "As seis direções estão em harmonia. A bússola aponta para a frente.")
      : instance.mode === "mission"
        ? localized("This arrangement did not yet hold together. The compass now shows one coherent solution.", "Esta disposição ainda não formava um conjunto coerente. A bússola mostra agora uma solução possível.")
        : localized(`${score.correctSlots} of 6 bearings are aligned. Keep the cues movable and reconsider the relationships.`, `${score.correctSlots} de 6 direções estão alinhadas. Continue movendo as pistas e reveja as relações.`);
    return { correct, complete: correct, feedback };
  },

  getAccessibleActions(scene) {
    if (!scene) return [];
    const model = scene.c23Model || C23_DEFAULT_PAYLOAD;
    const selected = model.concepts.find((item) => item.id === scene.c23State.selectedCueId) || model.concepts[0];
    const disabled = Boolean(scene.c23State.completed || scene.c23State.solutionShown);
    return [
      { id: "previous-cue", label: localized("Previous cue", "Pista anterior"), disabled, run: () => scene.selectByOffset(-1) },
      { id: "next-cue", label: localized("Next cue", "Próxima pista"), disabled, run: () => scene.selectByOffset(1) },
      ...model.slots.map((slot, index) => ({
        id: `place-${slot.id}`,
        label: localized(`${selected.label.en} → ${slot.clue.en}`, `${selected.label.pt} → ${slot.clue.pt}`),
        disabled,
        run: () => scene.placeCue(selected.id, index),
      })),
    ];
  },

  showHint(scene, hintIndex) {
    const model = scene.c23Model || C23_DEFAULT_PAYLOAD;
    scene.c23State.hintLevel = Math.max(scene.c23State.hintLevel, Math.min(2, hintIndex + 1));
    let message;
    if (hintIndex <= 0) {
      message = localized("Begin with lived experience. Let the Gospel, at the forward bearing, give it light.", "Comece pela experiência vivida. Deixe o Evangelho, na direção da frente, iluminá-la.");
    } else {
      const incorrectIndex = scene.c23State.placements.findIndex((id, index) => id !== model.solution[index]);
      if (incorrectIndex >= 0) {
        const cueId = model.solution[incorrectIndex];
        scene.placeCue?.(cueId, incorrectIndex);
        const cue = model.concepts.find((item) => item.id === cueId);
        const slot = model.slots[incorrectIndex];
        message = localized(`One bearing is set: ${cue.label.en} belongs with “${slot.clue.en}”.`, `Uma direção foi colocada: ${cue.label.pt} corresponde a “${slot.clue.pt}”.`);
      } else message = localized("All six bearings are aligned. Use Check to let the compass answer.", "As seis direções estão alinhadas. Use Verificar para a bússola responder.");
    }
    scene.redraw?.();
    scene.notify?.();
    return message;
  },

  destroy(scene) {
    scene?.tokenZones?.forEach((zone) => zone.removeAllListeners());
    scene?.input?.keyboard?.removeAllListeners();
    scene?.input?.removeAllListeners();
    scene?.textObjects?.forEach((item) => item.destroy());
  },
});
