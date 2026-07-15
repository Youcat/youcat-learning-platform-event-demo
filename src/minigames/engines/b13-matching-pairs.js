export const B13_ENGINE_ID = "B13";
export const B13_ENGINE_VERSION = "2.0.0";

const localized = (en, pt) => ({ en, pt });
const clone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const B13_PAIRS = Object.freeze([
  Object.freeze({
    id: "body-soul",
    words: Object.freeze([
      Object.freeze({ id: "body", label: localized("Body", "Corpo") }),
      Object.freeze({ id: "soul", label: localized("Soul", "Alma") }),
    ]),
  }),
  Object.freeze({
    id: "dignity-freedom",
    words: Object.freeze([
      Object.freeze({ id: "dignity", label: localized("Dignity", "Dignidade") }),
      Object.freeze({ id: "freedom", label: localized("Freedom", "Liberdade") }),
    ]),
  }),
  Object.freeze({
    id: "gift-covenant",
    words: Object.freeze([
      Object.freeze({ id: "gift", label: localized("Gift", "Dom") }),
      Object.freeze({ id: "covenant", label: localized("Covenant", "Aliança") }),
    ]),
  }),
]);

export const B13_WORDS = Object.freeze(B13_PAIRS.flatMap((pair) => pair.words.map((word) => Object.freeze({
  ...word,
  pairId: pair.id,
}))));

