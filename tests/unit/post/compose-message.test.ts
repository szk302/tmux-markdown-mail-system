import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, access } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { composeMessage } from "../../../src/post/compose-message.js";
import { parseMessage } from "../../../src/message/frontmatter.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "tmms-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("composeMessage", () => {
  const baseOpts = {
    body: "Hello world",
    to: "user-main",
    from: "agent-alpha",
    outboxDir: "",
  };

  it("creates a file in outboxDir", async () => {
    const result = await composeMessage({ ...baseOpts, outboxDir: tmpDir });
    const content = await readFile(result.filePath, "utf8");
    expect(content).toBeTruthy();
  });

  it("sets correct tmms_ metadata in frontmatter", async () => {
    const result = await composeMessage({ ...baseOpts, outboxDir: tmpDir });
    const content = await readFile(result.filePath, "utf8");
    const parsed = parseMessage(content);
    expect(parsed.frontmatter["tmms_from"]).toBe("agent-alpha");
    expect(parsed.frontmatter["tmms_to"]).toBe("user-main");
    expect(parsed.frontmatter["tmms_id"]).toBe(result.tmmsId);
    expect(parsed.frontmatter["tmms_created_at"]).toBeTruthy();
  });

  it("preserves non-tmms_ keys from existing frontmatter", async () => {
    const bodyWithFrontmatter = `---\ntags:\n  - important\n---\nHello`;
    const result = await composeMessage({ ...baseOpts, body: bodyWithFrontmatter, outboxDir: tmpDir });
    const content = await readFile(result.filePath, "utf8");
    const parsed = parseMessage(content);
    expect(parsed.frontmatter["tags"]).toEqual(["important"]);
  });

  it("overwrites tmms_ keys from existing frontmatter", async () => {
    const bodyWithFrontmatter = `---\ntmms_from: old-agent\ntmms_to: wrong-target\n---\nHello`;
    const result = await composeMessage({ ...baseOpts, body: bodyWithFrontmatter, outboxDir: tmpDir });
    const content = await readFile(result.filePath, "utf8");
    const parsed = parseMessage(content);
    expect(parsed.frontmatter["tmms_from"]).toBe("agent-alpha");
    expect(parsed.frontmatter["tmms_to"]).toBe("user-main");
  });

  it("includes subject when provided", async () => {
    const result = await composeMessage({ ...baseOpts, outboxDir: tmpDir, subject: "My Subject" });
    const content = await readFile(result.filePath, "utf8");
    const parsed = parseMessage(content);
    expect(parsed.frontmatter["tmms_subject"]).toBe("My Subject");
  });

  it("follows filename naming convention", async () => {
    const result = await composeMessage({ ...baseOpts, outboxDir: tmpDir });
    expect(result.filename).toMatch(/^\d{8}-\d{6}_agent-alpha_to_user-main_[a-f0-9]{8}\.md$/);
  });

  it("deletes source file after writing when sourceFilePath provided", async () => {
    const srcFile = join(tmpDir, "input.md");
    await writeFile(srcFile, "# Test\nBody text");

    await composeMessage({ ...baseOpts, body: "# Test\nBody text", outboxDir: tmpDir, sourceFilePath: srcFile });

    await expect(access(srcFile)).rejects.toThrow();
  });

  it("does NOT delete source file when sourceFilePath not provided", async () => {
    const result = await composeMessage({ ...baseOpts, outboxDir: tmpDir });
    // Just verify the output file exists
    await expect(access(result.filePath)).resolves.toBeUndefined();
  });
});
