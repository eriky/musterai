// File: src/services/column.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Column, CreateColumn, CAPEvent } from '../shared/types.js';
import { NotFoundError, ConflictError } from '../shared/errors.js';
import { generateRank, rankAfter } from '../shared/lexorank.js';

export class ColumnService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
  ) {}

  async create(data: CreateColumn): Promise<Column> {
    const now = new Date().toISOString();
    const cols = await this.db.query<Column>(
      `SELECT position FROM columns WHERE board_id = ? ORDER BY position DESC LIMIT 1`, 
      [data.board_id]
    );

    const position = cols.length > 0 ? rankAfter(cols[0].position) : generateRank();

    const column: Column = {
      id: ulid(),
      board_id: data.board_id,
      name: data.name,
      position,
      wip_limit: data.wip_limit || null,
      created_at: now,
      updated_at: now
    };

    await this.db.execute(
      `INSERT INTO columns (id, board_id, name, position, wip_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [column.id, column.board_id, column.name, column.position, column.wip_limit, column.created_at, column.updated_at]
    );

    return column;
  }

  async getById(id: string): Promise<Column> {
    const rows = await this.db.query<Column>(`SELECT * FROM columns WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Column with ID ${id} not found`);
    }
    return rows[0];
  }

  async update(id: string, data: Partial<CreateColumn>): Promise<Column> {
    const column = await this.getById(id);
    const updatedName = data.name !== undefined ? data.name : column.name;
    const updatedWip = data.wip_limit !== undefined ? data.wip_limit : column.wip_limit;
    const updatedAt = new Date().toISOString();

    await this.db.execute(
      `UPDATE columns SET name = ?, wip_limit = ?, updated_at = ? WHERE id = ?`,
      [updatedName, updatedWip, updatedAt, id]
    );

    return this.getById(id);
  }

  async move(id: string, position: string): Promise<Column> {
    const column = await this.getById(id);
    const updatedAt = new Date().toISOString();

    await this.db.execute(
      `UPDATE columns SET position = ?, updated_at = ? WHERE id = ?`,
      [position, updatedAt, id]
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    const column = await this.getById(id);
    
    const cards = await this.db.query<{count: number}>(`SELECT COUNT(*) as count FROM cards WHERE column_id = ? AND archived = 0`, [id]);
    if (cards[0].count > 0) {
      throw new ConflictError(`Cannot delete column with ID ${id} because it contains active cards`);
    }

    await this.db.execute(`DELETE FROM columns WHERE id = ?`, [id]);
  }
}
