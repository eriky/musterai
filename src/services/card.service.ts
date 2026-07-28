import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Card, CardAssignee, CardDetails, CreateCard, UpdateCard, MoveCard, Label, Document, CardLinkRelationType, StoredCardLinkType, LinkedCardSummary, CardWorkLink, CreateCardWorkLink, ClaimRefusal } from '../shared/types.js';
import { EventService } from './event.service.js';
import { rankAfter } from '../shared/lexorank.js';
import { formatCardKey } from '../shared/card-key.js';
import { ValidationError } from '../shared/errors.js';
import { config } from '../config/index.js';
import { assertMaxLength, CARD_TEXT_MAX_CHARS } from '../shared/content-limits.js';

function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`Work link URL is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`Work link URL must use http or https, got: ${parsed.protocol}`);
  }
}

const DEFAULT_CLAIM_TTL_SECONDS = 600;

export class CardService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateCard, actorId?: string): Promise<Card> {
    assertMaxLength(data.description, CARD_TEXT_MAX_CHARS, 'Card description');
    const id = ulid();
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    const projectId = await this.getProjectIdForColumn(data.column_id);
    if (!projectId) throw new Error(`Column ${data.column_id} is not attached to a project`);
    const key = await this.nextCardKey(projectId);

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
    const is_epic = data.is_epic ? 1 : 0;

    await this.db.execute(
      `INSERT INTO card (id, key, column_id, title, description, position, priority, due_date, status, blocked_reason, created_at, updated_at, archived, is_epic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, key, data.column_id, data.title, description, position, priority, due_date, status, blocked_reason, created_at, updated_at, is_epic]
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
      key,
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
      claimed_by: null,
      claimed_at: null,
      claim_expires_at: null,
      is_epic,
    };

    if (this.eventService) {
      await this.eventService.create({
        project_id: projectId,
        entity_type: 'card',
        entity_id: id,
        action: 'created',
        actor_id: actorId,
        payload: { title: card.title, column_id: card.column_id },
      });
    }

    return card;
  }

  /** Atomically claims the next per-project sequence number and formats it as e.g. "MUS-42". */
  private async nextCardKey(projectId: string): Promise<string> {
    return this.db.transaction(async tx => {
      const rows = await tx.query<{ card_seq: number; key_prefix: string }>(
        `UPDATE project SET card_seq = card_seq + 1 WHERE id = ? RETURNING card_seq, key_prefix`,
        [projectId]
      );
      const row = rows[0];
      if (!row) throw new Error(`Project ${projectId} not found`);
      return formatCardKey(row.key_prefix, row.card_seq);
    });
  }

  /**
   * `db` defaults to the pool-backed `this.db` for ordinary callers, but
   * every caller inside an open `this.db.transaction(tx => ...)` callback
   * (e.g. claim()) must pass `tx` explicitly. On SQLite there's only ever
   * one physical connection, so reaching back into `this.db` from inside a
   * transaction works by accident; on Postgres it asks the pool for another
   * connection while the transaction's own connection is still checked out,
   * and if every pool connection is meanwhile blocked on this same row's
   * lock (as under concurrent claim() calls), that request queues forever —
   * a self-inflicted deadlock. Found via MUS-31's concurrent-claim test.
   */
  async getById(id: string, db: DatabaseAdapter = this.db): Promise<CardDetails> {
    const cardRows = await db.query<Card>('SELECT * FROM card WHERE id = ?', [id]);
    const card = cardRows[0];
    if (!card) throw new Error(`Card with ID ${id} not found`);

    // LEFT JOINs both concrete principal tables — an assignee may be an agent
    // or a human app_user, and only one of the two joins will match per row.
    // A human's status is never surfaced (liveness is agent-only telemetry).
    const assignees = await db.query<CardAssignee>(
      `SELECT p.id, COALESCE(a.name, u.display_name) as name, p.kind, a.status FROM card_assignee ca
       JOIN principal p ON p.id = ca.principal_id
       LEFT JOIN agent a ON a.id = p.id
       LEFT JOIN app_user u ON u.id = p.id
       WHERE ca.card_id = ?`,
      [id]
    );

    const labels = await db.query<Label>(
      `SELECT l.* FROM label l
       JOIN card_label cl ON l.id = cl.label_id
       WHERE cl.card_id = ?`,
      [id]
    );

    const comments = await db.query<any>(
      `SELECT c.*, COALESCE(a.name, u.display_name) as author_name, p.kind as author_kind FROM comment c
       LEFT JOIN principal p ON c.author_id = p.id
       LEFT JOIN agent a ON c.author_id = a.id
       LEFT JOIN app_user u ON c.author_id = u.id
       WHERE c.card_id = ? ORDER BY c.created_at ASC`,
      [id]
    );

    // Deliberately excludes d.content — a design doc body can run tens of KB,
    // and every card mutation (create/move/link/assign/...) round-trips this
    // list via getById(). Full content is one getDocument call away.
    const linked_documents = await db.query<Omit<Document, 'content'>>(
      `SELECT d.id, d.project_id, d.parent_id, d.title, d.status, d.author_id, d.version, d.created_at, d.updated_at
       FROM document d
       JOIN card_document cd ON d.id = cd.document_id
       WHERE cd.card_id = ?
       ORDER BY cd.linked_at ASC`,
      [id]
    );

    const linked_cards = await this.getLinkedCards(id, db);
    const work_links = await this.listWorkLinks(id, db);
    const epic_progress = card.is_epic
      ? await this.getEpicProgress(linked_cards, db)
      : null;

    return {
      ...card,
      assignees: assignees.map(a => ({
        id: a.id,
        name: a.name,
        kind: (a.kind || 'agent') as 'user' | 'agent',
        status: a.kind === 'agent' ? (a.status || 'offline') : null,
      })),
      labels,
      comments,
      linked_documents,
      linked_cards,
      work_links,
      epic_progress,
    };
  }

  /**
   * "6 of 13 done" for an Epic. Deliberately scoped to the single-card
   * detail path (getById), not the board list — computing this per card on
   * a board fetch would be an N+1 query for every board with an Epic on it.
   * Children come from `linked_cards` (already fetched for this call), not
   * a fresh query. Zero children returns null rather than "0/0" — an empty
   * Epic hasn't been broken down yet, which reads differently from "not
   * started".
   */
  private async getEpicProgress(
    linkedCards: LinkedCardSummary[],
    db: DatabaseAdapter
  ): Promise<{ total: number; done: number } | null> {
    const children = linkedCards.filter(l => l.relation_type === 'parent_of');
    if (children.length === 0) return null;

    const columnIds = [...new Set(children.map(c => c.card.column_id))];
    const placeholders = columnIds.map(() => '?').join(', ');
    const terminalRows = await db.query<{ id: string }>(
      `SELECT id FROM "column" WHERE is_terminal = 1 AND id IN (${placeholders})`,
      columnIds
    );
    const terminalColumnIds = new Set(terminalRows.map(r => r.id));
    const done = children.filter(c => terminalColumnIds.has(c.card.column_id)).length;

    return { total: children.length, done };
  }

  private async getLinkedCards(cardId: string, db: DatabaseAdapter = this.db): Promise<LinkedCardSummary[]> {
    type LinkRow = { id: string; relation_type: string; other_id: string; other_key: string; other_title: string; other_column_id: string; other_column_name: string; other_status: string; other_priority: string; other_archived: number };

    const outgoing = await db.query<LinkRow>(
      `SELECT cl.id, cl.relation_type, c.id as other_id, c.key as other_key, c.title as other_title, c.column_id as other_column_id, col.name as other_column_name, c.status as other_status, c.priority as other_priority, c.archived as other_archived
       FROM card_link cl JOIN card c ON c.id = cl.target_card_id
       JOIN "column" col ON col.id = c.column_id
       WHERE cl.source_card_id = ?`,
      [cardId]
    );

    const incoming = await db.query<LinkRow>(
      `SELECT cl.id, cl.relation_type, c.id as other_id, c.key as other_key, c.title as other_title, c.column_id as other_column_id, col.name as other_column_name, c.status as other_status, c.priority as other_priority, c.archived as other_archived
       FROM card_link cl JOIN card c ON c.id = cl.source_card_id
       JOIN "column" col ON col.id = c.column_id
       WHERE cl.target_card_id = ?`,
      [cardId]
    );

    const toSummary = (row: LinkRow, relation_type: CardLinkRelationType): LinkedCardSummary => ({
      id: row.id,
      relation_type,
      card: {
        id: row.other_id,
        key: row.other_key,
        title: row.other_title,
        column_id: row.other_column_id,
        column_name: row.other_column_name,
        status: row.other_status as LinkedCardSummary['card']['status'],
        priority: row.other_priority as LinkedCardSummary['card']['priority'],
        archived: row.other_archived,
      },
    });

    const incomingLabel = (stored: string): CardLinkRelationType => {
      if (stored === 'blocks') return 'blocked_by';
      if (stored === 'parent_of') return 'child_of';
      return stored as CardLinkRelationType;
    };

    return [
      ...outgoing.map(r => toSummary(r, r.relation_type as CardLinkRelationType)),
      ...incoming.map(r => toSummary(r, incomingLabel(r.relation_type))),
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
      conditions.push('ca.principal_id = ?');
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

    const cards = await this.db.query<Card>(sql, params);
    if (cards.length === 0) return cards;

    const placeholders = cards.map(() => '?').join(', ');
    const assigneeRows = await this.db.query<CardAssignee & { card_id: string }>(
      `SELECT ca.card_id, p.id, COALESCE(a.name, u.display_name) as name, p.kind, a.status
       FROM card_assignee ca
       JOIN principal p ON ca.principal_id = p.id
       LEFT JOIN agent a ON a.id = p.id
       LEFT JOIN app_user u ON u.id = p.id
       WHERE ca.card_id IN (${placeholders})
       ORDER BY name ASC`,
      cards.map(card => card.id)
    );

    const assigneesByCard = new Map<string, CardAssignee[]>();
    for (const assignee of assigneeRows) {
      const cardAssignees = assigneesByCard.get(assignee.card_id) || [];
      cardAssignees.push({
        id: assignee.id,
        name: assignee.name,
        kind: (assignee.kind || 'agent') as 'user' | 'agent',
        status: assignee.kind === 'agent' ? assignee.status : null,
      });
      assigneesByCard.set(assignee.card_id, cardAssignees);
    }

    return cards.map(card => ({
      ...card,
      assignees: assigneesByCard.get(card.id) || [],
    }));
  }

  async update(id: string, data: UpdateCard, actorId?: string): Promise<CardDetails> {
    assertMaxLength(data.description, CARD_TEXT_MAX_CHARS, 'Card description');
    const existing = await this.getById(id);

    const title = data.title !== undefined ? data.title : existing.title;
    const description = data.description !== undefined ? data.description : existing.description;
    const priority = data.priority !== undefined ? data.priority : existing.priority;
    const due_date = data.due_date !== undefined ? data.due_date : existing.due_date;
    const status = data.status !== undefined ? data.status : existing.status;
    const blocked_reason = data.blocked_reason !== undefined ? data.blocked_reason : existing.blocked_reason;
    const is_epic = data.is_epic !== undefined ? (data.is_epic ? 1 : 0) : existing.is_epic;
    const updated_at = new Date().toISOString();

    await this.db.execute(
      `UPDATE card SET title = ?, description = ?, priority = ?, due_date = ?, status = ?, blocked_reason = ?, is_epic = ?, updated_at = ? WHERE id = ?`,
      [title, description, priority, due_date, status, blocked_reason, is_epic, updated_at, id]
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
      `INSERT OR IGNORE INTO card_assignee (card_id, principal_id) VALUES (?, ?)`,
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
      `DELETE FROM card_assignee WHERE card_id = ? AND principal_id = ?`,
      [cardId, agentId]
    );
  }

  /**
   * Atomically claim a card: succeeds only if unclaimed, held by the same agent,
   * or the existing lease has expired. Runs as a compare-and-swap inside a
   * transaction so two concurrent claims can never both succeed.
   */
  async claim(cardId: string, agentId: string, ttlSeconds: number = DEFAULT_CLAIM_TTL_SECONDS): Promise<CardDetails | ClaimRefusal> {
    return this.db.transaction(async (tx) => {
      // Read-check-write is only atomic if nothing else can write the row
      // between the read and the write. On SQLite that's true by accident —
      // better-sqlite3 is one connection and BEGIN IMMEDIATE serializes every
      // transaction globally. Postgres's connection pool has no such
      // accident: two concurrent claim() calls can both SELECT the same
      // unclaimed card before either UPDATEs it. FOR UPDATE closes that
      // window by blocking a second transaction's SELECT until the first
      // commits or rolls back. SQLite doesn't recognize FOR UPDATE as syntax
      // at all, so this must stay conditional rather than portable SQL —
      // see DatabaseAdapter.dialect's doc comment for why that's the
      // deliberate exception rather than the norm.
      const lockClause = tx.dialect === 'postgres' ? ' FOR UPDATE' : '';
      const rows = await tx.query<Card>(`SELECT * FROM card WHERE id = ?${lockClause}`, [cardId]);
      const card = rows[0];
      if (!card) throw new Error(`Card with ID ${cardId} not found`);

      const now = new Date();
      const nowIso = now.toISOString();
      const heldByOther = card.claimed_by && card.claimed_by !== agentId
        && card.claim_expires_at && card.claim_expires_at > nowIso;

      if (heldByOther) {
        const holderRows = await tx.query<{ name: string }>(
          'SELECT a.name FROM agent a JOIN principal p ON a.id = p.id WHERE p.id = ?',
          [card.claimed_by]
        );
        const refusal: ClaimRefusal = {
          success: false,
          reason: 'already_claimed',
          card_id: cardId,
          held_by: { id: card.claimed_by as string, name: holderRows[0]?.name ?? null },
          claim_expires_at: card.claim_expires_at as string,
        };
        return refusal;
      }

      const expiresIso = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
      await tx.execute(
        `UPDATE card SET claimed_by = ?, claimed_at = ?, claim_expires_at = ?, updated_at = ? WHERE id = ?`,
        [agentId, nowIso, expiresIso, nowIso, cardId]
      );
      await tx.execute(
        `INSERT OR IGNORE INTO card_assignee (card_id, principal_id) VALUES (?, ?)`,
        [cardId, agentId]
      );

      if (this.eventService) {
        const projectId = await this.getProjectIdForColumn(card.column_id);
        if (projectId) {
          await this.eventService.create({
            project_id: projectId,
            entity_type: 'card',
            entity_id: cardId,
            action: 'claimed',
            actor_id: agentId,
            payload: { claim_expires_at: expiresIso },
          });
        }
      }

      return this.getById(cardId, tx);
    });
  }

  /** Extend the claim lease on every card currently held by this agent — called on heartbeat. */
  async renewClaims(agentId: string, ttlSeconds: number = DEFAULT_CLAIM_TTL_SECONDS): Promise<void> {
    const expiresIso = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await this.db.execute(
      `UPDATE card SET claim_expires_at = ? WHERE claimed_by = ?`,
      [expiresIso, agentId]
    );
  }

  /** Release leases past their expiry so the board doesn't hold a card forever for a dead agent. */
  async releaseExpiredLeases(): Promise<string[]> {
    const nowIso = new Date().toISOString();
    const expired = await this.db.query<Card>(
      `SELECT * FROM card WHERE claimed_by IS NOT NULL AND claim_expires_at IS NOT NULL AND claim_expires_at <= ?`,
      [nowIso]
    );

    for (const card of expired) {
      const updated_at = new Date().toISOString();
      await this.db.execute(
        `UPDATE card SET claimed_by = NULL, claimed_at = NULL, claim_expires_at = NULL, updated_at = ? WHERE id = ?`,
        [updated_at, card.id]
      );

      if (this.eventService) {
        const projectId = await this.getProjectIdForColumn(card.column_id);
        if (projectId) {
          await this.eventService.create({
            project_id: projectId,
            entity_type: 'card',
            entity_id: card.id,
            action: 'claim_expired',
            payload: { previously_claimed_by: card.claimed_by },
          });
        }
      }
    }

    return expired.map(c => c.id);
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
    // 'blocked_by' and 'child_of' are inverse views: the caller names the
    // relationship from cardId's perspective, but storage is always
    // canonical ('blocks'/'parent_of' with source as the blocker/parent).
    let storedType: StoredCardLinkType =
      relationType === 'blocked_by' ? 'blocks' :
      relationType === 'child_of' ? 'parent_of' :
      relationType;

    if (relationType === 'blocked_by' || relationType === 'child_of') {
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

  async addWorkLink(cardId: string, data: CreateCardWorkLink, actorId?: string): Promise<CardWorkLink> {
    assertHttpUrl(data.url);

    const id = ulid();
    const created_at = new Date().toISOString();
    const external_ref = data.external_ref ?? null;
    const title = data.title ?? null;
    const status = data.status ?? null;

    await this.db.execute(
      `INSERT INTO card_work_link (id, card_id, kind, provider, url, external_ref, title, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, cardId, data.kind, data.provider, data.url, external_ref, title, status, created_at]
    );

    if (this.eventService) {
      const card = await this.getById(cardId);
      const projectId = await this.getProjectIdForColumn(card.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: cardId,
          action: 'work_link_added',
          actor_id: actorId,
          payload: { kind: data.kind, provider: data.provider, url: data.url },
        });
      }
    }

    return { id, card_id: cardId, kind: data.kind, provider: data.provider, url: data.url, external_ref, title, status, created_at };
  }

  async removeWorkLink(cardId: string, linkId: string, actorId?: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM card_work_link WHERE id = ? AND card_id = ?`,
      [linkId, cardId]
    );

    if (this.eventService) {
      const card = await this.getById(cardId);
      const projectId = await this.getProjectIdForColumn(card.column_id);
      if (projectId) {
        await this.eventService.create({
          project_id: projectId,
          entity_type: 'card',
          entity_id: cardId,
          action: 'work_link_removed',
          actor_id: actorId,
          payload: { link_id: linkId },
        });
      }
    }
  }

  async listWorkLinks(cardId: string, db: DatabaseAdapter = this.db): Promise<CardWorkLink[]> {
    return db.query<CardWorkLink>(
      `SELECT * FROM card_work_link WHERE card_id = ? ORDER BY created_at ASC`,
      [cardId]
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
    await this.db.execute('DELETE FROM card_work_link WHERE card_id = ?', [cardId]);
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

  /**
   * Layer 2 scope check: validate that a principal has scope over a card.
   * Returns true if the principal (or an agent they operate) is an assignee
   * on the card, or if the principal has unrestricted card access.
   * Under MUSTER_AUTH_MODE=open, always returns true (no scope enforcement).
   */
  async validateCardScope(cardId: string, agentIds: string[]): Promise<boolean> {
    if (config.auth.mode === 'open') return true;

    if (agentIds.length === 0) return false;

    const placeholders = agentIds.map(() => '?').join(',');
    const rows = await this.db.query<{ card_id: string }>(
      `SELECT card_id FROM card_assignee WHERE card_id = ? AND principal_id IN (${placeholders}) LIMIT 1`,
      [cardId, ...agentIds]
    );
    return rows.length > 0;
  }
}
