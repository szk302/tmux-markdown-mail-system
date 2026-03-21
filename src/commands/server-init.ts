import { writeFile, access, mkdir } from "fs/promises";
import { dirname } from "path";
import type { Command } from "commander";
import { DEFAULT_CONFIG_PATH } from "../shared/constants.js";
import { DEFAULT_CONFIG_TEMPLATE } from "../config/defaults.js";
import { logger } from "../shared/logger.js";

export function registerServerInitCommand(serverCmd: Command): void {
  serverCmd
    .command("init")
    .description("Generate default server configuration file")
    .option("-o, --output <PATH>", "Output path for config file", DEFAULT_CONFIG_PATH)
    .action(async (opts: { output: string }) => {
      const outputPath = opts.output;

      try {
        await access(outputPath);
        process.stderr.write(
          `Config file already exists: ${outputPath}\nUse --output to specify a different path.\n`,
        );
        process.exit(1);
      } catch {
        // File doesn't exist, proceed
      }

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, DEFAULT_CONFIG_TEMPLATE, "utf8");
      logger.info("Config file created", { path: outputPath });
      process.stdout.write(`Config file created: ${outputPath}\n`);
    });
}
