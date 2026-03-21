import { describe, it, expect } from "vitest";
import {
  parseMessage,
  mergeFrontmatter,
  serializeMessage,
} from "../../../src/message/frontmatter.js";
import type { TmmsMetadata } from "../../../src/shared/types.js";

const baseMeta: TmmsMetadata = {
  tmms_id: "abc12345-0000-0000-0000-000000000000",
  tmms_from: "agent-alpha",
  tmms_to: "user-main",
  tmms_created_at: "2026-03-22T05:15:45Z",
};

describe("parseMessage", () => {
  it("parses frontmatter and body", () => {
    const input = `---\ntags:\n  - foo\n---\nHello world`;
    const result = parseMessage(input);
    expect(result.frontmatter).toEqual({ tags: ["foo"] });
    expect(result.body.trim()).toBe("Hello world");
  });

  it("returns empty frontmatter when no frontmatter present", () => {
    const result = parseMessage("Just a body");
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe("Just a body");
  });

  it("parses existing tmms_ keys", () => {
    const input = `---\ntmms_from: old-agent\ntmms_subject: Test\n---\nBody`;
    const result = parseMessage(input);
    expect(result.frontmatter["tmms_from"]).toBe("old-agent");
    expect(result.frontmatter["tmms_subject"]).toBe("Test");
  });
});

describe("mergeFrontmatter", () => {
  it("preserves non-tmms_ keys", () => {
    const existing = { tags: ["foo", "bar"], aliases: ["test"] };
    const result = mergeFrontmatter(existing, baseMeta);
    expect(result["tags"]).toEqual(["foo", "bar"]);
    expect(result["aliases"]).toEqual(["test"]);
  });

  it("system tmms_ values overwrite existing tmms_ keys", () => {
    const existing = {
      tmms_from: "old-agent",
      tmms_to: "old-target",
      tmms_id: "old-id",
    };
    const result = mergeFrontmatter(existing, baseMeta);
    expect(result["tmms_from"]).toBe("agent-alpha");
    expect(result["tmms_to"]).toBe("user-main");
    expect(result["tmms_id"]).toBe(baseMeta.tmms_id);
  });

  it("drops existing tmms_ keys not in system metadata", () => {
    const existing = { tmms_custom: "should-be-removed" };
    const result = mergeFrontmatter(existing, baseMeta);
    expect(result["tmms_custom"]).toBeUndefined();
  });

  it("includes optional tmms fields when provided", () => {
    const meta: TmmsMetadata = { ...baseMeta, tmms_subject: "Hello", tmms_thread_id: "tid-1" };
    const result = mergeFrontmatter({}, meta);
    expect(result["tmms_subject"]).toBe("Hello");
    expect(result["tmms_thread_id"]).toBe("tid-1");
  });

  it("returns only system metadata when existing is empty", () => {
    const result = mergeFrontmatter({}, baseMeta);
    expect(result).toMatchObject(baseMeta);
    expect(Object.keys(result)).toHaveLength(Object.keys(baseMeta).length);
  });
});

describe("serializeMessage", () => {
  it("produces valid frontmatter block with body", () => {
    const fm = { tmms_from: "agent", tmms_to: "user" };
    const body = "Hello!";
    const result = serializeMessage(fm, body);
    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/---\n/);
    expect(result).toContain("Hello!");
    expect(result).toContain("tmms_from: agent");
  });

  it("produces valid frontmatter block with empty body", () => {
    const fm = { tmms_from: "agent" };
    const result = serializeMessage(fm, "");
    expect(result).toMatch(/^---\n/);
    expect(result.endsWith("---\n")).toBe(true);
  });

  it("round-trips through parseMessage", () => {
    const original = {
      tags: ["a", "b"],
      ...baseMeta,
    };
    const serialized = serializeMessage(original, "Body text");
    const reparsed = parseMessage(serialized);
    expect(reparsed.frontmatter["tags"]).toEqual(["a", "b"]);
    expect(reparsed.frontmatter["tmms_from"]).toBe("agent-alpha");
    expect(reparsed.body.trim()).toBe("Body text");
  });
});
