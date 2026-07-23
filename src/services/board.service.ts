// File: src/services/board.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Board, CreateBoard, Column, Label, CAPEvent } from '../shared/types.js';
import { NotFoundError } from '../shared/errors.js';
import { generateRank, rankAfter } from '../shared/lexorank.js';

export class BoardService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
  ) {}

  async create(data: CreateBoard): Promise<Board> {
    const now = new Date().toISOString();
    const board: Board = {
      id: ulid(),
      project_id: data.project_id,
      name: data.name,
      created_at: now,
      updated_at: now
    };

    await this.db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO boards (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [board.id, board.project_id, board.name, board.created_at, board.updated_at]
      );

      // Default columns
      const defaultCols = [
        { name: 'Backlog', wipLimit: null },
        { name: 'To Do', wipLimit: null },
        { name: 'In Progress', wipLimit: 3 },
        { name: 'In Review', wipLimit: 2 },
        { name: 'Done', wipLimit: null }
      ];

      let currentRank = generateRank();
      
      for (const col of defaultCols) {
        const colId = ulid();
        await tx.execute(
          `INSERT INTO columns (id, board_id, name, position, wip_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [colId, board.id, col.name, currentRank, col.wipLimit, now, now]
        );
        currentRank = rankAfter(currentRank);
      }
    });

    return board;
  }

  async listAll(): Promise<Board[]> {
    return this.db.query<Board>(`SELECT * FROM boards ORDER BY created_at ASC`);
  }

  async list(projectId: string): Promise<Board[]> {
    return this.db.query<Board>(`SELECT * FROM boards WHERE project_id = ? ORDER BY created_at ASC`, [projectId]);
  }

  async getById(id: string): Promise<Board & { columns: any[] }> {
    const rows = await this.db.query<Board>(`SELECT * FROM boards WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Board with ID ${id} not found`);
    }
    const board = rows[0];

    const columns = await this.db.query<any>(
      `SELECT c.*, COUNT(cards.id) as card_count 
       FROM columns c
       LEFT JOIN cards ON cards.column_id = c.id AND cards.archived = 0
       WHERE c.board_id = ?
       GROUP BY c.id
       ORDER BY c.position ASC`,
      [id]
    );

    return { ...board, columns };
  }

  async update(id: string, data: Partial<CreateBoard>): Promise<Board> {
    const board = await this.getById(id);
    const updatedName = data.name !== undefined ? data.name : board.name;
    const updatedAt = new Date().toISOString();

    await this.db.execute(
      `UPDATE boards SET name = ?, updated_at = ? WHERE id = ?`,
      [updatedName, updatedAt, id]
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.db.execute(`DELETE FROM boards WHERE id = ?`, [id]);
  }

  async createLabel(data: { board_id: string; name: string; color: string }): Promise<Label> {
    const label: Label = {
      id: ulid(),
      board_id: data.board_id,
      name: data.name,
      color: data.color
    };

    await this.db.execute(
      `INSERT INTO labels (id, board_id, name, color) VALUES (?, ?, ?, ?)`,
      [label.id, label.board_id, label.name, label.color]
    );

    return label;
  }

  async listLabels(boardId: string): Promise<Label[]> {
    return this.db.query<Label>(`SELECT * FROM labels WHERE board_id = ?`, [boardId]);
  }
}
