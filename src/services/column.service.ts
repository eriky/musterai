// File: src/services/column.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Column, CreateColumn, CAPEvent } from '../shared/types.js';
import { NotFoundError, ConflictError } from '../shared/errors.js';
import { generateRank, rankAfter, rankBefore, rankBetween } from '../shared/lexorank.js';

import { EventService } from './event.service.js';

export class ColumnService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateColumn): Promise<Column> {
    const now = new Date().toISOString();
    const allCols = await this.db.query<Column>(
      `SELECT position FROM columns WHERE board_id = ? ORDER BY position ASC`, 
      [data.board_id]
    );

    let position: string;

    if (allCols.length === 0) {
      position = generateRank();
    } else if (data.position === 'f') {
      // First — insert before the first column
      position = rankBefore(allCols[0].position);
    } else if (data.position === 'l') {
      // Left of middle — insert between first and center
      const mid = Math.floor((allCols.length - 1) / 2);
      position = rankBetween(
        mid > 0 ? allCols[mid - 1].position : null,
        allCols[mid].position
      );
    } else if (data.position === 'm') {
      // Middle — insert at the center point
      const mid = Math.floor(allCols.length / 2);
      position = rankBetween(
        allCols[mid - 1]?.position ?? null,
        allCols[mid]?.position ?? null
      );
    } else if (data.position === 'r') {
      // Right of middle — insert between center and last
      const mid = Math.floor(allCols.length / 2);
      position = rankBetween(
        allCols[mid].position,
        allCols[mid + 1]?.position ?? null
      );
    } else {
      // Default / undefined — append at end
      position = rankAfter(allCols[allCols.length - 1].position);
    }

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

    const b = await this.db.query<{project_id: string}>('SELECT project_id FROM boards WHERE id = ?', [column.board_id]);
    if (b.length > 0) {
      await this.eventService?.emit(b[0].project_id, 'column', column.id, 'created', 'system', { name: column.name });
    }

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
