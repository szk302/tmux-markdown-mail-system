import { listAllPanes, showPaneOption } from "./client.js";
import type { PaneInfo } from "../shared/types.js";

export async function getEnabledPanes(): Promise<PaneInfo[]> {
  const rawPanes = await listAllPanes();
  const results: PaneInfo[] = [];

  for (const { paneId } of rawPanes) {
    const enabled = await showPaneOption(paneId, "@tmms_enabled");
    if (enabled !== "true") continue;

    const name = await showPaneOption(paneId, "@tmms_name");
    const outbox = await showPaneOption(paneId, "@tmms_outbox");
    const inbox = await showPaneOption(paneId, "@tmms_inbox");
    const notifyCmd = await showPaneOption(paneId, "@tmms_notify_cmd");

    if (!name || !outbox || !inbox || !notifyCmd) continue;

    const replyTo = await showPaneOption(paneId, "@tmms_reply_to");

    results.push({
      paneId,
      name,
      outbox,
      inbox,
      notifyCmd,
      replyTo: replyTo || undefined,
    });
  }

  return results;
}

export function findPaneByName(panes: PaneInfo[], name: string): PaneInfo | undefined {
  return panes.find((p) => p.name === name);
}

export async function getCurrentPaneInfo(): Promise<
  Pick<PaneInfo, "name" | "outbox" | "replyTo"> & { paneId: string }
> {
  const { getCurrentPaneId, showPaneOption, isTmuxAvailable } = await import("./client.js");
  const { TmuxNotAvailableError, MissingPaneMetadataError } = await import(
    "../shared/errors.js"
  );

  if (!isTmuxAvailable()) {
    throw new TmuxNotAvailableError();
  }

  const paneId = await getCurrentPaneId();
  const name = await showPaneOption(paneId, "@tmms_name");
  const outbox = await showPaneOption(paneId, "@tmms_outbox");

  if (!name) throw new MissingPaneMetadataError("@tmms_name");
  if (!outbox) throw new MissingPaneMetadataError("@tmms_outbox");

  const replyTo = await showPaneOption(paneId, "@tmms_reply_to");

  return {
    paneId,
    name,
    outbox,
    replyTo: replyTo || undefined,
  };
}
