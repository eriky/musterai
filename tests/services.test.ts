// File: tests/services.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabaseAdapter } from '../src/db/factory.js';
import { DatabaseAdapter } from '../src/db/adapter.js';
import { Migrator } from '../src/db/migrator.js';
import {
  ProjectService,
  BoardService,
  ColumnService,
  CardService,
  CommentService,
  DocumentService,
  AgentService,
  EventService
} from '../src/services/index.js';
import { rankBetween } from '../src/shared/lexorank.js';

const TEST_DB = path.join(process.cwd(), 'data', 'test.db');

describe('Domain Services Integration Tests', () => {
  let db: DatabaseAdapter;
  let projectService: ProjectService;
  let boardService: BoardService;
  let columnService: ColumnService;
  let cardService: CardService;
  let commentService: CommentService;
  let documentService: DocumentService;
  let agentService: AgentService;
  let eventService: EventService;

  beforeEach(async () => {
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
    db = createDatabaseAdapter(TEST_DB);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    eventService = new EventService(db);
    boardService = new BoardService(db, eventService);
    projectService = new ProjectService(db, eventService, boardService);
    columnService = new ColumnService(db, eventService);
    cardService = new CardService(db, eventService);
    commentService = new CommentService(db, eventService);
    documentService = new DocumentService(db, eventService);
    agentService = new AgentService(db, eventService);
  });

  afterEach(async () => {
    if (db) await db.close();
    if (fs.existsSync(TEST_DB)) {
      fs.unlinkSync(TEST_DB);
    }
  });

  it('Bug 1.1: project creation creates default board and columns', async () => {
    const project = await projectService.create({ name: 'Test Project', description: 'Desc' });
    expect(project.id).toBeDefined();

    const boards = await boardService.list(project.id);
    expect(boards.length).toBe(1);
    expect(boards[0].name).toBe('Sprint 1');

    const columns = await columnService.list(boards[0].id);
    expect(columns.length).toBe(5);
    expect(columns.map(c => c.name)).toEqual(['Backlog', 'To Do', 'In Progress', 'In Review', 'Done']);
  });

  it('Feature: project update (name and description) works correctly and emits event', async () => {
    const project = await projectService.create({ name: 'Old Project Name', description: 'Old Desc' });
    const updated = await projectService.update(project.id, { name: 'New Project Name', description: 'Updated Desc' });

    expect(updated.name).toBe('New Project Name');
    expect(updated.description).toBe('Updated Desc');

    const fetched = await projectService.getById(project.id);
    expect(fetched?.name).toBe('New Project Name');
    expect(fetched?.description).toBe('Updated Desc');

    const events = await eventService.list(project.id);
    const updateEvt = events.find(e => e.entity_type === 'project' && e.action === 'updated');
    expect(updateEvt).toBeDefined();
  });

  it('Feature: board creation supports simple 3-lane template and custom columns', async () => {
    const project = await projectService.create({ name: 'Simplified Project' });

    // 3-lane board
    const simpleBoard = await boardService.create({ project_id: project.id, name: 'Simple Board', template: 'simple' });
    const simpleCols = await columnService.list(simpleBoard.id);
    expect(simpleCols.length).toBe(3);
    expect(simpleCols.map(c => c.name)).toEqual(['To Do', 'In Progress', 'Done']);

    // Custom columns board
    const customBoard = await boardService.create({
      project_id: project.id,
      name: 'Custom Board',
      columns: ['Idea', 'Building', 'QA', 'Shipped'],
    });
    const customCols = await columnService.list(customBoard.id);
    expect(customCols.length).toBe(4);
    expect(customCols.map(c => c.name)).toEqual(['Idea', 'Building', 'QA', 'Shipped']);
  });

  it('Feature: board update (rename) works correctly and emits event', async () => {
    const project = await projectService.create({ name: 'P' });
    const agent = await agentService.register({
      project_id: project.id,
      name: 'Agent 1',
      type: 'ai_agent',
      role: 'contributor',
    });
    const boards = await boardService.list(project.id);
    const initialBoard = boards[0];

    const updated = await boardService.update(initialBoard.id, { name: 'Sprint 1 - Renamed' }, agent.id);
    expect(updated.name).toBe('Sprint 1 - Renamed');

    const fetched = await boardService.getById(initialBoard.id);
    expect(fetched?.name).toBe('Sprint 1 - Renamed');

    const events = await eventService.list(project.id);
    const renameEvent = events.find(e => e.entity_type === 'board' && e.action === 'updated');
    expect(renameEvent).toBeDefined();
    expect(renameEvent?.actor_id).toBe(agent.id);
  });

  it('Bug 1.2: column wip_limit works correctly', async () => {
    const project = await projectService.create({ name: 'P' });
    const boards = await boardService.list(project.id);
    const col = await columnService.create({ board_id: boards[0].id, name: 'Testing', wip_limit: 5 });

    expect(col.wip_limit).toBe(5);

    const updated = await columnService.update(col.id, { wip_limit: 10 });
    expect(updated.wip_limit).toBe(10);
  });

  it('MUS-19: reordering a column via position moves it in list() order', async () => {
    const project = await projectService.create({ name: 'P' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    expect(columns.length).toBeGreaterThanOrEqual(3);

    const [first, second, third] = columns;

    // Move the last of the three columns to the front.
    const newPosition = rankBetween(null, first.position);
    await columnService.update(third.id, { position: newPosition });

    const reordered = await columnService.list(boards[0].id);
    expect(reordered[0].id).toBe(third.id);
    expect(reordered[1].id).toBe(first.id);
    expect(reordered[2].id).toBe(second.id);

    const events = await eventService.list(project.id);
    const moveEvent = events.find(e => e.entity_type === 'column' && e.entity_id === third.id && e.action === 'updated');
    expect(moveEvent).toBeDefined();
  });

  it('Bug 1.3: commentService.create executes without SQL syntax error', async () => {
    const project = await projectService.create({ name: 'P' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({ column_id: columns[0].id, title: 'Card 1' });

    const agent = await agentService.register({
      project_id: project.id,
      name: 'Agent 1',
      type: 'ai_agent',
      role: 'contributor',
      capabilities: 'code',
      status: 'active'
    });

    const comment = await commentService.create({ card_id: card.id, author_id: agent.id, content: 'Test comment' });
    expect(comment.content).toBe('Test comment');

    const comments = await commentService.listByCard(card.id);
    expect(comments.length).toBe(1);

    // Test card deletion
    await cardService.delete(card.id);
    await expect(cardService.getById(card.id)).rejects.toThrow('not found');
  });



  it('registers and unregisters an agent cleanly', async () => {
    const project = await projectService.create({ name: 'P' });
    const agent = await agentService.register({
      project_id: project.id,
      name: 'Agent To Remove',
      type: 'ai_agent',
      role: 'contributor',
    });
    expect(agent.name).toBe('Agent To Remove');

    let agents = await agentService.list(project.id);
    expect(agents.some(a => a.id === agent.id)).toBe(true);

    await agentService.unregister(agent.id);

    agents = await agentService.list(project.id);
    expect(agents.some(a => a.id === agent.id)).toBe(false);
  });

  it('Bug 1.4: document creation and update succeed without version title error', async () => {
    const project = await projectService.create({ name: 'P' });
    const agent = await agentService.register({
      project_id: project.id,
      name: 'Agent 1',
      type: 'ai_agent',
      role: 'contributor',
      capabilities: 'code',
      status: 'active'
    });

    const doc = await documentService.create({
      project_id: project.id,
      title: 'Spec',
      content: 'v1 content',
      author_id: agent.id
    });
    expect(doc.version).toBe(1);

    const updated = await documentService.update(doc.id, {
      title: 'Spec v2',
      content: 'v2 content',
      change_summary: 'Updated content',
      author_id: agent.id
    });
    expect(updated.version).toBe(2);
    expect(updated.title).toBe('Spec v2');

    const history = await documentService.getHistory(doc.id);
    expect(history.length).toBe(2);
  });

  it('Feature: document version history attributes each edit to its actual author', async () => {
    const project = await projectService.create({ name: 'P' });
    const author = await agentService.register({
      project_id: project.id,
      name: 'Original Author',
      type: 'ai_agent',
      role: 'contributor',
    });
    const editor = await agentService.register({
      project_id: project.id,
      name: 'Later Editor',
      type: 'human',
      role: 'owner',
    });

    const doc = await documentService.create(
      { project_id: project.id, title: 'Spec', content: 'v1' },
      author.id
    );

    // Edit by a different actor, passed as actorId rather than in the payload.
    await documentService.update(doc.id, { content: 'v2', change_summary: 'Revised' }, editor.id);

    // Edit by an unidentified caller must not inherit the previous author.
    await documentService.update(doc.id, { content: 'v3', change_summary: 'Anonymous' });

    const history = await documentService.getHistory(doc.id);
    expect(history.map(v => v.version)).toEqual([3, 2, 1]);

    const [v3, v2, v1] = history;
    expect(v1.author_id).toBe(author.id);
    expect(v1.author_name).toBe('Original Author');
    expect(v2.author_id).toBe(editor.id);
    expect(v2.author_name).toBe('Later Editor');
    expect(v3.author_id).toBeNull();
    expect(v3.author_name).toBeNull();

    // The document row keeps its last known author rather than going null.
    const current = await documentService.getById(doc.id);
    expect(current?.author_id).toBe(editor.id);
  });

  it('Feature: secret token verification and agent session re-binding', async () => {
    const token = await agentService.getHumanSecretToken();
    expect(token).toMatch(/^muster_sec_/);

    // Rejects registration with invalid secret_token
    await expect(
      agentService.register({
        name: 'Malicious Agent',
        type: 'ai_agent',
        role: 'contributor',
        secret_token: 'wrong_secret'
      })
    ).rejects.toThrow('Invalid secret token');

    // Register initial agent with valid token
    const initialAgent = await agentService.register({
      name: 'Claude 3.7',
      type: 'ai_agent',
      role: 'contributor',
      secret_token: token,
      capabilities: ['code', 'testing']
    });
    expect(initialAgent.id).toBeDefined();

    // Re-bind session using existing agent_id
    const reboundAgent = await agentService.register({
      agent_id: initialAgent.id,
      name: 'Claude 3.7 (Rebound)',
      secret_token: token
    });

    expect(reboundAgent.id).toBe(initialAgent.id);
    expect(reboundAgent.name).toBe('Claude 3.7 (Rebound)');
    expect(reboundAgent.status).toBe('active');

    // Update agent attributes & human owner assignment
    const updatedAgent = await agentService.update(initialAgent.id, {
      name: 'Claude 3.7 Sonnet (Updated)',
      capabilities: ['code', 'architecture', 'review'],
      role: 'owner',
      owner_id: 'human_erik'
    });

    expect(updatedAgent.name).toBe('Claude 3.7 Sonnet (Updated)');
    expect(updatedAgent.capabilities).toEqual(['code', 'architecture', 'review']);
    expect(updatedAgent.role).toBe('owner');
    expect(updatedAgent.owner_id).toBe('human_erik');
  });

  it('Feature: card status (active, blocked, in_review) and blocked_reason management', async () => {
    const project = await projectService.create({ name: 'Card Status Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const colId = columns[0].id;

    // Create card with blocked status
    const card = await cardService.create({
      column_id: colId,
      title: 'Blocked Task',
      status: 'blocked',
      blocked_reason: 'Requires human review',
    });

    expect(card.status).toBe('blocked');
    expect(card.blocked_reason).toBe('Requires human review');

    // Fetch details
    const details = await cardService.getById(card.id);
    expect(details.status).toBe('blocked');
    expect(details.blocked_reason).toBe('Requires human review');

    // Update status to in_review
    const updated = await cardService.update(card.id, {
      status: 'in_review',
      blocked_reason: 'Waiting for operator signoff',
    });
    expect(updated.status).toBe('in_review');
    expect(updated.blocked_reason).toBe('Waiting for operator signoff');

    // Filter list by status
    const blockedCards = await cardService.list({ board_id: boards[0].id, status: 'in_review' });
    expect(blockedCards.length).toBe(1);
    expect(blockedCards[0].id).toBe(card.id);

    // Unblock card to active
    const unblocked = await cardService.update(card.id, {
      status: 'active',
      blocked_reason: null,
    });
    expect(unblocked.status).toBe('active');
    expect(unblocked.blocked_reason).toBeNull();
  });

  it('includes assignee summaries when listing board cards', async () => {
    const project = await projectService.create({ name: 'Assigned Cards Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({
      column_id: columns[0].id,
      title: 'Assigned task',
    });
    const assignedAgent = await agentService.register({
      name: 'Working Agent',
      type: 'ai_agent',
      role: 'contributor',
      status: 'active',
    });
    await cardService.assign(card.id, assignedAgent.id);

    const listedCards = await cardService.list({ board_id: boards[0].id });

    expect(listedCards).toHaveLength(1);
    expect(listedCards[0].assignees).toEqual([
      {
        id: assignedAgent.id,
        name: 'Working Agent',
        type: 'ai_agent',
        status: 'active',
      },
    ]);
  });

  it('Feature: card-to-card linking supports blocks/blocked_by/relates_to and title search', async () => {
    const project = await projectService.create({ name: 'Linking Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);

    const cardA = await cardService.create({ column_id: columns[0].id, title: 'Implement login API' });
    const cardB = await cardService.create({ column_id: columns[0].id, title: 'Design login UI' });
    const cardC = await cardService.create({ column_id: columns[0].id, title: 'Write login docs' });

    // A blocks B -> B should see "blocked_by" A
    await cardService.linkCard(cardA.id, cardB.id, 'blocks');
    const detailsA = await cardService.getById(cardA.id);
    const detailsB = await cardService.getById(cardB.id);
    expect(detailsA.linked_cards.find(l => l.card.id === cardB.id)?.relation_type).toBe('blocks');
    expect(detailsB.linked_cards.find(l => l.card.id === cardA.id)?.relation_type).toBe('blocked_by');

    // Choosing "blocked_by" from the other side stores the inverse direction
    await cardService.linkCard(cardC.id, cardA.id, 'blocked_by');
    const detailsC = await cardService.getById(cardC.id);
    expect(detailsC.linked_cards.find(l => l.card.id === cardA.id)?.relation_type).toBe('blocked_by');
    const detailsA2 = await cardService.getById(cardA.id);
    expect(detailsA2.linked_cards.find(l => l.card.id === cardC.id)?.relation_type).toBe('blocks');

    // Symmetric relation
    await cardService.linkCard(cardB.id, cardC.id, 'relates_to');
    const detailsB2 = await cardService.getById(cardB.id);
    const detailsC2 = await cardService.getById(cardC.id);
    expect(detailsB2.linked_cards.find(l => l.card.id === cardC.id)?.relation_type).toBe('relates_to');
    expect(detailsC2.linked_cards.find(l => l.card.id === cardB.id)?.relation_type).toBe('relates_to');

    // Self-linking is rejected
    await expect(cardService.linkCard(cardA.id, cardA.id, 'relates_to')).rejects.toThrow();

    // Title search is project-scoped and excludes the given card
    const results = await cardService.searchByTitle(project.id, 'login', { excludeCardId: cardA.id });
    expect(results.map(r => r.id).sort()).toEqual([cardB.id, cardC.id].sort());

    // Unlinking removes the relation from both sides
    const linkId = detailsA2.linked_cards.find(l => l.card.id === cardB.id)!.id;
    await cardService.unlinkCard(cardA.id, linkId);
    const detailsA3 = await cardService.getById(cardA.id);
    const detailsB3 = await cardService.getById(cardB.id);
    expect(detailsA3.linked_cards.some(l => l.card.id === cardB.id)).toBe(false);
    expect(detailsB3.linked_cards.some(l => l.card.id === cardA.id)).toBe(false);

    // Deleting a card cleans up its links
    await cardService.delete(cardC.id);
    const detailsA4 = await cardService.getById(cardA.id);
    expect(detailsA4.linked_cards.some(l => l.card.id === cardC.id)).toBe(false);
  });

  it('Card keys: cards get short, sequential, project-scoped keys', async () => {
    const project = await projectService.create({ name: 'Collaborative Agent Platform' });
    expect(project.key_prefix).toBe('CAP');

    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);

    const cardA = await cardService.create({ column_id: columns[0].id, title: 'A' });
    const cardB = await cardService.create({ column_id: columns[0].id, title: 'B' });
    expect(cardA.key).toBe('CAP-1');
    expect(cardB.key).toBe('CAP-2');

    // A second project with a colliding acronym gets a disambiguated prefix,
    // and its card sequence starts independently from 1.
    const otherProject = await projectService.create({ name: 'Client Approval Portal' });
    expect(otherProject.key_prefix).toBe('CAP2');

    const otherBoards = await boardService.list(otherProject.id);
    const otherColumns = await columnService.list(otherBoards[0].id);
    const otherCard = await cardService.create({ column_id: otherColumns[0].id, title: 'C' });
    expect(otherCard.key).toBe('CAP2-1');

    // Keys round-trip through getById/list.
    const fetched = await cardService.getById(cardA.id);
    expect(fetched.key).toBe('CAP-1');
    const listed = await cardService.list({ column_id: columns[0].id });
    expect(listed.map(c => c.key).sort()).toEqual(['CAP-1', 'CAP-2']);
  });

  it('Card keys: legacy rows without a key are backfilled on migrator startup', async () => {
    const project = await projectService.create({ name: 'Muster' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);
    const card = await cardService.create({ column_id: columns[0].id, title: 'Legacy' });
    expect(card.key).toBe('MUS-1');

    // Simulate rows written before migration 010 by wiping the derived columns.
    await db.execute('UPDATE project SET key_prefix = NULL, card_seq = 0 WHERE id = ?', [project.id]);
    await db.execute('UPDATE card SET key = NULL WHERE id = ?', [card.id]);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    const backfilledProject = await projectService.getById(project.id);
    expect(backfilledProject?.key_prefix).toBe('MUS');
    const backfilledCard = await cardService.getById(card.id);
    expect(backfilledCard.key).toBe('MUS-1');

    // Running the migrator again must not change already-assigned keys.
    await migrator.run();
    const stableCard = await cardService.getById(card.id);
    expect(stableCard.key).toBe('MUS-1');
  });

  it('Feature: work links can be attached, listed, removed, reject unsafe schemes, and cascade on delete', async () => {
    const project = await projectService.create({ name: 'Work Links Project' });
    const boards = await boardService.list(project.id);
    const columns = await columnService.list(boards[0].id);

    const card = await cardService.create({ column_id: columns[0].id, title: 'Implement atomic claim' });

    const branchLink = await cardService.addWorkLink(card.id, {
      kind: 'branch',
      provider: 'forgejo',
      url: 'https://forgejo.example/org/repo/src/branch/feat/atomic-claim',
      external_ref: 'feat/atomic-claim',
    });
    expect(branchLink.id).toBeTruthy();

    await cardService.addWorkLink(card.id, {
      kind: 'pull_request',
      provider: 'forgejo',
      url: 'https://forgejo.example/org/repo/pulls/42',
      external_ref: '#42',
      title: 'Atomic card claiming',
    });

    const details = await cardService.getById(card.id);
    expect(details.work_links).toHaveLength(2);
    expect(details.work_links.map(l => l.kind).sort()).toEqual(['branch', 'pull_request']);

    const listed = await cardService.listWorkLinks(card.id);
    expect(listed).toHaveLength(2);

    // Reject unsafe URL schemes at the service layer
    await expect(cardService.addWorkLink(card.id, {
      kind: 'commit',
      provider: 'github',
      url: 'javascript:alert(1)',
    })).rejects.toThrow();

    await expect(cardService.addWorkLink(card.id, {
      kind: 'commit',
      provider: 'github',
      url: 'data:text/html,<script>alert(1)</script>',
    })).rejects.toThrow();

    // Removing a link drops it from the list
    await cardService.removeWorkLink(card.id, branchLink.id);
    const afterRemove = await cardService.getById(card.id);
    expect(afterRemove.work_links.some(l => l.id === branchLink.id)).toBe(false);
    expect(afterRemove.work_links).toHaveLength(1);

    // Deleting a card cleans up its work links
    await cardService.delete(card.id);
    await expect(cardService.getById(card.id)).rejects.toThrow();
  });
});

