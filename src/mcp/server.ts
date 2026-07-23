// File: src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  ProjectService,
  BoardService,
  ColumnService,
  CardService,
  CommentService,
  DocumentService,
  AgentService,
  EventService
} from '../services/index.js';

export interface Services {
  projectService: ProjectService;
  boardService: BoardService;
  columnService: ColumnService;
  cardService: CardService;
  commentService: CommentService;
  documentService: DocumentService;
  agentService: AgentService;
  eventService: EventService;
}

export function createMcpServer(services: Services): McpServer {
  const server = new McpServer({
    name: 'Collaborative Agent Platform',
    version: '1.0.0',
  });

  // --- Project Management ---
  server.tool(
    'list_projects',
    {},
    async () => {
      const result = await services.projectService.list();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_project',
    { name: z.string(), description: z.string().optional() },
    async ({ name, description }) => {
      const result = await services.projectService.create({ name, description });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Board Management ---
  server.tool(
    'list_boards',
    { project_id: z.string() },
    async ({ project_id }) => {
      const result = await services.boardService.list(project_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_board',
    { project_id: z.string(), name: z.string() },
    async ({ project_id, name }) => {
      const result = await services.boardService.create({ project_id, name });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_board',
    { board_id: z.string() },
    async ({ board_id }) => {
      const result = await services.boardService.getById(board_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Column Management ---
  server.tool(
    'create_column',
    {
      board_id: z.string(),
      name: z.string(),
      position: z.string().optional(),
      wip_limit: z.number().optional()
    },
    async ({ board_id, name, position, wip_limit }) => {
      const result = await services.columnService.create({ 
        board_id, 
        name, 
        position: position || 'm', 
        wip_limit 
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_column',
    {
      column_id: z.string(),
      name: z.string().optional(),
      wip_limit: z.number().optional()
    },
    async ({ column_id, name, wip_limit }) => {
      const result = await services.columnService.update(column_id, { name, wip_limit });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'move_column',
    {
      column_id: z.string(),
      position: z.string()
    },
    async ({ column_id, position }) => {
      const result = await services.columnService.move(column_id, position);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'delete_column',
    { column_id: z.string() },
    async ({ column_id }) => {
      await services.columnService.delete(column_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  // --- Card Management ---
  server.tool(
    'list_cards',
    {
      column_id: z.string().optional(),
      board_id: z.string().optional(),
      assignee_id: z.string().optional(),
      label_id: z.string().optional(),
      archived: z.boolean().optional()
    },
    async (filters) => {
      const result = await services.cardService.list(filters);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_card',
    {
      column_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional()
    },
    async (data) => {
      const result = await services.cardService.create({
        column_id: data.column_id,
        title: data.title,
        description: data.description,
        priority: data.priority as 'critical' | 'high' | 'medium' | 'low' | undefined,
        position: 'm',
        assignees: data.assignees
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_card',
    { card_id: z.string() },
    async ({ card_id }) => {
      const result = await services.cardService.getById(card_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_card',
    {
      card_id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.string().optional(),
      due_date: z.string().optional()
    },
    async ({ card_id, title, description, priority, due_date }) => {
      const result = await services.cardService.update(card_id, {
        title,
        description,
        priority: priority as 'critical' | 'high' | 'medium' | 'low' | undefined,
        due_date: due_date ? new Date(due_date).toISOString() : undefined
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'move_card',
    {
      card_id: z.string(),
      target_column_id: z.string(),
      position: z.string().optional()
    },
    async ({ card_id, target_column_id, position }) => {
      const result = await services.cardService.move(card_id, target_column_id, position);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'assign_card',
    {
      card_id: z.string(),
      agent_id: z.string()
    },
    async ({ card_id, agent_id }) => {
      await services.cardService.assign(card_id, agent_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'unassign_card',
    {
      card_id: z.string(),
      agent_id: z.string()
    },
    async ({ card_id, agent_id }) => {
      await services.cardService.unassign(card_id, agent_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'add_comment',
    {
      card_id: z.string(),
      content: z.string(),
      author_id: z.string()
    },
    async ({ card_id, content, author_id }) => {
      const result = await services.commentService.create({ card_id, content, author_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'add_label',
    {
      card_id: z.string(),
      label_id: z.string()
    },
    async ({ card_id, label_id }) => {
      await services.cardService.addLabel(card_id, label_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'remove_label',
    {
      card_id: z.string(),
      label_id: z.string()
    },
    async ({ card_id, label_id }) => {
      await services.cardService.removeLabel(card_id, label_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'archive_card',
    {
      card_id: z.string()
    },
    async ({ card_id }) => {
      const result = await services.cardService.archive(card_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Label Management ---
  server.tool(
    'create_label',
    {
      board_id: z.string(),
      name: z.string(),
      color: z.string()
    },
    async ({ board_id, name, color }) => {
      const result = await services.boardService.createLabel({ board_id, name, color });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'list_labels',
    {
      board_id: z.string()
    },
    async ({ board_id }) => {
      const result = await services.boardService.listLabels(board_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Document Management ---
  server.tool(
    'list_documents',
    {
      project_id: z.string(),
      status: z.string().optional(),
      parent_id: z.string().optional()
    },
    async ({ project_id, status, parent_id }) => {
      const result = await services.documentService.list(project_id, { status: status as any, parentId: parent_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'create_document',
    {
      project_id: z.string(),
      title: z.string(),
      content: z.string(),
      author_id: z.string(),
      parent_id: z.string().optional()
    },
    async ({ project_id, title, content, author_id, parent_id }) => {
      const result = await services.documentService.create({ project_id, title, content, author_id, parent_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_document',
    {
      document_id: z.string(),
      version: z.number().optional()
    },
    async ({ document_id, version }) => {
      const result = await services.documentService.getById(document_id, version);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'update_document',
    {
      document_id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      change_summary: z.string(),
      author_id: z.string()
    },
    async ({ document_id, title, content, change_summary, author_id }) => {
      const result = await services.documentService.update(document_id, { title, content, change_summary, author_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'set_document_status',
    {
      document_id: z.string(),
      status: z.string()
    },
    async ({ document_id, status }) => {
      const result = await services.documentService.setStatus(document_id, status as any);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_document_history',
    {
      document_id: z.string()
    },
    async ({ document_id }) => {
      const result = await services.documentService.getHistory(document_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Agent Management ---
  server.tool(
    'register_agent',
    {
      project_id: z.string(),
      name: z.string(),
      type: z.string(),
      role: z.string(),
      capabilities: z.array(z.string()).optional()
    },
    async ({ project_id, name, type, role, capabilities }) => {
      const result = await services.agentService.register({ project_id, name, type: type as 'ai_agent' | 'human', role: role as 'owner' | 'contributor' | 'observer', capabilities: (capabilities || []).join(','), status: 'active' });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'heartbeat',
    {
      agent_id: z.string()
    },
    async ({ agent_id }) => {
      await services.agentService.heartbeat(agent_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    }
  );

  server.tool(
    'list_agents',
    {
      project_id: z.string()
    },
    async ({ project_id }) => {
      const result = await services.agentService.list(project_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  server.tool(
    'get_project_summary',
    {
      project_id: z.string()
    },
    async ({ project_id }) => {
      const result = await services.projectService.getSummary(project_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Activity ---
  server.tool(
    'get_activity',
    {
      project_id: z.string(),
      entity_type: z.string().optional(),
      entity_id: z.string().optional(),
      since: z.string().optional(),
      limit: z.number().optional()
    },
    async ({ project_id, entity_type, entity_id, since, limit }) => {
      const result = await services.eventService.list(project_id, {
        entityType: entity_type as any,
        entityId: entity_id,
        since: since ? new Date(since).toISOString() : undefined,
        limit
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );

  // --- Resources ---
  server.resource(
    'project-summary',
    'cap://project/{id}/summary',
    async (uri: URL) => {
      const summary = await services.projectService.getSummary(uri.pathname.split('/').pop()!);
      return { contents: [{ uri: uri.href, text: JSON.stringify(summary) }] };
    }
  );

  server.resource(
    'board-details',
    'cap://board/{id}',
    async (uri: URL) => {
      const board = await services.boardService.getById(uri.pathname.split('/').pop()!);
      return { contents: [{ uri: uri.href, text: JSON.stringify(board) }] };
    }
  );

  server.resource(
    'card-details',
    'cap://card/{id}',
    async (uri: URL) => {
      const card = await services.cardService.getById(uri.pathname.split('/').pop()!);
      return { contents: [{ uri: uri.href, text: JSON.stringify(card) }] };
    }
  );

  server.resource(
    'document-details',
    'cap://document/{id}',
    async (uri: URL) => {
      const document = await services.documentService.getById(uri.pathname.split('/').pop()!);
      return { contents: [{ uri: uri.href, text: JSON.stringify(document) }] };
    }
  );

  server.resource(
    'project-activity',
    'cap://project/{id}/activity',
    async (uri: URL) => {
      const activity = await services.eventService.list(uri.pathname.split('/').pop()!);
      return { contents: [{ uri: uri.href, text: JSON.stringify(activity) }] };
    }
  );

  return server;
}
