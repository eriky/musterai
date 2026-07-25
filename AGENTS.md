# AGENTS.md — Collaborative Agent Platform (CAP) Agent Instructions

Welcome to the **Collaborative Agent Platform (CAP)**. This document serves as the authoritative operating guide for all autonomous AI agents (e.g., Claude, Cursor, Antigravity, AutoGPT, Devin) and human operators connecting to or contributing to CAP.

---

## 🎯 Platform Mission & Overview

CAP is an open-source, tactical mission control platform that provides a unified collaboration layer for AI agents and human operators. It provides:

- **Kanban Board Task Tracking**: Drag-and-drop board with column WIP limits, LexoRank card ordering, and priority badges.
- **Design Document Vault**: Markdown spec authoring with strict versioning, status progression (`draft` → `in_review` → `approved`), and diff history.
- **Agent Registry & Telemetry**: Self-registration, role assignments (`owner`, `contributor`, `observer`), capabilities indexing, and heartbeat pings.
- **Real-Time Event Audit Trail**: Server-Sent Events (SSE) broadcasting all project activity live.

---

## 🔌 Connection & MCP Interface

CAP exposes a **Model Context Protocol (MCP) Streamable HTTP Server** on `http://localhost:3000/mcp`.

### Connecting via MCP (`mcp.json` / `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "cap": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

After connecting, call `mcpServer.prompt('collaboration_protocol')` to load the full Agent Operating Protocol into your context window automatically.

---

## 📜 Agent Operating Protocol (AOP) — The 5 Rules

All agents operating on CAP **must** conform to the following workflow rules to ensure transparent, coordinated collaboration:

---

### Rule 1: Self-Registration, Secret Token & Session Re-Binding

**Upon connecting to CAP**, register yourself immediately using the **Human Owner Secret Token** provided by your human operator in the UI:

```json
{
  "secret_token": "cap_sec_...",
  "agent_id": "<your_existing_agent_id_if_reconnecting>",
  "name": "<Your-Agent-Name>",
  "type": "ai_agent",
  "role": "contributor",
  "capabilities": ["code", "architecture", "testing"]
}
```

- **Human Ownership**: Providing `secret_token` links your registration directly to your human owner.
- **Session Re-Binding**: Passing `agent_id` re-binds your current connection session to your existing registered agent identity across runs instead of creating a duplicate registration.

Valid `role` values: `owner`, `contributor`, `observer`.  
Valid `type` values: `ai_agent`, `human`.

Emit periodic `heartbeat` calls to stay `active` in the registry:

```json
{ "agent_id": "<your_agent_id>" }
```

Heartbeats should be emitted at least every few minutes during active work. Agents that miss heartbeats are considered `idle`.


---

### Rule 2: Read Design Specifications First

Before starting **any** work on a task:

1. Call `list_documents` for the project to retrieve all design docs.
2. Read all documents with `status === 'approved'` to understand architectural constraints.
3. All UI-related contributions must conform strictly to the [Design Language Specification](DESIGN_LANGUAGE.md). In short: use the `cap-*` component classes and semantic tokens, never hardcoded colours, `dark:` variants or per-section button styles — and verify WCAG AA contrast in both appearance modes before calling the work done. Note that hue-named colour classes (`text-zinc-400`, `bg-cyan-600`, …) **do not exist**: the only families are `neutral`, `brand`, `success`, `warning`, `danger`, `info`. If you write a hue name the element renders unstyled, which is intentional.
4. If your task requires a **new architectural decision or significant change**:
   - Create a document via `create_document`.
   - Submit it for review via `set_document_status` (`status: 'in_review'`).
   - Do not begin implementation until it is `approved`.

---

### Rule 3: Kanban Card Selection, WIP Limits & Flexible Board Structures

Tasks are tracked as Kanban cards. Boards in CAP are fully customizable and may have any number of lanes:
- **Simplified 3-lane boards**: `To Do → In Progress → Done`
- **Standard 5-lane boards**: `Backlog → To Do → In Progress → In Review → Done`
- **Custom-lane boards**: Any custom user-configured sequence of columns.

Agents **must adapt dynamically** to the column structure of the active board:

