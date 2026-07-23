// File: src/services/card.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Card, CreateCard, CAPEvent, Label, CardAssignee } from '../shared/types.js';
import { NotFoundError, ConflictError } from '../shared/errors.js';
import { generateRank, rankAfter } from '../shared/lexorank.js';

import { EventService } from './event.service.js';

export class CardService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  private async getProjectIdForColumn(columnId: string): Promise<string> {
    const rows = await this.db.query<{project_id: string}>(
      `SELECT b.project_id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ?`,
      [columnId]
    );
    return rows.length > 0 ? rows[0].project_id : '';
  }

  async create(data: CreateCard): Promise<Card> {
    const now = new Date().toISOString();

    const cards = await this.db.query<Card>(
      `SELECT position FROM cards WHERE column_id = ? AND archived = 0 ORDER BY position DESC LIMIT 1`, 
      [data.column_id]
    );

    const position = cards.length > 0 ? rankAfter(cards[0].position) : generateRank();

    const card: Card = {
      id: ulid(),
      column_id: data.column_id,
      title: data.title,
      description: data.description || null,
      position,
      priority: data.priority || 'medium',
      due_date: data.due_date || null,
      created_at: now,
      updated_at: now,
      archived: 0
    };

    await this.db.execute(
      `INSERT INTO cards (id, column_id, title, description, position, priority, due_date, created_at, updated_at, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [card.id, card.column_id, card.title, card.description, card.position, card.priority, card.due_date, card.created_at, card.updated_at, card.archived]
    );

    const projectId = await this.getProjectIdForColumn(card.column_id);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', card.id, 'created', 'system', { title: card.title, priority: card.priority });
    }

    return card;
  }

  async list(filters?: { columnId?: string; boardId?: string; assigneeId?: string; labelId?: string; archived?: boolean }): Promise<Card[]> {
    let sql = `
      SELECT DISTINCT c.* 
      FROM cards c
      LEFT JOIN card_assignees ca ON c.id = ca.card_id
      LEFT JOIN card_labels cl ON c.id = cl.card_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.columnId) {
      sql += ` AND c.column_id = ?`;
      params.push(filters.columnId);
    }
    if (filters?.boardId) {
      sql += ` AND c.column_id IN (SELECT id FROM columns WHERE board_id = ?)`;
      params.push(filters.boardId);
    }
    if (filters?.assigneeId) {
      sql += ` AND ca.agent_id = ?`;
      params.push(filters.assigneeId);
    }
    if (filters?.labelId) {
      sql += ` AND cl.label_id = ?`;
      params.push(filters.labelId);
    }

    if (filters?.archived) {
      sql += ` AND c.archived = 1`;
    } else {
      sql += ` AND c.archived = 0`;
    }

    sql += ` ORDER BY c.position ASC`;

    return this.db.query<Card>(sql, params);
  }

  async getById(id: string): Promise<Card & { labels: Label[], assignees: CardAssignee[], comments: any[] }> {
    const rows = await this.db.query<Card>(`SELECT * FROM cards WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Card with ID ${id} not found`);
    }
    const card = rows[0];

    const labels = await this.db.query<Label>(
      `SELECT l.* FROM labels l JOIN card_labels cl ON l.id = cl.label_id WHERE cl.card_id = ?`, [id]
    );
    const assignees = await this.db.query<CardAssignee>(
      `SELECT * FROM card_assignees WHERE card_id = ?`, [id]
    );
    const comments = await this.db.query<any>(
      `SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC`, [id]
    );

    return { ...card, labels, assignees, comments };
  }

  async update(id: string, data: Partial<CreateCard>): Promise<Card> {
    const card = await this.getById(id);
    const updatedTitle = data.title !== undefined ? data.title : card.title;
    const updatedDesc = data.description !== undefined ? data.description : card.description;
    const updatedPriority = data.priority !== undefined ? data.priority : card.priority;
    const updatedDue = data.due_date !== undefined ? data.due_date : card.due_date;
    const updatedAt = new Date().toISOString();

    await this.db.execute(
      `UPDATE cards SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ?`,
      [updatedTitle, updatedDesc, updatedPriority, updatedDue, updatedAt, id]
    );

    const projectId = await this.getProjectIdForColumn(card.column_id);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', id, 'updated', 'system', data);
    }

    return this.getById(id);
  }

  async move(id: string, targetColumnId: string, position?: string): Promise<Card> {
    const card = await this.getById(id);
    const updatedAt = new Date().toISOString();

    // Check WIP Limits if moving to a new column
    if (card.column_id !== targetColumnId) {
      const colRows = await this.db.query<{wip_limit: number | null}>(`SELECT wip_limit FROM columns WHERE id = ?`, [targetColumnId]);
      if (colRows.length > 0 && colRows[0].wip_limit !== null) {
        const countRows = await this.db.query<{count: number}>(`SELECT COUNT(*) as count FROM cards WHERE column_id = ? AND archived = 0`, [targetColumnId]);
        if (countRows[0].count >= colRows[0].wip_limit) {
          throw new ConflictError(`Cannot move card to column ${targetColumnId}, WIP limit exceeded`);
        }
      }
    }

    let finalPos = position;
    if (!finalPos) {
      const cards = await this.db.query<Card>(
        `SELECT position FROM cards WHERE column_id = ? AND archived = 0 ORDER BY position DESC LIMIT 1`, 
        [targetColumnId]
      );
      finalPos = cards.length > 0 ? rankAfter(cards[0].position) : generateRank();
    }

    await this.db.execute(
      `UPDATE cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?`,
      [targetColumnId, finalPos, updatedAt, id]
    );

    const projectId = await this.getProjectIdForColumn(targetColumnId);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', id, 'moved', 'system', { target_column_id: targetColumnId, position: finalPos });
    }

    return this.getById(id);
  }

  async assign(cardId: string, agentId: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO card_assignees (card_id, agent_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [cardId, agentId]
    );
    const card = await this.getById(cardId);
    const projectId = await this.getProjectIdForColumn(card.column_id);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', cardId, 'assigned', agentId, { agent_id: agentId });
    }
  }

  async unassign(cardId: string, agentId: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_assignees WHERE card_id = ? AND agent_id = ?`,
      [cardId, agentId]
    );
    const card = await this.getById(cardId);
    const projectId = await this.getProjectIdForColumn(card.column_id);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', cardId, 'unassigned', agentId, { agent_id: agentId });
    }
  }

  async addLabel(cardId: string, labelId: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO card_labels (card_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [cardId, labelId]
    );
  }

  async removeLabel(cardId: string, labelId: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_labels WHERE card_id = ? AND label_id = ?`,
      [cardId, labelId]
    );
  }

  async archive(id: string): Promise<Card> {
    const card = await this.getById(id);
    const now = new Date().toISOString();
    
    await this.db.execute(
      `UPDATE cards SET archived = 1, updated_at = ? WHERE id = ?`,
      [now, id]
    );

    const projectId = await this.getProjectIdForColumn(card.column_id);
    if (projectId) {
      await this.eventService?.emit(projectId, 'card', id, 'archived', 'system', {});
    }

    return this.getById(id);
  }
}
