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
});
