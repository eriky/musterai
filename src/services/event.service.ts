// File: src/services/event.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Event, CreateEvent } from '../shared/types.js';

export type EventCallback = (event: Event) => void | Promise<void>;

export class EventService {
  private listeners: EventCallback[] = [];

  constructor(
    private db: DatabaseAdapter,
    onEvent?: EventCallback
  ) {
    if (onEvent) {
      this.listeners.push(onEvent);
    }
  }

  on(callback: EventCallback): void {
    this.listeners.push(callback);
  }

  async create(data: CreateEvent): Promise<Event> {
    const id = ulid();
    const created_at = new Date().toISOString();
    const payload = data.payload ? JSON.stringify(data.payload) : null;

    await this.db.execute(
      `INSERT INTO event (id, project_id, entity_type, entity_id, action, actor_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.project_id, data.entity_type, data.entity_id, data.action, data.actor_id || null, payload, created_at]
    );

    const event: Event = {
      id,
      project_id: data.project_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action: data.action,
      actor_id: data.actor_id || null,
      payload: data.payload || null,
      created_at,
    };

    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }

    return event;
  }

  async list(projectId: string, options: { entity_type?: string; entity_id?: string; since?: string; limit?: number } = {}): Promise<Event[]> {
    let sql = 'SELECT * FROM event WHERE project_id = ?';
    const params: unknown[] = [projectId];

    if (options.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(options.entity_type);
    }

    if (options.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(options.entity_id);
    }

    if (options.since) {
      sql += ' AND created_at >= ?';
      params.push(options.since);
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = await this.db.query<any>(sql, params);
    return rows.map(r => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }
}
