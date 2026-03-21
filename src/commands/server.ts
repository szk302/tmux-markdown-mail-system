import { join } from "path";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { startPollingLoop } from "../server/polling-loop.js";
import { CONFIG_FILENAME } from "../shared/constants.js";
import { logger } from "../shared/logger.js";

export function registerServerCommand(serverCmd: Command): void {
  serverCmd
    .description("Start the TMMS server process")
    .option("-c, --config <PATH>", "Path to config file", join(process.cwd(), CONFIG_FILENAME))
    .action(async (opts: { config: string }) => {
      try {
        const config = await loadConfig(opts.config);
        await startPollingLoop(config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Server startup failed", { error: message });
        process.stderr.write(`tmms server: ${message}\n`);
        process.exit(1);
      }
    });
}
