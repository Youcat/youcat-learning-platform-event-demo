import { assertGameInstance, GameContractError } from "./contracts.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBundledGameSource(fixtures) {
  if (!Array.isArray(fixtures)) throw new GameContractError("Bundled fixtures must be an array");
  const byId = new Map();
  fixtures.forEach((fixture) => {
    assertGameInstance(fixture);
    if (byId.has(fixture.id)) throw new GameContractError(`Duplicate bundled fixture id ${fixture.id}`);
    byId.set(fixture.id, clone(fixture));
  });

  return Object.freeze({
    kind: "bundled",
    list() {
      return [...byId.values()].map((fixture) => clone(fixture));
    },
    get(id, { mode } = {}) {
      const fixture = byId.get(id);
      if (!fixture) return null;
      const instance = clone(fixture);
      if (mode) instance.mode = mode;
      return assertGameInstance(instance);
    },
  });
}
