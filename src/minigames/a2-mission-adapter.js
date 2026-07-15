import { A2_ENGINE_ID, A2_ENGINE_VERSION } from "./fixtures/a2-fixture.js";
import { missionGameInstanceFrom } from "./mission-hooks.js";
import { getA2MissionDefinition, registerA2 } from "./a2-registration.js";
import { launchGameStage } from "./stage-shell.js";

export function isA2Activity(activity) {
  return activity?.type === "minigame"
    && activity.engineId === A2_ENGINE_ID
    && activity.engineVersion === A2_ENGINE_VERSION;
}

export function createA2MissionInstance(mission, activity) {
  if (!isA2Activity(activity)) throw new TypeError("A2 mission adapter received an incompatible activity");
  if (Number(mission?.questionNumber) !== 34 || Number(mission?.challengeIndex) !== 1) {
    throw new TypeError("A2 1.0.0 is registered only for Q34 mission slot 1");
  }
  return missionGameInstanceFrom({ mission, definition: getA2MissionDefinition() });
}

export function createSingleSubmissionAdapter(onResult) {
  let delivered = false;
  return async (result) => {
    if (delivered) return false;
    delivered = true;
    await onResult?.(result);
    return true;
  };
}

export async function launchA2Mission({ mount, mission, activity, language, onResult, onClose }) {
  const instance = createA2MissionInstance(mission, activity);
  const registry = registerA2();
  const deliverResultOnce = createSingleSubmissionAdapter(onResult);
  return launchGameStage({
    mount,
    instance,
    registry,
    language,
    onResult: deliverResultOnce,
    onClose,
  });
}
