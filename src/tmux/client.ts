import { execFile } from "child_process";
import { promisify } from "util";
import { TmuxNotAvailableError } from "../shared/errors.js";

const execFileAsync = promisify(execFile);

export function isTmuxAvailable(): boolean {
  return Boolean(process.env["TMUX"]);
}

export async function tmuxCommand(args: string[]): Promise<string> {
  if (!isTmuxAvailable()) {
    throw new TmuxNotAvailableError();
  }
  const { stdout } = await execFileAsync("tmux", args);
  return stdout.trim();
}

export async function getCurrentPaneId(): Promise<string> {
  return tmuxCommand(["display-message", "-p", "#{pane_id}"]);
}

export async function showPaneOption(paneId: string, optionName: string): Promise<string> {
  try {
    const result = await tmuxCommand([
      "show-options",
      "-p",
      "-v",
      "-t",
      paneId,
      optionName,
    ]);
    return result;
  } catch {
    return "";
  }
}

export interface RawPane {
  paneId: string;
  sessionId: string;
}

export async function listAllPanes(): Promise<RawPane[]> {
  const output = await tmuxCommand([
    "list-panes",
    "-a",
    "-F",
    "#{pane_id}:#{session_id}",
  ]);
  if (!output) return [];
  return output.split("\n").map((line) => {
    const [paneId, sessionId] = line.split(":");
    return { paneId: paneId ?? "", sessionId: sessionId ?? "" };
  });
}
