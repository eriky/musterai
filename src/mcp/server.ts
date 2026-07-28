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
  EventService,
  KBService,
  RoleService,
  TokenService,
  SessionService,
  OidcService,
  InvitationService,
  UserService,
  DeviceGrantService,
  McpOAuthService,
} from '../services/index.js';
import { AuthContext, OPEN_AUTH_CONTEXT } from '../shared/auth-context.js';
import { withPermission } from '../shared/permission-enforcer.js';

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
  kbService: KBService;
  roleService: RoleService;
  tokenService: TokenService;
  sessionService: SessionService;
  oidcService: OidcService;
  invitationService: InvitationService;
  userService: UserService;
  deviceGrantService: DeviceGrantService;
  mcpOAuthService: McpOAuthService;
}

import { Request } from 'express';
import { config } from '../config/index.js';

/**
 * Derive the actor ID exclusively from the authenticated principal (credential).
 *
 * MUS-23: caller-asserted identity via tool arguments is retired. `agent_id`
 * in tool args is now a SELECTOR (validated server-side against the caller's
 * owned agents), never an identity claim. In open mode the actor may be
 * undefined — services handle null actors gracefully. In enforced mode,
 * handlers that need an actor call requireActor() which refuses loudly.
 */
function resolveActor(auth: AuthContext): string | undefined {
  if (auth.principal) return auth.principal.id;
  return undefined;
}

/**
 * Like resolveActor but throws if no actor could be determined (enforced mode).
 * In open mode, returns undefined — the caller is unauthenticated.
 */
function requireActor(auth: AuthContext, context: string): string | undefined {
  const actorId = resolveActor(auth);
  if (!actorId) {
    if (config.auth.mode === 'enforced') {
      throw new Error(
        `Forbidden: tool "${context}" requires an authenticated actor, but no principal was resolved.`
      );
    }
  }
  return actorId;
}

/**
 * Validate that the caller owns the given agent_id, or has a bypass permission.
 * In open mode, always passes.
 */
async function validateAgentOwnershipOrAdmin(
  agentService: AgentService,
  auth: AuthContext,
  agentId: string,
  bypassPermission: string,
): Promise<void> {
  if (config.auth.mode === 'open') return;
  if (auth.permissions.includes(bypassPermission)) return;
  if (!auth.principal) {
    throw new Error('Forbidden: requires an authenticated principal to operate on an agent.');
  }
  await agentService.validateAgentOwnership(agentId, auth.principal.id);
}

