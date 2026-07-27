// File: src/index.ts
import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatabaseAdapter } from './db/factory.js';
import { Migrator } from './db/migrator.js';
import {
  ProjectService,
  BoardService,
  ColumnService,
  CardService,
  CommentService,
  DocumentService,
  AgentService,
  EventService,
  KBService,
  RoleService,
} from './services/index.js';
import { SSEManager } from './realtime/sse.js';
import { createRouter } from './api/router.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { createMcpServer, Services } from './mcp/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config/index.js';
import { OPEN_AUTH_CONTEXT } from './shared/auth-context.js';
import { ulid } from 'ulid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const db = createDatabaseAdapter();

  const migrator = new Migrator(db, path.join(__dirname, 'db/migrations'));
  await migrator.run();

  const sseManager = new SSEManager();
  const eventService = new EventService(db, async (evt) => {
    sseManager.broadcast(evt.project_id, evt);
  });

  const boardService = new BoardService(db, eventService);
  const documentService = new DocumentService(db, eventService);
  const kbService = new KBService(db, eventService);
  const roleService = new RoleService(db, eventService);
  const services: Services = {
    projectService: new ProjectService(db, eventService, boardService, documentService),
    boardService,
    columnService: new ColumnService(db, eventService),
    cardService: new CardService(db, eventService),
    commentService: new CommentService(db, eventService),
    documentService,
    agentService: new AgentService(db, eventService),
    eventService,
    kbService,
    roleService,
  };

  // Bootstrap: create default workspace and project if empty
  const workspaces = await db.query<{ id: string }>('SELECT id FROM workspace LIMIT 1');
  if (workspaces.length === 0) {
    const wsId = ulid();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [wsId, 'Default Workspace', 'default', now, now]
    );
    console.log('Created default workspace');
  }

  // Seed preset roles into the default workspace and backfill agent roles
  const wsRows = await db.query<{ id: string }>('SELECT id FROM workspace LIMIT 1');
  if (wsRows.length > 0) {
    const wsId = wsRows[0].id;
    const seeded = await roleService.seedPreset(wsId);
    const backfilled = await roleService.backfillAgentRoles(wsId);
    console.log(`Seeded ${seeded.length} preset roles; backfilled ${backfilled} agents`);
  }

  const existingProjects = await services.projectService.list();
  if (existingProjects.length === 0) {
    console.log('No existing projects found. Creating default project "Alpha Agent Project"...');
    await services.projectService.create({
      name: 'Alpha Agent Project',
      description: 'Primary project for AI agent collaboration'
    });
  }

  const app = express();
  app.use(express.json());

  // AuthContext middleware — resolves per-request context
  app.use((req: Request, _res, next) => {
    // For now, MUSTER_AUTH_MODE=open produces a permissive stub.
    // In MUS-21/22 this will resolve real tokens/sessions.
    (req as any).authContext = OPEN_AUTH_CONTEXT;
    next();
  });

  const apiRouter = createRouter(services, sseManager, db);
  app.use('/api', apiRouter);

  const publicDir = config.publicDir;
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // MCP Streamable HTTP Transport
  app.post('/mcp', async (req: Request, res: Response) => {
    const auth = (req as any).authContext || OPEN_AUTH_CONTEXT;
    const mcpServer = createMcpServer(services, req, auth);

    const mcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    try {
      await mcpServer.connect(mcpTransport);
      await mcpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: req.body?.id || null,
        });
      }
    }
  });

  // SPA Fallback Handler
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/mcp')) {
      return next();
    }
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  app.use(errorHandler);

  const statusTimer = setInterval(() => {
    services.agentService.updateStatus().catch(console.error);
    services.cardService.releaseExpiredLeases().catch(console.error);
  }, 60000);

  // Warn if binding to non-loopback with auth=open
  const host = config.host;
  if (config.auth.mode === 'open' && host !== 'localhost' && host !== '127.0.0.1') {
    console.warn(
      `\n⚠  WARNING: MUSTER_AUTH_MODE=open but binding to host "${host}".\n` +
      `   Set MUSTER_AUTH_MODE=enforced and configure a reverse proxy with TLS\n` +
      `   before exposing on a non-local interface.\n`
    );
  }

  const initialPort = config.port;

  const listenOnPort = (port: number) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`  Muster v2.0 - ONLINE`);
      console.log(`======================================================`);
      console.log(`  • Web UI:   http://${config.host}:${port}`);
      console.log(`  • REST API: http://${config.host}:${port}/api/v1`);
      console.log(`  • MCP Tool: POST http://${config.host}:${port}/mcp`);
      console.log(`  • Auth:     ${config.auth.mode}`);
      console.log(`======================================================\n`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Muster] Port ${port} is currently in use. Trying port ${port + 1}...`);
        listenOnPort(port + 1);
      } else {
        console.error('[Muster] Server error:', err);
      }
    });

    const shutdown = async () => {
      console.log('Shutting down Muster...');
      clearInterval(statusTimer);
      sseManager.close();
      server.close();
      await db.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  };

  listenOnPort(initialPort);
}

main().catch(console.error);