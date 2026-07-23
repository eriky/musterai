import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { SQLiteAdapter } from '../src/db/sqlite-adapter.js';
import { Migrator } from '../src/db/migrator.js';
import {
  ProjectService,
  BoardService,
  ColumnService,
  CardService,
  CommentService,
  DocumentService,
  AgentService
} from '../src/services/index.js';

describe('CAP Services Integration Tests', () => {
  let db: SQLiteAdapter;
  let testDbPath: string;

  let projectService: ProjectService;
  let boardService: BoardService;
  let columnService: ColumnService;
  let cardService: CardService;
  let commentService: CommentService;
  let documentService: DocumentService;
  let agentService: AgentService;

  beforeEach(async () => {
    testDbPath = path.join(process.cwd(), `data/test_${Date.now()}_${Math.random().toString(36).substring(7)}.db`);
    db = new SQLiteAdapter(testDbPath);

    const migrator = new Migrator(db, path.join(process.cwd(), 'src/db/migrations'));
    await migrator.run();

    projectService = new ProjectService(db);
    boardService = new BoardService(db);
    columnService = new ColumnService(db);
    cardService = new CardService(db);
    commentService = new CommentService(db);
    documentService = new DocumentService(db);
    agentService = new AgentService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Bug 1.1: getSummary returns accurate counts without SQL join error', async () => {
    const project = await projectService.create({ name: 'Test Project' });
    const board = await boardService.create({ project_id: project.id, name: 'Main Board' });
    const col = await columnService.create({ board_id: board.id, name: 'To Do' });
    await cardService.create({ column_id: col.id, title: 'Card 1', position: 'm' });

    const summary = await projectService.getSummary(project.id);
    expect(summary.board_count).toBe(1);
    expect(summary.card_count).toBe(1);
  });

  it('Bug 1.2: card assign and addLabel succeed without schema error', async () => {
    const project = await projectService.create({ name: 'Project' });
    const board = await boardService.create({ project_id: project.id, name: 'Board' });
    const col = await columnService.create({ board_id: board.id, name: 'Col' });
    const card = await cardService.create({ column_id: col.id, title: 'Card', position: 'm' });
    const agent = await agentService.register({
      project_id: project.id,
      name: 'Agent 1',
      type: 'ai_agent',
      role: 'contributor',
      capabilities: 'code',
      status: 'active'
    });
    const label = await boardService.createLabel({ board_id: board.id, name: 'Bug', color: 'red' });

    await expect(cardService.assign(card.id, agent.id)).resolves.not.toThrow();
    await expect(cardService.addLabel(card.id, label.id)).resolves.not.toThrow();

    const cardDetails = await cardService.getById(card.id);
    expect(cardDetails.assignees.length).toBe(1);
    expect(cardDetails.labels.length).toBe(1);
  });

  it('Bug 1.3: comment creation succeeds without updated_at error', async () => {
    const project = await projectService.create({ name: 'P' });
    const board = await boardService.create({ project_id: project.id, name: 'B' });
    const col = await columnService.create({ board_id: board.id, name: 'C' });
    const card = await cardService.create({ column_id: col.id, title: 'Card', position: 'm' });
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
      content: 'v2 content',
      author_id: agent.id,
      change_summary: 'Updated content'
    });
    expect(updated.version).toBe(2);

    const history = await documentService.getHistory(doc.id);
    expect(history.length).toBe(2);
  });

  it('Bug 3.2: multiple agents of same type can register and list_agents parses capabilities safely', async () => {
    const project = await projectService.create({ name: 'P' });

    const agent1 = await agentService.register({
      project_id: project.id,
      name: 'Architect',
      type: 'ai_agent',
      role: 'owner',
      capabilities: 'design,review',
      status: 'active'
    });

    const agent2 = await agentService.register({
      project_id: project.id,
      name: 'Developer',
      type: 'ai_agent',
      role: 'contributor',
      capabilities: ['code', 'test'] as any,
      status: 'active'
    });

    expect(agent1.id).not.toBe(agent2.id);

    const agents = await agentService.list(project.id);
    expect(agents.length).toBe(2);
    expect(Array.isArray(agents[0].capabilities)).toBe(true);
  });
});
