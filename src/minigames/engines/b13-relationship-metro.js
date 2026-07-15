export const B13_ENGINE_ID = "B13";
export const B13_ENGINE_VERSION = "1.0.0";

const localized = (en, pt) => ({ en, pt });
const jsonClone = (value) => JSON.parse(JSON.stringify(value));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export const B13_CONCEPTS = Object.freeze([
  Object.freeze({ id: "body", label: Object.freeze(localized("Body", "Corpo")) }),
  Object.freeze({ id: "soul", label: Object.freeze(localized("Soul", "Alma")) }),
  Object.freeze({ id: "dignity", label: Object.freeze(localized("Dignity", "Dignidade")) }),
  Object.freeze({ id: "gift", label: Object.freeze(localized("Gift", "Dom")) }),
  Object.freeze({ id: "freedom", label: Object.freeze(localized("Freedom", "Liberdade")) }),
  Object.freeze({ id: "covenant", label: Object.freeze(localized("Covenant", "Aliança")) }),
]);

export const B13_STATIONS = Object.freeze([
  Object.freeze({ id: "upper-start", x: 0.12, y: 0.21, label: Object.freeze(localized("upper start", "início superior")) }),
  Object.freeze({ id: "lower-start", x: 0.12, y: 0.51, label: Object.freeze(localized("lower start", "início inferior")) }),
  Object.freeze({ id: "first-transfer", x: 0.37, y: 0.36, label: Object.freeze(localized("first transfer", "primeira conexão")) }),
  Object.freeze({ id: "upper-branch", x: 0.62, y: 0.21, label: Object.freeze(localized("upper branch", "ramal superior")) }),
  Object.freeze({ id: "lower-branch", x: 0.62, y: 0.51, label: Object.freeze(localized("lower branch", "ramal inferior")) }),
  Object.freeze({ id: "last-transfer", x: 0.87, y: 0.36, label: Object.freeze(localized("last transfer", "última conexão")) }),
]);

export const B13_SOLUTION = Object.freeze({
  "upper-start": "body",
  "lower-start": "soul",
  "first-transfer": "dignity",
  "upper-branch": "gift",
  "lower-branch": "freedom",
  "last-transfer": "covenant",
});

export const B13_ROUTES = Object.freeze([
  Object.freeze({ id: "embodied-gift", stationIds: Object.freeze(["upper-start", "first-transfer", "upper-branch", "last-transfer"]) }),
  Object.freeze({ id: "free-covenant", stationIds: Object.freeze(["lower-start", "first-transfer", "lower-branch", "last-transfer"]) }),
]);

