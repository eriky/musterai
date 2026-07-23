// File: src/api/router.ts
import { Router } from 'express';
import { Services } from '../mcp/server.js';
import { SSEManager } from '../realtime/sse.js';
import { createProjectRoutes } from './routes/project.routes.js';
import { createBoardRoutes } from './routes/board.routes.js';
import { createColumnRoutes } from './routes/column.routes.js';
import { createCardRoutes } from './routes/card.routes.js';
import { createDocumentRoutes } from './routes/document.routes.js';
import { createAgentRoutes } from './routes/agent.routes.js';
import { createEventRoutes } from './routes/event.routes.js';

export function createRouter(services: Services, sseManager: SSEManager): Router {
  const router = Router();

  router.use('/projects', createProjectRoutes(services.projectService));
  router.use('/boards', createBoardRoutes(services.boardService));
  router.use('/columns', createColumnRoutes(services.columnService));
  router.use('/cards', createCardRoutes(services.cardService, services.commentService));
  router.use('/documents', createDocumentRoutes(services.documentService));
  router.use('/agents', createAgentRoutes(services.agentService));
  router.use('/events', createEventRoutes(services.eventService, sseManager));

  return router;
}
