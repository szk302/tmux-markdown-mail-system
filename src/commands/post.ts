import { readFile } from "fs/promises";
import type { Command } from "commander";
import { composeMessage } from "../post/compose-message.js";
import { getCurrentPaneInfo } from "../tmux/pane-registry.js";
import { NoRecipientError } from "../shared/errors.js";
import { logger } from "../shared/logger.js";

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

export function registerPostCommand(program: Command): void {
  program
    .command("post [file]")
    .description("Post a message to a pane's outbox")
    .option("-t, --to <ADDRESS>", "Recipient address (@tmms_name)")
    .option("-s, --subject <TEXT>", "Message subject")
    .option("-f, --file <PATH>", "Path to Markdown file to send")
    .action(
      async (
        fileArg: string | undefined,
        opts: { to?: string; subject?: string; file?: string },
      ) => {
        try {
          const pane = await getCurrentPaneInfo();

          const to = opts.to ?? pane.replyTo;
          if (!to) {
            throw new NoRecipientError();
          }

          const filePath = opts.file ?? fileArg;
          const body = filePath ? await readFile(filePath, "utf8") : await readStdin();

          const result = await composeMessage({
            body,
            to,
            from: pane.name,
            outboxDir: pane.outbox,
            subject: opts.subject,
          });

          logger.info("Message posted", { filename: result.filename, to, from: pane.name });
          process.stdout.write(result.filePath + "\n");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          process.stderr.write(`tmms post: ${message}\n`);
          process.exit(1);
        }
      },
    );
}
