import { assertGameInstance } from "./contracts.js";

export const MINIGAME_LAUNCH_EVENT = "youcat:minigame:launch";
export const MINIGAME_RESULT_EVENT = "youcat:minigame:result";

export function emitMissionGameLaunch(instance) {
  assertGameInstance(instance);
  if (instance.mode !== "mission") throw new TypeError("Mission launcher requires mode=mission");
  window.dispatchEvent(new CustomEvent(MINIGAME_LAUNCH_EVENT, { detail: { instance } }));
}

export function onMissionGameLaunch(handler) {
  const listener = (event) => handler(event.detail.instance);
  window.addEventListener(MINIGAME_LAUNCH_EVENT, listener);
  return () => window.removeEventListener(MINIGAME_LAUNCH_EVENT, listener);
}

export function emitMissionGameResult(result) {
  window.dispatchEvent(new CustomEvent(MINIGAME_RESULT_EVENT, { detail: { result } }));
}

export function missionGameInstanceFrom({ mission, definition }) {
  return assertGameInstance({
    ...definition,
    id: `${mission.groupCode}:${mission.id}`,
    questionNumber: Number(mission.questionNumber),
    missionSlot: Number(mission.challengeIndex),
    mode: "mission",
    xp: Number(mission.xp) || 0,
  });
}
