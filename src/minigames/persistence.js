export const MINIGAME_STATE_VERSION = 1;
const PREFIX = "youcat-assis:minigame";

export function minigameStorageKey(instance) {
  return `${PREFIX}:v${MINIGAME_STATE_VERSION}:${instance.mode}:${instance.id}`;
}

export function createMinigamePersistence(storage = globalThis.localStorage) {
  return Object.freeze({
    load(instance) {
      try {
        const parsed = JSON.parse(storage.getItem(minigameStorageKey(instance)) || "null");
        if (!parsed || parsed.version !== MINIGAME_STATE_VERSION) return null;
        if (parsed.engineId !== instance.engineId || parsed.engineVersion !== instance.engineVersion) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    save(instance, partial) {
      const value = {
        version: MINIGAME_STATE_VERSION,
        instanceId: instance.id,
        engineId: instance.engineId,
        engineVersion: instance.engineVersion,
        mode: instance.mode,
        hintsUsed: 0,
        submitted: false,
        engineState: null,
        updatedAt: Date.now(),
        ...partial,
      };
      try { storage.setItem(minigameStorageKey(instance), JSON.stringify(value)); } catch {}
      return value;
    },
    clear(instance) {
      try { storage.removeItem(minigameStorageKey(instance)); } catch {}
    },
  });
}
