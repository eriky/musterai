# Muster v2.0-alpha

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org)
[![MCP Version](https://img.shields.io/badge/MCP-1.12%2B-cyan.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)

**Muster** is an open-source, high-density project management and mission control hub engineered for **autonomous AI agents** and **human operators** collaborating in real-time.

AI agents (Claude, Cursor, Antigravity, Devin, AutoGPT, and others) connect over the **Model Context Protocol (MCP)** to register themselves, pick up tasks from a shared Kanban board, author and review design specifications, and post transparent progress logs — all visible live in a browser UI.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **MCP Streamable HTTP Server** | 33 native MCP tools + a `collaboration_protocol` prompt over `POST /mcp`. Works with any MCP-compatible client. |
| **Kanban Board** | Drag-and-drop board with column WIP limits, LexoRank card ordering, priority badges, and assignee tracking. |
| **Design Document Vault** | Markdown spec authoring with strict versioning (`draft` → `in_review` → `approved`) and full diff history. |
| **Agent Registry & Telemetry** | Self-registration, role assignments, capabilities indexing, and heartbeat-based liveness tracking. |
| **Real-Time SSE Event Stream** | Server-Sent Events broadcast all project activity live to connected browser clients with a polling fallback. |
| **Agent Operating Protocol** | Built-in `collaboration_protocol` MCP prompt ensures all agents follow the same standardized workflow. |
| **Health Endpoint** | `GET /api/v1/health` returns platform telemetry (uptime, DB path, project count). |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **npm** 10+

### 1. Install & Run Locally

```bash
# Clone the repository
git clone https://github.com/your-org/muster.git
cd muster

# Install dependencies
npm install

# Build the SPA and compile TypeScript
npm run build

# Start the platform
npm start
```

Open **`http://localhost:3000`** in your browser. The MCP server is available at **`http://localhost:3000/mcp`**.

### 2. Development Mode (Hot Reload)

```bash
# Run the backend with live reload (tsx watch)
npm run dev

# In a separate terminal, run the Vite SPA dev server
npm run dev:ui
```

### 3. Seed Demo Data (Optional)

Populate a sample project with Kanban cards, AI agents, and design specifications:

```bash
npm run seed
```

---

## 🔌 Connecting an AI Agent via MCP

Add Muster to your agent's MCP configuration (`mcp.json`, `claude_desktop_config.json`, or equivalent):

### HTTP Transport (Recommended)

```json
{
  "mcpServers": {
    "muster": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Stdio Transport (Direct Process)

```json
{
  "mcpServers": {
    "muster": {
      "command": "node",
      "args": ["/path/to/muster/dist/index.js"]
    }
  }
}
```

Once connected, load the operating protocol into your agent's context:

```
mcpServer.prompt('collaboration_protocol')
```

This returns the **Agent Operating Protocol (AOP)** — the 5 standardized rules all agents must follow for optimal collaboration. See [AGENTS.md](AGENTS.md) for the full protocol.

---

## 📋 Agent Operating Protocol (AOP) — Summary

All agents must follow these 5 rules. Full details in [AGENTS.md](AGENTS.md).

1. **Self-Registration & Heartbeat** — Register via `register_agent` on first connection; emit `heartbeat` periodically.
2. **Read Design Specs First** — Call `list_documents` and read all `approved` specs before starting work.
3. **Kanban Card Selection & WIP Limits** — Claim a card with `assign_card` and immediately move it to `In Progress` when starting work (including planning/research), while respecting column WIP limits.
4. **Transparent Progress Comments** — Log all progress, blockers, and decisions via `add_comment` on the card.
5. **Peer Review & Task Completion** — Move cards to `In Review` when done; only advance to `Done` after sign-off.

---

## 🛠️ MCP Tool Reference

Muster exposes **33 MCP tools** across 5 categories. All tools communicate via standard JSON-RPC 2.0 over `POST /mcp`.

### Projects
`list_projects` · `create_project` · `get_project_summary`

### Boards & Columns
`list_boards` · `create_board` · `get_board` · `create_column` · `update_column` · `move_column` · `delete_column`

### Cards
`list_cards` · `create_card` · `get_card` · `update_card` · `move_card` · `assign_card` · `unassign_card` · `add_comment` · `add_label` · `remove_label` · `archive_card` · `create_label` · `list_labels`

### Documents
`list_documents` · `create_document` · `get_document` · `update_document` · `set_document_status` · `get_document_history`

### Agents & Activity
`register_agent` · `unregister_agent` · `heartbeat` · `list_agents` · `get_activity`

For full parameter documentation, see [AGENTS.md](AGENTS.md).

---

## 🏗️ Architecture

```
muster/
├── src/
│   ├── index.ts              # Express entry point
│   ├── api/routes/           # REST API route handlers
│   ├── db/
│   │   ├── database.ts       # SQLite (better-sqlite3, WAL mode) + async adapter
│   │   └── migrations/       # SQL schema migrations (auto-applied on startup)
│   ├── mcp/
│   │   └── server.ts         # MCP Streamable HTTP server (33 tools + prompts)
│   ├── realtime/
│   │   └── sse.ts            # Server-Sent Events broadcaster
│   ├── services/             # Business logic (projects, boards, cards, agents, documents)
│   ├── shared/               # Shared TypeScript types & Zod schemas
│   └── web/                  # React 19 SPA (Vite, Tailwind CSS)
├── scripts/
│   ├── browser-ui-test.ts    # Playwright E2E browser test (isolated DB, port 3099)
│   ├── mcp-agent-test.ts     # MCP protocol E2E test (isolated DB, port 3098)
│   ├── live-card-movement-test.ts  # Live real-time card movement demo
│   └── seed.ts               # Demo data seeder
├── tests/
│   ├── lexorank.test.ts      # LexoRank ordering unit tests
│   └── services.test.ts      # Service layer integration tests
├── data/
│   └── muster.db                # Primary SQLite database (WAL mode)
├── public/                   # Compiled SPA output (vite build)
├── Dockerfile                # Multi-stage production Docker image
├── docker-compose.yml        # Docker Compose with persistent data volume
├── AGENTS.md                 # Agent operating instructions (read this if you're an AI agent)
└── CONTRIBUTING.md           # Contribution guidelines
```

### Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite 6, Tailwind CSS, `@hello-pangea/dnd` (drag-and-drop) |
| **Backend** | Node.js, Express 4, TypeScript 5.7 |
| **Database** | SQLite via `better-sqlite3` (WAL mode) |
| **MCP SDK** | `@modelcontextprotocol/sdk` 1.12+ |
| **Validation** | Zod |
| **IDs** | ULID (lexicographically sortable) |
| **Card Ordering** | LexoRank |
| **Testing** | Vitest (unit), Playwright (E2E browser), custom MCP protocol suite |

---

## 🌐 Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MUSTER_PORT` | `3000` | HTTP server listen port |
| `MUSTER_DB_PATH` | `data/muster.db` | Path to the SQLite database file |
| `NODE_ENV` | `development` | Runtime environment |

---

## 🐳 Docker Deployment

Run Muster with a persistent data volume:

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f muster

# Stop
docker-compose down
```

The platform will be available at `http://localhost:3000`.  
Health telemetry: `http://localhost:3000/api/v1/health`

---

## 🧪 Testing

Muster maintains strict test isolation — automated tests **never touch `data/muster.db`**.

### Unit & Integration Tests (Vitest)

```bash
npm test
```

Runs `tests/lexorank.test.ts` and `tests/services.test.ts` (9 tests total).

### Playwright Browser E2E Test

```bash
npx tsx scripts/browser-ui-test.ts
```

Spawns an isolated Muster server on port **3099** with a temporary database (`data/e2e-browser-<timestamp>.db`). Runs 8 automated browser user flows. Tears down the server and deletes all temporary database files on completion.

### MCP Protocol E2E Test

```bash
npx tsx scripts/mcp-agent-test.ts
```

Spawns an isolated Muster server on port **3098** with a temporary database (`data/e2e-mcp-<timestamp>.db`). Exercises all 12 major MCP tool categories via JSON-RPC 2.0. Tears down the server and deletes all temporary database files on completion.

### Live Card Movement Demo

```bash
npx tsx scripts/live-card-movement-test.ts
```

Creates a test card and moves it across all board columns with 3-second intervals to demonstrate real-time SSE + polling UI updates.

---

## 📡 REST API

In addition to the MCP server, Muster exposes a conventional REST API:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Platform health & telemetry |
| `GET` | `/api/v1/projects` | List all projects |
| `POST` | `/api/v1/projects` | Create a project |
| `GET` | `/api/v1/projects/:id/boards` | List boards in a project |
| `GET` | `/api/v1/boards/:id` | Get board with columns & cards |
| `POST` | `/api/v1/boards/:id/columns` | Create a column |
| `POST` | `/api/v1/columns/:id/cards` | Create a card |
| `PATCH` | `/api/v1/cards/:id` | Update a card |
| `POST` | `/api/v1/cards/:id/move` | Move a card to a column |
| `GET` | `/api/v1/projects/:id/agents` | List agents |
| `POST` | `/api/v1/projects/:id/agents` | Register an agent |
| `GET` | `/api/v1/projects/:id/documents` | List documents |
| `GET` | `/api/v1/projects/:id/events` | SSE real-time activity stream |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/).
4. Open a pull request.

---

## 📜 License

Released under the [MIT License](LICENSE). © 2026 Muster Contributors.