export function createMcpServer(services: Services, req?: Request, auth: AuthContext = OPEN_AUTH_CONTEXT): McpServer {
  const server = new McpServer({
    name: 'muster',
    version: '2.0.0',
  });

  // --- MCP Collaboration Prompts ---
  server.prompt('collaboration_protocol', {}, () => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `# Muster — Standard Operating Protocol

All AI agents and human operators collaborating within Muster must follow this protocol:

1. **Self-Registration & Status**:
   - Upon connecting, call \`register_agent\` to register your agent ID, name, and capabilities.
   - Emit periodic \`heartbeat\` pings to maintain 'active' status.

2. **Design Specifications & Knowledge Bases First**:
   - Before executing tasks, call \`list_documents\` to inspect approved system specs.
   - Check Knowledge Bases: Call \`list_knowledge_bases\` and \`search_knowledge\` (or \`get_entity_knowledge\`) for the project to inspect existing domain knowledge, facts, constraints, entities, and gotchas before planning or implementation.
   - Record Gained Knowledge: When discovering new facts, system specs, constraints, or entity relations during work, add them to the Knowledge Base via \`add_gained_knowledge\` or \`upsert_kb_entity\`.
   - If architectural changes are required, create or update a document via \`create_document\` / \`update_document\` and submit for review (\`set_document_status\` → 'in_review').

3. **Kanban Card Workflow & Flexible Board Structures**:
   - Boards are flexible and may have 3 lanes ('To Do' → 'In Progress' → 'Done'), standard 5 lanes, or custom columns. Inspect the active board layout via \`get_board\`.
   - Call \`list_cards\` or \`get_board\` to find unassigned cards in initial state columns ('To Do' / 'Backlog').
   - As soon as you start working on a task (including making plans, research, or drafting design docs), **immediately** assign yourself using \`assign_card\` AND move the card to 'In Progress' via \`move_card\`. Do NOT wait until right before editing files. Always respect column WIP limits.

4. **Transparent Progress & Human-Readable Task Descriptions**:
   - Always state current work using full human-readable task titles and work summaries out loud (e.g. \`Muster Task: "Create user authentication middleware"\`), never raw ID strings like \`Work on card #01J3K...\`.
   - Log key progress updates, code diffs, or blockers on cards using \`add_comment\`.

5. **Peer Review & Task Completion**:
   - Before moving a card to 'In Review', attach the branch, pull request, or commit you worked on via \`add_work_link\` — the human operator should never have to go find the work themselves.
   - When implementation is completed, if an 'In Review' column exists on the board, move the card to 'In Review' for verification. If no 'In Review' column exists (e.g. 3-lane board), post verification notes and move directly to 'Done'.`,
        },
      },
    ],
  }));

  // --- Project Tools ---
  server.tool('list_projects', {}, withPermission('list_projects', auth, async () => {
    const projects = await services.projectService.list();
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  }));

  server.tool('create_project', { name: z.string(), description: z.string().optional() }, withPermission('create_project', auth, async (args) => {
    const project = await services.projectService.create(args, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
  }));

  server.tool('get_project_summary', { project_id: z.string() }, withPermission('get_project_summary', auth, async ({ project_id }) => {
    const summary = await services.projectService.getSummary(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  }));

  server.tool(
    'update_project',
    {
      project_id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
    },
    withPermission('update_project', auth, async ({ project_id, ...data }) => {
      const project = await services.projectService.update(project_id, data, resolveActor(auth));
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    })
  );

  server.tool('delete_project', { project_id: z.string() }, withPermission('delete_project', auth, async ({ project_id }) => {
    await services.projectService.delete(project_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Project ${project_id} deleted` }) }] };
  }));

  // --- Board & Column Tools ---
  server.tool('list_boards', { project_id: z.string() }, withPermission('list_boards', auth, async ({ project_id }) => {
    const boards = await services.boardService.list(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(boards, null, 2) }] };
  }));

  server.tool(
    'create_board',
    {
      project_id: z.string(),
      name: z.string(),
      template: z.enum(['simple', 'standard']).optional(),
      columns: z.array(z.string()).optional(),
    },
    withPermission('create_board', auth, async (args) => {
      const board = await services.boardService.create(args, resolveActor(auth));
      return { content: [{ type: 'text', text: JSON.stringify(board, null, 2) }] };
    })
  );

  server.tool('update_board', { board_id: z.string(), name: z.string() }, withPermission('update_board', auth, async ({ board_id, name }) => {
    const board = await services.boardService.update(board_id, { name }, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(board, null, 2) }] };
  }));

  server.tool('delete_board', { board_id: z.string() }, withPermission('delete_board', auth, async ({ board_id }) => {
    await services.boardService.delete(board_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Board ${board_id} deleted` }) }] };
  }));

  server.tool('get_board', { board_id: z.string() }, withPermission('get_board', auth, async ({ board_id }) => {
    const board = await services.boardService.getById(board_id);
    if (!board) throw new Error(`Board ${board_id} not found`);

    const columns = await services.columnService.list(board_id);
    const cards = await services.cardService.list({ board_id });

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...board, columns, cards }, null, 2) }],
    };
  }));

  server.tool('create_column', {
    board_id: z.string(),
    name: z.string(),
    position: z.string().optional(),
    wip_limit: z.number().optional()
  }, withPermission('create_column', auth, async (args) => {
    const col = await services.columnService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  }));

  server.tool('update_column', {
    column_id: z.string(),
    name: z.string().optional(),
    wip_limit: z.number().nullable().optional(),
    position: z.string().optional()
  }, withPermission('update_column', auth, async ({ column_id, ...data }) => {
    const col = await services.columnService.update(column_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  }));

  server.tool('move_column', { column_id: z.string(), position: z.string() }, withPermission('move_column', auth, async ({ column_id, position }) => {
    const col = await services.columnService.update(column_id, { position });
    return { content: [{ type: 'text', text: JSON.stringify(col, null, 2) }] };
  }));

  server.tool('delete_column', { column_id: z.string() }, withPermission('delete_column', auth, async ({ column_id }) => {
    await services.columnService.delete(column_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Column ${column_id} deleted` }) }] };
  }));

  // --- Card Tools ---
  server.tool('list_cards', {
    board_id: z.string().optional(),
    column_id: z.string().optional(),
    assignee_id: z.string().optional(),
    label: z.string().optional(),
    status: z.enum(['active', 'blocked', 'in_review']).optional(),
    archived: z.boolean().optional()
  }, withPermission('list_cards', auth, async (filters) => {
    const cards = await services.cardService.list(filters);
    return { content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }] };
  }));

  server.tool('create_card', {
    column_id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    position: z.string().optional(),
    due_date: z.string().optional(),
    status: z.enum(['active', 'blocked', 'in_review']).optional(),
    blocked_reason: z.string().nullable().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    is_epic: z.boolean().optional().describe('Marks this card as a container for related work'),
  }, withPermission('create_card', auth, async (args) => {
    const card = await services.cardService.create(args, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
  }));

  server.tool('get_card', { card_id: z.string() }, withPermission('get_card', auth, async ({ card_id }) => {
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('update_card', {
    card_id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    due_date: z.string().nullable().optional(),
    status: z.enum(['active', 'blocked', 'in_review']).optional(),
    blocked_reason: z.string().nullable().optional(),
    is_epic: z.boolean().optional().describe('Marks this card as a container for related work'),
  }, withPermission('update_card', auth, async ({ card_id, ...data }) => {
    // Layer 2 scope check: if the principal doesn't have card.assign_others,
    // they may only update cards they are assigned to.
    if (!auth.permissions.includes('card.assign_others') && auth.principal) {
      const agentIds = await services.agentService.getAgentIdsForPrincipal(auth.principal.id);
      const hasScope = await services.cardService.validateCardScope(card_id, agentIds);
      if (!hasScope) {
        throw new Error(`Forbidden: you may only update cards you are assigned to (principal: ${auth.principal.id})`);
      }
    }
    const details = await services.cardService.update(card_id, data, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('move_card', {
    card_id: z.string(),
    target_column_id: z.string().optional(),
    position: z.string().optional()
  }, withPermission('move_card', auth, async ({ card_id, target_column_id, position }) => {
    // Layer 2 scope check: if the principal doesn't have card.assign_others,
    // they may only move cards they are assigned to.
    if (!auth.permissions.includes('card.assign_others') && auth.principal) {
      const agentIds = await services.agentService.getAgentIdsForPrincipal(auth.principal.id);
      const hasScope = await services.cardService.validateCardScope(card_id, agentIds);
      if (!hasScope) {
        throw new Error(`Forbidden: you may only move cards you are assigned to (principal: ${auth.principal.id})`);
      }
    }
    const details = await services.cardService.move(card_id, { target_column_id, position }, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('claim_card', {
    card_id: z.string(),
    agent_id: z.string().describe('Required — the principal/agent ID claiming the card'),
    ttl_seconds: z.number().optional().describe('Lease duration in seconds; defaults to 600 (10 minutes)'),
  }, withPermission('claim_card', auth, async ({ card_id, agent_id, ttl_seconds }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'card.assign_others');
    const result = await services.cardService.claim(card_id, agent_id, ttl_seconds);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('assign_card', { card_id: z.string(), agent_id: z.string() }, withPermission('assign_card', auth, async ({ card_id, agent_id }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'card.assign_others');
    await services.cardService.assign(card_id, agent_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('unassign_card', { card_id: z.string(), agent_id: z.string() }, withPermission('unassign_card', auth, async ({ card_id, agent_id }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'card.assign_others');
    await services.cardService.unassign(card_id, agent_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('add_comment', { card_id: z.string(), content: z.string() }, withPermission('add_comment', auth, async (args) => {
    const author_id = resolveActor(auth);
    const comment = await services.commentService.create({ ...args, author_id });
    return { content: [{ type: 'text', text: JSON.stringify(comment, null, 2) }] };
  }));

  server.tool('add_label', { card_id: z.string(), label_id: z.string() }, withPermission('add_label', auth, async ({ card_id, label_id }) => {
    await services.cardService.addLabel(card_id, label_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  }));

  server.tool('remove_label', { card_id: z.string(), label_id: z.string() }, withPermission('remove_label', auth, async ({ card_id, label_id }) => {
    await services.cardService.removeLabel(card_id, label_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  }));

  server.tool('archive_card', { card_id: z.string() }, withPermission('archive_card', auth, async ({ card_id }) => {
    await services.cardService.archive(card_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  }));

  server.tool('delete_card', { card_id: z.string() }, withPermission('delete_card', auth, async ({ card_id }) => {
    await services.cardService.delete(card_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Card ${card_id} deleted` }) }] };
  }));

  server.tool('link_document_to_card', { card_id: z.string(), document_id: z.string() }, withPermission('link_document_to_card', auth, async ({ card_id, document_id }) => {
    await services.cardService.linkDocument(card_id, document_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('unlink_document_from_card', { card_id: z.string(), document_id: z.string() }, withPermission('unlink_document_from_card', auth, async ({ card_id, document_id }) => {
    await services.cardService.unlinkDocument(card_id, document_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('link_card', {
    card_id: z.string(),
    target_card_id: z.string(),
    relation_type: z.enum(['blocks', 'blocked_by', 'relates_to', 'duplicates', 'parent_of', 'child_of']),
  }, withPermission('link_card', auth, async ({ card_id, target_card_id, relation_type }) => {
    await services.cardService.linkCard(card_id, target_card_id, relation_type, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('unlink_card', { card_id: z.string(), link_id: z.string() }, withPermission('unlink_card', auth, async ({ card_id, link_id }) => {
    await services.cardService.unlinkCard(card_id, link_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('add_work_link', {
    card_id: z.string(),
    kind: z.enum(['branch', 'pull_request', 'commit', 'pipeline']),
    provider: z.enum(['forgejo', 'github', 'gitlab', 'other']),
    url: z.string(),
    external_ref: z.string().optional(),
    title: z.string().optional(),
    status: z.string().optional(),
  }, withPermission('add_work_link', auth, async ({ card_id, ...data }) => {
    await services.cardService.addWorkLink(card_id, data, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('remove_work_link', { card_id: z.string(), link_id: z.string() }, withPermission('remove_work_link', auth, async ({ card_id, link_id }) => {
    await services.cardService.removeWorkLink(card_id, link_id, resolveActor(auth));
    const details = await services.cardService.getById(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
  }));

  server.tool('list_work_links', { card_id: z.string() }, withPermission('list_work_links', auth, async ({ card_id }) => {
    const links = await services.cardService.listWorkLinks(card_id);
    return { content: [{ type: 'text', text: JSON.stringify(links, null, 2) }] };
  }));

  server.tool('create_label', { board_id: z.string(), name: z.string(), color: z.string() }, withPermission('create_label', auth, async (args) => {
    const result = await services.boardService.createLabel(args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('list_labels', { board_id: z.string() }, withPermission('list_labels', auth, async ({ board_id }) => {
    const result = await services.boardService.listLabels(board_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  // --- Document Management Tools ---
  server.tool('list_documents', {
    project_id: z.string(),
    status: z.string().optional(),
    parent_id: z.string().nullable().optional()
  }, withPermission('list_documents', auth, async ({ project_id, ...filters }) => {
    const result = await services.documentService.list(project_id, filters);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('create_document', {
    project_id: z.string(),
    title: z.string(),
    content: z.string(),
    parent_id: z.string().optional(),
  }, withPermission('create_document', auth, async (args) => {
    const author_id = resolveActor(auth);
    const result = await services.documentService.create({ ...args, author_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('get_document', { document_id: z.string() }, withPermission('get_document', auth, async ({ document_id }) => {
    const result = await services.documentService.getById(document_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('update_document', {
    document_id: z.string(),
    title: z.string().optional(),
    content: z.string().optional(),
    change_summary: z.string().optional(),
  }, withPermission('update_document', auth, async ({ document_id, ...data }) => {
    const author_id = resolveActor(auth);
    const result = await services.documentService.update(document_id, { ...data, author_id });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('set_document_status', {
    document_id: z.string(),
    status: z.enum(['draft', 'in_review', 'approved'])
  }, withPermission('set_document_status', auth, async ({ document_id, status }) => {
    const result = await services.documentService.setStatus(document_id, status, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('get_document_history', { document_id: z.string() }, withPermission('get_document_history', auth, async ({ document_id }) => {
    const result = await services.documentService.getHistory(document_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  // --- Agent Management Tools ---
  server.tool('register_agent', {
    agent_id: z.string().optional().describe('Existing Agent ID to re-bind session across runs'),
    name: z.string().optional().describe('Agent name'),
    capabilities: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.enum(['active', 'idle', 'offline']).optional()
  }, withPermission('register_agent', auth, async (args) => {
    // MUS-23: bind agent to the authenticated operator
    const operatorUserId = resolveActor(auth);
    const result = await services.agentService.register(args, operatorUserId);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('update_agent', {
    agent_id: z.string(),
    name: z.string().optional(),
    capabilities: z.union([z.string(), z.array(z.string())]).optional(),
    status: z.enum(['active', 'idle', 'offline']).optional(),
  }, withPermission('update_agent', auth, async ({ agent_id, ...data }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'agent.manage_others');
    const agent = await services.agentService.update(agent_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(agent, null, 2) }] };
  }));

  server.tool('unregister_agent', { agent_id: z.string() }, withPermission('unregister_agent', auth, async ({ agent_id }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'agent.manage_others');
    await services.agentService.unregister(agent_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Agent ${agent_id} unregistered.` }) }] };
  }));

  server.tool('heartbeat', { agent_id: z.string() }, withPermission('heartbeat', auth, async ({ agent_id }) => {
    await validateAgentOwnershipOrAdmin(services.agentService, auth, agent_id, 'agent.manage_others');
    const result = await services.agentService.heartbeat(agent_id);
    await services.cardService.renewClaims(agent_id);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('list_agents', {}, withPermission('list_agents', auth, async () => {
    const result = await services.agentService.list();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  // --- Event & Activity Tools ---
  server.tool('get_activity', {
    project_id: z.string(),
    entity_type: z.string().optional(),
    entity_id: z.string().optional(),
    limit: z.number().optional()
  }, withPermission('get_activity', auth, async ({ project_id, ...filters }) => {
    const result = await services.eventService.list(project_id, filters);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  // --- Knowledge Base Tools ---
  server.tool('list_knowledge_bases', { project_id: z.string().optional() }, withPermission('list_knowledge_bases', auth, async ({ project_id }) => {
    const kbs = await services.kbService.list(project_id);
    return { content: [{ type: 'text', text: JSON.stringify(kbs, null, 2) }] };
  }));

  server.tool('create_knowledge_base', {
    name: z.string(),
    description: z.string().optional(),
    is_global: z.boolean().optional(),
    project_ids: z.array(z.string()).optional(),
    agent_id: z.string().optional(),
  }, withPermission('create_knowledge_base', auth, async (args) => {
    const kb = await services.kbService.create(args, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify(kb, null, 2) }] };
  }));

  server.tool('link_knowledge_base', {
    kb_id: z.string(),
    project_id: z.string(),
    agent_id: z.string().optional(),
  }, withPermission('link_knowledge_base', auth, async (args) => {
    await services.kbService.linkProject(args.kb_id, args.project_id, resolveActor(auth));
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `KB ${args.kb_id} linked to project ${args.project_id}` }) }] };
  }));

  server.tool('search_knowledge', {
    query: z.string(),
    kb_id: z.string().optional(),
    project_id: z.string().optional(),
    limit: z.number().optional()
  }, withPermission('search_knowledge', auth, async ({ query, kb_id, project_id, limit }) => {
    let kbIds: string[] | undefined;
    if (kb_id) {
      kbIds = [kb_id];
    } else if (project_id) {
      const kbs = await services.kbService.list(project_id);
      kbIds = kbs.map(k => k.id);
    }
    const results = await services.kbService.searchKnowledge(query, kbIds, limit);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }));

  server.tool('get_entity_knowledge', {
    query: z.string().describe('Entity ID, canonical identifier (IP, email, hostname), or entity name'),
    kb_id: z.string().optional()
  }, withPermission('get_entity_knowledge', auth, async ({ query, kb_id }) => {
    const result = await services.kbService.getEntityKnowledge(query, kb_id ? [kb_id] : undefined);
    if (!result) return { content: [{ type: 'text', text: `No entity knowledge found for \"${query}\"` }] };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }));

  server.tool('add_gained_knowledge', {
    kb_id: z.string(),
    title: z.string(),
    content: z.string(),
    category: z.string().optional(),
    entity_id: z.string().optional(),
    entity_name: z.string().optional(),
    entity_type: z.string().optional(),
    entity_identifier: z.string().optional(),
    confidence: z.number().optional(),
    agent_id: z.string().optional(),
  }, withPermission('add_gained_knowledge', auth, async (args) => {
    const actorId = resolveActor(auth);
    const fact = await services.kbService.addFact(args, actorId);
    return { content: [{ type: 'text', text: JSON.stringify(fact, null, 2) }] };
  }));

  server.tool('upsert_kb_entity', {
    kb_id: z.string(),
    name: z.string(),
    type: z.string().optional(),
    identifier: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    agent_id: z.string().optional(),
  }, withPermission('upsert_kb_entity', auth, async (args) => {
    const actorId = resolveActor(auth);
    const entity = await services.kbService.upsertEntity(args, actorId);
    return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
  }));

  server.tool('update_gained_knowledge', {
    fact_id: z.string(),
    title: z.string().optional(),
    content: z.string().optional(),
    category: z.string().optional(),
    entity_id: z.string().optional(),
    entity_name: z.string().optional(),
    entity_type: z.string().optional(),
    entity_identifier: z.string().optional(),
    confidence: z.number().optional(),
    agent_id: z.string().optional(),
  }, withPermission('update_gained_knowledge', auth, async ({ fact_id, ...data }) => {
    const actorId = resolveActor(auth);
    const fact = await services.kbService.updateFact(fact_id, data, actorId);
    return { content: [{ type: 'text', text: JSON.stringify(fact, null, 2) }] };
  }));

  server.tool('update_kb_entity', {
    entity_id: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    identifier: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    agent_id: z.string().optional(),
  }, withPermission('update_kb_entity', auth, async ({ entity_id, ...data }) => {
    const actorId = resolveActor(auth);
    const entity = await services.kbService.updateEntity(entity_id, data, actorId);
    return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
  }));

  server.tool('add_kb_relation', {
    kb_id: z.string(),
    source_entity_id: z.string(),
    target_entity_id: z.string(),
    relation_type: z.string(),
    description: z.string().optional(),
    agent_id: z.string().optional(),
  }, withPermission('add_kb_relation', auth, async (args) => {
    const actorId = resolveActor(auth);
    const relation = await services.kbService.addRelation(args, actorId);
    return { content: [{ type: 'text', text: JSON.stringify(relation, null, 2) }] };
  }));

  // --- Role Management Tools ---
  server.tool('list_roles', { workspace_id: z.string() }, withPermission('list_roles', auth, async ({ workspace_id }) => {
    const roles = await services.roleService.list(workspace_id);
    return { content: [{ type: 'text', text: JSON.stringify(roles, null, 2) }] };
  }));

  server.tool('get_role', { role_id: z.string() }, withPermission('get_role', auth, async ({ role_id }) => {
    const role = await services.roleService.getById(role_id);
    if (!role) throw new Error(`Role ${role_id} not found`);
    return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
  }));

  server.tool('create_role', {
    workspace_id: z.string(),
    key: z.string(),
    name: z.string(),
    description: z.string().optional(),
    permissions: z.array(z.string()),
    rank: z.number().optional(),
  }, withPermission('create_role', auth, async (args) => {
    const role = await services.roleService.create(args);
    return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
  }));

  server.tool('update_role', {
    role_id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    rank: z.number().optional(),
  }, withPermission('update_role', auth, async ({ role_id, ...data }) => {
    const role = await services.roleService.update(role_id, data);
    return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
  }));

  server.tool('delete_role', { role_id: z.string() }, withPermission('delete_role', auth, async ({ role_id }) => {
    await services.roleService.delete(role_id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Role ${role_id} deleted` }) }] };
  }));

  server.tool('clone_role', {
    role_id: z.string(),
    new_key: z.string(),
    new_name: z.string().optional(),
  }, withPermission('clone_role', auth, async ({ role_id, new_key, new_name }) => {
    const role = await services.roleService.clone(role_id, new_key, new_name);
    return { content: [{ type: 'text', text: JSON.stringify(role, null, 2) }] };
  }));

  return server;
}