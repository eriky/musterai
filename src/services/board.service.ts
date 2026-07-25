// File: src/services/board.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Board, CreateBoard, UpdateBoard, Label, CreateLabel } from '../shared/types.js';
import { EventService } from './event.service.js';
import { rankAfter } from '../shared/lexorank.js';

export class BoardService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateBoard, actorId?: string): Promise<Board> {
    const id = ulid();
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    await this.db.execute(
      `INSERT INTO board (id, project_id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.project_id, data.name, created_at, updated_at]
    );

    const board: Board = {
      id,
      project_id: data.project_id,
      name: data.name,
      created_at,
      updated_at,
    };

    // Default or custom columns
    let defaultCols: { name: string; wip_limit: number | null }[] = [];

    if (data.columns && data.columns.length > 0) {
      defaultCols = data.columns.map((colName) => ({
        name: colName,
        wip_limit: colName.toLowerCase() === 'in progress' ? 3 : null,
      }));
    } else if (data.template === 'simple') {
      defaultCols = [
        { name: 'To Do', wip_limit: null },
        { name: 'In Progress', wip_limit: 3 },
        { name: 'Done', wip_limit: null },
      ];
    } else {
      defaultCols = [
        { name: 'Backlog', wip_limit: null },
        { name: 'To Do', wip_limit: null },
        { name: 'In Progress', wip_limit: 3 },
        { name: 'In Review', wip_limit: 2 },
        { name: 'Done', wip_limit: null },
      ];
    }

    let lastRank = '';
    for (const col of defaultCols) {
      const colId = ulid();
      const pos = rankAfter(lastRank);
      lastRank = pos;
      await this.db.execute(
        `INSERT INTO "column" (id, board_id, name, position, wip_limit) VALUES (?, ?, ?, ?, ?)`,
        [colId, id, col.name, pos, col.wip_limit]
      );
    }

    if (this.eventService) {
      await this.eventService.create({
        project_id: data.project_id,
        entity_type: 'board',
        entity_id: id,
        action: 'created',
        actor_id: actorId,
        payload: { name: board.name },
      });
    }

    return board;
  }

  async getById(id: string): Promise<Board | null> {
    const rows = await this.db.query<Board>('SELECT * FROM board WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async list(projectId: string): Promise<Board[]> {
    return this.db.query<Board>('SELECT * FROM board WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
  }

  async update(id: string, data: UpdateBoard, actorId?: string): Promise<Board> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Board with ID ${id} not found`);

    const name = data.name !== undefined ? data.name : existing.name;
    const updated_at = new Date().toISOString();

    await this.db.execute('UPDATE board SET name = ?, updated_at = ? WHERE id = ?', [name, updated_at, id]);

    const updated: Board = { ...existing, name, updated_at };

    if (this.eventService) {
      await this.eventService.create({
        project_id: existing.project_id,
        entity_type: 'board',
        entity_id: id,
        action: 'updated',
        actor_id: actorId,
        payload: { name },
      });
    }

    return updated;
  }

  async delete(id: string, actorId?: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Board with ID ${id} not found`);

    await this.db.execute('DELETE FROM board WHERE id = ?', [id]);

    if (this.eventService) {
      await this.eventService.create({
        project_id: existing.project_id,
        entity_type: 'board',
        entity_id: id,
        action: 'deleted',
        actor_id: actorId,
      });
    }
  }

  // Label management
  async createLabel(data: CreateLabel): Promise<Label> {
    const id = ulid();
    await this.db.execute(
      'INSERT INTO label (id, board_id, name, color) VALUES (?, ?, ?, ?)',
      [id, data.board_id, data.name, data.color]
    );
    return { id, board_id: data.board_id, name: data.name, color: data.color };
  }

  async listLabels(boardId: string): Promise<Label[]> {
    return this.db.query<Label>('SELECT * FROM label WHERE board_id = ?', [boardId]);
  }
}
