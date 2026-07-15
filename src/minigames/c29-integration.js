export function acceptC29MissionResult(interaction, result) {
  const current = interaction && typeof interaction === "object" ? interaction : {};
  if (current.attempted) return { accepted: false, interaction: { ...current } };
  return {
    accepted: true,
    interaction: {
      ...current,
      attempted: true,
      finished: true,
      succeeded: Boolean(result?.correct && result?.complete),
      currentCorrect: Boolean(result?.correct && result?.complete),
      minigameResult: {
        engineId: result?.engineId || "C29",
        engineVersion: result?.engineVersion || "1.0.0",
        hintsUsed: Math.max(0, Number(result?.hintsUsed) || 0),
        xpAwarded: Math.max(0, Number(result?.xpAwarded) || 0),
      },
    },
  };
}
