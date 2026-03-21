import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must mock before imports that use it
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "child_process";
import {
  isTmuxAvailable,
  tmuxCommand,
  getCurrentPaneId,
  listAllPanes,
  showPaneOption,
} from "../../../src/tmux/client.js";
import { TmuxNotAvailableError } from "../../../src/shared/errors.js";

const execFileMock = vi.mocked(execFile);

function mockExecFile(stdout: string) {
  execFileMock.mockImplementation((_cmd: unknown, _args: unknown, callback: unknown) => {
    (callback as (err: null, result: { stdout: string; stderr: string }) => void)(null, {
      stdout,
      stderr: "",
    });
    return {} as ReturnType<typeof execFile>;
  });
}

function mockExecFileError(message: string) {
  execFileMock.mockImplementation((_cmd: unknown, _args: unknown, callback: unknown) => {
    (callback as (err: Error) => void)(new Error(message));
    return {} as ReturnType<typeof execFile>;
  });
}

describe("isTmuxAvailable", () => {
  const originalTmux = process.env["TMUX"];

  afterEach(() => {
    if (originalTmux === undefined) {
      delete process.env["TMUX"];
    } else {
      process.env["TMUX"] = originalTmux;
    }
  });

  it("returns true when TMUX env var is set", () => {
    process.env["TMUX"] = "/tmp/tmux-1234/default,0,0";
    expect(isTmuxAvailable()).toBe(true);
  });

  it("returns false when TMUX env var is unset", () => {
    delete process.env["TMUX"];
    expect(isTmuxAvailable()).toBe(false);
  });
});

describe("tmuxCommand", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns trimmed stdout from tmux (works outside tmux session)", async () => {
    delete process.env["TMUX"];
    mockExecFile("%0\n");
    const result = await tmuxCommand(["display-message", "-p", "#{pane_id}"]);
    expect(result).toBe("%0");
  });
});

describe("getCurrentPaneId", () => {
  beforeEach(() => {
    process.env["TMUX"] = "/tmp/tmux-1234/default,0,0";
  });

  afterEach(() => {
    delete process.env["TMUX"];
    vi.resetAllMocks();
  });

  it("returns current pane id", async () => {
    mockExecFile("%1\n");
    const result = await getCurrentPaneId();
    expect(result).toBe("%1");
  });
});

describe("showPaneOption", () => {
  beforeEach(() => {
    process.env["TMUX"] = "/tmp/tmux-1234/default,0,0";
  });

  afterEach(() => {
    delete process.env["TMUX"];
    vi.resetAllMocks();
  });

  it("returns option value", async () => {
    mockExecFile("agent-alpha\n");
    const result = await showPaneOption("%1", "@tmms_name");
    expect(result).toBe("agent-alpha");
  });

  it("returns empty string when option not set (command error)", async () => {
    mockExecFileError("no server running");
    const result = await showPaneOption("%1", "@tmms_unknown");
    expect(result).toBe("");
  });
});

describe("listAllPanes", () => {
  beforeEach(() => {
    process.env["TMUX"] = "/tmp/tmux-1234/default,0,0";
  });

  afterEach(() => {
    delete process.env["TMUX"];
    vi.resetAllMocks();
  });

  it("parses pane list output", async () => {
    mockExecFile("%0:$0\n%1:$0\n%2:$1\n");
    const panes = await listAllPanes();
    expect(panes).toHaveLength(3);
    expect(panes[0]).toEqual({ paneId: "%0", sessionId: "$0" });
    expect(panes[2]).toEqual({ paneId: "%2", sessionId: "$1" });
  });

  it("returns empty array when no panes", async () => {
    mockExecFile("");
    const panes = await listAllPanes();
    expect(panes).toHaveLength(0);
  });
});
