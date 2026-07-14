export function rankMembers(members) {
  return [...members].sort((a, b) => Number(b.personalXp || 0) - Number(a.personalXp || 0) || String(a.displayName || "").localeCompare(String(b.displayName || "")));
}

export function rankGroupSummaries(groups, minimumParticipants = 3) {
  return groups
    .map((item) => ({
      code: item.groupCode,
      total: Number(item.totalXp) || 0,
      participants: Number(item.participants) || 0,
      average: Number(item.averageXp) || 0,
    }))
    .filter((item) => item.participants >= minimumParticipants)
    .sort((a, b) => b.average - a.average || b.total - a.total || a.code.localeCompare(b.code));
}
