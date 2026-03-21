import { describe, it, expect, vi, afterEach } from "vitest";
import { findPaneByName } from "../../../src/tmux/pane-registry.js";
import type { PaneInfo } from "../../../src/shared/types.js";

describe("findPaneByName", () => {
  const panes: PaneInfo[] = [
    { paneId: "%1", name: "agent-alpha", outbox: "/alpha/out", inbox: "/alpha/in", notifyCmd: "echo" },
    { paneId: "%2", name: "user-main", outbox: "/user/out", inbox: "/user/in", notifyCmd: "notify-send test" },
    { paneId: "%3", name: "agent-beta", outbox: "/beta/out", inbox: "/beta/in", notifyCmd: "echo", replyTo: "user-main" },
  ];

  it("returns pane matching name", () => {
    const result = findPaneByName(panes, "user-main");
    expect(result?.name).toBe("user-main");
    expect(result?.paneId).toBe("%2");
  });

  it("returns undefined for unknown name", () => {
    const result = findPaneByName(panes, "nonexistent");
    expect(result).toBeUndefined();
  });

  it("returns pane with replyTo when set", () => {
    const result = findPaneByName(panes, "agent-beta");
    expect(result?.replyTo).toBe("user-main");
  });
});
