// File: src/services/event.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { CAPEvent } from '../shared/types.js';

export class EventService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
  ) {}

  async emit(
    projectId: string,
    entityType: string,
    entityId: string,
    action: string,
    actorId: string,
    payload: any
  ): Promise<CAPEvent> {
    const event: CAPEvent = {
      id: ulid(),
      project_id: projectId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: actorId,
      payload,
      created_at: new Date().toISOString()
    };

    const payloadStr = typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload);

    await this.db.execute(
      `INSERT INTO events (id, project_id, entity_type, entity_id, action, actor_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.project_id, event.entity_type, event.entity_id, event.action, event.actor_id, payloadStr, event.created_at]
    );

    if (this.onEvent) {
      await this.onEvent(event);
    }

    return event;
  }

  async list(
    projectId: string,
    options?: { entityType?: string; entityId?: string; since?: string; limit?: number }
  ): Promise<CAPEvent[]> {
    let sql = `SELECT * FROM events WHERE project_id = ?`;
    const params: any[] = [projectId];

    if (options?.entityType) {
      sql += ` AND entity_type = ?`;
      params.push(options.entityType);
    }
    if (options?.entityId) {
      sql += ` AND entity_id = ?`;
      params.push(options.entityId);
    }
    if (options?.since) {
      sql += ` AND created_at > ?`;
      params.push(options.since);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(row => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
    }));
  }
}
