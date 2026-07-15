function localized(en, pt) {
  return { en, pt };
}

function clamp(value) {
  return Math.max(0.08, Math.min(0.92, value));
}

function validPoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

export const skeletonEngine = Object.freeze({
  validate(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object") errors.push("payload must be an object");
    if (!validPoint(payload?.start)) errors.push("payload.start must be a normalized {x, y} point");
    if (!validPoint(payload?.target)) errors.push("payload.target must be a normalized {x, y} point");
    if (!Number.isFinite(payload?.tolerance) || payload.tolerance <= 0 || payload.tolerance > 0.25) errors.push("payload.tolerance must be greater than 0 and at most 0.25");
    return { ok: errors.length === 0, errors };
  },

  createScene({ Phaser, instance, reducedMotion, onStateChange, onReady }) {
    const start = { ...instance.payload.start };

    class FoundationSkeletonScene extends Phaser.Scene {
      constructor() {
        super({ key: `skeleton-${instance.id}` });
        this.foundationInitialState = { marker: { ...start }, selected: false, hintLevel: 0 };
        this.foundationState = { marker: { ...start }, selected: false, hintLevel: 0 };
      }

      create() {
        this.graphics = this.add.graphics();
        this.markerZone = this.add.zone(0, 0, 52, 52).setInteractive({ cursor: "grab" });
        this.input.setDraggable(this.markerZone);
        this.markerZone.on("drag", (_pointer, x, y) => this.moveMarker(x / this.scale.width, y / this.scale.height));
        this.markerZone.on("pointerdown", (pointer) => {
          const marker = this.foundationState.marker;
          const markerX = marker.x * this.scale.width;
          const markerY = marker.y * this.scale.height;
          if (Math.hypot(pointer.x - markerX, pointer.y - markerY) <= 34) {
            this.foundationState.selected = !this.foundationState.selected;
            this.redraw();
            this.notify();
          }
        });
        this.input.on("pointerdown", (pointer, over) => {
          if (over.length || !this.foundationState.selected) return;
          this.foundationState.selected = false;
          this.moveMarker(pointer.x / this.scale.width, pointer.y / this.scale.height);
        });
        this.cursors = this.input.keyboard.createCursorKeys();
        this.selectKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.input.keyboard.on("keydown-SPACE", (event) => {
          event.preventDefault();
          this.toggleSelection();
        });
        this.input.keyboard.on("keydown-LEFT", () => this.nudge(-0.025, 0));
        this.input.keyboard.on("keydown-RIGHT", () => this.nudge(0.025, 0));
        this.input.keyboard.on("keydown-UP", () => this.nudge(0, -0.025));
        this.input.keyboard.on("keydown-DOWN", () => this.nudge(0, 0.025));
        this.redraw();
        onReady(this);
      }

      moveMarker(x, y) {
        this.foundationState.marker = { x: clamp(x), y: clamp(y) };
        this.redraw();
        this.notify();
      }

      nudge(dx, dy) {
        const { x, y } = this.foundationState.marker;
        this.moveMarker(x + dx, y + dy);
      }

      toggleSelection() {
        this.foundationState.selected = !this.foundationState.selected;
        this.redraw();
        this.notify();
      }

      notify() {
        onStateChange(this);
      }

      redraw() {
        if (!this.graphics) return;
        const width = this.scale.width;
        const height = this.scale.height;
        const target = instance.payload.target;
        const marker = this.foundationState.marker;
        this.graphics.clear();
        this.graphics.lineStyle(3, 0x22201d, 1);
        this.graphics.strokeCircle(target.x * width, target.y * height, 29);
        this.graphics.lineStyle(1, 0x22201d, 0.45);
        this.graphics.strokeCircle(target.x * width, target.y * height, 38);
        if (this.foundationState.hintLevel > 0) {
          this.graphics.lineStyle(3, 0xd60056, reducedMotion ? 0.45 : 0.7);
          this.graphics.lineBetween(marker.x * width, marker.y * height, target.x * width, target.y * height);
        }
        this.graphics.fillStyle(0xd60056, 1);
        this.graphics.fillCircle(marker.x * width, marker.y * height, 20);
        this.graphics.lineStyle(this.foundationState.selected ? 5 : 2, 0x151515, 1);
        this.graphics.strokeCircle(marker.x * width, marker.y * height, this.foundationState.selected ? 24 : 21);
        this.markerZone?.setPosition(marker.x * width, marker.y * height);
      }
    }

    return new FoundationSkeletonScene();
  },

  serializeState(scene) {
    return JSON.parse(JSON.stringify(scene?.foundationState || null));
  },

  restoreState(scene, savedState) {
    const start = scene?.foundationInitialState?.marker || scene?.foundationState?.marker;
    const marker = validPoint(savedState?.marker) ? savedState.marker : start;
    scene.foundationState = {
      marker: { ...marker },
      selected: Boolean(savedState?.selected),
      hintLevel: Math.max(0, Math.min(2, Number(savedState?.hintLevel) || 0)),
    };
    scene.redraw?.();
  },

  evaluate(scene, instance) {
    const marker = scene.foundationState.marker;
    const target = instance.payload.target;
    const correct = Math.hypot(marker.x - target.x, marker.y - target.y) <= instance.payload.tolerance;
    return {
      correct,
      complete: correct,
      feedback: correct
        ? localized("The shared foundation responded correctly.", "A fundação compartilhada respondeu corretamente.")
        : localized("Move the marker fully inside the target and check again.", "Mova o marcador completamente para dentro do alvo e verifique novamente."),
    };
  },

  getAccessibleActions(scene) {
    if (!scene) return [];
    return [
      { id: "select", label: localized("Select marker", "Selecionar marcador"), run: () => scene.toggleSelection() },
      { id: "left", label: localized("Move left", "Mover para a esquerda"), run: () => scene.nudge(-0.04, 0) },
      { id: "up", label: localized("Move up", "Mover para cima"), run: () => scene.nudge(0, -0.04) },
      { id: "down", label: localized("Move down", "Mover para baixo"), run: () => scene.nudge(0, 0.04) },
      { id: "right", label: localized("Move right", "Mover para a direita"), run: () => scene.nudge(0.04, 0) },
    ];
  },

  showHint(scene, hintIndex, instance) {
    scene.foundationState.hintLevel = Math.max(scene.foundationState.hintLevel, hintIndex + 1);
    if (hintIndex === 1) {
      const marker = scene.foundationState.marker;
      const target = instance.payload.target;
      scene.foundationState.marker = { x: (marker.x + target.x) / 2, y: (marker.y + target.y) / 2 };
    }
    scene.redraw();
    scene.notify();
    return hintIndex === 0
      ? localized("Follow the red guide toward the graphite rings.", "Siga a guia vermelha em direção aos anéis de grafite.")
      : localized("The marker moved halfway toward the target.", "O marcador avançou até a metade do caminho para o alvo.");
  },

  destroy(scene) {
    scene?.input?.keyboard?.removeAllListeners();
    scene?.input?.removeAllListeners();
  },
});
