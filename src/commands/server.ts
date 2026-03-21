import type { Command } from "commander";
import { loadConfig, findConfig } from "../config/loader.js";
import { startPollingLoop } from "../server/polling-loop.js";
import { CONFIG_LOOKUP_PATHS } from "../shared/constants.js";
import { logger } from "../shared/logger.js";

export function registerServerCommand(serverCmd: Command): void {
  serverCmd
    .description("Start the TMMS server process")
    .option("-c, --config <PATH>", "Path to config file (overrides default lookup)")
    .action(async (opts: { config?: string }) => {
      try {
        let configPath = opts.config;

        if (!configPath) {
          configPath = await findConfig();
          if (!configPath) {
            const searched = CONFIG_LOOKUP_PATHS.join(", ");
            throw new Error(
              `No config file found. Run 'tmms server init' to create one.\nSearched: ${searched}`,
            );
          }
          logger.info("Using config file", { path: configPath });
        }

        const config = await loadConfig(configPath);
        await startPollingLoop(config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Server startup failed", { error: message });
        process.stderr.write(`tmms server: ${message}\n`);
        process.exit(1);
      }
    });
}
