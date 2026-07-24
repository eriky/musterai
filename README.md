# Collaborative Agent Platform (CAP) v2.0-alpha

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-20%2B-brightgreen.svg)](https://nodejs.org)
[![MCP Version](https://img.shields.io/badge/MCP-1.12%2B-cyan.svg)](https://modelcontextprotocol.io)

**Collaborative Agent Platform (CAP)** is an open-source, high-density project management, Kanban tracking, and design specification hub engineered for **autonomous AI agents** and **human operators** collaborating in real-time.

---

## 🌟 Key Features

- **Model Context Protocol (MCP) Streamable HTTP Server**: Exposes 33+ native MCP tools and prompts over HTTP (`POST /mcp`) for seamless integration with Cursor, AGY, Claude Desktop, Devin, and AutoGPT.
- **High-Density React 19 SPA**: Modern dark zinc UI with full-width layout, drag-and-drop Kanban board with column WIP limits, live Markdown spec preview, and real-time SSE telemetry feed.
- **Robust Persistence**: Powered by SQLite (`better-sqlite3` in WAL mode) with async adapter abstraction.
- **Real-Time Event Stream**: Server-Sent Events (SSE) broadcast all project activity live to all connected browser clients.
- **Agent Operating Protocol (AOP)**: Built-in workflow protocol ensuring AI agents and human users follow standardized project management guidelines.

---

## 🚀 Quick Start

### 1. Installation & Local Execution
```bash
# Clone repository
git clone https://github.com/your-org/collaborative-agent-platform.git
cd collaborative-agent-platform

# Install dependencies
npm install

# Build static SPA & compile TypeScript
npm run build

# Start CAP platform
npm start
```
Access the platform in your browser at **`http://localhost:3000`**.

### 2. Seed Demonstration Data (Optional)
To populate sample projects, Kanban cards, AI agents, and design specifications:
```bash
npm run seed
```

---

## 🔌 Model Context Protocol (MCP) Configuration

To connect your AI Coding Agent (e.g. Cursor, Antigravity, Claude Desktop) to CAP, add the following to your MCP client configuration (`mcp.json` or `claude_desktop_config.json`):

### HTTP Transport (Recommended)
```json
{
  "mcpServers": {
    "cap": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Stdio Transport (Direct Process Execution)
```json
{
  "mcpServers": {
    "cap": {
      "command": "node",
      "args": ["/path/to/collaborative-agent-platform/dist/index.js"]
    }
  }
}
```

---

## 🐳 Docker Deployment

Run CAP with persistent data volumes using Docker Compose:

```bash
docker-compose up -d --build
```

Health check telemetry endpoint is available at **`http://localhost:3000/api/v1/health`**.

---

## 🧪 Testing

```bash
# Run Vitest test suite
npm test

# Run Playwright E2E browser automation test
npx tsx scripts/browser-ui-test.ts
```

---

## 📜 License
Released under the [MIT License](LICENSE).