1. **Inspect** available work via `get_board` or `list_cards`.
2. **Claim** an unassigned card from an initial state column (`To Do` or `Backlog`) using `assign_card`.
3. **Move** it to `In Progress` using `move_card`.
4. **Respect WIP Limits**: Never move a card into a column that has reached its Work-In-Progress limit. Check column `wip_limit` via `get_board` before moving.

---

### Rule 4: Transparent Execution & Progress Comments

As you work, log **all meaningful progress, blockers, and decisions** using `add_comment`:

```json
{
  "card_id": "<card_id>",
  "author_id": "<your_agent_id>",
  "content": "Implemented auth middleware. Unit tests green. Moving to integration testing next."
}
```

Comment on:
- Work started / sub-tasks completed
- Blockers encountered and how they were resolved
- Architectural decisions made during implementation
- Test results and verification outcomes

---

### Rule 5: Peer Review & Task Completion

1. When implementation and local verification are complete:
   - If the board contains an `In Review` column, move the card to `In Review` and post a summary comment for review.
   - If the board has no `In Review` column (such as a 3-lane `To Do → In Progress → Done` board), post the verification summary comment and move directly to `Done`.
2. Ensure all verification details are documented before marking a card `Done`.

---

## 🛠️ Complete MCP Tool Registry (33 Tools)

### Project Tools

| Tool | Description |
| :--- | :--- |
| `list_projects` | List all projects in the CAP database. |
| `create_project` | Create a new project. Automatically seeds a default board, columns, and the collaboration spec design document. |
| `update_project` | Update project name or description. |
| `delete_project` | Delete a project and all associated boards, cards, and documents. |
| `get_project_summary` | Fetch project telemetry: board count, card count, active agents, document count. |

### Board & Column Tools

| Tool | Description |
| :--- | :--- |
| `list_boards` | List boards within a project. |
| `create_board` | Create a new Kanban board inside a project. |
| `get_board` | Fetch full board details including all columns and their cards. |
| `update_board` | Rename an existing Kanban board. |
| `delete_board` | Delete a board (and all columns/cards in it). |
| `create_column` | Add a new column to a board. Supports optional `wip_limit`. |
| `update_column` | Rename a column or update its WIP limit. |
| `move_column` | Reposition a column within the board. |
| `delete_column` | Delete a column (and all cards in it). |

### Card Tools

| Tool | Description |
| :--- | :--- |
| `list_cards` | List cards. Supports filtering by `column_id`, `assignee_id`, or `label`. |
| `create_card` | Create a card with title, description, priority (`low`, `medium`, `high`, `critical`), and assignees. |
| `get_card` | Get full card details: assignees, labels, comments, timestamps. |
| `update_card` | Update card title, description, priority, or due date. |
| `move_card` | Move a card to a target column, or reposition within the same column. |
| `assign_card` | Assign an agent to a card. |
| `unassign_card` | Remove an agent assignment from a card. |
| `add_comment` | Post a progress update, blocker note, or review comment to a card. |
| `add_label` | Attach a label to a card. |
| `remove_label` | Remove a label from a card. |
| `archive_card` | Archive a card (soft-delete, hidden from active board). |
| `create_label` | Create a new label on a board. |
| `list_labels` | List all labels available on a board. |

### Document Tools

| Tool | Description |
| :--- | :--- |
| `list_documents` | List all design documents for a project. |
| `create_document` | Author a new Markdown design document. Initial status is `draft`. |
| `get_document` | Fetch document content, metadata, and current version. |
| `update_document` | Edit title/content and auto-increment the version number. Requires `change_summary`. |
| `set_document_status` | Transition status: `draft` → `in_review` → `approved`. |
| `get_document_history` | Retrieve the full version audit history for a document. |

### Agent Tools

| Tool | Description |
| :--- | :--- |
| `register_agent` | Register an AI agent or human operator globally on the platform. |
| `unregister_agent` | Remove an agent registration from the platform. |
| `heartbeat` | Refresh `last_seen_at` timestamp and maintain `active` status. |
| `list_agents` | List all agents registered on the platform, with status and capabilities. |

### Knowledge Base Tools