const WORD_IDS = Object.freeze(B13_WORDS.map(({ id }) => id));
const PAIR_IDS = Object.freeze(B13_PAIRS.map(({ id }) => id));

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed || "b13-pairs")) {
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

export function generateB13Order(seed) {
  const order = [...WORD_IDS];
  const random = seededRandom(seed);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

export function createB13State(seed) {
  return {
    schemaVersion: 2,
    order: generateB13Order(seed),
    selectedId: null,
    focusedId: null,
    matchedPairIds: [],
    attempts: 0,
    invalidMoves: 0,
    completed: false,
    revealSolution: false,
    status: localized("Choose two words that belong together.", "Escolha duas palavras que pertencem uma à outra."),
  };
}

function validOrder(order) {
  return Array.isArray(order)
    && order.length === WORD_IDS.length
    && order.every((id) => WORD_IDS.includes(id))
    && new Set(order).size === WORD_IDS.length;
}

function validMatchedPairs(value) {
  return Array.isArray(value)
    && value.every((id) => PAIR_IDS.includes(id))
    && new Set(value).size === value.length;
}

export function restoreB13State(savedState, seed) {
  const clean = createB13State(seed);
  if (!isRecord(savedState)
    || savedState.schemaVersion !== 2
    || !validOrder(savedState.order)
    || !validMatchedPairs(savedState.matchedPairIds)) return clean;
  const matchedPairIds = [...savedState.matchedPairIds];
  const selectedWord = B13_WORDS.find(({ id }) => id === savedState.selectedId);
  const selectedId = selectedWord && !matchedPairIds.includes(selectedWord.pairId) ? selectedWord.id : null;
  return {
    schemaVersion: 2,
    order: [...savedState.order],
    selectedId,
    focusedId: WORD_IDS.includes(savedState.focusedId) ? savedState.focusedId : null,
    matchedPairIds,
    attempts: Math.max(0, Math.floor(Number(savedState.attempts) || 0)),
    invalidMoves: Math.max(0, Math.floor(Number(savedState.invalidMoves) || 0)),
    completed: matchedPairIds.length === PAIR_IDS.length,
    revealSolution: Boolean(savedState.revealSolution),
    status: exactKeys(savedState.status, ["en", "pt"])
      && [savedState.status.en, savedState.status.pt].every((text) => typeof text === "string")
      ? { ...savedState.status }
      : clean.status,
  };
}

function wordById(id) {
  return B13_WORDS.find((word) => word.id === id) || null;
}

export function chooseB13Word(state, wordId) {
  const word = wordById(wordId);
  if (!word || state.completed || state.revealSolution || state.matchedPairIds.includes(word.pairId)) {
    return {
      ...state,
      invalidMoves: state.invalidMoves + 1,
      status: localized("That word is not available. Your pairs are unchanged.", "Essa palavra não está disponível. Seus pares não mudaram."),
    };
  }
  if (!state.selectedId) {
    return {
      ...state,
      selectedId: wordId,
      focusedId: wordId,
      status: localized(`${word.label.en} selected. Choose its partner.`, `${word.label.pt} selecionado. Escolha seu par.`),
    };
  }
  if (state.selectedId === wordId) {
    return {
      ...state,
      selectedId: null,
      focusedId: wordId,
      status: localized("Selection cleared.", "Seleção cancelada."),
    };
  }
  const first = wordById(state.selectedId);
  if (first?.pairId === word.pairId) {
    const matchedPairIds = [...state.matchedPairIds, word.pairId];
    const completed = matchedPairIds.length === PAIR_IDS.length;
    return {
      ...state,
      selectedId: null,
      focusedId: wordId,
      matchedPairIds,
      attempts: state.attempts + 1,
      completed,
      status: completed
        ? localized("All three pairs are complete. Press Check.", "Os três pares estão completos. Pressione Verificar.")
        : localized(`${first.label.en} and ${word.label.en} belong together.`, `${first.label.pt} e ${word.label.pt} pertencem um ao outro.`),
    };
  }
  return {
    ...state,
    selectedId: null,
    focusedId: wordId,
    attempts: state.attempts + 1,
    status: localized(
      `${first?.label.en || "Those words"} and ${word.label.en} are not a pair. Try again.`,
      `${first?.label.pt || "Essas palavras"} e ${word.label.pt} não formam um par. Tente novamente.`,
    ),
  };
}

export function analyzeB13State(state) {
  const matchedPairIds = validMatchedPairs(state?.matchedPairIds) ? state.matchedPairIds : [];
  return {
    matchedCount: matchedPairIds.length,
    remaining: PAIR_IDS.length - matchedPairIds.length,
    correct: matchedPairIds.length === PAIR_IDS.length,
    complete: matchedPairIds.length === PAIR_IDS.length,
  };
}

function validateLocalized(value, path, errors) {
  if (!exactKeys(value, ["en", "pt"])
    || ["en", "pt"].some((locale) => typeof value[locale] !== "string" || !value[locale].trim())) {
    errors.push(`${path} must contain exactly non-empty {en, pt}`);
  }
}

function validatePayload(payload, layoutOverrides) {
  const errors = [];
  if (!exactKeys(payload, ["schemaVersion", "pairs"])) errors.push("payload must contain exactly {schemaVersion, pairs}");
  if (payload?.schemaVersion !== 2) errors.push("payload.schemaVersion must be 2");
  if (!Array.isArray(payload?.pairs) || payload.pairs.length !== B13_PAIRS.length) {
    errors.push("payload.pairs must contain exactly three pairs");
  } else {
    payload.pairs.forEach((pair, pairIndex) => {
      const approved = B13_PAIRS[pairIndex];
      if (!exactKeys(pair, ["id", "words"]) || pair.id !== approved.id) errors.push(`payload.pairs[${pairIndex}] must use the approved pair id`);
      if (!Array.isArray(pair.words) || pair.words.length !== 2) {
        errors.push(`payload.pairs[${pairIndex}].words must contain exactly two words`);
        return;
      }
      pair.words.forEach((word, wordIndex) => {
        const approvedWord = approved.words[wordIndex];
        if (!exactKeys(word, ["id", "label"]) || word.id !== approvedWord.id) errors.push(`payload.pairs[${pairIndex}].words[${wordIndex}] must use the approved word id`);
        validateLocalized(word?.label, `payload.pairs[${pairIndex}].words[${wordIndex}].label`, errors);
        if (["en", "pt"].some((locale) => word?.label?.[locale] !== approvedWord.label[locale])) errors.push(`payload.pairs[${pairIndex}].words[${wordIndex}] must use the approved label`);
      });
    });
  }
  if (!isRecord(layoutOverrides) || Object.keys(layoutOverrides).length) errors.push("B13 does not accept layout overrides");
  return { ok: errors.length === 0, errors };
}

function positionsFor(order) {
  const points = [
    { x: 92, y: 76 }, { x: 268, y: 76 },
    { x: 92, y: 174 }, { x: 268, y: 174 },
    { x: 92, y: 272 }, { x: 268, y: 272 },
  ];
  return Object.fromEntries(order.map((id, index) => [id, points[index]]));
}

function setStatus(scene, message) {
  scene.b13State.status = { ...message };
  scene.accessibleStatus = { ...message };
}

export const b13MatchingPairsEngine = Object.freeze({
  validate(payload, instance) {
    return validatePayload(payload, instance?.layoutOverrides);
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const locale = language === "pt" ? "pt" : "en";
    const labels = new Map(B13_WORDS.map((word) => [word.id, word.label]));

    class MatchingPairsScene extends Phaser.Scene {
      constructor() {
        super({ key: `b13-pairs-${instance.id}` });
        this.b13State = createB13State(instance.seed);
        this.accessibleStatus = { ...this.b13State.status };
        this.wordViews = new Map();
        this.draggedId = null;
        this.reducedMotion = Boolean(reducedMotion);
      }

      create() {
        this.lineGraphics = this.add.graphics();
        this.add.text(180, 18, locale === "pt" ? "Encontre os três pares" : "Find the three pairs", {
          color: "#6f6a61", fontFamily: "Fira Sans", fontSize: "13px", fontStyle: "600", align: "center",
        }).setOrigin(0.5);
        for (const wordId of this.b13State.order) this.createWord(wordId);
        this.input.on("dragstart", (_pointer, container) => {
          if (this.isUnavailable(container.name)) return;
          container.setData("b13DragOrigin", { x: container.x, y: container.y });
          container.setData("b13SuppressTap", false);
          this.draggedId = null;
        });
        this.input.on("drag", (_pointer, container, x, y) => {
          const origin = container.getData("b13DragOrigin");
          if (!origin || Phaser.Math.Distance.Between(origin.x, origin.y, x, y) < 7) return;
          if (!this.draggedId) {
            this.draggedId = container.name;
            container.setData("b13SuppressTap", true);
            this.b13State.selectedId = container.name;
            container.setDepth(10).setAlpha(this.reducedMotion ? 1 : 0.84);
            this.redraw();
          }
          if (this.draggedId === container.name) container.setPosition(x, y);
        });
        this.input.on("dragend", (_pointer, container) => {
          if (this.draggedId !== container.name) {
            this.redraw();
            return;
          }
          const target = [...this.wordViews.values()]
            .filter(({ container: candidate }) => candidate.name !== container.name && !this.isUnavailable(candidate.name))
            .map(({ container: candidate }) => ({ id: candidate.name, distance: Phaser.Math.Distance.Between(container.x, container.y, candidate.x, candidate.y) }))
            .sort((a, b) => a.distance - b.distance)[0];
          this.draggedId = null;
          if (target && target.distance <= 82) this.choose(target.id);
          else {
            this.b13State.selectedId = null;
            this.b13State.invalidMoves += 1;
            setStatus(this, localized("Drop the word on another word tile.", "Solte a palavra sobre outra palavra."));
            this.redraw();
            this.notify();
          }
        });
        this.keyboardHandler = (event) => {
          if (this.b13State.revealSolution || this.b13State.completed) return;
          const available = this.b13State.order.filter((id) => !this.isUnavailable(id));
          if (!available.length) return;
          const current = available.indexOf(this.b13State.focusedId);
          if (["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            const offset = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
            this.b13State.focusedId = available[(current + offset + available.length) % available.length];
            this.redraw();
            this.notify();
          } else if (["Enter", " "].includes(event.key)) {
            event.preventDefault();
            this.choose(this.b13State.focusedId || available[0]);
          } else if (event.key === "Escape") {
            this.b13State.selectedId = null;
            setStatus(this, localized("Selection cleared.", "Seleção cancelada."));
            this.redraw();
            this.notify();
          }
        };
        this.game.canvas.addEventListener("keydown", this.keyboardHandler);
        this.redraw();
        onReady(this);
      }

      createWord(wordId) {
        const label = labels.get(wordId)[locale];
        const background = this.add.rectangle(0, 0, 148, 62, 0xffffff, 1).setStrokeStyle(1.5, 0x22201d, 1);
        const text = this.add.text(0, 0, label, {
          color: "#22201d", fontFamily: "Fira Sans", fontSize: "17px", fontStyle: "600", align: "center",
        }).setOrigin(0.5);
        const container = this.add.container(0, 0, [background, text]).setSize(152, 66).setInteractive({ cursor: "grab" });
        container.name = wordId;
        container.on("pointerup", () => {
          if (container.getData("b13SuppressTap")) {
            container.setData("b13SuppressTap", false);
            return;
          }
          this.choose(wordId);
        });
        this.input.setDraggable(container);
        this.wordViews.set(wordId, { container, background, text });
      }

      isUnavailable(wordId) {
        const word = wordById(wordId);
        return !word || this.b13State.revealSolution || this.b13State.matchedPairIds.includes(word.pairId);
      }

      choose(wordId) {
        this.b13State = chooseB13Word(this.b13State, wordId);
        this.accessibleStatus = { ...this.b13State.status };
        this.redraw();
        this.notify();
      }

      notify() {
        onStateChange(this);
      }

      setLocked(locked) {
        if (locked) this.b13State.revealSolution = true;
        this.redraw();
      }

      revealSolution() {
        this.b13State.revealSolution = true;
        this.b13State.selectedId = null;
        this.redraw();
      }

      redraw() {
        if (!this.lineGraphics) return;
        const positions = positionsFor(this.b13State.order);
        this.lineGraphics.clear();
        const shownPairs = this.b13State.revealSolution ? PAIR_IDS : this.b13State.matchedPairIds;
        for (const pair of B13_PAIRS) {
          if (!shownPairs.includes(pair.id)) continue;
          const first = positions[pair.words[0].id];
          const second = positions[pair.words[1].id];
          this.lineGraphics.lineStyle(4, 0xd60056, this.b13State.revealSolution && !this.b13State.matchedPairIds.includes(pair.id) ? 0.42 : 0.86);
          this.lineGraphics.lineBetween(first.x, first.y, second.x, second.y);
        }
        for (const word of B13_WORDS) {
          const view = this.wordViews.get(word.id);
          const position = positions[word.id];
          if (!view || (this.draggedId === word.id)) continue;
          view.container.setPosition(position.x, position.y).setDepth(3).setAlpha(1);
          const matched = shownPairs.includes(word.pairId);
          const selected = this.b13State.selectedId === word.id;
          const focused = this.b13State.focusedId === word.id;
          view.background.setFillStyle(matched ? 0xf7e4eb : 0xffffff, 1);
          view.background.setStrokeStyle(selected ? 3 : focused ? 2.5 : 1.5, selected || focused ? 0xd60056 : 0x22201d, 1);
          view.text.setColor(matched ? "#8f003a" : "#22201d");
        }
      }
    }

    return new MatchingPairsScene();
  },

  serializeState(scene) {
    return clone(scene?.b13State || null);
  },

  restoreState(scene, savedState, instance) {
    scene.b13State = restoreB13State(savedState, instance.seed);
    scene.accessibleStatus = { ...scene.b13State.status };
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const analysis = analyzeB13State(scene.b13State);
    if (analysis.correct || instance.mode === "mission") {
      scene.b13State.completed = true;
      scene.b13State.revealSolution = true;
      scene.b13State.selectedId = null;
      scene.accessibleStatus = localized("", "");
      scene.redraw?.();
    }
    if (analysis.correct) {
      return {
        correct: true,
        complete: true,
        feedback: localized(
          "Three pairs: body and soul, dignity and freedom, gift and covenant.",
          "Três pares: corpo e alma, dignidade e liberdade, dom e aliança.",
        ),
      };
    }
    return {
      correct: false,
      complete: false,
      feedback: localized(
        `${analysis.matchedCount} of 3 pairs are complete. Match all three before checking.`,
        `${analysis.matchedCount} de 3 pares estão completos. Forme os três pares antes de verificar.`,
      ),
    };
  },

  getAccessibleActions(scene) {
    if (!scene || scene.b13State.completed || scene.b13State.revealSolution) return [];
    return scene.b13State.order
      .filter((id) => !scene.isUnavailable?.(id))
      .map((id) => ({
        id: `choose-${id}`,
        label: wordById(id).label,
        run: () => scene.choose(id),
      }));
  },

  showHint() {
    return localized(
      "Look for words that describe one human reality or one free act of love.",
      "Procure palavras que descrevem uma realidade humana ou um ato livre de amor.",
    );
  },

  destroy(scene) {
    if (!scene) return;
    if (scene.keyboardHandler && scene.game?.canvas) scene.game.canvas.removeEventListener("keydown", scene.keyboardHandler);
    scene.wordViews?.forEach(({ container }) => container.removeAllListeners());
    scene.input?.removeAllListeners();
  },
});
