export class TmmsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "TmmsError";
  }
}

export class PaneNotFoundError extends TmmsError {
  constructor(name: string) {
    super(`Pane not found: ${name}`, "PANE_NOT_FOUND");
    this.name = "PaneNotFoundError";
  }
}

export class ConfigNotFoundError extends TmmsError {
  constructor(path: string) {
    super(`Config file not found: ${path}`, "CONFIG_NOT_FOUND");
    this.name = "ConfigNotFoundError";
  }
}

export class TmuxNotAvailableError extends TmmsError {
  constructor() {
    super("Not running inside a tmux session", "TMUX_NOT_AVAILABLE");
    this.name = "TmuxNotAvailableError";
  }
}

export class MissingPaneMetadataError extends TmmsError {
  constructor(variable: string) {
    super(`Required tmux pane variable not set: ${variable}`, "MISSING_PANE_METADATA");
    this.name = "MissingPaneMetadataError";
  }
}

export class NoRecipientError extends TmmsError {
  constructor() {
    super(
      "No recipient specified. Use -t option or set @tmms_reply_to on the pane.",
      "NO_RECIPIENT",
    );
    this.name = "NoRecipientError";
  }
}
