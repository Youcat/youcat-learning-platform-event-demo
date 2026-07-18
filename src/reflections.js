export function isResolvedReflectionStatus(status) {
  return status === "submitted" || status === "declined";
}

export const REFLECTION_BOARD_UNLOCK_RATIO = 0.5;

export function calculateReflectionBoardEligibility(summaries = [], existingUnlocked = {}) {
  const activeGroups = summaries.filter((group) => Number(group.participants || 0) >= 2);
  const eligibleCount = activeGroups.reduce((total, group) => total + Number(group.members || 0), 0);
  const questionKeys = new Set(Object.keys(existingUnlocked || {}));
  activeGroups.forEach((group) => {
    Object.keys(group.reflectionResolved || {}).forEach((key) => questionKeys.add(String(key)));
  });

  const resolved = {};
  const eligibleParticipantCount = {};
  const unlocked = { ...(existingUnlocked || {}) };
  questionKeys.forEach((key) => {
    resolved[key] = activeGroups.reduce(
      (total, group) => total + Number(group.reflectionResolved?.[key] || 0),
      0,
    );
    eligibleParticipantCount[key] = eligibleCount;
    if (eligibleCount > 0 && resolved[key] / eligibleCount >= REFLECTION_BOARD_UNLOCK_RATIO) unlocked[key] = true;
  });

  return { resolved, eligibleParticipantCount, unlocked };
}
