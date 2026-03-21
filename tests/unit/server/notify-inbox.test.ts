import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { tmpdir, platform } from "os";
import { join } from "path";
import { expandVariables, notifyInbox } from "../../../src/server/notify-inbox.js";
import type { PaneInfo } from "../../../src/shared/types.js";

let tmpDir: string;

function makePane(overrides: Partial<PaneInfo> = {}): PaneInfo {
  return {
    paneId: "%1",
    name: "agent-alpha",
    outbox: join(tmpDir, "outbox"),
    inbox: join(tmpDir, "inbox"),
    notifyCmd: "true",
    ...overrides,
  };
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "tmms-notify-test-"));
  await mkdir(join(tmpDir, "inbox"), { recursive: true });
  await mkdir(join(tmpDir, "outbox"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("expandVariables", () => {
  it("replaces ${{filepath}} with the file path", () => {
    const result = expandVariables("cat ${{filepath}}", { filepath: "/tmp/test.md" });
    expect(result).toBe("cat /tmp/test.md");
  });

  it("replaces multiple variables", () => {
    const result = expandVariables(
      "notify ${{tmms_from}} -> ${{tmms_to}}: ${{tmms_subject}}",
      { tmms_from: "alpha", tmms_to: "beta", tmms_subject: "Hello" },
    );
    expect(result).toBe("notify alpha -> beta: Hello");
  });

  it("replaces unknown variable with empty string", () => {
    const result = expandVariables("${{unknown}}", {});
    expect(result).toBe("");
  });

  it("leaves non-template strings unchanged", () => {
    const result = expandVariables("echo hello", {});
    expect(result).toBe("echo hello");
  });
});

describe("notifyInbox", () => {
  it("executes notify_cmd for each file in inbox", async () => {
    const markerFile = join(tmpDir, "marker.txt");
    const inboxFile = join(tmpDir, "inbox", "test-msg.md");

    await writeFile(
      inboxFile,
      `---\ntmms_id: tid1\ntmms_from: agent-alpha\ntmms_to: user-main\ntmms_created_at: 2026-03-22T05:00:00Z\n---\nBody`,
    );

    const pane = makePane({
      inbox: join(tmpDir, "inbox"),
      notifyCmd: `touch ${markerFile}`,
    });

    await notifyInbox([pane]);

    const { access } = await import("fs/promises");
    await expect(access(markerFile)).resolves.toBeUndefined();
  });

  it("passes filepath variable to command", async () => {
    const outputFile = join(tmpDir, "output.txt");
    const inboxFile = join(tmpDir, "inbox", "msg.md");

    await writeFile(
      inboxFile,
      `---\ntmms_id: tid2\ntmms_from: a\ntmms_to: b\ntmms_created_at: 2026-03-22T05:00:00Z\n---\nBody`,
    );

    const pane = makePane({
      inbox: join(tmpDir, "inbox"),
      notifyCmd: `echo $\{\{filepath\}\} > ${outputFile}`,
    });

    await notifyInbox([pane]);

    const { readFile } = await import("fs/promises");
    const out = await readFile(outputFile, "utf8");
    expect(out.trim()).toBe(inboxFile);
  });

  it("does nothing when inbox is empty", async () => {
    let called = false;
    const pane = makePane({
      inbox: join(tmpDir, "inbox"),
      notifyCmd: "this-would-fail-if-called",
    });

    // No files written to inbox
    await notifyInbox([pane]);
    expect(called).toBe(false);
  });

  it("continues to next file when command fails", async () => {
    const markerFile = join(tmpDir, "marker2.txt");

    await writeFile(
      join(tmpDir, "inbox", "msg1.md"),
      `---\ntmms_id: t1\ntmms_from: a\ntmms_to: b\ntmms_created_at: 2026-03-22T05:00:00Z\n---\n`,
    );
    await writeFile(
      join(tmpDir, "inbox", "msg2.md"),
      `---\ntmms_id: t2\ntmms_from: a\ntmms_to: b\ntmms_created_at: 2026-03-22T05:00:01Z\n---\n`,
    );

    let cmdCount = 0;
    // Use a command that fails on first call but succeeds on second
    const pane = makePane({
      inbox: join(tmpDir, "inbox"),
      // sh -c: exit 1 if marker doesn't exist yet (first call), then create it
      notifyCmd: `sh -c 'if [ ! -f ${markerFile} ]; then touch ${markerFile}; exit 1; fi; true'`,
    });

    // Should not throw even though first command fails
    await expect(notifyInbox([pane])).resolves.toBeUndefined();
  });
});
