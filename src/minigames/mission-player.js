import { createAppMinigameRegistry, fixtureForMissionActivity } from "./catalog.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { launchGameStage } from "./stage-shell.js";

export function missionInstanceForActivity({ mission, activity }) {
  const definition = fixtureForMissionActivity(activity);
  if (!definition) throw new TypeError(`No bundled minigame fixture for ${String(activity?.fixtureId || activity?.definitionId || activity?.engineId || "")}`);
  if (definition.questionNumber !== Number(mission.questionNumber) || definition.missionSlot !== Number(mission.challengeIndex)) {
    throw new TypeError("Mission and bundled minigame slot do not match");
  }
  return missionGameInstanceFrom({ mission, definition });
}

export function applyMissionMinigameResult(interaction, result) {
  if (!interaction || typeof interaction !== "object") throw new TypeError("Mission interaction is required");
  if (interaction.attempted) return { accepted: false, correct: Boolean(interaction.currentCorrect) };
  const correct = Boolean(result?.correct && result?.complete);
  interaction.attempted = true;
  interaction.finished = true;
  interaction.currentCorrect = correct;
  interaction.succeeded = correct;
  interaction.minigameResult = JSON.parse(JSON.stringify(result || null));
  return { accepted: true, correct };
}

export async function startMissionMinigame({ mount, mission, activity, language, onResult, onClose, embedded = false }) {
  const instance = missionInstanceForActivity({ mission, activity });
  return launchGameStage({
    mount,
    instance,
    registry: createAppMinigameRegistry(),
    language,
    onResult,
    onClose,
    embedded,
  });
}
