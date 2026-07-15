import { b14Engine } from "./engines/b14.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { createMinigameRegistry } from "./registry.js";
import { launchGameStage } from "./stage-shell.js";

export async function launchB14Mission({ mission, definition, language, onResult, onClose }) {
  const instance = missionGameInstanceFrom({ mission, definition });
  const registry = createMinigameRegistry();
  registry.register({ engineId: "B14", engineVersion: "1.0.0", engine: b14Engine, production: true });

  const overlay = document.createElement("div");
  overlay.className = "minigame-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", instance.title[language] || instance.title.en);
  document.body.append(overlay);
  document.body.classList.add("is-minigame-open");

  let stage = null;
  const close = () => {
    stage?.destroy();
    overlay.remove();
    document.body.classList.remove("is-minigame-open");
    onClose?.();
  };

  try {
    stage = await launchGameStage({
      mount: overlay,
      instance,
      registry,
      language,
      onResult,
      onClose: close,
    });
    return Object.freeze({ instance, close });
  } catch (error) {
    overlay.remove();
    document.body.classList.remove("is-minigame-open");
    throw error;
  }
}
