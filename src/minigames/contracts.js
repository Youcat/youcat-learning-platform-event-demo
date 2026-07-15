export const GAME_INSTANCE_VERSION = 1;

export const GAME_INSTANCE_FIELDS = Object.freeze([
  "id",
  "questionNumber",
  "missionSlot",
  "engineId",
  "engineVersion",
  "seed",
  "mode",
  "xp",
  "title",
  "prompt",
  "insight",
  "assets",
  "layoutOverrides",
  "payload",
]);

export const ENGINE_METHODS = Object.freeze([
  "validate",
  "createScene",
  "serializeState",
  "restoreState",
  "evaluate",
  "getAccessibleActions",
  "showHint",
  "destroy",
]);

const ENGINE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/i;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validateLocalizedText(value, path, errors, { allowEmpty = false } = {}) {
  if (!hasExactKeys(value, ["en", "pt"])) {
    errors.push(`${path} must contain exactly {en, pt}`);
    return;
  }
  for (const locale of ["en", "pt"]) {
    if (typeof value[locale] !== "string" || (!allowEmpty && !value[locale].trim())) {
      errors.push(`${path}.${locale} must be ${allowEmpty ? "a string" : "a non-empty string"}`);
    }
  }
}

export function validateGameInstance(value) {
  const errors = [];
  if (!hasExactKeys(value, GAME_INSTANCE_FIELDS)) {
    errors.push(`GameInstance must contain exactly: ${GAME_INSTANCE_FIELDS.join(", ")}`);
  }
  if (!isRecord(value)) return { ok: false, errors };

  if (typeof value.id !== "string" || !ID_PATTERN.test(value.id)) errors.push("id must be a stable non-empty identifier");
  if (!Number.isInteger(value.questionNumber) || value.questionNumber < 1) errors.push("questionNumber must be a positive integer");
  if (!Number.isInteger(value.missionSlot) || value.missionSlot < 0 || value.missionSlot > 3) errors.push("missionSlot must be an integer from 0 to 3");
  if (typeof value.engineId !== "string" || !ID_PATTERN.test(value.engineId)) errors.push("engineId must be a stable non-empty identifier");
  if (typeof value.engineVersion !== "string" || !ENGINE_VERSION_PATTERN.test(value.engineVersion)) errors.push("engineVersion must be a semantic version");
  if (typeof value.seed !== "string" || !value.seed.trim()) errors.push("seed must be a non-empty string");
  if (!new Set(["lab", "mission"]).has(value.mode)) errors.push('mode must be either "lab" or "mission"');
  if (!Number.isInteger(value.xp) || value.xp < 0) errors.push("xp must be a non-negative integer");

  validateLocalizedText(value.title, "title", errors);
  validateLocalizedText(value.prompt, "prompt", errors);
  validateLocalizedText(value.insight, "insight", errors, { allowEmpty: true });

  if (!hasExactKeys(value.assets, ["baseImage", "layers", "masks"])) {
    errors.push("assets must contain exactly {baseImage, layers, masks}");
  } else {
    if (value.assets.baseImage !== null && (typeof value.assets.baseImage !== "string" || !value.assets.baseImage.trim())) {
      errors.push("assets.baseImage must be null or a non-empty string");
    }
    for (const key of ["layers", "masks"]) {
      if (!Array.isArray(value.assets[key]) || value.assets[key].some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(`assets.${key} must be an array of non-empty strings`);
      }
    }
  }

  if (!isRecord(value.layoutOverrides)) errors.push("layoutOverrides must be an object");
  if (!isRecord(value.payload)) errors.push("payload must be an object");
  return { ok: errors.length === 0, errors };
}

export class GameContractError extends TypeError {
  constructor(message, errors = []) {
    super(`${message}${errors.length ? `: ${errors.join("; ")}` : ""}`);
    this.name = "GameContractError";
    this.errors = [...errors];
  }
}

export function assertGameInstance(value) {
  const result = validateGameInstance(value);
  if (!result.ok) throw new GameContractError("Invalid GameInstance", result.errors);
  return value;
}

export function assertEngineInterface(engine) {
  if (!isRecord(engine)) throw new GameContractError("Engine must be an object");
  const missing = ENGINE_METHODS.filter((method) => typeof engine[method] !== "function");
  if (missing.length) throw new GameContractError("Invalid minigame engine", missing.map((method) => `missing ${method}()`));
  return engine;
}
