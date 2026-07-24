// File: src/api/router.ts
import { Router } from 'express';
import { DatabaseAdapter } from '../db/adapter.js';
import { Services } from '../mcp/server.js';
import { SSEManager } from '../realtime/sse.js';
import { createProjectRouter } from './routes/project.routes.js';
import { createBoardRouter } from './routes/board.routes.js';
import { createColumnRouter } from './routes/column.routes.js';
import { createCardRouter } from './routes/card.routes.js';
import { createDocumentRouter } from './routes/document.routes.js';
import { createAgentRouter } from './routes/agent.routes.js';
import { createEventRouter } from './routes/event.routes.js';
import { createHealthRouter } from './routes/health.routes.js';

export function createRouter(services: Services, sseManager: SSEManager, db: DatabaseAdapter): Router {
  const router = Router();
  const v1 = Router();

  v1.use(createHealthRouter(db));
  v1.use('/projects', createProjectRouter(services.projectService));
  v1.use(createBoardRouter(services.boardService, services.columnService, services.cardService));
  v1.use(createColumnRouter(services.columnService));
  v1.use(createCardRouter(services.cardService, services.commentService));
  v1.use(createDocumentRouter(services.documentService));
  v1.use(createAgentRouter(services.agentService));
  v1.use(createEventRouter(services.eventService, sseManager));

  router.use('/v1', v1);
  return router;
}
