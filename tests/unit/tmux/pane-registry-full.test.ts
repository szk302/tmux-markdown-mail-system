import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../src/tmux/client.js", () => ({
  isTmuxAvailable: vi.fn(),
  listAllPanes: vi.fn(),
  showPaneOption: vi.fn(),
  getCurrentPaneId: vi.fn(),
}));

import * as client from "../../../src/tmux/client.js";
import { getEnabledPanes, getCurrentPaneInfo } from "../../../src/tmux/pane-registry.js";
import { TmuxNotAvailableError, MissingPaneMetadataError } from "../../../src/shared/errors.js";

const mockListAllPanes = vi.mocked(client.listAllPanes);
const mockShowPaneOption = vi.mocked(client.showPaneOption);
const mockIsTmuxAvailable = vi.mocked(client.isTmuxAvailable);
const mockGetCurrentPaneId = vi.mocked(client.getCurrentPaneId);

function setupPaneOptions(paneId: string, options: Record<string, string>) {
  mockShowPaneOption.mockImplementation(async (id: string, opt: string) => {
    if (id === paneId) return options[opt] ?? "";
    return "";
  });
}

describe("getEnabledPanes", () => {
  beforeEach(() => {
    process.env["TMUX"] = "/tmp/tmux/default,0,0";
  });

  afterEach(() => {
    delete process.env["TMUX"];
    vi.resetAllMocks();
  });

  it("returns enabled panes with required fields", async () => {
    mockListAllPanes.mockResolvedValue([{ paneId: "%1", sessionId: "$0" }]);
    setupPaneOptions("%1", {
      "@tmms_enabled": "true",
      "@tmms_name": "agent-alpha",
      "@tmms_outbox": "/alpha/out",
      "@tmms_inbox": "/alpha/in",
      "@tmms_notify_cmd": "echo ${{filepath}}",
      "@tmms_reply_to": "",
    });

    const panes = await getEnabledPanes();
    expect(panes).toHaveLength(1);
    expect(panes[0]?.name).toBe("agent-alpha");
    expect(panes[0]?.outbox).toBe("/alpha/out");
    expect(panes[0]?.replyTo).toBeUndefined();
  });

  it("skips panes where tmms_enabled is not true", async () => {
    mockListAllPanes.mockResolvedValue([
      { paneId: "%1", sessionId: "$0" },
      { paneId: "%2", sessionId: "$0" },
    ]);
    mockShowPaneOption.mockImplementation(async (_id: string, opt: string) => {
      if (opt === "@tmms_enabled") return "false";
      return "";
    });

    const panes = await getEnabledPanes();
    expect(panes).toHaveLength(0);
  });

  it("skips panes missing required fields", async () => {
    mockListAllPanes.mockResolvedValue([{ paneId: "%1", sessionId: "$0" }]);
    setupPaneOptions("%1", {
      "@tmms_enabled": "true",
      "@tmms_name": "agent-alpha",
      // Missing outbox, inbox, notifyCmd
    });

    const panes = await getEnabledPanes();
    expect(panes).toHaveLength(0);
  });

  it("includes replyTo when set", async () => {
    mockListAllPanes.mockResolvedValue([{ paneId: "%1", sessionId: "$0" }]);
    setupPaneOptions("%1", {
      "@tmms_enabled": "true",
      "@tmms_name": "agent-beta",
      "@tmms_outbox": "/beta/out",
      "@tmms_inbox": "/beta/in",
      "@tmms_notify_cmd": "echo",
      "@tmms_reply_to": "user-main",
    });

    const panes = await getEnabledPanes();
    expect(panes[0]?.replyTo).toBe("user-main");
  });
});

describe("getCurrentPaneInfo", () => {
  afterEach(() => {
    delete process.env["TMUX"];
    vi.resetAllMocks();
  });

  it("throws TmuxNotAvailableError when not in tmux", async () => {
    delete process.env["TMUX"];
    mockIsTmuxAvailable.mockReturnValue(false);
    await expect(getCurrentPaneInfo()).rejects.toThrow(TmuxNotAvailableError);
  });

  it("returns current pane info when available", async () => {
    process.env["TMUX"] = "/tmp/tmux/default,0,0";
    mockIsTmuxAvailable.mockReturnValue(true);
    mockGetCurrentPaneId.mockResolvedValue("%1");
    mockShowPaneOption.mockImplementation(async (_id: string, opt: string) => {
      const vals: Record<string, string> = {
        "@tmms_name": "agent-alpha",
        "@tmms_outbox": "/alpha/out",
        "@tmms_reply_to": "user-main",
      };
      return vals[opt] ?? "";
    });

    const info = await getCurrentPaneInfo();
    expect(info.name).toBe("agent-alpha");
    expect(info.outbox).toBe("/alpha/out");
    expect(info.replyTo).toBe("user-main");
  });

  it("throws MissingPaneMetadataError when @tmms_name not set", async () => {
    process.env["TMUX"] = "/tmp/tmux/default,0,0";
    mockIsTmuxAvailable.mockReturnValue(true);
    mockGetCurrentPaneId.mockResolvedValue("%1");
    mockShowPaneOption.mockResolvedValue("");

    await expect(getCurrentPaneInfo()).rejects.toThrow(MissingPaneMetadataError);
  });

  it("throws MissingPaneMetadataError when @tmms_outbox not set", async () => {
    process.env["TMUX"] = "/tmp/tmux/default,0,0";
    mockIsTmuxAvailable.mockReturnValue(true);
    mockGetCurrentPaneId.mockResolvedValue("%1");
    mockShowPaneOption.mockImplementation(async (_id: string, opt: string) => {
      if (opt === "@tmms_name") return "agent-alpha";
      return "";
    });

    await expect(getCurrentPaneInfo()).rejects.toThrow(MissingPaneMetadataError);
  });
});
