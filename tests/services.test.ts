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

  it('Feature: secret token verification and agent session re-binding', async () => {
    const token = await agentService.getHumanSecretToken();
    expect(token).toMatch(/^cap_sec_/);

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
});


