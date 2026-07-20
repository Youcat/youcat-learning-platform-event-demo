import { isResolvedReflectionStatus } from "./reflections.js";

export const SHARED_CHALLENGE_XP = 509;
export const TEN_MEMBER_TARGET_XP = 1300;
export const TARGET_XP_PER_MEMBER = (TEN_MEMBER_TARGET_XP - SHARED_CHALLENGE_XP) / 10;

export function winnerTargetForMembers(memberCount) {
  const members = Math.max(0, Math.trunc(Number(memberCount) || 0));
  const rawTarget = SHARED_CHALLENGE_XP + TARGET_XP_PER_MEMBER * members;
  return Math.round(rawTarget / 10) * 10;
}

export function aggregateGroupStandings(members = []) {
  const grouped = new Map();
  members.filter((member) => member?.active !== false).forEach((member) => {
    const groupCode = String(member.groupCode || member.currentGroup || "").trim();
    if (!groupCode) return;
    const standing = grouped.get(groupCode) || {
      groupCode,
      totalXp: 0,
      members: 0,
      participants: 0,
    };
    const xp = Math.max(0, Number(member.groupXp || 0));
    standing.members += 1;
    standing.totalXp += xp;
    if (xp > 0) standing.participants += 1;
    grouped.set(groupCode, standing);
  });

  return [...grouped.values()]
    .filter((standing) => standing.participants >= 2)
    .map((standing) => ({
      ...standing,
      targetXp: winnerTargetForMembers(standing.members),
      averageXp: standing.members ? Math.round(standing.totalXp / standing.members) : 0,
    }))
    .sort((a, b) => b.totalXp - a.totalXp || a.groupCode.localeCompare(b.groupCode));
}

export function isStandingWinnerEligible(standing) {
  return Boolean(standing)
    && Number(standing.participants || 0) >= 2
    && Number(standing.totalXp || 0) >= Number(standing.targetXp || Infinity);
}

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
