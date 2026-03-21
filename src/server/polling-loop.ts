import { mkdir, readdir } from "fs/promises";
import { getEnabledPanes } from "../tmux/pane-registry.js";
import { routeMessages } from "./route-messages.js";
import { notifyInbox } from "./notify-inbox.js";
import { logger } from "../shared/logger.js";
import { MD_EXTENSION } from "../shared/constants.js";
import type { ServerConfig } from "../shared/types.js";

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function warnIfDeadLetterHasFiles(deadLetterDir: string): Promise<void> {
  try {
    const files = await readdir(deadLetterDir);
    const mdFiles = files.filter((f) => f.endsWith(MD_EXTENSION));
    if (mdFiles.length > 0) {
      logger.warn(
        `Dead letter directory contains ${mdFiles.length} undelivered message(s). Check: ${deadLetterDir}`,
        { dead_letter_dir: deadLetterDir, count: mdFiles.length },
      );
      process.stderr.write(
        `[TMMS] Warning: ${mdFiles.length} undelivered message(s) in dead letter directory: ${deadLetterDir}\n`,
      );
    }
  } catch {
    // Directory not yet created or unreadable — skip warning
  }
}

async function runPollingCycle(config: ServerConfig): Promise<void> {
  const panes = await getEnabledPanes();
  logger.debug("Polling cycle", { paneCount: panes.length });

  await routeMessages(panes, config.dead_letter_dir);
  await notifyInbox(panes);
}

export async function startPollingLoop(config: ServerConfig): Promise<void> {
  await warnIfDeadLetterHasFiles(config.dead_letter_dir);
  await ensureDir(config.dead_letter_dir);

  logger.info("TMMS server starting", {
    polling_interval: config.polling_interval,
    dead_letter_dir: config.dead_letter_dir,
  });

  // Run immediately on start
  try {
    await runPollingCycle(config);
  } catch (err) {
    logger.error("Polling cycle error", { error: (err as Error).message });
  }

  const intervalMs = config.polling_interval * 1000;
  const timer = setInterval(async () => {
    try {
      await runPollingCycle(config);
    } catch (err) {
      logger.error("Polling cycle error", { error: (err as Error).message });
    }
  }, intervalMs);

  // Graceful shutdown
  const shutdown = () => {
    logger.info("TMMS server shutting down");
    clearInterval(timer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
