// File: src/index.ts
import express, { Request, Response } from 'express';
import path from 'path';
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
  EventService
} from './services/index.js';
import { SSEManager } from './realtime/sse.js';
import { createRouter } from './api/router.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { createMcpServer, Services } from './mcp/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Initialize database
  const db = createDatabaseAdapter();
  
  // Run migrations
  const migrator = new Migrator(db, path.join(__dirname, 'db/migrations'));
  await migrator.run();

  const sseManager = new SSEManager();
  const eventService = new EventService(db, async (evt) => {
    sseManager.broadcast(evt.project_id, evt);
  });

  const services: Services = {
    projectService: new ProjectService(db, eventService),
    boardService: new BoardService(db, eventService),
    columnService: new ColumnService(db, eventService),
    cardService: new CardService(db, eventService),
    commentService: new CommentService(db, eventService),
    documentService: new DocumentService(db, eventService),
    agentService: new AgentService(db, eventService),
    eventService
  };

  const existingProjects = await services.projectService.list();
  console.log(`Starting CAP... Found ${existingProjects.length} existing project(s).`);

  const app = express();
  app.use(express.json());
  
  // Serve static files from public directory
  const publicDir = config.publicDir;
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  
  // API routes
  const apiRouter = createRouter(services, sseManager);
  app.use('/api', apiRouter);
  
  // Error handling
  app.use(errorHandler);

  // MCP Streamable HTTP endpoint (per-request transport, stateless)
  const mcpServer = createMcpServer(services);
  app.post('/mcp', async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        mcpServer.close();
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  const statusTimer = setInterval(() => services.agentService.updateStatus().catch(console.error), 60000);

  const port = config.port;
  const server = app.listen(port, () => {
    console.log(`Server listening on http://${config.host}:${port}`);
    console.log(`API: http://${config.host}:${port}/api`);
    console.log(`MCP: POST http://${config.host}:${port}/mcp`);
    console.log(`Web UI: http://${config.host}:${port}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    clearInterval(statusTimer);
    server.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
