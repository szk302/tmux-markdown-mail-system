# TMMS — Tmux Markdown Mailer System

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Version](https://img.shields.io/badge/version-0.1.0-blue)

> **Note:** This project is in early development (v0.1.0). The API may change between releases.

TMMS is a lightweight asynchronous messaging system that treats tmux panes as virtual mail clients. Messages are Markdown files with YAML front matter, and the file system serves as the message queue — no external database required. It is designed for communication between AI agents or between humans and agents running in tmux sessions.

---

## Features

- **Pane-to-pane messaging** — Send and receive messages between tmux panes using standard file operations
- **Markdown + YAML front matter** — Human-readable message format compatible with any text editor or Markdown tool
- **File system as queue** — Zero external dependencies; `ls`, `cat`, and `rm` are your inbox viewer
- **Automatic routing** — Polling server moves messages from `outbox` to the correct `inbox`
- **Customizable notifications** — Per-pane `notify_cmd` with variable expansion (`${{filepath}}`, `${{tmms_from}}`, etc.)
- **Dead letter handling** — Messages with unknown recipients are isolated rather than lost
- **Graceful shutdown** — Server handles `SIGINT`/`SIGTERM` cleanly

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  tmux session                                        │
│                                                      │
│  ┌─────────────┐          ┌─────────────┐           │
│  │  Pane A     │          │  Pane B     │           │
│  │  (sender)   │          │  (receiver) │           │
│  └──────┬──────┘          └──────┬──────┘           │
│         │ tmms post               │                  │
│         ▼                         │                  │
│  [A's outbox/]    tmms server     │                  │
│    msg.md    ──────────────────►  [B's inbox/]       │
│                 mv (routing)        msg.md            │
│                                     │                │
│                               @tmms_notify_cmd       │
│                               executed per file      │
└─────────────────────────────────────────────────────┘
```

**Flow:**
1. `tmms post` writes a message to the current pane's `outbox`
2. `tmms server` polls all `outbox` directories and moves files to the recipient's `inbox`
3. For each file found in an `inbox`, the server runs `@tmms_notify_cmd` with variable expansion
4. The recipient reads messages with `cat`, processes them, and removes them with `rm`

---

## Prerequisites

- **Node.js >= 20**
- **tmux** installed and available in `PATH`
- `tmms post` must be run **inside a tmux session** (reads current pane metadata from tmux)
- `tmms server` can run outside a tmux session as long as a tmux server is running with active sessions

---

## Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd tmms
pnpm install

# Build
pnpm build

# Make available globally (choose one)
pnpm link --global
# or add to PATH:
export PATH="$PATH:/path/to/tmms/dist"
# or use directly:
node dist/index.js --help
```

---

## Quick Start

### 1. Start a tmux session with two panes

```bash
tmux new-session -s demo
# Split horizontally: Ctrl-b %
```

### 2. Create inbox/outbox directories

```bash
mkdir -p ~/tmms/alpha/{inbox,outbox}
mkdir -p ~/tmms/beta/{inbox,outbox}
mkdir -p ~/tmms/dead_letter
```

### 3. Set tmux pane metadata

In **Pane A** (e.g., `%0`):
```bash
tmux set-option -p @tmms_enabled true
tmux set-option -p @tmms_name    "agent-alpha"
tmux set-option -p @tmms_outbox  "$HOME/tmms/alpha/outbox"
tmux set-option -p @tmms_inbox   "$HOME/tmms/alpha/inbox"
tmux set-option -p @tmms_notify_cmd 'echo "[$TERM_SESSION_ID] New mail: ${{tmms_from}} -> ${{filepath}}"'
```

In **Pane B** (e.g., `%1`):
```bash
tmux set-option -p @tmms_enabled true
tmux set-option -p @tmms_name    "agent-beta"
tmux set-option -p @tmms_outbox  "$HOME/tmms/beta/outbox"
tmux set-option -p @tmms_inbox   "$HOME/tmms/beta/inbox"
tmux set-option -p @tmms_notify_cmd 'echo "New mail from ${{tmms_from}}: ${{tmms_subject}}"'
tmux set-option -p @tmms_reply_to "agent-alpha"
```

### 4. Initialize and edit the server config

```bash
tmms server init          # creates ~/.config/tmms/config.yml
```

> **Required:** Edit the generated file and set `dead_letter_dir` to a real path (e.g., `~/tmms/dead_letter`).

```yaml
polling_interval: 10
dead_letter_dir: /home/youruser/tmms/dead_letter
```

### 5. Start the server (in a dedicated pane or background)

```bash
tmms server               # auto-discovers ~/.config/tmms/config.yml
```

### 6. Send a message from Pane A

```bash
# Plain text via stdin
echo "Hello from alpha!" | tmms post -t agent-beta -s "Greeting"

# From a Markdown file
tmms post -t agent-beta -s "Report" -f report.md
```


### 7. Check received messages in Pane B

```bash
ls ~/tmms/beta/inbox/
cat ~/tmms/beta/inbox/*.md
rm  ~/tmms/beta/inbox/*.md   # mark as processed
```

---

## Usage

### `tmms server`

Start the TMMS routing server. Polls all enabled panes and processes Task A (routing) then Task B (notification) on each cycle.

```bash
tmms server [options]
```

| Option | Description |
| :--- | :--- |
| `-c, --config <PATH>` | Path to config file (skips auto-discovery) |

When `-c` is not specified, the server searches for a config file in the following order:

1. `~/.tmms.yml`
2. `~/.tmms/config.yml`
3. `~/.config/tmms/config.yml`

The server runs until it receives `SIGINT` (`Ctrl-C`) or `SIGTERM`.

---

### `tmms server init`

Generate a default config file template.

```bash
tmms server init [options]
```

| Option | Default | Description |
| :--- | :--- | :--- |
| `-o, --output <PATH>` | `~/.config/tmms/config.yml` | Output path for the config file |

The parent directory is created automatically if it does not exist. Exits with an error if the output file already exists.

---

### `tmms post`

Compose and deliver a message from the current pane's outbox.

```bash
tmms post [options] [file]
# or via stdin
echo "Body" | tmms post [options]
```

| Option | Description |
| :--- | :--- |
| `-t, --to <ADDRESS>` | Recipient's `@tmms_name`. Falls back to `@tmms_reply_to` if omitted; errors if neither is set. |
| `-s, --subject <TEXT>` | Message subject (sets `tmms_subject` in front matter). |
| `-f, --file <PATH>` | Path to a Markdown file to send. The original file is left unchanged. |

On success, prints the full path of the created outbox file to stdout.

---

## Configuration

### Server config (`config.yml`)

```yaml
# Polling interval in seconds (default: 60)
polling_interval: 60

# Directory for messages with unknown recipients (required, must exist or be creatable)
dead_letter_dir: /path/to/dead_letter
```

### tmux pane variables

Set these with `tmux set-option -p <variable> <value>` inside the target pane.

| Variable | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `@tmms_enabled` | boolean | Yes | Set to `true` to include this pane in TMMS routing |
| `@tmms_name` | string | Yes | Pane identifier used as the `From`/`To` address |
| `@tmms_outbox` | string | Yes | Absolute path to the outbox directory |
| `@tmms_inbox` | string | Yes | Absolute path to the inbox directory |
| `@tmms_notify_cmd` | string | Yes | Shell command executed when inbox contains files |
| `@tmms_reply_to` | string | No | Default recipient for `tmms post` when `-t` is omitted |

---

## Message Format

Messages are Markdown files with a YAML front matter block.

```markdown
---
tmms_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
tmms_from: agent-alpha
tmms_to: agent-beta
tmms_created_at: 2026-03-22T14:30:05Z
tmms_subject: Task complete
tags:
  - report
---

The analysis is complete. See attached results.
```

### System-managed keys (`tmms_` prefix)

| Key | Required | Description |
| :--- | :--- | :--- |
| `tmms_id` | Yes | UUID v4 — generated by `tmms post` |
| `tmms_from` | Yes | Sender's `@tmms_name` |
| `tmms_to` | Yes | Recipient's `@tmms_name` |
| `tmms_created_at` | Yes | ISO 8601 creation timestamp |
| `tmms_subject` | No | Message subject |
| `tmms_thread_id` | No | Thread tracking ID |

> **Merge rules:** When `tmms post` processes an existing front matter block, all `tmms_` keys are overwritten by system-generated values. All other keys (e.g., `tags`, `aliases`) are preserved as-is.

### File naming convention

```
{YYYYMMDD-HHMMSS}_{From}_to_{To}_{ShortID}.md
```

Example: `20260322-143005_agent-alpha_to_agent-beta_a1b2c3d4.md`

### Notification command variables

The `@tmms_notify_cmd` string supports `${{variable}}` expansion before execution:

| Variable | Value |
| :--- | :--- |
| `${{filepath}}` | Absolute path to the inbox file |
| `${{tmms_id}}` | Message ID |
| `${{tmms_from}}` | Sender address |
| `${{tmms_to}}` | Recipient address |
| `${{tmms_subject}}` | Subject (empty string if not set) |
| `${{tmms_thread_id}}` | Thread ID (empty string if not set) |

> **Note:** The notification command is executed on **every polling cycle** as long as the file remains in the inbox. Delete or move the file to stop repeated notifications.

---

## Use Cases

### Multi-agent collaboration

Run multiple Claude Code (or any AI agent) sessions in separate tmux panes. Each agent has its own inbox/outbox. Agents send task requests and results to each other using `tmms post`, and receive notifications via their `@tmms_notify_cmd`.

```
┌──────────────┐     tmms post     ┌──────────────┐
│  Orchestrator│ ────────────────► │  Worker A    │
│  (agent-main)│ ◄──────────────── │  (agent-a)   │
└──────────────┘     tmms post     └──────────────┘
```

### Notification to a tmux pane status line

```bash
# Set notify_cmd to display a message count in the tmux status bar
tmux set-option -p @tmms_notify_cmd \
  'tmux set-option -p @tmms_unread "$(ls ${{filepath}} | wc -l) unread"'
```

---

## Development

### Setup

```bash
pnpm install
```

### Scripts

| Command | Description |
| :--- | :--- |
| `pnpm build` | Compile TypeScript with tsup → `dist/index.js` |
| `pnpm dev` | Watch mode build |
| `pnpm test` | Run all tests with vitest |
| `pnpm test:coverage` | Run tests with v8 coverage (threshold: 80%) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

### Project structure

```
src/
├── index.ts              # CLI entry point (commander)
├── commands/
│   ├── server.ts         # tmms server
│   ├── server-init.ts    # tmms server init
│   └── post.ts           # tmms post
├── server/
│   ├── route-messages.ts # Task A: outbox → inbox routing
│   ├── notify-inbox.ts   # Task B: inbox notification + variable expansion
│   └── polling-loop.ts   # Polling loop + graceful shutdown
├── post/
│   └── compose-message.ts# Message composition and front matter merge
├── tmux/
│   ├── client.ts         # tmux CLI wrapper (execFile)
│   └── pane-registry.ts  # Scan @tmms_enabled panes
├── message/
│   ├── frontmatter.ts    # Parse / merge / serialize front matter
│   └── filename.ts       # File naming convention
├── config/
│   ├── schema.ts         # Config validation
│   ├── loader.ts         # YAML config loader
│   └── defaults.ts       # Default config template
└── shared/
    ├── types.ts          # Shared TypeScript types
    ├── constants.ts      # Constants
    ├── errors.ts         # Custom error classes
    └── logger.ts         # Structured stderr logger
```
