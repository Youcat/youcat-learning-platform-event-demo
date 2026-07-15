const CONCEPT_IDS = Object.freeze(["love", "truth", "safety", "help", "boundaries"]);
const SLOT_IDS = Object.freeze(["support-1", "support-2", "support-3", "support-4", "support-5"]);

const DEFAULT_PAYLOAD = Object.freeze({
  concepts: [
    { id: "love", label: { en: "Love", pt: "Amor" } },
    { id: "truth", label: { en: "Truth", pt: "Verdade" } },
    { id: "safety", label: { en: "Safety", pt: "Segurança" } },
    { id: "help", label: { en: "Qualified help", pt: "Ajuda qualificada" } },
    { id: "boundaries", label: { en: "Boundaries", pt: "Limites" } },
  ],
  slots: SLOT_IDS.map((id, index) => ({ id, label: { en: `Support ${index + 1}`, pt: `Apoio ${index + 1}` } })),
  minimumMoves: 7,
  minimumReconsidered: 2,
});

const localized = (en, pt) => ({ en, pt });
const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, expected) => isRecord(value)
  && Object.keys(value).sort().join("|") === [...expected].sort().join("|");
const validLocalized = (value) => exactKeys(value, ["en", "pt"])
  && [value.en, value.pt].every((text) => typeof text === "string" && text.trim());

