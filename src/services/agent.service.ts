// File: src/services/agent.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { AgentRegistration, CreateAgentRegistration, CAPEvent } from '../shared/types.js';
import { NotFoundError } from '../shared/errors.js';

export class AgentService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
  ) {}

  async register(data: CreateAgentRegistration): Promise<AgentRegistration> {
    const now = new Date().toISOString();
    
    const existing = await this.db.query<AgentRegistration>(
      `SELECT * FROM agent_registrations WHERE project_id = ? AND type = ? AND status != 'offline' LIMIT 1`,
      [data.project_id, data.type]
    );

    if (existing.length > 0) {
      return this.heartbeat(existing[0].id);
    }

    const registration: AgentRegistration = {
      id: ulid(),
      project_id: data.project_id,
      name: data.name,
      type: data.type,
      role: data.role,
      capabilities: data.capabilities,
      status: 'active',
      last_seen_at: now,
      created_at: now
    };

    await this.db.execute(
      `INSERT INTO agent_registrations (id, project_id, name, type, role, capabilities, status, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [registration.id, registration.project_id, registration.name, registration.type, registration.role, registration.capabilities, registration.status, registration.last_seen_at, registration.created_at]
    );

    return registration;
  }

  async list(projectId: string): Promise<AgentRegistration[]> {
    const rows = await this.db.query<any>(`SELECT * FROM agent_registrations WHERE project_id = ? ORDER BY last_seen_at DESC`, [projectId]);
    return rows.map(row => ({
      ...row,
      capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities
    }));
  }

  async getById(id: string): Promise<AgentRegistration> {
    const rows = await this.db.query<any>(`SELECT * FROM agent_registrations WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Agent registration with ID ${id} not found`);
    }
    const row = rows[0];
    return {
      ...row,
      capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities
    };
  }

  async heartbeat(id: string): Promise<AgentRegistration> {
    const now = new Date().toISOString();
    await this.db.execute(
      `UPDATE agent_registrations SET status = 'active', last_seen_at = ? WHERE id = ?`,
      [now, id]
    );
    return this.getById(id);
  }

  async updateStatus(): Promise<void> {
    const now = new Date();
    
    const idleTime = new Date(now.getTime() - 5 * 60000).toISOString();
    const offlineTime = new Date(now.getTime() - 15 * 60000).toISOString();

    await this.db.execute(
      `UPDATE agent_registrations 
       SET status = 'idle' 
       WHERE status = 'active' AND last_seen_at < ? AND last_seen_at >= ?`,
      [idleTime, offlineTime]
    );

    await this.db.execute(
      `UPDATE agent_registrations 
       SET status = 'offline' 
       WHERE status != 'offline' AND last_seen_at < ?`,
      [offlineTime]
    );
  }
}
