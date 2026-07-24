// File: src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z as zod } from 'zod';
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

const z = zod;

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
    name: 'collaborative-agent-platform',
    version: '2.0.0',
  });

  // --- MCP Collaboration Prompts ---
  server.prompt('collaboration_protocol', {}, () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `# Collaborative Agent Platform (CAP) — Standard Operating Protocol

All AI agents and human operators collaborating within CAP must follow this protocol:

1. **Self-Registration & Status**:
   - Upon connecting, call \`register_agent\` to register your agent ID, name, role ('contributor' | 'owner' | 'observer'), and capabilities.
   - Emit periodic \`heartbeat\` pings to maintain 'active' status.

2. **Design Specifications First**:
   - Before executing tasks, call \`list_documents\` to inspect approved system specs.
   - If architectural changes are required, create or update a document via \`create_document\` / \`update_document\` and submit for review (\`set_document_status\` → 'in_review').

3. **Kanban Card Workflow & WIP Limits**:
   - Call \`list_cards\` or \`get_board\` to find unassigned cards in 'Backlog' / 'To Do'.
   - Assign yourself using \`assign_card\`.
   - Move card to 'In Progress' via \`move_card\`. Always respect column WIP limits.

4. **Transparent Progress & Audit Trail**:
   - Log key progress updates, code diffs, or blockers on cards using \`add_comment\`.
   - When implementation is completed, move card to 'In Review' and notify reviewers.

5. **Peer Review & Task Completion**:
   - Peer agents or human operators inspect work in 'In Review' and advance card to 'Done' upon verification.`,
        },
      },
    ],
  }));

  // --- Project Tools ---
  server.tool('list_projects', {}, async () => {
    const projects = await services.projectService.list();
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  });

  server.tool('create_project', { name: z.string(), description: z.string().optional() }, async (args) => {
    const project = await services.projectService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
  });

  server.tool('get_project_summary', { project_id: z.string() }, async ({ project_id }) => {
    const summary = await services.projectService.getSummary(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  });

  // --- Board & Column Tools ---
  server.tool('list_boards', { project_id: z.string() }, async ({ project_id }) => {
    const boards = await services.boardService.list(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }] };
  });

  server.tool('create_board', { project_id: z.string(), name: z.string() }, async (args) => {
    const board = await services.boardService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(board, null, 2) }] };
  });

  server.tool('get_board', { board_id: z.string() }, async ({ board_id }) => {
    const board = await services.boardService.getById(board_id);
    if (!board) throw new Error(`Board ${board_id} not found`);

    const columns = await services.columnService.list(board_id);
    const cards = await services.cardService.list({ board_id });

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...board, columns, cards }, null, 2) }],
    };
  });

  server.tool('create_column', {
    board_id: z.string(),
    name: z.string(),
    position: z.string().optional(),
    wip_limit: z.number().optional()
  }, async (args) => {
    const col = await services.columnService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  });

  server.tool('update_column', {
    column_id: z.string(),
    name: z.string().optional(),
    wip_limit: z.number().nullable().optional(),
    position: z.string().optional()
  }, async ({ column_id, ...data }) => {
    const col = await services.columnService.update(column_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  });

  server.tool('move_column', { column_id: z.string(), position: z.string() }, async ({ column_id, position }) => {
    const col = await services.columnService.update(column_id, { position });
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  });

  server.tool('delete_column', { column_id: z.string() }, async ({ column_id }) => {
    await services.columnService.delete(column_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Column ${column_id} deleted` }) }] };
  });

  // --- Card Tools ---
  server.tool('list_cards', {
    board_id: z.string().optional(),
    column_id: z.string().optional(),
    assignee_id: z.string().optional(),
    label: z.string().optional(),
    archived: z.boolean().optional()
  }, async (filters) => {
    const cards = await services.cardService.list(filters);
    return { content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }] };
  });

  server.tool('create_card', {
    column_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    position: z.string().optional(),
    due_date: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional()
  }, async (args) => {
    const card = await services.cardService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
  });

  server.tool('get_card', { card_id: z.string() }, async ({ card_id }) => {
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('update_card', {
    card_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    due_date: z.string().nullable().optional()
  }, async ({ card_id, ...data }) => {
    const details = await services.cardService.update(card_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('move_card', {
    card_id: z.string(),
    target_column_id: z.string().optional(),
    position: z.string().optional()
  }, async ({ card_id, target_column_id, position }) => {
    const details = await services.cardService.move(card_id, { target_column_id, position });
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('assign_card', { card_id: z.string(), agent_id: z.string() }, async ({ card_id, agent_id }) => {
    await services.cardService.assign(card_id, agent_id);
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('unassign_card', { card_id: z.string(), agent_id: z.string() }, async ({ card_id, agent_id }) => {
    await services.cardService.unassign(card_id, agent_id);
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('add_comment', { card_id: z.string(), author_id: z.string(), content: z.string() }, async (args) => {
    const comment = await services.commentService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }] };
  });

  server.tool('add_label', { card_id: z.string(), label_id: z.string() }, async ({ card_id, label_id }) => {
    await services.cardService.addLabel(card_id, label_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  });

  server.tool('remove_label', { card_id: z.string(), label_id: z.string() }, async ({ card_id, label_id }) => {
    await services.cardService.removeLabel(card_id, label_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  });

  server.tool('archive_card', { card_id: z.string() }, async ({ card_id }) => {
    await services.cardService.archive(card_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  });

  server.tool('link_document_to_card', { card_id: z.string(), document_id: z.string() }, async ({ card_id, document_id }) => {
    await services.cardService.linkDocument(card_id, document_id);
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('unlink_document_from_card', { card_id: z.string(), document_id: z.string() }, async ({ card_id, document_id }) => {
    await services.cardService.unlinkDocument(card_id, document_id);
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  });

  server.tool('create_label', { board_id: z.string(), name: z.string(), color: z.string() }, async (args) => {
    const result = await services.boardService.createLabel(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('list_labels', { board_id: z.string() }, async ({ board_id }) => {
    const result = await services.boardService.listLabels(board_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // --- Document Management Tools ---
  server.tool('list_documents', {
    project_id: z.string(),
    status: z.string().optional(),
    parent_id: z.string().nullable().optional()
  }, async ({ project_id, ...filters }) => {
    const result = await services.documentService.list(project_id, filters);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('create_document', {
    project_id: z.string(),
    title: z.string(),
    content: z.string(),
    parent_id: z.string().optional(),
    author_id: z.string().optional()
  }, async (args) => {
    const result = await services.documentService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('get_document', { document_id: z.string() }, async ({ document_id }) => {
    const result = await services.documentService.getById(document_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('update_document', {
    document_id: z.string(),
    title: z.string().optional(),
    content: z.string().optional(),
    change_summary: z.string().optional(),
    author_id: z.string().optional()
  }, async ({ document_id, ...data }) => {
    const result = await services.documentService.update(document_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('set_document_status', {
    document_id: z.string(),
    status: z.enum(['draft', 'in_review', 'approved'])
  }, async ({ document_id, status }) => {
    const result = await services.documentService.setStatus(document_id, status);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('get_document_history', { document_id: z.string() }, async ({ document_id }) => {
    const result = await services.documentService.getHistory(document_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // --- Agent Management Tools ---
  server.tool('register_agent', {
    name: z.string(),
    type: z.enum(['ai_agent', 'human']),
    role: z.enum(['owner', 'contributor', 'observer']),
    capabilities: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.enum(['active', 'idle', 'offline']).optional()
  }, async (args) => {
    const result = await services.agentService.register(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('unregister_agent', { agent_id: z.string() }, async ({ agent_id }) => {
    await services.agentService.unregister(agent_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Agent ${agent_id} unregistered.` }) }] };
  });

  server.tool('heartbeat', { agent_id: z.string() }, async ({ agent_id }) => {
    const result = await services.agentService.heartbeat(agent_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('list_agents', {}, async () => {
    const result = await services.agentService.list();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  // --- Event & Activity Tools ---
  server.tool('get_activity', {
    project_id: z.string(),
    entity_type: z.string().optional(),
    entity_id: z.string().optional(),
    limit: z.number().optional()
  }, async ({ project_id, ...filters }) => {
    const result = await services.eventService.list(project_id, filters);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  return server;
}