function seedRandom(seed) {
  let value = 2166136261;
  for (const char of String(seed)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateB13Tray(seed) {
  const random = seedRandom(seed);
  const ids = B13_CONCEPTS.map(({ id }) => id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  if (ids.every((id, index) => id === Object.values(B13_SOLUTION)[index])) {
    [ids[0], ids[1]] = [ids[1], ids[0]];
  }
  return ids;
}

function emptyAssignments() {
  return Object.fromEntries(B13_STATIONS.map(({ id }) => [id, null]));
}

export function createB13State(seed) {
  return {
    schemaVersion: 1,
    trayOrder: generateB13Tray(seed),
    assignments: emptyAssignments(),
    selectedTokenId: null,
    hintLevel: 0,
    moves: 0,
    invalidMoves: 0,
    completed: false,
    revealSolution: false,
    status: localized("Choose a concept, then a station.", "Escolha um conceito e depois uma estação."),
  };
}

function conceptIds() {
  return new Set(B13_CONCEPTS.map(({ id }) => id));
}

function stationIds() {
  return new Set(B13_STATIONS.map(({ id }) => id));
}

function validAssignments(assignments) {
  if (!hasExactKeys(assignments, B13_STATIONS.map(({ id }) => id))) return false;
  const placed = Object.values(assignments).filter(Boolean);
  return placed.every((id) => conceptIds().has(id)) && new Set(placed).size === placed.length;
}

export function restoreB13State(savedState, seed) {
  const clean = createB13State(seed);
  if (!isRecord(savedState) || !validAssignments(savedState.assignments)) return clean;
  const selectedTokenId = conceptIds().has(savedState.selectedTokenId) ? savedState.selectedTokenId : null;
  const trayOrder = Array.isArray(savedState.trayOrder)
    && savedState.trayOrder.length === B13_CONCEPTS.length
    && savedState.trayOrder.every((id) => conceptIds().has(id))
    && new Set(savedState.trayOrder).size === B13_CONCEPTS.length
    ? [...savedState.trayOrder]
    : clean.trayOrder;
  return {
    schemaVersion: 1,
    trayOrder,
    assignments: { ...savedState.assignments },
    selectedTokenId,
    hintLevel: Math.max(0, Math.min(2, Number(savedState.hintLevel) || 0)),
    moves: Math.max(0, Math.floor(Number(savedState.moves) || 0)),
    invalidMoves: Math.max(0, Math.floor(Number(savedState.invalidMoves) || 0)),
    completed: Boolean(savedState.completed),
    revealSolution: Boolean(savedState.revealSolution),
    status: hasExactKeys(savedState.status, ["en", "pt"])
      && typeof savedState.status.en === "string"
      && typeof savedState.status.pt === "string"
      ? { ...savedState.status }
      : clean.status,
  };
}

function slotForConcept(assignments, tokenId) {
  return Object.entries(assignments).find(([, conceptId]) => conceptId === tokenId)?.[0] || null;
}

export function placeB13Token(state, tokenId, targetStationId) {
  if (!conceptIds().has(tokenId) || !stationIds().has(targetStationId) || state.completed) {
    return {
      ...state,
      invalidMoves: state.invalidMoves + 1,
      status: localized("That move is not available. Your map is unchanged.", "Esse movimento não está disponível. Seu mapa não mudou."),
    };
  }
  const assignments = { ...state.assignments };
  const sourceStationId = slotForConcept(assignments, tokenId);
  const displacedTokenId = assignments[targetStationId];
  if (sourceStationId === targetStationId) {
    return {
      ...state,
      selectedTokenId: null,
      invalidMoves: state.invalidMoves + 1,
      status: localized("That concept is already at this station.", "Esse conceito já está nesta estação."),
    };
  }
  if (sourceStationId) assignments[sourceStationId] = displacedTokenId || null;
  assignments[targetStationId] = tokenId;
  return {
    ...state,
    assignments,
    selectedTokenId: null,
    moves: state.moves + 1,
    status: displacedTokenId && !sourceStationId
      ? localized("Placed. The previous concept returned to the tray.", "Posicionado. O conceito anterior voltou à bandeja.")
      : localized("Concept placed. You can still move it before checking.", "Conceito posicionado. Você ainda pode movê-lo antes de verificar."),
  };
}

export function analyzeB13State(state) {
  const assignments = validAssignments(state?.assignments) ? state.assignments : emptyAssignments();
  const correctStationIds = B13_STATIONS
    .map(({ id }) => id)
    .filter((stationId) => assignments[stationId] === B13_SOLUTION[stationId]);
  const filled = Object.values(assignments).filter(Boolean).length;
  const routeScores = Object.fromEntries(B13_ROUTES.map((route) => [
    route.id,
    route.stationIds.filter((stationId) => assignments[stationId] === B13_SOLUTION[stationId]).length,
  ]));
  return {
    filled,
    correctCount: correctStationIds.length,
    correctStationIds,
    transferCorrect: ["first-transfer", "last-transfer"].filter((id) => correctStationIds.includes(id)).length,
    routeScores,
    correct: correctStationIds.length === B13_STATIONS.length,
  };
}

function labelFor(tokenId, locale) {
  return B13_CONCEPTS.find(({ id }) => id === tokenId)?.label?.[locale] || tokenId;
}

function validateLocalized(value, path, errors) {
  if (!hasExactKeys(value, ["en", "pt"]) || ["en", "pt"].some((locale) => typeof value[locale] !== "string" || !value[locale].trim())) {
    errors.push(`${path} must contain exactly non-empty {en, pt}`);
  }
}

function validatePayload(payload, layoutOverrides) {
  const errors = [];
  if (!hasExactKeys(payload, ["schemaVersion", "concepts", "stations", "routes", "solution"])) {
    errors.push("payload must contain exactly schemaVersion, concepts, stations, routes, and solution");
  }
  if (payload?.schemaVersion !== 1) errors.push("payload.schemaVersion must be 1");
  if (!Array.isArray(payload?.concepts) || payload.concepts.length !== B13_CONCEPTS.length) {
    errors.push("payload.concepts must contain six concepts");
  } else {
    payload.concepts.forEach((concept, index) => {
      if (!hasExactKeys(concept, ["id", "label"])) errors.push(`payload.concepts[${index}] must contain exactly id and label`);
      validateLocalized(concept?.label, `payload.concepts[${index}].label`, errors);
    });
    if (payload.concepts.map(({ id }) => id).join("|") !== B13_CONCEPTS.map(({ id }) => id).join("|")) errors.push("payload.concepts must use the approved B13 concept ids");
    payload.concepts.forEach((concept, index) => {
      if (["en", "pt"].some((locale) => concept?.label?.[locale] !== B13_CONCEPTS[index].label[locale])) {
        errors.push(`payload.concepts[${index}] must use the approved B13 label`);
      }
    });
  }
  if (!Array.isArray(payload?.stations) || payload.stations.length !== B13_STATIONS.length) {
    errors.push("payload.stations must contain six stations");
  } else {
    payload.stations.forEach((station, index) => {
      const expected = B13_STATIONS[index];
      if (!hasExactKeys(station, ["id", "x", "y", "label"])) errors.push(`payload.stations[${index}] must contain exactly id, x, y, and label`);
      validateLocalized(station?.label, `payload.stations[${index}].label`, errors);
      if (station?.id !== expected.id || station?.x !== expected.x || station?.y !== expected.y
        || ["en", "pt"].some((locale) => station?.label?.[locale] !== expected.label[locale])) {
        errors.push(`payload.stations[${index}] must match the approved B13 station`);
      }
    });
  }
  if (!Array.isArray(payload?.routes) || payload.routes.length !== B13_ROUTES.length) {
    errors.push("payload.routes must contain two approved routes");
  } else {
    payload.routes.forEach((route, index) => {
      const expected = B13_ROUTES[index];
      if (!hasExactKeys(route, ["id", "stationIds"])) errors.push(`payload.routes[${index}] must contain exactly id and stationIds`);
      if (route?.id !== expected.id || !Array.isArray(route.stationIds) || route.stationIds.join("|") !== expected.stationIds.join("|")) {
        errors.push(`payload.routes[${index}] must match the approved B13 route`);
      }
    });
  }
  if (!hasExactKeys(payload?.solution, B13_STATIONS.map(({ id }) => id))
    || Object.entries(B13_SOLUTION).some(([stationId, tokenId]) => payload.solution?.[stationId] !== tokenId)) {
    errors.push("payload.solution must match the approved B13 route map");
  }
  if (!isRecord(layoutOverrides) || Object.keys(layoutOverrides).some((key) => key !== "stationScale")) {
    errors.push("layoutOverrides may only contain stationScale");
  }
  if (layoutOverrides?.stationScale !== undefined
    && (!Number.isFinite(layoutOverrides.stationScale) || layoutOverrides.stationScale < 0.85 || layoutOverrides.stationScale > 1.1)) {
    errors.push("layoutOverrides.stationScale must be from 0.85 to 1.1");
  }
  return { ok: errors.length === 0, errors };
}

function sceneStatus(scene, message) {
  scene.accessibleStatus = { ...message };
  scene.b13State.status = { ...message };
}

function pointForStation(station, width, height) {
  return { x: station.x * width, y: station.y * height };
}

export const b13RelationshipMetroEngine = Object.freeze({
  validate(payload, instance) {
    return validatePayload(payload, instance?.layoutOverrides);
  },

  createScene({ Phaser, instance, language, reducedMotion, onStateChange, onReady }) {
    const locale = language === "pt" ? "pt" : "en";
    const conceptById = new Map(instance.payload.concepts.map((concept) => [concept.id, concept]));
    const stationById = new Map(B13_STATIONS.map((station) => [station.id, station]));

    class RelationshipMetroScene extends Phaser.Scene {
      constructor() {
        super({ key: `b13-${instance.id}` });
        this.b13InitialState = createB13State(instance.seed);
        this.b13State = jsonClone(this.b13InitialState);
        this.accessibleStatus = { ...this.b13State.status };
        this.tokenViews = new Map();
        this.stationZones = new Map();
        this.reducedMotion = Boolean(reducedMotion);
      }

      preload() {
        if (instance.assets.baseImage) this.load.image("b13-completion-art", instance.assets.baseImage);
      }

      create() {
        this.mapGraphics = this.add.graphics();
        this.stationGraphics = this.add.graphics();
        this.labels = this.add.group();
        this.add.text(16, 7, locale === "pt" ? "Duas linhas, duas conexões" : "Two lines, two transfers", {
          color: "#6f6a61", fontFamily: "Fira Sans", fontSize: "13px", fontStyle: "600",
        });
        for (const station of B13_STATIONS) {
          const point = pointForStation(station, this.scale.width, this.scale.height);
          const zone = this.add.zone(point.x, point.y, 88, 46).setInteractive({ cursor: "pointer" });
          zone.on("pointerdown", () => this.placeSelected(station.id));
          this.stationZones.set(station.id, zone);
        }
        for (const concept of instance.payload.concepts) this.createToken(concept);
        if (this.textures.exists("b13-completion-art")) {
          this.completionArt = this.add.image(302, 294, "b13-completion-art").setDisplaySize(88, 88).setVisible(false);
        }
        this.input.on("dragstart", (_pointer, token) => {
          token.setData("b13DragOrigin", { x: token.x, y: token.y });
          token.setData("b13DidDrag", false);
          token.setDepth(10).setAlpha(this.reducedMotion ? 1 : 0.82);
        });
        this.input.on("drag", (_pointer, token, dragX, dragY) => {
          const origin = token.getData("b13DragOrigin");
          if (origin && Phaser.Math.Distance.Between(origin.x, origin.y, dragX, dragY) > 6) {
            token.setData("b13DidDrag", true);
            this.b13State.selectedTokenId = token.name;
          }
          token.setPosition(dragX, dragY);
        });
        this.input.on("dragend", (_pointer, token) => {
          token.setDepth(5).setAlpha(1);
          if (!token.getData("b13DidDrag")) {
            this.redraw();
            return;
          }
          const closest = B13_STATIONS
            .map((station) => ({ station, distance: Phaser.Math.Distance.Between(token.x, token.y, station.x * this.scale.width, station.y * this.scale.height) }))
            .sort((a, b) => a.distance - b.distance)[0];
          if (!closest || closest.distance > 54) this.rejectMove();
          else this.placeToken(token.name, closest.station.id);
        });
        this.redraw();
        onReady(this);
      }

      createToken(concept) {
        const background = this.add.rectangle(0, 0, 98, 38, 0xffffff, 1).setStrokeStyle(1.5, 0x22201d, 1);
        const text = this.add.text(0, 0, concept.label[locale], {
          color: "#22201d", fontFamily: "Fira Sans", fontSize: locale === "pt" && concept.id === "dignity" ? "12px" : "13px", fontStyle: "600", align: "center",
        }).setOrigin(0.5);
        const token = this.add.container(0, 0, [background, text]).setSize(102, 44).setInteractive({ cursor: "grab" });
        token.name = concept.id;
        token.setDepth(5);
        this.input.setDraggable(token);
        token.on("pointerdown", () => {
          const selected = this.b13State.selectedTokenId;
          const targetSlot = slotForConcept(this.b13State.assignments, concept.id);
          if (selected && selected !== concept.id && targetSlot) this.placeToken(selected, targetSlot);
          else this.selectToken(concept.id);
        });
        this.tokenViews.set(concept.id, { token, background, text });
      }

      selectToken(tokenId) {
        if (this.b13State.completed) return this.rejectMove();
        this.b13State.selectedTokenId = this.b13State.selectedTokenId === tokenId ? null : tokenId;
        const label = labelFor(tokenId, locale);
        sceneStatus(this, this.b13State.selectedTokenId
          ? localized(`${label} selected. Choose a station.`, `${label} selecionado. Escolha uma estação.`)
          : localized("Selection cleared.", "Seleção cancelada."));
        this.redraw();
        this.notify();
      }

      placeSelected(stationId) {
        if (!this.b13State.selectedTokenId) {
          sceneStatus(this, localized("Choose a concept before choosing a station.", "Escolha um conceito antes de escolher uma estação."));
          this.b13State.invalidMoves += 1;
          this.notify();
          return;
        }
        this.placeToken(this.b13State.selectedTokenId, stationId);
      }

      placeToken(tokenId, stationId) {
        this.b13State = placeB13Token(this.b13State, tokenId, stationId);
        this.accessibleStatus = { ...this.b13State.status };
        this.redraw();
        this.notify();
      }

      rejectMove() {
        this.b13State = {
          ...this.b13State,
          selectedTokenId: null,
          invalidMoves: this.b13State.invalidMoves + 1,
          status: localized("Drop a concept on one of the six station circles.", "Solte o conceito em um dos seis círculos de estação."),
        };
        this.accessibleStatus = { ...this.b13State.status };
        this.redraw();
        this.notify();
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.mapGraphics || !this.stationGraphics) return;
        const width = this.scale.width;
        const height = this.scale.height;
        const shownAssignments = this.b13State.revealSolution ? B13_SOLUTION : this.b13State.assignments;
        const transferHints = this.b13State.hintLevel > 0;
        this.mapGraphics.clear();
        this.stationGraphics.clear();
        const routePoints = B13_ROUTES.map((route) => route.stationIds.map((id) => pointForStation(stationById.get(id), width, height)));
        routePoints.forEach((points, routeIndex) => {
          this.mapGraphics.lineStyle(routeIndex === 0 ? 5 : 3, routeIndex === 0 ? 0xd60056 : 0x22201d, 0.9);
          this.mapGraphics.beginPath();
          this.mapGraphics.moveTo(points[0].x - 4, points[0].y + (routeIndex ? 2 : -2));
          points.slice(1).forEach((point, index) => this.mapGraphics.lineTo(point.x + (index % 2 ? -3 : 2), point.y + (index % 2 ? 2 : -2)));
          this.mapGraphics.strokePath();
        });
        for (const station of B13_STATIONS) {
          const point = pointForStation(station, width, height);
          const isTransfer = ["first-transfer", "last-transfer"].includes(station.id);
          const isHinted = transferHints && isTransfer;
          this.stationGraphics.fillStyle(0xffffff, 1);
          this.stationGraphics.fillCircle(point.x, point.y, isTransfer ? 24 : 21);
          this.stationGraphics.lineStyle(isHinted ? 4 : 2, isHinted ? 0xd60056 : 0x22201d, 1);
          this.stationGraphics.strokeEllipse(point.x, point.y, isTransfer ? 49 : 43, isTransfer ? 45 : 40);
          if (isTransfer) {
            this.stationGraphics.lineStyle(1, 0x22201d, 0.65);
            this.stationGraphics.strokeEllipse(point.x + 2, point.y - 1, 57, 51);
          }
        }
        const assigned = new Set(Object.values(shownAssignments).filter(Boolean));
        const trayIds = this.b13State.trayOrder.filter((id) => !assigned.has(id));
        const trayPositions = [
          { x: 60, y: 267 }, { x: 180, y: 267 }, { x: 300, y: 267 },
          { x: 60, y: 319 }, { x: 180, y: 319 }, { x: 300, y: 319 },
        ];
        for (const concept of instance.payload.concepts) {
          const view = this.tokenViews.get(concept.id);
          const stationId = slotForConcept(shownAssignments, concept.id);
          const station = stationId ? stationById.get(stationId) : null;
          const trayIndex = trayIds.indexOf(concept.id);
          const position = station ? pointForStation(station, width, height) : trayPositions[Math.max(0, trayIndex)];
          view.token.setPosition(position.x, position.y).setVisible(!this.b13State.revealSolution || Boolean(station));
          const selected = this.b13State.selectedTokenId === concept.id;
          view.background.setStrokeStyle(selected ? 3 : 1.5, selected ? 0xd60056 : 0x22201d, 1);
          view.background.setFillStyle(selected ? 0xf7e4eb : 0xffffff, 1);
        }
        this.completionArt?.setVisible(Boolean(this.b13State.revealSolution));
      }
    }

    return new RelationshipMetroScene();
  },

  serializeState(scene) {
    return jsonClone(scene?.b13State || null);
  },

  restoreState(scene, savedState, instance) {
    scene.b13State = restoreB13State(savedState, instance.seed);
    scene.accessibleStatus = scene.b13State.completed ? localized("", "") : { ...scene.b13State.status };
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const analysis = analyzeB13State(scene.b13State);
    if (instance.mode === "mission" || analysis.correct) {
      scene.b13State.completed = true;
      scene.b13State.revealSolution = true;
      scene.b13State.selectedTokenId = null;
      scene.accessibleStatus = localized("", "");
    }
    scene.redraw?.();
    if (analysis.correct) {
      return {
        correct: true,
        complete: true,
        feedback: localized(
          "Route restored: body and soul meet in dignity; gift and freedom lead toward covenant.",
          "Rota reconstruída: corpo e alma se encontram na dignidade; dom e liberdade conduzem à aliança.",
        ),
      };
    }
    if (analysis.filled < B13_STATIONS.length) {
      return {
        correct: false,
        complete: false,
        feedback: localized(
          `Place all six concepts before checking. ${analysis.filled} of 6 are on the map.`,
          `Posicione os seis conceitos antes de verificar. ${analysis.filled} de 6 estão no mapa.`,
        ),
      };
    }
    if (analysis.transferCorrect < 2) {
      return {
        correct: false,
        complete: false,
        feedback: localized(
          "Revisit the shared circles: Dignity is the first transfer and Covenant the last.",
          "Reveja os círculos compartilhados: Dignidade é a primeira conexão e Aliança é a última.",
        ),
      };
    }
    return {
      correct: false,
      complete: false,
      feedback: localized(
        `${analysis.correctCount} of 6 stations follow the approved routes. Revisit the two branches.`,
        `${analysis.correctCount} de 6 estações seguem as rotas aprovadas. Reveja os dois ramais.`,
      ),
    };
  },

  getAccessibleActions(scene) {
    if (!scene || scene.b13State.completed) return [];
    const selected = scene.b13State.selectedTokenId;
    if (!selected) {
      return B13_CONCEPTS.map((concept) => ({
        id: `select-${concept.id}`,
        label: concept.label,
        run: () => scene.selectToken(concept.id),
      }));
    }
    return [
      ...B13_STATIONS.map((station) => ({
        id: `place-${selected}-${station.id}`,
        label: localized(
          `${labelFor(selected, "en")} → ${station.label.en}`,
          `${labelFor(selected, "pt")} → ${station.label.pt}`,
        ),
        run: () => scene.placeToken(selected, station.id),
      })),
      {
        id: "cancel-selection",
        label: localized("Cancel selection", "Cancelar seleção"),
        run: () => scene.selectToken(selected),
      },
    ];
  },

  showHint(scene, hintIndex) {
    const level = Math.max(0, Math.min(1, Number(hintIndex) || 0)) + 1;
    scene.b13State.hintLevel = Math.max(scene.b13State.hintLevel, level);
    if (level === 2 && !scene.b13State.completed) {
      scene.b13State = placeB13Token(scene.b13State, "dignity", "first-transfer");
      scene.b13State = placeB13Token(scene.b13State, "covenant", "last-transfer");
      scene.b13State.hintLevel = 2;
    }
    const message = level === 1
      ? localized(
        "The shared circles are transfers. Dignity comes before Covenant.",
        "Os círculos compartilhados são conexões. Dignidade vem antes de Aliança.",
      )
      : localized(
        "Dignity and Covenant are now placed. Reconstruct each branch between them.",
        "Dignidade e Aliança foram posicionadas. Reconstrua cada ramal entre elas.",
      );
    sceneStatus(scene, message);
    scene.redraw?.();
    scene.notify?.();
    return message;
  },

  destroy(scene) {
    scene?.input?.removeAllListeners();
    scene?.input?.keyboard?.removeAllListeners();
    scene?.tokenViews?.forEach(({ token }) => token.removeAllListeners());
    scene?.stationZones?.forEach((zone) => zone.removeAllListeners());
  },
});
