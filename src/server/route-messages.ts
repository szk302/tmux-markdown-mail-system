import { readdir, rename, copyFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { parseMessage } from "../message/frontmatter.js";
import { readFile } from "fs/promises";
import { findPaneByName } from "../tmux/pane-registry.js";
import { logger } from "../shared/logger.js";
import { MD_EXTENSION } from "../shared/constants.js";
import type { PaneInfo } from "../shared/types.js";

async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      // Cross-device move: copy then delete
      await copyFile(src, dest);
      await unlink(src);
    } else {
      throw err;
    }
  }
}

export async function routeMessages(panes: PaneInfo[], deadLetterDir: string): Promise<void> {
  for (const pane of panes) {
    let files: string[];
    try {
      files = await readdir(pane.outbox);
    } catch {
      logger.warn("Cannot read outbox", { outbox: pane.outbox, pane: pane.name });
      continue;
    }

    const mdFiles = files.filter((f) => f.endsWith(MD_EXTENSION));

    for (const filename of mdFiles) {
      const srcPath = join(pane.outbox, filename);

      let content: string;
      try {
        content = await readFile(srcPath, "utf8");
      } catch {
        logger.warn("Cannot read message file", { path: srcPath });
        continue;
      }

      const parsed = parseMessage(content);
      const tmmsTo = parsed.frontmatter["tmms_to"];

      if (typeof tmmsTo !== "string" || !tmmsTo) {
        logger.warn("Message missing tmms_to, routing to dead letter", { path: srcPath });
        await mkdir(deadLetterDir, { recursive: true });
        await moveFile(srcPath, join(deadLetterDir, filename));
        continue;
      }

      const destPane = findPaneByName(panes, tmmsTo);
      if (!destPane) {
        logger.warn("Unknown recipient, routing to dead letter", {
          path: srcPath,
          tmms_to: tmmsTo,
        });
        await mkdir(deadLetterDir, { recursive: true });
        await moveFile(srcPath, join(deadLetterDir, filename));
        continue;
      }

      await mkdir(destPane.inbox, { recursive: true });
      const destPath = join(destPane.inbox, filename);
      await moveFile(srcPath, destPath);
      logger.info("Message routed", { from: pane.name, to: tmmsTo, filename });
    }
  }
}
