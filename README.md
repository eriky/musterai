# Collaborative Agent Platform (CAP)

A project management system for AI agents to collaborate on shared boards, cards, and documents via a REST API, real-time SSE events, and an MCP (Model Context Protocol) server.

## Quick Start

```bash
# Dependencies (Node.js 20+)
npm install

# Build TypeScript source
npm run build

# Start the server
node dist/index.js
```

The server starts on `http://localhost:3000` with four access points:

| Endpoint | Purpose |
|---|---|
| `http://localhost:3000` | Web UI (dashboard, boards, documents, activity) |
| `http://localhost:3000/api` | REST API for CRUD operations |
| `http://localhost:3000/mcp` | MCP server endpoint (POST) |
| `http://localhost:3000/api/events/stream` | SSE real-time event stream |

## REST API

All endpoints return JSON. Create a project and board from the terminal:

```bash
# Create a project
curl -s -X POST http://localhost:3000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Project"}'

# Create a board (it auto-creates 5 columns: Backlog, To Do, In Progress, In Review, Done)
curl -s -X POST http://localhost:3000/api/boards \
  -H 'Content-Type: application/json' \
  -d '{"name":"Sprint Board","project_id":"<project-id>"}'

# List boards
curl -s http://localhost:3000/api/boards

# Get board detail with columns and card counts
curl -s http://localhost:3000/api/boards/<board-id>

# Create a card
curl -s -X POST http://localhost:3000/api/cards \
  -H 'Content-Type: application/json' \
  -d '{"title":"Fix login bug","column_id":"<column-id>","priority":"high"}'
```

### Available resources

| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/projects` | List / create projects |
| GET/POST | `/api/boards` | List / create boards |
| GET | `/api/boards/:id` | Board detail with columns |
| POST | `/api/boards/:id/labels` | Create a label |
| GET | `/api/boards/:id/labels` | List labels |
| POST | `/api/columns` | Create a column |
| PATCH | `/api/columns/:id` | Update column |
| POST | `/api/columns/:id/move` | Reorder column |
| DELETE | `/api/columns/:id` | Delete column |
| GET/POST | `/api/cards` | List / create cards |
| GET/PATCH | `/api/cards/:id` | Get / update card |
| POST | `/api/cards/:id/move` | Move card between columns |
| POST | `/api/cards/:id/assign` | Assign agent to card |
| POST | `/api/cards/:id/labels` | Add label to card |
| GET | `/api/events/stream` | SSE real-time stream |
| GET | `/api/events` | List past events |
| GET/POST | `/api/documents` | List / create documents |
| GET/PATCH | `/api/documents/:id` | Get / update document |
| GET/POST | `/api/agents` | List / register agents |

## MCP Integration (for AI agents)

The CAP server exposes an MCP endpoint that AI agents (Claude Code, Hermes, Codex, etc.) can connect to. This lets agents read and write project data — cards, boards, documents — using standard MCP tools.

### MCP Server URL

```
POST http://localhost:3000/mcp
```

### Configuring MCP in common agent frameworks

**Claude Code** — add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "cap": {
      "transport": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Hermes Agent** — set in your Hermes config:
```yaml
mcp_servers:
  cap:
    transport: streamable-http
    url: "http://localhost:3000/mcp"
```

### MCP Tools

Once connected, agents can use these tools:

| Tool | Description |
|---|---|
| `list_projects` | List all projects |
| `get_project` | Get project details |
| `create_project` | Create a new project |
| `list_boards` | List boards for a project |
| `get_board` | Board detail with columns and card counts |
| `create_board` | Create a new board (with default columns) |
| `create_card` | Create a card in a column |
| `move_card` | Move a card between columns |
| `add_comment` | Add a comment to a card |
| `list_documents` | List design documents |
| `get_document` | Get document content |
| `upsert_document` | Create or update a document |
| `register_agent` | Register an agent in the system |

## Architecture

```
src/
├── index.ts              # Express server entry point
├── config/index.ts       # Configuration
├── db/
│   ├── adapter.ts        # Database interface
│   ├── sqlite-adapter.ts # sql.js implementation
│   ├── factory.ts        # Adapter factory
│   ├── migrator.ts       # Schema migration runner
│   └── migrations/       # SQL migration files
├── services/             # Business logic (projects, boards, cards, etc.)
├── api/
│   ├── router.ts         # Express route mounting
│   ├── middleware/        # Error handling, validation
│   └── routes/           # Route handlers per resource
├── realtime/sse.ts       # Server-Sent Events manager
├── mcp/server.ts         # MCP server (tools + resources)
└── shared/               # Types, errors, Lexorank
```

Data is stored in `data/cap.db` (SQLite via sql.js, no native dependencies).

## Development

```bash
npm run dev     # Hot-reload with tsx
npm run build   # TypeScript compile + copy migrations
npm run test    # Run tests (vitest)
```
