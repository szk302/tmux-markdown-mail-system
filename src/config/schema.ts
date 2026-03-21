import type { ServerConfig } from "../shared/types.js";

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

export function validateConfig(raw: unknown): ServerConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new ConfigValidationError("Config must be a YAML object");
  }

  const obj = raw as Record<string, unknown>;

  const polling_interval = obj["polling_interval"];
  if (polling_interval !== undefined) {
    if (typeof polling_interval !== "number" || polling_interval <= 0) {
      throw new ConfigValidationError("polling_interval must be a positive number");
    }
  }

  const dead_letter_dir = obj["dead_letter_dir"];
  if (typeof dead_letter_dir !== "string" || dead_letter_dir.trim() === "") {
    throw new ConfigValidationError("dead_letter_dir must be a non-empty string");
  }

  return {
    polling_interval: typeof polling_interval === "number" ? polling_interval : 60,
    dead_letter_dir: dead_letter_dir.trim(),
  };
}
