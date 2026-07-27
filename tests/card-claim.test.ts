// File: tests/card-claim.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import {
  AgentService,
  CardService,
  BoardService,
  ColumnService,
  ProjectService,
  CommentService,
  DocumentService,
  EventService,
  KBService,
  RoleService,
} from '../src/services/index.js';
import { createMcpServer, Services } from '../src/mcp/server.js';
import { AuthContext } from '../src/shared/auth-context.js';
import { ClaimRefusal, CardDetails } from '../src/shared/types.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test-card-claim.db');

function isRefusal(result: CardDetails | ClaimRefusal): result is ClaimRefusal {
  return 'success' in result && result.success === false;
}

function makeAuth(principalId: string): AuthContext {
  return {
    principal: { kind: 'agent', id: principalId },
    workspace_id: null,
    permissions: [],
    is_operator_override: false,
    role_name: null,
  };
}

describe('Atomic card claiming and lease expiry', () => {
  let db: DatabaseAdapter;
  let projectService: ProjectService;
  let boardService: BoardService;
  let columnService: ColumnService;
  let cardService: CardService;
  let commentService: CommentService;
  let documentService: DocumentService;
  let agentService: AgentService;
  let eventService: EventService;
  let kbService: KBService;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    db = createDatabaseAdapter(TEST_DB);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    eventService = new EventService(db);
    boardService = new BoardService(db, eventService);
    projectService = new ProjectService(db, eventService, boardService);

    // Bootstrap a default workspace for tests
    const wsId = 'test-ws-01';
    const now = new Date().toISOString();
    await db.execute(
      `INSERT OR IGNORE INTO workspace (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [wsId, 'Test Workspace', 'test', now, now]
    );

    columnService = new ColumnService(db, eventService);
    cardService = new CardService(db, eventService);
    commentService = new CommentService(db, eventService);
    documentService = new DocumentService(db, eventService);
    agentService = new AgentService(db, eventService);
    kbService = new KBService(db, eventService);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  async function makeCard(title = 'Claimable task') {
    const project = await projectService.create({ name: `P-${title}` });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    return cardService.create({ column_id: columns[0].id, title });
  }

  it('two concurrent claim_card calls for the same card: exactly one succeeds, the other names the holder', async () => {
    const card = await makeCard();
    const agentA = await agentService.register({ name: 'Agent A' });
    const agentB = await agentService.register({ name: 'Agent B' });

    const [resultA, resultB] = await Promise.all([
      cardService.claim(card.id, agentA.id),
      cardService.claim(card.id, agentB.id),
    ]);

    const results = [resultA, resultB];
    const winners = results.filter(r => !isRefusal(r)) as CardDetails[];
    const refusals = results.filter(isRefusal) as ClaimRefusal[];

    expect(winners).toHaveLength(1);
    expect(refusals).toHaveLength(1);

    const winner = winners[0];
    const refusal = refusals[0];
    expect(winner.claimed_by).toBe(winner.assignees.some(a => a.id === agentA.id) ? agentA.id : agentB.id);
    expect(refusal.reason).toBe('already_claimed');
    expect(refusal.held_by.id).toBe(winner.claimed_by);
    expect(refusal.card_id).toBe(card.id);

    // Winner is recorded as an assignee too.
    expect(winner.assignees.map(a => a.id)).toContain(winner.claimed_by);
  });

  it('the same agent re-claiming its own card succeeds and simply extends the lease', async () => {
    const card = await makeCard();
    const agent = await agentService.register({ name: 'Solo Agent' });

    const first = await cardService.claim(card.id, agent.id, 60);
    expect(isRefusal(first)).toBe(false);

    const second = await cardService.claim(card.id, agent.id, 6000);
    expect(isRefusal(second)).toBe(false);
    const details = second as CardDetails;
    expect(details.claimed_by).toBe(agent.id);
    expect(new Date(details.claim_expires_at!).getTime()).toBeGreaterThan(Date.now() + 5000 * 1000);
  });

  it('an expired lease is reclaimable by a different agent', async () => {
    const card = await makeCard();
    const holder = await agentService.register({ name: 'Original Holder' });
    const claimant = await agentService.register({ name: 'New Claimant' });

    const claimed = await cardService.claim(card.id, holder.id, 1);
    expect(isRefusal(claimed)).toBe(false);

    // Force the lease into the past instead of sleeping in the test.
    await db.execute('UPDATE card SET claim_expires_at = ? WHERE id = ?', [
      new Date(Date.now() - 1000).toISOString(),
      card.id,
    ]);

    const reclaimed = await cardService.claim(card.id, claimant.id);
    expect(isRefusal(reclaimed)).toBe(false);
    expect((reclaimed as CardDetails).claimed_by).toBe(claimant.id);
  });

  it('renewClaims (heartbeat) extends the lease for the holding agent', async () => {
    const card = await makeCard();
    const agent = await agentService.register({ name: 'Heartbeat Agent' });

    const claimed = await cardService.claim(card.id, agent.id, 60) as CardDetails;
    const originalExpiry = new Date(claimed.claim_expires_at!).getTime();

    await cardService.renewClaims(agent.id, 6000);

    const refreshed = await cardService.getById(card.id);
    expect(new Date(refreshed.claim_expires_at!).getTime()).toBeGreaterThan(originalExpiry);
  });

  it('releaseExpiredLeases sweeps expired claims and emits a claim_expired event', async () => {
    const project = await projectService.create({ name: 'Sweep Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({ column_id: columns[0].id, title: 'Sweep me' });
    const agent = await agentService.register({ name: 'Dead Agent' });

    await cardService.claim(card.id, agent.id, 1);
    await db.execute('UPDATE card SET claim_expires_at = ? WHERE id = ?', [
      new Date(Date.now() - 1000).toISOString(),
      card.id,
    ]);

    const releasedIds = await cardService.releaseExpiredLeases();
    expect(releasedIds).toContain(card.id);

    const refreshed = await cardService.getById(card.id);
    expect(refreshed.claimed_by).toBeNull();
    expect(refreshed.claimed_at).toBeNull();
    expect(refreshed.claim_expires_at).toBeNull();

    const events = await eventService.list(project.id, { entity_id: card.id });
    expect(events.some(e => e.action === 'claim_expired')).toBe(true);
  });

  it('claiming an unclaimed card by an unrelated agent does not affect other cards', async () => {
    const card = await makeCard();
    const other = await makeCard('Untouched card');
    const agent = await agentService.register({ name: 'Focused Agent' });

    await cardService.claim(card.id, agent.id);
    const untouched = await cardService.getById(other.id);
    expect(untouched.claimed_by).toBeNull();
  });

  it('with two agents registered simultaneously, comments are attributed to the correct agent every time', async () => {
    const project = await projectService.create({ name: 'Attribution Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({ column_id: columns[0].id, title: 'Attribution card' });

    const services: Services = {
      projectService,
      boardService,
      columnService,
      cardService,
      commentService,
      documentService,
      agentService,
      eventService,
      kbService,
      roleService: {} as RoleService,
    };

    // MUS-23: each server instance gets an auth context with its principal identity.
    // Pre-create principal + app_user rows so that agent registration's
    // operator_user_id FK constraint is satisfied.
    const authAId = 'human-operator-a';
    const authBId = 'human-operator-b';
    const now = new Date().toISOString();
    for (const id of [authAId, authBId]) {
      await db.execute('INSERT OR IGNORE INTO principal (id, kind, created_at) VALUES (?, ?, ?)', [id, 'user', now]);
      await db.execute('INSERT OR IGNORE INTO app_user (id, display_name, status, created_at) VALUES (?, ?, ?, ?)', [id, id, 'active', now]);
    }
    const authA = makeAuth(authAId);
    const authB = makeAuth(authBId);
    const serverA = createMcpServer(services, { headers: {} } as any, authA) as any;
    const serverB = createMcpServer(services, { headers: {} } as any, authB) as any;

    const registerA = await serverA._registeredTools['register_agent'].handler(
      { name: 'Connected Agent A' },
      {}
    );
    const agentA = JSON.parse(registerA.content[0].text);

    const registerB = await serverB._registeredTools['register_agent'].handler(
      { name: 'Connected Agent B' },
      {}
    );
    const agentB = JSON.parse(registerB.content[0].text);

    // Server B's auth principal is human-operator-b — the comment is attributed to that identity.
    const commentResult = await serverB._registeredTools['add_comment'].handler(
      { card_id: card.id, content: 'From agent B' },
      {}
    );
    const comment = JSON.parse(commentResult.content[0].text);
    expect(comment.author_id).toBe('human-operator-b');
    expect(comment.author_id).not.toBe('human-operator-a');
  });

  it('fails loudly instead of inventing an actor when no identity can be determined', async () => {
    const project = await projectService.create({ name: 'No Actor Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({ column_id: columns[0].id, title: 'Anonymous comment attempt' });

    const services: Services = {
      projectService,
      boardService,
      columnService,
      cardService,
      commentService,
      documentService,
      agentService,
      eventService,
      kbService,
      roleService: {} as RoleService,
    };

    const server = createMcpServer(services, { headers: {} } as any) as any;

    // MUS-23: with no auth principal (OPEN_AUTH_CONTEXT default), the handler
    // passes undefined author_id to the comment service. The SQL NOT NULL constraint
    // on comment.author_id rejects it — no fabricated actor.
    await expect(
      server._registeredTools['add_comment'].handler({ card_id: card.id, content: 'Whose comment is this?' }, {})
    ).rejects.toThrow();
  });
});