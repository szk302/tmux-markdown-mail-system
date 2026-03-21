import { readFile } from "fs/promises";
import { parse } from "yaml";
import { validateConfig } from "./schema.js";
import { ConfigNotFoundError } from "../shared/errors.js";
import type { ServerConfig } from "../shared/types.js";

export async function loadConfig(configPath: string): Promise<ServerConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigNotFoundError(configPath);
    }
    throw err;
  }

  const parsed = parse(raw) as unknown;
  return validateConfig(parsed);
}