function hashSeed(seed) {
  let value = 2166136261;
  for (const character of String(seed || "C21")) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seededRandom(seed) {
  let value = hashSeed(seed) || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seed) {
  const random = seededRandom(seed);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function normalizeC21Payload(payload) {
  const result = c21Engine.validate(payload);
  return result.ok ? clone(payload) : clone(DEFAULT_PAYLOAD);
}

export function createC21Puzzle(seed, payload = DEFAULT_PAYLOAD) {
  const normalized = normalizeC21Payload(payload);
  return {
    concepts: shuffled(normalized.concepts, `${seed}:concepts`),
    slots: [...normalized.slots],
    minimumMoves: normalized.minimumMoves,
    minimumReconsidered: normalized.minimumReconsidered,
  };
}

export function createC21InitialState(payload = DEFAULT_PAYLOAD) {
  const normalized = normalizeC21Payload(payload);
  return {
    assignments: Object.fromEntries(normalized.concepts.map(({ id }) => [id, null])),
    moveCounts: Object.fromEntries(normalized.concepts.map(({ id }) => [id, 0])),
    totalMoves: 0,
    selectedId: null,
    hintLevel: 0,
  };
}

function sanitizeState(savedState, payload) {
  const initial = createC21InitialState(payload);
  if (!isRecord(savedState)) return initial;
  const usedSlots = new Set();
  for (const id of CONCEPT_IDS) {
    const slot = SLOT_IDS.includes(savedState.assignments?.[id]) ? savedState.assignments[id] : null;
    initial.assignments[id] = slot && !usedSlots.has(slot) ? slot : null;
    if (initial.assignments[id]) usedSlots.add(initial.assignments[id]);
    initial.moveCounts[id] = Math.max(0, Math.min(99, Math.floor(Number(savedState.moveCounts?.[id]) || 0)));
  }
  initial.totalMoves = Math.max(0, Math.min(999, Math.floor(Number(savedState.totalMoves) || 0)));
  initial.selectedId = CONCEPT_IDS.includes(savedState.selectedId) ? savedState.selectedId : null;
  initial.hintLevel = Math.max(0, Math.min(2, Math.floor(Number(savedState.hintLevel) || 0)));
  return initial;
}

export function applyC21Move(state, conceptId, targetSlotId) {
  if (!CONCEPT_IDS.includes(conceptId)) return { changed: false, reason: "unknown-concept" };
  if (targetSlotId !== null && !SLOT_IDS.includes(targetSlotId)) return { changed: false, reason: "unknown-support" };
  const previousSlot = state.assignments[conceptId];
  if (previousSlot === targetSlotId) return { changed: false, reason: "same-support" };

  const displacedId = targetSlotId
    ? CONCEPT_IDS.find((id) => id !== conceptId && state.assignments[id] === targetSlotId)
    : null;
  state.assignments[conceptId] = targetSlotId;
  state.moveCounts[conceptId] += 1;
  state.totalMoves += 1;

  if (displacedId) {
    state.assignments[displacedId] = previousSlot;
    state.moveCounts[displacedId] += 1;
    state.totalMoves += 1;
  }
  return { changed: true, displacedId, previousSlot };
}

export function summarizeC21State(state, payload = DEFAULT_PAYLOAD) {
  const normalized = normalizeC21Payload(payload);
  const assigned = CONCEPT_IDS.filter((id) => SLOT_IDS.includes(state?.assignments?.[id]));
  const uniqueSlots = new Set(assigned.map((id) => state.assignments[id]));
  const reconsidered = CONCEPT_IDS.filter((id) => Number(state?.moveCounts?.[id]) >= 2).length;
  const stable = assigned.length === CONCEPT_IDS.length && uniqueSlots.size === CONCEPT_IDS.length;
  return {
    assigned: assigned.length,
    reconsidered,
    stable,
    explored: Number(state?.totalMoves) >= normalized.minimumMoves && reconsidered >= normalized.minimumReconsidered,
    complete: stable && Number(state?.totalMoves) >= normalized.minimumMoves && reconsidered >= normalized.minimumReconsidered,
  };
}

const SLOT_POINTS = Object.freeze([
  { x: 42, y: 116 },
  { x: 111, y: 132 },
  { x: 180, y: 102 },
  { x: 249, y: 132 },
  { x: 318, y: 116 },
]);

const DOCK_POINTS = Object.freeze([
  { x: 64, y: 242 },
  { x: 180, y: 242 },
  { x: 296, y: 242 },
  { x: 122, y: 304 },
  { x: 238, y: 304 },
]);

export const c21Engine = Object.freeze({
  validate(payload) {
    const errors = [];
    if (!exactKeys(payload, ["concepts", "slots", "minimumMoves", "minimumReconsidered"])) {
      errors.push("payload must contain exactly {concepts, slots, minimumMoves, minimumReconsidered}");
    }
    if (!Array.isArray(payload?.concepts) || payload.concepts.length !== 5) {
      errors.push("payload.concepts must contain exactly five concepts");
    } else {
      const ids = payload.concepts.map((concept) => concept?.id);
      if (new Set(ids).size !== 5 || !CONCEPT_IDS.every((id) => ids.includes(id))) errors.push("payload.concepts must use the five C21 concept ids exactly once");
      payload.concepts.forEach((concept, index) => {
        if (!exactKeys(concept, ["id", "label"]) || !validLocalized(concept.label)) errors.push(`payload.concepts[${index}] must contain exactly {id, label:{en,pt}}`);
      });
    }
    if (!Array.isArray(payload?.slots) || payload.slots.length !== 5) {
      errors.push("payload.slots must contain exactly five supports");
    } else {
      const ids = payload.slots.map((slot) => slot?.id);
      if (new Set(ids).size !== 5 || !SLOT_IDS.every((id) => ids.includes(id))) errors.push("payload.slots must use the five C21 support ids exactly once");
      payload.slots.forEach((slot, index) => {
        if (!exactKeys(slot, ["id", "label"]) || !validLocalized(slot.label)) errors.push(`payload.slots[${index}] must contain exactly {id, label:{en,pt}}`);
      });
    }
    if (!Number.isInteger(payload?.minimumMoves) || payload.minimumMoves < 5 || payload.minimumMoves > 15) errors.push("payload.minimumMoves must be an integer from 5 to 15");
    if (!Number.isInteger(payload?.minimumReconsidered) || payload.minimumReconsidered < 1 || payload.minimumReconsidered > 5) errors.push("payload.minimumReconsidered must be an integer from 1 to 5");
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const payload = normalizeC21Payload(instance.payload);
    const puzzle = createC21Puzzle(instance.seed, payload);
    const conceptById = new Map(payload.concepts.map((concept) => [concept.id, concept]));
    const locale = language === "pt" ? "pt" : "en";

    class BalanceOfLoveScene extends Phaser.Scene {
      constructor() {
        super({ key: `c21-${instance.id}` });
        this.c21InitialState = createC21InitialState(payload);
        this.c21State = createC21InitialState(payload);
        this.c21Payload = payload;
        this.c21Puzzle = puzzle;
        this.dragPositions = {};
        this.tokenZones = new Map();
        this.tokenTexts = new Map();
        this.slotZones = new Map();
        this.accessibleFeedback = null;
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("c21-approved-art", instance.assets.baseImage);
      }

      create() {
        this.graphics = this.add.graphics();
        if (this.textures.exists("c21-approved-art")) {
          this.approvedArt = this.add.image(323, 39, "c21-approved-art").setDisplaySize(58, 58).setAlpha(0.22);
        }
        puzzle.slots.forEach((slot, index) => {
          const point = SLOT_POINTS[index];
          const zone = this.add.zone(point.x, point.y, 58, 58).setInteractive({ cursor: "pointer" });
          zone.on("pointerdown", () => this.placeSelected(slot.id));
          this.slotZones.set(slot.id, zone);
          this.add.text(point.x, point.y + 33, String(index + 1), {
            color: "#6f6a61", fontFamily: "Fira Sans", fontSize: "11px", fontStyle: "600",
          }).setOrigin(0.5);
        });
        puzzle.concepts.forEach((concept, index) => {
          const point = DOCK_POINTS[index];
          const text = this.add.text(point.x, point.y, concept.label[locale], {
            color: "#22201d",
            fontFamily: "Fira Sans",
            fontSize: "12px",
            fontStyle: "600",
            align: "center",
            fixedWidth: 104,
            wordWrap: { width: 96 },
            padding: { x: 4, y: 8 },
          }).setOrigin(0.5);
          const zone = this.add.zone(point.x, point.y, 108, 48).setInteractive({ cursor: "grab" });
          this.input.setDraggable(zone);
          zone.on("pointerdown", () => this.handleTokenTap(concept.id));
          zone.on("drag", (_pointer, x, y) => {
            this.dragPositions[concept.id] = { x, y };
            this.redraw();
          });
          zone.on("dragend", (pointer, x, y) => this.finishDrag(
            concept.id,
            Number.isFinite(pointer?.worldX) ? pointer.worldX : x,
            Number.isFinite(pointer?.worldY) ? pointer.worldY : y,
          ));
          this.tokenTexts.set(concept.id, text);
          this.tokenZones.set(concept.id, zone);
        });
        this.redraw();
        onReady(this);
      }

      notify(message = null) {
        this.accessibleFeedback = message;
        onStateChange(this);
      }

      selectConcept(conceptId) {
        this.c21State.selectedId = this.c21State.selectedId === conceptId ? null : conceptId;
        const label = conceptById.get(conceptId)?.label;
        this.redraw();
        this.notify(this.c21State.selectedId
          ? localized(`${label.en} selected. Choose a numbered support.`, `${label.pt} selecionado. Escolha um apoio numerado.`)
          : localized("Selection cleared.", "Seleção cancelada."));
      }

      handleTokenTap(conceptId) {
        const selectedId = this.c21State.selectedId;
        const occupiedSlot = this.c21State.assignments[conceptId];
        if (selectedId && selectedId !== conceptId && occupiedSlot) {
          this.moveConcept(selectedId, occupiedSlot);
          return;
        }
        this.selectConcept(conceptId);
      }

      placeSelected(slotId) {
        if (!this.c21State.selectedId) {
          this.notify(localized("Select a concept first.", "Primeiro selecione um conceito."));
          return;
        }
        this.moveConcept(this.c21State.selectedId, slotId);
      }

      moveConcept(conceptId, slotId) {
        const result = applyC21Move(this.c21State, conceptId, slotId);
        if (!result.changed) {
          const message = result.reason === "same-support"
            ? localized("That concept is already on this support.", "Esse conceito já está neste apoio.")
            : localized("That move is not available. Your arrangement is unchanged.", "Esse movimento não está disponível. Sua organização não mudou.");
          this.redraw();
          this.notify(message);
          return;
        }
        this.c21State.selectedId = null;
        const summary = summarizeC21State(this.c21State, payload);
        this.redraw();
        this.notify(summary.complete
          ? localized("The balance is stable and you reconsidered the arrangement. You may now check it.", "A balança está estável e você reconsiderou a organização. Agora pode verificá-la.")
          : localized(`${summary.assigned} of 5 concepts placed; ${summary.reconsidered} reconsidered.`, `${summary.assigned} de 5 conceitos colocados; ${summary.reconsidered} reconsiderados.`));
      }

      returnToTray(conceptId) {
        this.moveConcept(conceptId, null);
      }

      finishDrag(conceptId, x, y) {
        delete this.dragPositions[conceptId];
        const closest = SLOT_POINTS
          .map((point, index) => ({ id: puzzle.slots[index].id, distance: Math.hypot(point.x - x, point.y - y) }))
          .sort((a, b) => a.distance - b.distance)[0];
        if (closest?.distance <= 45) this.moveConcept(conceptId, closest.id);
        else if (this.c21State.assignments[conceptId]) this.returnToTray(conceptId);
        else {
          this.redraw();
          this.notify(localized("Drop the concept on a numbered support.", "Solte o conceito sobre um apoio numerado."));
        }
      }

      positionFor(conceptId) {
        if (this.dragPositions[conceptId]) return this.dragPositions[conceptId];
        const slotId = this.c21State.assignments[conceptId];
        const slotIndex = puzzle.slots.findIndex((slot) => slot.id === slotId);
        if (slotIndex >= 0) return SLOT_POINTS[slotIndex];
        return DOCK_POINTS[puzzle.concepts.findIndex((concept) => concept.id === conceptId)];
      }

      redraw() {
        if (!this.graphics) return;
        const state = this.c21State;
        this.graphics.clear();
        this.graphics.lineStyle(2, 0x22201d, 1);
        this.graphics.lineBetween(26, 148, 334, 148);
        this.graphics.lineBetween(180, 148, 180, 210);
        this.graphics.lineBetween(145, 210, 215, 210);
        this.graphics.lineStyle(1, 0xd9d2bf, 1);
        this.graphics.lineBetween(20, 219, 340, 219);

        puzzle.slots.forEach((_slot, index) => {
          const point = SLOT_POINTS[index];
          const occupied = CONCEPT_IDS.some((id) => state.assignments[id] === puzzle.slots[index].id);
          const hinted = state.hintLevel > 0 && !occupied;
          this.graphics.fillStyle(occupied ? 0xf7e4eb : 0xffffff, 1);
          this.graphics.fillCircle(point.x, point.y, 25);
          this.graphics.lineStyle(hinted ? 3 : 1.5, hinted ? 0xd60056 : 0x22201d, 1);
          this.graphics.strokeCircle(point.x, point.y, 25);
          this.graphics.lineStyle(1, 0x22201d, 0.8);
          this.graphics.lineBetween(point.x, point.y + 25, point.x, 148);
        });

        for (const concept of puzzle.concepts) {
          const point = this.positionFor(concept.id);
          const selected = state.selectedId === concept.id;
          const assigned = Boolean(state.assignments[concept.id]);
          this.graphics.fillStyle(assigned ? 0xf7e4eb : 0xffffff, 1);
          this.graphics.fillRoundedRect(point.x - 53, point.y - 22, 106, 44, 6);
          this.graphics.lineStyle(selected ? 3 : 1.5, selected ? 0xd60056 : 0x22201d, 1);
          this.graphics.strokeRoundedRect(point.x - 53, point.y - 22, 106, 44, 6);
          this.tokenZones.get(concept.id)?.setPosition(point.x, point.y);
          this.tokenTexts.get(concept.id)?.setPosition(point.x, point.y).setColor(selected ? "#d60056" : "#22201d");
        }

        if (state.hintLevel > 1) {
          const summary = summarizeC21State(state, payload);
          this.graphics.lineStyle(2, 0xd60056, reducedMotion ? 0.45 : 0.75);
          this.graphics.strokeRoundedRect(12, 224, 336, 114, 6);
          if (summary.stable) this.graphics.lineBetween(151, 213, 209, 213);
        }
      }
    }

    return new BalanceOfLoveScene();
  },

  serializeState(scene) {
    return clone(scene?.c21State || createC21InitialState(scene?.c21Payload));
  },

  restoreState(scene, savedState, instance) {
    const payload = normalizeC21Payload(instance?.payload || scene?.c21Payload);
    scene.c21State = sanitizeState(savedState, payload);
    scene.accessibleFeedback = null;
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const summary = summarizeC21State(scene?.c21State, instance?.payload);
    if (summary.complete) {
      return {
        correct: true,
        complete: true,
        feedback: localized(
          "Exploration complete. This is your reflection, not a moral ranking of these supports.",
          "Exploração concluída. Esta é a sua reflexão, não uma classificação moral destes apoios.",
        ),
      };
    }
    const missing = 5 - summary.assigned;
    return {
      correct: false,
      complete: false,
      feedback: localized(
        `${missing ? `Place ${missing} more concept${missing === 1 ? "" : "s"}. ` : ""}Reconsider at least two concepts before checking. No position is morally ranked.`,
        `${missing ? `Coloque mais ${missing} conceito${missing === 1 ? "" : "s"}. ` : ""}Reconsidere pelo menos dois conceitos antes de verificar. Nenhuma posição é uma classificação moral.`,
      ),
    };
  },

  getAccessibleActions(scene) {
    if (!scene) return [];
    const payload = scene.c21Payload || DEFAULT_PAYLOAD;
    const selectedId = scene.c21State?.selectedId;
    if (!selectedId) {
      return payload.concepts.map((concept) => ({
        id: `select-${concept.id}`,
        label: localized(`Select ${concept.label.en}`, `Selecionar ${concept.label.pt}`),
        run: () => scene.selectConcept(concept.id),
      }));
    }
    const selected = payload.concepts.find((concept) => concept.id === selectedId);
    return [
      ...payload.slots.map((slot, index) => ({
        id: `place-${slot.id}`,
        label: localized(`Place ${selected.label.en} on support ${index + 1}`, `Colocar ${selected.label.pt} no apoio ${index + 1}`),
        run: () => scene.moveConcept(selectedId, slot.id),
      })),
      {
        id: "return-to-tray",
        label: localized(`Return ${selected.label.en} to tray`, `Devolver ${selected.label.pt} à bandeja`),
        disabled: !scene.c21State.assignments[selectedId],
        run: () => scene.returnToTray(selectedId),
      },
    ];
  },

  showHint(scene, hintIndex, instance) {
    scene.c21State.hintLevel = Math.max(scene.c21State.hintLevel, Math.min(2, hintIndex + 1));
    if (hintIndex === 1 && !scene.c21State.selectedId) {
      const candidate = CONCEPT_IDS.find((id) => scene.c21State.moveCounts[id] < 2) || CONCEPT_IDS[0];
      scene.c21State.selectedId = candidate;
    }
    scene.redraw?.();
    scene.notify?.();
    return hintIndex === 0
      ? localized(
        "Place every concept on a numbered support. The positions do not rank their moral importance.",
        "Coloque cada conceito num apoio numerado. As posições não classificam sua importância moral.",
      )
      : localized(
        "After all five are placed, swap or move two concepts to show that you reconsidered the arrangement.",
        "Depois de colocar os cinco, troque ou mova dois conceitos para mostrar que reconsiderou a organização.",
      );
  },

  destroy(scene) {
    scene?.tokenZones?.forEach((zone) => zone.removeAllListeners());
    scene?.slotZones?.forEach((zone) => zone.removeAllListeners());
    scene?.input?.removeAllListeners();
  },
});

export { CONCEPT_IDS, SLOT_IDS };