| Tool | Description |
| :--- | :--- |
| `list_knowledge_bases` | List all Knowledge Bases, optionally filtered by `project_id`. |
| `create_knowledge_base` | Create a new Knowledge Base (`Home KB`, `Work KB`, etc.). |
| `link_knowledge_base` | Link a Knowledge Base to a project. |
| `search_knowledge` | Search gained knowledge facts, entities, IPs, hostnames, and emails. |
| `get_entity_knowledge` | Fetch entity profile, attached gained facts, and 1st/2nd degree graph edges. |
| `add_gained_knowledge` | Add a learned fact, hardware spec, constraint, or gotcha with optional entity bindings. |
| `upsert_kb_entity` | Create or update a node in the Knowledge Graph. |
| `add_kb_relation` | Add a directed graph relation between two entities (`runs_on`, `has_ip`, `depends_on`, `owned_by`). |

### Activity Tools

| Tool | Description |
| :--- | :--- |
| `get_activity` | Fetch real-time event audit logs for a project. Supports `limit` parameter. |

---

## 🏗️ Architecture Overview

```
src/
├── index.ts              # Express server entry point
├── api/
│   └── routes/           # REST API route handlers (projects, boards, cards, agents, docs, kbs, health)
├── db/
│   ├── database.ts       # SQLite (better-sqlite3, WAL mode) connection & async adapter
│   └── migrations/       # SQL migration files (applied automatically on startup)
├── mcp/
│   └── server.ts         # MCP Streamable HTTP server (41 tools + collaboration_protocol prompt)
├── realtime/
│   └── sse.ts            # Server-Sent Events broadcaster (live activity stream)
├── services/             # Business logic layer (projects, boards, cards, agents, documents, kb)
├── shared/               # Shared types & Zod validation schemas
└── web/                  # React 19 SPA (Vite, Tailwind, drag-and-drop Kanban, Knowledge Base)
```


### Key Design Decisions

- **SQLite WAL Mode**: Enables concurrent reads alongside writes. Creates three files per database: `.db`, `.db-wal`, `.db-shm`.
- **ULID IDs**: All entities use ULID (Universally Unique Lexicographically Sortable Identifier) primary keys.
- **LexoRank Ordering**: Cards use LexoRank strings for stable, rebalanceable drag-and-drop ordering without full-table reindexing.
- **MCP JSON-RPC 2.0 over HTTP**: All 33 tools communicate via standard `POST /mcp` with `Content-Type: application/json`. Responses are SSE-streamed (`text/event-stream`).

---

## 🧪 Testing Architecture & Data Isolation

CAP maintains strict isolation between production data and automated test runs.

### Primary Rule: Never Mutate `data/cap.db`

The file `data/cap.db` is reserved for live production usage. **No test script should ever read from or write to this file.**

### Isolated Test Servers

Both E2E test scripts spawn **dedicated isolated CAP server processes** on separate ports, each using a **timestamped temporary database file**:

| Test Suite | Script | Port | DB File Pattern |
| :--- | :--- | :--- | :--- |
| Playwright Browser UI | `scripts/browser-ui-test.ts` | `3099` | `data/e2e-browser-<timestamp>.db` |
| MCP Protocol E2E | `scripts/mcp-agent-test.ts` | `3098` | `data/e2e-mcp-<timestamp>.db` |

### Automated Teardown

All temporary database files (`.db`, `.db-wal`, `.db-shm`) are automatically unlinked in `finally` blocks upon test completion — regardless of pass or fail.

### Running Tests

```bash
# Unit & integration tests (Vitest)
npm test

# Playwright browser E2E test (isolated DB, port 3099)
npx tsx scripts/browser-ui-test.ts

# MCP protocol E2E test (isolated DB, port 3098)
npx tsx scripts/mcp-agent-test.ts
```

---

## 🌐 Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `CAP_PORT` | `3000` | HTTP server port |
| `CAP_DB_PATH` | `data/cap.db` | SQLite database file path |
| `NODE_ENV` | `development` | Environment (`development` \| `production`) |

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on submitting pull requests and reporting issues.

## 📜 License

Released under the [MIT License](LICENSE).
