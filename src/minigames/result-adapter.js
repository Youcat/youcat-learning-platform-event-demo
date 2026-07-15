export const MINIGAME_RESULT_VERSION = 1;

export function createMinigameResult(instance, evaluation, { hintsUsed = 0 } = {}) {
  return Object.freeze({
    version: MINIGAME_RESULT_VERSION,
    instanceId: instance.id,
    questionNumber: instance.questionNumber,
    missionSlot: instance.missionSlot,
    engineId: instance.engineId,
    engineVersion: instance.engineVersion,
    mode: instance.mode,
    correct: Boolean(evaluation?.correct),
    complete: Boolean(evaluation?.complete),
    xpAwarded: evaluation?.correct && evaluation?.complete ? instance.xp : 0,
    hintsUsed: Math.max(0, Number(hintsUsed) || 0),
    submittedAt: new Date().toISOString(),
  });
}

export function createResultAdapter({ onLabResult = () => {}, onMissionResult = () => {} } = {}) {
  return async function adaptResult(instance, evaluation, meta) {
    const result = createMinigameResult(instance, evaluation, meta);
    if (instance.mode === "mission") await onMissionResult(result);
    else await onLabResult(result);
    return result;
  };
}
