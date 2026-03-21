import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readdir, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { routeMessages } from "../../../src/server/route-messages.js";
import type { PaneInfo } from "../../../src/shared/types.js";

let tmpDir: string;

function makePane(overrides: Partial<PaneInfo> = {}): PaneInfo {
  return {
    paneId: "%1",
    name: "agent-alpha",
    outbox: join(tmpDir, "alpha-outbox"),
    inbox: join(tmpDir, "alpha-inbox"),
    notifyCmd: "echo {{filepath}}",
    ...overrides,
  };
}

async function writeMessage(dir: string, filename: string, tmmsTo: string): Promise<void> {
  const content = `---\ntmms_id: test-id\ntmms_from: agent-alpha\ntmms_to: ${tmmsTo}\ntmms_created_at: 2026-03-22T05:00:00Z\n---\nBody`;
  await writeFile(join(dir, filename), content);
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "tmms-route-test-"));
  await mkdir(join(tmpDir, "alpha-outbox"), { recursive: true });
  await mkdir(join(tmpDir, "alpha-inbox"), { recursive: true });
  await mkdir(join(tmpDir, "beta-outbox"), { recursive: true });
  await mkdir(join(tmpDir, "beta-inbox"), { recursive: true });
  await mkdir(join(tmpDir, "dead-letter"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("routeMessages", () => {
  it("routes message to correct inbox", async () => {
    const alphaPane = makePane({
      name: "agent-alpha",
      outbox: join(tmpDir, "alpha-outbox"),
      inbox: join(tmpDir, "alpha-inbox"),
    });
    const betaPane = makePane({
      paneId: "%2",
      name: "agent-beta",
      outbox: join(tmpDir, "beta-outbox"),
      inbox: join(tmpDir, "beta-inbox"),
    });

    await writeMessage(join(tmpDir, "alpha-outbox"), "test-msg.md", "agent-beta");

    await routeMessages([alphaPane, betaPane], join(tmpDir, "dead-letter"));

    const betaInbox = await readdir(join(tmpDir, "beta-inbox"));
    expect(betaInbox).toContain("test-msg.md");

    const alphaOutbox = await readdir(join(tmpDir, "alpha-outbox"));
    expect(alphaOutbox).not.toContain("test-msg.md");
  });

  it("routes unknown recipient to dead letter dir", async () => {
    const alphaPane = makePane({
      outbox: join(tmpDir, "alpha-outbox"),
      inbox: join(tmpDir, "alpha-inbox"),
    });

    await writeMessage(join(tmpDir, "alpha-outbox"), "unknown-msg.md", "nonexistent-pane");

    await routeMessages([alphaPane], join(tmpDir, "dead-letter"));

    const deadLetter = await readdir(join(tmpDir, "dead-letter"));
    expect(deadLetter).toContain("unknown-msg.md");
  });

  it("routes message with missing tmms_to to dead letter", async () => {
    const alphaPane = makePane({
      outbox: join(tmpDir, "alpha-outbox"),
      inbox: join(tmpDir, "alpha-inbox"),
    });

    const content = `---\ntmms_id: test-id\ntmms_from: agent-alpha\ntmms_created_at: 2026-03-22T05:00:00Z\n---\nBody`;
    await writeFile(join(tmpDir, "alpha-outbox", "no-to.md"), content);

    await routeMessages([alphaPane], join(tmpDir, "dead-letter"));

    const deadLetter = await readdir(join(tmpDir, "dead-letter"));
    expect(deadLetter).toContain("no-to.md");
  });

  it("does nothing when outbox is empty", async () => {
    const alphaPane = makePane({
      outbox: join(tmpDir, "alpha-outbox"),
      inbox: join(tmpDir, "alpha-inbox"),
    });

    await routeMessages([alphaPane], join(tmpDir, "dead-letter"));

    const deadLetter = await readdir(join(tmpDir, "dead-letter"));
    expect(deadLetter).toHaveLength(0);
  });

  it("ignores non-.md files in outbox", async () => {
    const alphaPane = makePane({
      outbox: join(tmpDir, "alpha-outbox"),
      inbox: join(tmpDir, "alpha-inbox"),
    });

    await writeFile(join(tmpDir, "alpha-outbox", "notes.txt"), "some text");

    await routeMessages([alphaPane], join(tmpDir, "dead-letter"));

    const deadLetter = await readdir(join(tmpDir, "dead-letter"));
    expect(deadLetter).toHaveLength(0);
  });
});
