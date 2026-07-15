import { assertEngineInterface, assertGameInstance, GameContractError } from "./contracts.js";

export const MINIGAME_REGISTRY_VERSION = 1;

function keyFor(engineId, engineVersion) {
  return `${engineId}@${engineVersion}`;
}

export function createMinigameRegistry({ version = MINIGAME_REGISTRY_VERSION } = {}) {
  if (!Number.isInteger(version) || version < 1) throw new GameContractError("Registry version must be a positive integer");
  const engines = new Map();

  return Object.freeze({
    version,
    register({ engineId, engineVersion, engine, production = true }) {
      assertEngineInterface(engine);
      const key = keyFor(engineId, engineVersion);
      if (engines.has(key)) throw new GameContractError(`Engine ${key} is already registered`);
      engines.set(key, Object.freeze({ engineId, engineVersion, engine, production: Boolean(production) }));
      return this;
    },
    resolve(instance, { allowNonProduction = false } = {}) {
      assertGameInstance(instance);
      const registration = engines.get(keyFor(instance.engineId, instance.engineVersion));
      if (!registration) throw new GameContractError(`No engine registered for ${instance.engineId}@${instance.engineVersion}`);
      if (!registration.production && !allowNonProduction) throw new GameContractError(`Engine ${instance.engineId} is non-production`);
      return registration.engine;
    },
    registrations() {
      return [...engines.values()].map(({ engineId, engineVersion, production }) => ({ engineId, engineVersion, production }));
    },
  });
}
