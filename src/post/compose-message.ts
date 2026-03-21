import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { parseMessage, mergeFrontmatter, serializeMessage } from "../message/frontmatter.js";
import { generateFilename } from "../message/filename.js";
import type { TmmsMetadata } from "../shared/types.js";

export interface ComposeOptions {
  body: string;
  to: string;
  from: string;
  outboxDir: string;
  subject?: string;
  threadId?: string;
}

export interface ComposeResult {
  filePath: string;
  filename: string;
  tmmsId: string;
}

export async function composeMessage(opts: ComposeOptions): Promise<ComposeResult> {
  const { body, to, from, outboxDir, subject, threadId } = opts;

  const tmmsId = randomUUID();
  const createdAt = new Date().toISOString();

  const metadata: TmmsMetadata = {
    tmms_id: tmmsId,
    tmms_from: from,
    tmms_to: to,
    tmms_created_at: createdAt,
    ...(subject !== undefined ? { tmms_subject: subject } : {}),
    ...(threadId !== undefined ? { tmms_thread_id: threadId } : {}),
  };

  const parsed = parseMessage(body);
  const merged = mergeFrontmatter(parsed.frontmatter, metadata);
  const content = serializeMessage(merged, parsed.body);

  const filename = generateFilename(from, to, tmmsId, createdAt);
  const filePath = join(outboxDir, filename);

  await mkdir(outboxDir, { recursive: true });
  await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });

  return { filePath, filename, tmmsId };
}
