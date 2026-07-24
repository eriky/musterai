// File: src/services/card.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Card, CardDetails, CreateCard, UpdateCard, MoveCard, Label, Agent } from '../shared/types.js';
import { EventService } from './event.service.js';
import { rankAfter } from '../shared/lexorank.js';

export class CardService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateCard, actorId?: string): Promise<Card> {
    const id = ulid();
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    let position = data.position;
    if (!position) {
      const cards = await this.list({ column_id: data.column_id });
      const lastPos = cards.length > 0 ? cards[cards.length - 1].position : '';
      position = rankAfter(lastPos);
    }

    const priority = data.priority || 'medium';
    const description = data.description || null;
    const due_date = data.due_date || null;

    await this.db.execute(
      `INSERT INTO card (id, column_id, title, description, position, priority, due_date, created_at, updated_at, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, data.column_id, data.title, description, position, priority, due_date, created_at, updated_at]
    );

    if (data.labels && data.labels.length > 0) {
      for (const labelId of data.labels) {
        await this.addLabel(id, labelId, actorId);
      }
    }

    if (data.assignees && data.assignees.length > 0) {
      for (const agentId of data.assignees) {
        await this.assign(id, agentId, actorId);
      }
    }

    const card: Card = {
      id,
      column_id: data.column_id,
      title: data.title,
      description,
      position,
      priority,
      due_date,
      created_at,
      updated_at,
      archived: 0,
    };

    if (this.eventService) {
      const projectId = await this.getProjectIdForColumn(data.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: id,
          action: 'created',
          actor_id: actorId,
          payload: { title: card.title, column_id: card.column_id },
        });
      }
    }

    return card;
  }

  async getById(id: string): Promise<CardDetails> {
    const cardRows = await this.db.query<Card>('SELECT * FROM card WHERE id = ?', [id]);
    const card = cardRows[0];
    if (!card) throw new Error(`Card with ID ${id} not found`);

    const assignees = await this.db.query<Agent>(
      `SELECT a.* FROM agent_registration a
       JOIN card_assignee ca ON a.id = ca.agent_id
       WHERE ca.card_id = ?`,
      [id]
    );

    const labels = await this.db.query<Label>(
      `SELECT l.* FROM label l
       JOIN card_label cl ON l.id = cl.label_id
       WHERE cl.card_id = ?`,
      [id]
    );

    const comments = await this.db.query<any>(
      `SELECT c.*, a.name as author_name FROM comment c
       LEFT JOIN agent_registration a ON c.author_id = a.id
       WHERE c.card_id = ? ORDER BY c.created_at ASC`,
      [id]
    );

    return {
      ...card,
      assignees: assignees.map(a => ({
        ...a,
        capabilities: typeof a.capabilities === 'string' ? JSON.parse(a.capabilities) : (a.capabilities || []),
      })),
      labels,
      comments,
    };
  }

  async list(filters: { column_id?: string; board_id?: string; assignee_id?: string; label?: string; archived?: boolean } = {}): Promise<Card[]> {
    let sql = 'SELECT DISTINCT c.* FROM card c';
    const joins: string[] = [];
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.board_id) {
      joins.push('JOIN "column" col ON c.column_id = col.id');
      conditions.push('col.board_id = ?');
      params.push(filters.board_id);
    }

    if (filters.column_id) {
      conditions.push('c.column_id = ?');
      params.push(filters.column_id);
    }

    if (filters.assignee_id) {
      joins.push('JOIN card_assignee ca ON c.id = ca.card_id');
      conditions.push('ca.agent_id = ?');
      params.push(filters.assignee_id);
    }

    if (filters.label) {
      joins.push('JOIN card_label cl ON c.id = cl.card_id JOIN label l ON cl.label_id = l.id');
      conditions.push('(l.id = ? OR l.name = ?)');
      params.push(filters.label, filters.label);
    }

    if (filters.archived !== undefined) {
      conditions.push('c.archived = ?');
      params.push(filters.archived ? 1 : 0);
    } else {
      conditions.push('c.archived = 0');
    }

    if (joins.length > 0) {
      sql += ' ' + joins.join(' ');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY c.position ASC';

    return this.db.query<Card>(sql, params);
  }

  async update(id: string, data: UpdateCard, actorId?: string): Promise<CardDetails> {
    const existing = await this.getById(id);

    const title = data.title !== undefined ? data.title : existing.title;
    const description = data.description !== undefined ? data.description : existing.description;
    const priority = data.priority !== undefined ? data.priority : existing.priority;
    const due_date = data.due_date !== undefined ? data.due_date : existing.due_date;
    const updated_at = new Date().toISOString();

    await this.db.execute(
      `UPDATE card SET title = ?, description = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ?`,
      [title, description, priority, due_date, updated_at, id]
    );

    if (this.eventService) {
      const projectId = await this.getProjectIdForColumn(existing.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: id,
          action: 'updated',
          actor_id: actorId,
          payload: data as Record<string, unknown>,
        });
      }
    }

    return this.getById(id);
  }

  async move(id: string, data: MoveCard, actorId?: string): Promise<CardDetails> {
    const existing = await this.getById(id);
    const target_column_id = data.target_column_id || existing.column_id;

    let position = data.position;
    if (!position) {
      const targetCards = await this.list({ column_id: target_column_id });
      const lastPos = targetCards.length > 0 ? targetCards[targetCards.length - 1].position : '';
      position = rankAfter(lastPos);
    }

    const updated_at = new Date().toISOString();

    await this.db.execute(
      `UPDATE card SET column_id = ?, position = ?, updated_at = ? WHERE id = ?`,
      [target_column_id, position, updated_at, id]
    );

    if (this.eventService) {
      const projectId = await this.getProjectIdForColumn(target_column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: id,
          action: 'moved',
          actor_id: actorId,
          payload: {
            from_column_id: existing.column_id,
            to_column_id: target_column_id,
            position,
          },
        });
      }
    }

    return this.getById(id);
  }

  async assign(cardId: string, agentId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `INSERT OR IGNORE INTO card_assignee (card_id, agent_id) VALUES (?, ?)`,
      [cardId, agentId]
    );

    if (this.eventService) {
      const card = await this.getById(cardId);
      const projectId = await this.getProjectIdForColumn(card.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: cardId,
          action: 'assigned',
          actor_id: actorId,
          payload: { agent_id: agentId },
        });
      }
    }
  }

  async unassign(cardId: string, agentId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_assignee WHERE card_id = ? AND agent_id = ?`,
      [cardId, agentId]
    );
  }

  async addLabel(cardId: string, labelId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `INSERT OR IGNORE INTO card_label (card_id, label_id) VALUES (?, ?)`,
      [cardId, labelId]
    );
  }

  async removeLabel(cardId: string, labelId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_label WHERE card_id = ? AND label_id = ?`,
      [cardId, labelId]
    );
  }

  async archive(cardId: string, actorId?: string): Promise<void> {
    const updated_at = new Date().toISOString();
    await this.db.execute(`UPDATE card SET archived = 1, updated_at = ? WHERE id = ?`, [updated_at, cardId]);
  }

  private async getProjectIdForColumn(columnId: string): Promise<string | null> {
    const rows = await this.db.query<{ project_id: string }>(
      `SELECT b.project_id FROM "column" col JOIN board b ON col.board_id = b.id WHERE col.id = ?`,
      [columnId]
    );
    return rows[0]?.project_id || null;
  }
}
