import { describe, it, expect } from "vitest";
import { generateFilename } from "../../../src/message/filename.js";

describe("generateFilename", () => {
  const tmmsId = "a1b2c3d4-e5f6-0000-0000-000000000000";
  const createdAt = "2026-03-22T14:30:05Z";

  it("generates correct filename format", () => {
    const filename = generateFilename("agent-alpha", "user-main", tmmsId, createdAt);
    expect(filename).toBe("20260322-143005_agent-alpha_to_user-main_a1b2c3d4.md");
  });

  it("uses first 8 chars of UUID as ShortID", () => {
    const filename = generateFilename("from", "to", "abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx", createdAt);
    expect(filename).toContain("_abcd1234.md");
  });

  it("sanitizes special characters in names", () => {
    const filename = generateFilename("from/agent", "to:target", tmmsId, createdAt);
    expect(filename).not.toContain("/");
    expect(filename).not.toContain(":");
    expect(filename).toContain("from-agent");
    expect(filename).toContain("to-target");
  });

  it("pads single-digit date/time components", () => {
    const filename = generateFilename("a", "b", tmmsId, "2026-01-05T03:07:09Z");
    expect(filename).toMatch(/^20260105-030709_/);
  });

  it("always ends with .md", () => {
    const filename = generateFilename("a", "b", tmmsId, createdAt);
    expect(filename).toMatch(/\.md$/);
  });
});
