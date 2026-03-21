import { homedir } from "os";
import { join } from "path";

export const TMMS_PREFIX = "tmms_";
export const DEFAULT_POLLING_INTERVAL = 60;
export const MD_EXTENSION = ".md";
export const CONFIG_FILENAME = "config.yml";

/** Default output path for `tmms server init` */
export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "tmms", CONFIG_FILENAME);

/** Ordered list of config lookup paths (highest priority first, excluding explicit -c flag) */
export const CONFIG_LOOKUP_PATHS = [
  join(homedir(), ".tmms.yml"),
  join(homedir(), ".tmms", CONFIG_FILENAME),
  DEFAULT_CONFIG_PATH,
];
