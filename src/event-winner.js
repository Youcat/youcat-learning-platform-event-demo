import { isResolvedReflectionStatus } from "./reflections.js";

export function isGroupJourneyComplete({ members, group, challengeIds, questions }) {
  const activeMembers = (members || []).filter((member) => member.active !== false);
  if (activeMembers.length < 2) return false;

  const challengesComplete = challengeIds.every((id) =>
    ["completed", "skipped"].includes(group?.challenges?.[id]?.status));
  if (!challengesComplete) return false;

  return activeMembers.every((member) => questions.every((questionNumber) => {
    const key = String(questionNumber);
    return isResolvedReflectionStatus(member.reflectionStatus?.[key])
      && member.boardCompleted?.[key] === true;
  }));
}
