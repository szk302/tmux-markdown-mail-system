import { readFile, access } from "fs/promises";
import { parse } from "yaml";
import { validateConfig } from "./schema.js";
import { ConfigNotFoundError } from "../shared/errors.js";
import { CONFIG_LOOKUP_PATHS } from "../shared/constants.js";
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

/**
 * Find the first existing config file from the lookup paths.
 * Returns the path if found, or undefined if none exist.
 */
export async function findConfig(
  lookupPaths: string[] = CONFIG_LOOKUP_PATHS,
): Promise<string | undefined> {
  for (const p of lookupPaths) {
    try {
      await access(p);
      return p;
    } catch {
      // not found, try next
    }
  }
  return undefined;
}
