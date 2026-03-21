import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { parseMessage } from "../message/frontmatter.js";
import { logger } from "../shared/logger.js";
import { MD_EXTENSION } from "../shared/constants.js";
import type { PaneInfo } from "../shared/types.js";

const execFileAsync = promisify(execFile);

export function expandVariables(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\$\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

export async function notifyInbox(panes: PaneInfo[]): Promise<void> {
  for (const pane of panes) {
    let files: string[];
    try {
      files = await readdir(pane.inbox);
    } catch {
      logger.warn("Cannot read inbox", { inbox: pane.inbox, pane: pane.name });
      continue;
    }

    const mdFiles = files.filter((f) => f.endsWith(MD_EXTENSION));

    for (const filename of mdFiles) {
      const filePath = join(pane.inbox, filename);

      let content: string;
      try {
        content = await readFile(filePath, "utf8");
      } catch {
        logger.warn("Cannot read inbox file", { path: filePath });
        continue;
      }

      const parsed = parseMessage(content);
      const fm = parsed.frontmatter;

      const vars: Record<string, string> = {
        filepath: filePath,
        tmms_id: String(fm["tmms_id"] ?? ""),
        tmms_from: String(fm["tmms_from"] ?? ""),
        tmms_to: String(fm["tmms_to"] ?? ""),
        tmms_subject: String(fm["tmms_subject"] ?? ""),
        tmms_thread_id: String(fm["tmms_thread_id"] ?? ""),
      };

      const expandedCmd = expandVariables(pane.notifyCmd, vars);

      try {
        await execFileAsync("sh", ["-c", expandedCmd]);
        logger.info("Notification executed", { pane: pane.name, filename });
      } catch (err) {
        logger.error("Notification command failed", {
          pane: pane.name,
          filename,
          cmd: expandedCmd,
          error: (err as Error).message,
        });
      }
    }
  }
}
