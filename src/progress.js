// Start the July event from a clean client-side slate. Older local data remains
// inaccessible to the app and therefore cannot repopulate the reset database.
const STORAGE_KEY = "youcat-assis-progress-v5";
const VERSION = 5;

export const ACHIEVEMENTS = [
  { id: "first-steps", xp: 25, pt: "Primeiros passos", en: "First steps" },
  { id: "curious", xp: 75, pt: "Curioso", en: "Curious" },
  { id: "explorer", xp: 150, pt: "Explorador", en: "Explorer" },
  { id: "persevering", xp: 300, pt: "Perseverante", en: "Persevering" },
];

function emptyData() {
  return {
    version: VERSION,
    profile: null,
    sound: false,
    awards: {},
    readings: {},
    interactions: {},
    pendingAchievement: null,
  };
}

function safeParse(raw) {
  if (!raw) return emptyData();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyData();
    return {
      ...emptyData(),
      ...parsed,
      version: VERSION,
      awards: parsed.awards && typeof parsed.awards === "object" ? parsed.awards : {},
      readings: parsed.readings && typeof parsed.readings === "object" ? parsed.readings : {},
      interactions: parsed.interactions && typeof parsed.interactions === "object" ? parsed.interactions : {},
    };
  } catch {
    return emptyData();
  }
}

export function countWords(text) {
  return (String(text || "").trim().match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}

export function readingReward(text) {
  const words = countWords(text);
  return {
    words,
    xp: Math.max(1, Math.min(10, Math.ceil(words / 75))),
    requiredMs: Math.max(5_000, Math.ceil((words / 400) * 60_000)),
  };
}

export function createProgressStore(storage = window.localStorage) {
  let raw = null;
  try { raw = storage.getItem(STORAGE_KEY); } catch {}
  let data = safeParse(raw);

  const persist = () => { try { storage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} };
  const totalXp = () => Object.values(data.awards).reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  const groupXp = (group) => Object.values(data.awards)
    .filter((item) => item.group === group)
    .reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  const questionGroupXp = (group, question) => Object.values(data.awards)
    .filter((item) => item.group === group && Number(item.question) === Number(question))
    .reduce((sum, item) => sum + (Number(item.xp) || 0), 0);
  const allGroupXp = () => Object.values(data.awards).reduce((result, item) => {
    if (item.group) result[item.group] = (result[item.group] || 0) + (Number(item.xp) || 0);
    return result;
  }, {});
  const allGroupQuestionXp = () => Object.values(data.awards).reduce((result, item) => {
    if (!item.group || !item.question) return result;
    result[item.group] ||= {};
    result[item.group][item.question] = (result[item.group][item.question] || 0) + (Number(item.xp) || 0);
    return result;
  }, {});

  function awardOnce(id, xp, group, meta = {}) {
    if (data.awards[id]) return { awarded: false, totalXp: totalXp(), unlocked: [] };
    const before = totalXp();
    data.awards[id] = { xp, group, at: Date.now(), ...meta };
    const after = totalXp();
    const unlocked = ACHIEVEMENTS.filter((item) => before < item.xp && after >= item.xp);
    if (unlocked.length) data.pendingAchievement = unlocked[unlocked.length - 1].id;
    persist();
    return { awarded: true, totalXp: after, unlocked };
  }

  return {
    profile: () => data.profile,
    setProfile(profile) { data.profile = profile ? { ...profile } : null; persist(); },
    soundEnabled: () => Boolean(data.sound),
    setSound(enabled) { data.sound = Boolean(enabled); persist(); },
    totalXp,
    groupXp,
    questionGroupXp,
    allGroupXp,
    allGroupQuestionXp,
    transferAwardsToGroup(group) {
      Object.values(data.awards).forEach((item) => { item.group = group; });
      persist();
    },
    awards: () => ({ ...data.awards }),
    hasAward: (id) => Boolean(data.awards[id]),
    awardOnce,
    reading(id) { return { elapsedMs: 0, maxScrollRatio: 0, ...(data.readings[id] || {}) }; },
    updateReading(id, patch) { data.readings[id] = { ...this.reading(id), ...patch }; persist(); return data.readings[id]; },
    interaction(number) { return data.interactions[number] ? JSON.parse(JSON.stringify(data.interactions[number])) : null; },
    saveInteraction(number, interaction) { data.interactions[number] = JSON.parse(JSON.stringify(interaction)); persist(); },
    pendingAchievement() { return data.pendingAchievement; },
    clearPendingAchievement() { data.pendingAchievement = null; persist(); },
    reset() { data = emptyData(); try { storage.removeItem(STORAGE_KEY); } catch {} },
    snapshot() { return JSON.parse(JSON.stringify(data)); },
  };
}
