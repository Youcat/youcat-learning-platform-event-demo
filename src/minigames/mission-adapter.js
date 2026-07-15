import { bundledMinigameSource, createAppMinigameRegistry } from "./catalog.js";
import { GameContractError } from "./contracts.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { launchGameStage } from "./stage-shell.js";

export function missionMinigameInstance({ mission, activity }) {
  if (activity?.type !== "minigame" || typeof activity.fixtureId !== "string") {
    throw new GameContractError("Mission activity is not a registered minigame");
  }
  const definition = bundledMinigameSource.get(activity.fixtureId, { mode: "mission" });
  if (!definition) throw new GameContractError(`Missing bundled minigame fixture ${activity.fixtureId}`);
  if (activity.engineId !== definition.engineId || activity.engineVersion !== definition.engineVersion) {
    throw new GameContractError("Mission activity engine registration does not match its bundled fixture");
  }
  return missionGameInstanceFrom({ mission, definition });
}

export function launchMissionMinigame({ mount, mission, activity, language, onResult, onClose }) {
  const instance = missionMinigameInstance({ mission, activity });
  return launchGameStage({
    mount,
    instance,
    registry: createAppMinigameRegistry(),
    language,
    onResult,
    onClose,
  });
}
