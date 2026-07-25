import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Card, CardDetails, CreateCard, UpdateCard, MoveCard, Label, Agent, Document, CardLinkRelationType, LinkedCardSummary } from '../shared/types.js';
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
    const status = data.status || 'active';
    const blocked_reason = data.blocked_reason !== undefined ? data.blocked_reason : null;

    await this.db.execute(
      `INSERT INTO card (id, column_id, title, description, position, priority, due_date, status, blocked_reason, created_at, updated_at, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, data.column_id, data.title, description, position, priority, due_date, status, blocked_reason, created_at, updated_at]
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
      status,
      blocked_reason,
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

    const linked_documents = await this.db.query<Document>(
      `SELECT d.* FROM document d
       JOIN card_document cd ON d.id = cd.document_id
       WHERE cd.card_id = ?
       ORDER BY cd.linked_at ASC`,
      [id]
    );

    const linked_cards = await this.getLinkedCards(id);

    return {
      ...card,
      assignees: assignees.map(a => ({
        ...a,
        capabilities: typeof a.capabilities === 'string' ? JSON.parse(a.capabilities) : (a.capabilities || []),
      })),
      labels,
      comments,
      linked_documents,
      linked_cards,
    };
  }

  private async getLinkedCards(cardId: string): Promise<LinkedCardSummary[]> {
    type LinkRow = { id: string; relation_type: string; other_id: string; other_title: string; other_column_id: string; other_status: string; other_priority: string; other_archived: number };

    const outgoing = await this.db.query<LinkRow>(
      `SELECT cl.id, cl.relation_type, c.id as other_id, c.title as other_title, c.column_id as other_column_id, c.status as other_status, c.priority as other_priority, c.archived as other_archived
       FROM card_link cl JOIN card c ON c.id = cl.target_card_id
       WHERE cl.source_card_id = ?`,
      [cardId]
    );

    const incoming = await this.db.query<LinkRow>(
      `SELECT cl.id, cl.relation_type, c.id as other_id, c.title as other_title, c.column_id as other_column_id, c.status as other_status, c.priority as other_priority, c.archived as other_archived
       FROM card_link cl JOIN card c ON c.id = cl.source_card_id
       WHERE cl.target_card_id = ?`,
      [cardId]
    );

    const toSummary = (row: LinkRow, relation_type: CardLinkRelationType): LinkedCardSummary => ({
      id: row.id,
      relation_type,
      card: {
        id: row.other_id,
        title: row.other_title,
        column_id: row.other_column_id,
        status: row.other_status as LinkedCardSummary['card']['status'],
        priority: row.other_priority as LinkedCardSummary['card']['priority'],
        archived: row.other_archived,
      },
    });

    return [
      ...outgoing.map(r => toSummary(r, r.relation_type as CardLinkRelationType)),
      ...incoming.map(r => toSummary(r, r.relation_type === 'blocks' ? 'blocked_by' : (r.relation_type as CardLinkRelationType))),
    ];
  }

  async list(filters: { column_id?: string; board_id?: string; assignee_id?: string; label?: string; status?: string; archived?: boolean } = {}): Promise<Card[]> {
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

    if (filters.status) {
      conditions.push('c.status = ?');
      params.push(filters.status);
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
    const status = data.status !== undefined ? data.status : existing.status;
    const blocked_reason = data.blocked_reason !== undefined ? data.blocked_reason : existing.blocked_reason;
    const updated_at = new Date().toISOString();

    await this.db.execute(
      `UPDATE card SET title = ?, description = ?, priority = ?, due_date = ?, status = ?, blocked_reason = ?, updated_at = ? WHERE id = ?`,
      [title, description, priority, due_date, status, blocked_reason, updated_at, id]
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

  async linkDocument(cardId: string, documentId: string, actorId?: string): Promise<void> {
    const linked_at = new Date().toISOString();
    await this.db.execute(
      `INSERT OR IGNORE INTO card_document (card_id, document_id, linked_at) VALUES (?, ?, ?)`,
      [cardId, documentId, linked_at]
    );

    if (this.eventService) {
      const card = await this.getById(cardId);
      const projectId = await this.getProjectIdForColumn(card.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: cardId,
          action: 'document_linked',
          actor_id: actorId,
          payload: { document_id: documentId },
        });
      }
    }
  }

  async unlinkDocument(cardId: string, documentId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_document WHERE card_id = ? AND document_id = ?`,
      [cardId, documentId]
    );
  }

  async linkCard(cardId: string, targetCardId: string, relationType: CardLinkRelationType, actorId?: string): Promise<void> {
    if (cardId === targetCardId) throw new Error('A card cannot be linked to itself');

    let sourceCardId = cardId;
    let destCardId = targetCardId;
    let storedType: 'blocks' | 'relates_to' | 'duplicates' = relationType === 'blocked_by' ? 'blocks' : relationType;

    if (relationType === 'blocked_by') {
      sourceCardId = targetCardId;
      destCardId = cardId;
    } else if (storedType === 'relates_to' || storedType === 'duplicates') {
      // Symmetric relations: canonicalize direction so A-B and B-A collapse to one row.
      if (sourceCardId > destCardId) {
        [sourceCardId, destCardId] = [destCardId, sourceCardId];
      }
    }

    const id = ulid();
    const created_at = new Date().toISOString();
    await this.db.execute(
      `INSERT OR IGNORE INTO card_link (id, source_card_id, target_card_id, relation_type, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, sourceCardId, destCardId, storedType, created_at]
    );

    if (this.eventService) {
      const card = await this.getById(cardId);
      const projectId = await this.getProjectIdForColumn(card.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: cardId,
          action: 'card_linked',
          actor_id: actorId,
          payload: { target_card_id: targetCardId, relation_type: relationType },
        });
      }
    }
  }

  async unlinkCard(cardId: string, linkId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_link WHERE id = ? AND (source_card_id = ? OR target_card_id = ?)`,
      [linkId, cardId, cardId]
    );
  }

  async searchByTitle(projectId: string, query: string, opts: { excludeCardId?: string; limit?: number } = {}): Promise<Card[]> {
    const limit = opts.limit ?? 20;
    const params: unknown[] = [projectId];

    let sql = `SELECT c.* FROM card c
      JOIN "column" col ON c.column_id = col.id
      JOIN board b ON col.board_id = b.id
      WHERE b.project_id = ? AND c.archived = 0`;

    if (query.trim()) {
      sql += ' AND c.title LIKE ?';
      params.push(`%${query.trim()}%`);
    }

    if (opts.excludeCardId) {
      sql += ' AND c.id != ?';
      params.push(opts.excludeCardId);
    }

    sql += ' ORDER BY c.updated_at DESC LIMIT ?';
    params.push(limit);

    return this.db.query<Card>(sql, params);
  }

  async archive(cardId: string, actorId?: string): Promise<void> {
    const updated_at = new Date().toISOString();
    await this.db.execute(`UPDATE card SET archived = 1, updated_at = ? WHERE id = ?`, [updated_at, cardId]);
  }

  async delete(cardId: string, actorId?: string): Promise<void> {
    const existing = await this.getById(cardId);
    if (!existing) throw new Error(`Card with ID ${cardId} not found`);

    const projectId = await this.getProjectIdForColumn(existing.column_id);

    await this.db.execute('DELETE FROM card_assignee WHERE card_id = ?', [cardId]);
    await this.db.execute('DELETE FROM card_label WHERE card_id = ?', [cardId]);
    await this.db.execute('DELETE FROM card_document WHERE card_id = ?', [cardId]);
    await this.db.execute('DELETE FROM card_link WHERE source_card_id = ? OR target_card_id = ?', [cardId, cardId]);
    await this.db.execute('DELETE FROM comment WHERE card_id = ?', [cardId]);
    await this.db.execute('DELETE FROM card WHERE id = ?', [cardId]);

    if (this.eventService && projectId) {
      await this.eventService.create({
        project_id: projectId,
        entity_type: 'card',
        entity_id: cardId,
        action: 'deleted',
        actor_id: actorId,
        payload: { title: existing.title },
      });
    }
  }

  private async getProjectIdForColumn(columnId: string): Promise<string | null> {
    const rows = await this.db.query<{ project_id: string }>(
      `SELECT b.project_id FROM "column" col JOIN board b ON col.board_id = b.id WHERE col.id = ?`,
      [columnId]
    );
    return rows[0]?.project_id || null;
  }
}

