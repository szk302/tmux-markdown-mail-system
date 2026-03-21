# TMMS — Tmux Markdown Mailer System

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Version](https://img.shields.io/badge/version-0.1.0-blue)

> **注意:** このプロジェクトは開発初期段階（v0.1.0）です。リリース間で API が変更される可能性があります。

TMMS は、tmux ペインを仮想メールクライアントとして扱う軽量な非同期メッセージングシステムです。メッセージは YAML フロントマター付きの Markdown ファイルであり、ファイルシステムがメッセージキューとして機能します。外部データベースは不要です。tmux セッション上で動作する AI エージェント間、または人間とエージェント間の通信を目的として設計されています。

---

## 特徴

- **ペイン間メッセージング** — 標準のファイル操作で tmux ペイン間のメッセージ送受信が可能
- **Markdown + YAML フロントマター** — テキストエディタや Markdown ツールと互換性のある人間が読みやすいメッセージ形式
- **ファイルシステムをキューとして利用** — 外部依存ゼロ。受信メッセージの確認は `ls`、`cat`、`rm` だけで完結
- **自動ルーティング** — ポーリングサーバが `outbox` のメッセージを正しい `inbox` へ自動転送
- **通知コマンドのカスタマイズ** — ペインごとに `notify_cmd` を設定し、変数展開（`${{filepath}}`、`${{tmms_from}}` 等）に対応
- **Dead letter 処理** — 宛先不明のメッセージはロストせず隔離ディレクトリへ移動
- **グレースフルシャットダウン** — `SIGINT`/`SIGTERM` を受信してサーバを安全に停止

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  tmux セッション                                     │
│                                                      │
│  ┌─────────────┐          ┌─────────────┐           │
│  │  ペイン A   │          │  ペイン B   │           │
│  │  （送信側） │          │  （受信側） │           │
│  └──────┬──────┘          └──────┬──────┘           │
│         │ tmms post               │                  │
│         ▼                         │                  │
│  [A の outbox/]  tmms server      │                  │
│    msg.md    ──────────────────►  [B の inbox/]      │
│                 mv（ルーティング）   msg.md            │
│                                     │                │
│                               @tmms_notify_cmd       │
│                               ファイルごとに実行      │
└─────────────────────────────────────────────────────┘
```

**フロー:**
1. `tmms post` が現在のペインの `outbox` にメッセージを書き出す
2. `tmms server` がすべての `outbox` をポーリングし、宛先の `inbox` へファイルを移動
3. `inbox` にファイルが存在する場合、変数展開付きで `@tmms_notify_cmd` を実行
4. 受信側は `cat` でメッセージを読み、処理後に `rm` で削除する

---

## 前提条件

- **Node.js >= 20**
- **tmux** がインストールされ `PATH` に存在すること
- `tmms post` は **tmux セッション内**で実行すること（現在のペインのメタデータを読み取るため）
- `tmms server` はセッション外からでも起動可能（tmux サーバが起動済みでセッションが存在すれば良い）

---

## インストール

```bash
# クローンして依存パッケージをインストール
git clone <repository-url>
cd tmms
pnpm install

# ビルド
pnpm build

# グローバルで利用できるようにする（いずれかの方法で）
pnpm link --global
# または PATH に追加:
export PATH="$PATH:/path/to/tmms/dist"
# または直接実行:
node dist/index.js --help
```

---

## クイックスタート

### 1. 2ペインの tmux セッションを起動する

```bash
tmux new-session -s demo
# 水平分割: Ctrl-b %
```

### 2. inbox/outbox ディレクトリを作成する

```bash
mkdir -p ~/tmms/alpha/{inbox,outbox}
mkdir -p ~/tmms/beta/{inbox,outbox}
mkdir -p ~/tmms/dead_letter
```

### 3. tmux ペインのメタデータを設定する

**ペイン A**（例: `%0`）で実行:
```bash
tmux set-option -p @tmms_enabled true
tmux set-option -p @tmms_name    "agent-alpha"
tmux set-option -p @tmms_outbox  "$HOME/tmms/alpha/outbox"
tmux set-option -p @tmms_inbox   "$HOME/tmms/alpha/inbox"
tmux set-option -p @tmms_notify_cmd 'echo "新着メール: ${{tmms_from}} -> ${{filepath}}"'
```

**ペイン B**（例: `%1`）で実行:
```bash
tmux set-option -p @tmms_enabled true
tmux set-option -p @tmms_name    "agent-beta"
tmux set-option -p @tmms_outbox  "$HOME/tmms/beta/outbox"
tmux set-option -p @tmms_inbox   "$HOME/tmms/beta/inbox"
tmux set-option -p @tmms_notify_cmd 'echo "件名: ${{tmms_subject}} (from ${{tmms_from}})"'
tmux set-option -p @tmms_reply_to "agent-alpha"
```

### 4. サーバ設定ファイルを初期化・編集する

```bash
tmms server init          # ~/.config/tmms/config.yml を生成
```

> **必須:** 生成されたファイルを開き、`dead_letter_dir` を実際のパスに変更してください。

```yaml
polling_interval: 10
dead_letter_dir: /home/youruser/tmms/dead_letter
```

### 5. サーバを起動する（専用ペインまたはバックグラウンドで）

```bash
tmms server               # ~/.config/tmms/config.yml を自動探索して起動
```

### 6. ペイン A からメッセージを送信する

```bash
# 標準入力から送信
echo "Hello from alpha!" | tmms post -t agent-beta -s "挨拶"

# Markdown ファイルから送信
tmms post -t agent-beta -s "レポート" -f report.md
```


### 7. ペイン B で受信メッセージを確認する

```bash
ls ~/tmms/beta/inbox/
cat ~/tmms/beta/inbox/*.md
rm  ~/tmms/beta/inbox/*.md   # 処理済みとしてマーク
```

---

## 使い方

### `tmms server`

TMMS ルーティングサーバを起動します。有効なペインをポーリングし、各サイクルで Task A（ルーティング）→ Task B（通知）を実行します。

```bash
tmms server [オプション]
```

| オプション | 説明 |
| :--- | :--- |
| `-c, --config <PATH>` | 設定ファイルのパスを明示指定（自動探索をスキップ） |

`-c` を指定しない場合、以下の順序で設定ファイルを探索します:

1. `~/.tmms.yml`
2. `~/.tmms/config.yml`
3. `~/.config/tmms/config.yml`

`SIGINT`（Ctrl-C）または `SIGTERM` を受信するまで実行を続けます。

---

### `tmms server init`

デフォルトの設定ファイルテンプレートを生成します。

```bash
tmms server init [オプション]
```

| オプション | デフォルト | 説明 |
| :--- | :--- | :--- |
| `-o, --output <PATH>` | `~/.config/tmms/config.yml` | 設定ファイルの出力パス |

出力先の親ディレクトリが存在しない場合は自動的に作成されます。出力先にファイルが既に存在する場合はエラーで終了します。

---

### `tmms post`

現在のペインの outbox にメッセージを作成・配置します。

```bash
tmms post [オプション] [ファイル]
# または標準入力から
echo "本文" | tmms post [オプション]
```

| オプション | 説明 |
| :--- | :--- |
| `-t, --to <ADDRESS>` | 宛先の `@tmms_name`。省略時は `@tmms_reply_to` を使用。どちらも未設定の場合はエラー。 |
| `-s, --subject <TEXT>` | メッセージの件名（フロントマターの `tmms_subject` に設定）。 |
| `-f, --file <PATH>` | 送信する Markdown ファイルのパス。元のファイルはそのまま残る。 |

成功時は作成された outbox ファイルのフルパスを標準出力に出力します。

---

## 設定

### サーバ設定（`config.yml`）

```yaml
# ポーリング間隔（秒）（デフォルト: 60）
polling_interval: 60

# 宛先不明メッセージの隔離ディレクトリ
# デフォルト: ~/.local/share/tmms/dead_letter
dead_letter_dir: ~/.local/share/tmms/dead_letter
```

> **注意:** サーバ起動時に `dead_letter_dir` 内に `.md` ファイルが存在する場合、件数とパスを警告として stderr に出力します。

### tmux ペイン変数

対象のペインで `tmux set-option -p <変数名> <値>` を実行して設定します。

| 変数名 | 型 | 必須 | 説明 |
| :--- | :--- | :--- | :--- |
| `@tmms_enabled` | boolean | 必須 | `true` に設定するとそのペインが TMMS のルーティング対象になる |
| `@tmms_name` | string | 必須 | `From`/`To` アドレスとして使用されるペインの識別子 |
| `@tmms_outbox` | string | 必須 | outbox ディレクトリの絶対パス |
| `@tmms_inbox` | string | 必須 | inbox ディレクトリの絶対パス |
| `@tmms_notify_cmd` | string | 必須 | inbox にファイルが存在する場合に実行されるシェルコマンド |
| `@tmms_reply_to` | string | 任意 | `-t` 省略時の `tmms post` デフォルト宛先 |

---

## メッセージフォーマット

メッセージは YAML フロントマターブロック付きの Markdown ファイルです。

```markdown
---
tmms_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
tmms_from: agent-alpha
tmms_to: agent-beta
tmms_created_at: 2026-03-22T14:30:05Z
tmms_subject: タスク完了
tags:
  - report
---

分析が完了しました。結果は以下を参照してください。
```

### システム管理キー（`tmms_` プレフィックス）

| キー | 必須 | 説明 |
| :--- | :--- | :--- |
| `tmms_id` | 必須 | UUID v4 — `tmms post` が自動生成 |
| `tmms_from` | 必須 | 送信元の `@tmms_name` |
| `tmms_to` | 必須 | 宛先の `@tmms_name` |
| `tmms_created_at` | 必須 | ISO 8601 形式の作成日時 |
| `tmms_subject` | 任意 | メッセージの件名 |
| `tmms_thread_id` | 任意 | スレッド追跡用 ID |

> **マージルール:** `tmms post` が既存のフロントマターを処理する際、すべての `tmms_` キーはシステム生成値で上書きされます。それ以外のキー（例: `tags`、`aliases`）はそのまま保持されます。

### ファイル命名規則

```
{YYYYMMDD-HHMMSS}_{From}_to_{To}_{ShortID}.md
```

例: `20260322-143005_agent-alpha_to_agent-beta_a1b2c3d4.md`

### 通知コマンドの変数展開

`@tmms_notify_cmd` の文字列は実行前に `${{変数名}}` 形式で展開されます。

| 変数 | 値 |
| :--- | :--- |
| `${{filepath}}` | inbox ファイルの絶対パス |
| `${{tmms_id}}` | メッセージ ID |
| `${{tmms_from}}` | 送信元アドレス |
| `${{tmms_to}}` | 宛先アドレス |
| `${{tmms_subject}}` | 件名（未設定の場合は空文字列） |
| `${{tmms_thread_id}}` | スレッド ID（未設定の場合は空文字列） |

> **注意:** 通知コマンドは inbox にファイルが存在する限り、**毎ポーリングサイクルで再実行**されます。通知を止めるにはファイルを削除または別ディレクトリへ移動してください。

---

## 活用例

### マルチエージェント協調

複数の Claude Code（または任意の AI エージェント）セッションを別々の tmux ペインで起動します。各エージェントは固有の inbox/outbox を持ち、`tmms post` でタスク依頼や結果報告を相互に送受信します。

```
┌──────────────┐     tmms post     ┌──────────────┐
│  オーケスト  │ ────────────────► │  ワーカー A  │
│  レーター    │ ◄──────────────── │  (agent-a)   │
│  (agent-main)│     tmms post     └──────────────┘
└──────────────┘
```

### tmux ステータスラインへの未読通知

```bash
# 未読件数を tmux ステータスバーに表示する
tmux set-option -p @tmms_notify_cmd \
  'COUNT=$(ls '"$HOME"'/tmms/inbox/*.md 2>/dev/null | wc -l); tmux set-option -p @tmms_unread "${COUNT} 件"'
```

---

## 開発

### セットアップ

```bash
pnpm install
```

### スクリプト

| コマンド | 説明 |
| :--- | :--- |
| `pnpm build` | tsup で TypeScript をコンパイル → `dist/index.js` |
| `pnpm dev` | ウォッチモードでビルド |
| `pnpm test` | vitest でテストを実行 |
| `pnpm test:coverage` | v8 カバレッジ付きでテスト実行（閾値: 80%） |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

### プロジェクト構造

```
src/
├── index.ts              # CLI エントリポイント（commander）
├── commands/
│   ├── server.ts         # tmms server
│   ├── server-init.ts    # tmms server init
│   └── post.ts           # tmms post
├── server/
│   ├── route-messages.ts # Task A: outbox → inbox ルーティング
│   ├── notify-inbox.ts   # Task B: 受信通知 + 変数展開
│   └── polling-loop.ts   # ポーリングループ + グレースフルシャットダウン
├── post/
│   └── compose-message.ts# メッセージ作成・フロントマターマージ
├── tmux/
│   ├── client.ts         # tmux CLI ラッパー（execFile）
│   └── pane-registry.ts  # @tmms_enabled ペインの一覧取得
├── message/
│   ├── frontmatter.ts    # フロントマターのパース / マージ / シリアライズ
│   └── filename.ts       # ファイル命名規則
├── config/
│   ├── schema.ts         # 設定バリデーション
│   ├── loader.ts         # YAML 設定ファイル読込
│   └── defaults.ts       # デフォルト設定テンプレート
└── shared/
    ├── types.ts          # 共通 TypeScript 型定義
    ├── constants.ts      # 定数
    ├── errors.ts         # カスタムエラークラス
    └── logger.ts         # 構造化 stderr ロガー
```
