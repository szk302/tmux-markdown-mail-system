import matter from "gray-matter";
import { stringify } from "yaml";
import { TMMS_PREFIX } from "../shared/constants.js";
import type { ParsedMessage } from "./types.js";
import type { TmmsMetadata } from "../shared/types.js";

export function parseMessage(content: string): ParsedMessage {
  const parsed = matter(content);
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
}

export function mergeFrontmatter(
  existing: Record<string, unknown>,
  tmmsMetadata: TmmsMetadata,
): Record<string, unknown> {
  // Keep all non-tmms_ keys from existing frontmatter
  const preserved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!key.startsWith(TMMS_PREFIX)) {
      preserved[key] = value;
    }
  }

  // System tmms_ values always win
  return {
    ...preserved,
    ...tmmsMetadata,
  };
}

export function serializeMessage(frontmatter: Record<string, unknown>, body: string): string {
  const yamlStr = stringify(frontmatter, { lineWidth: 0 }).trimEnd();
  const bodyTrimmed = body.trimStart();
  const separator = bodyTrimmed ? "\n" : "";
  return `---\n${yamlStr}\n---\n${separator}${bodyTrimmed}`;
}
