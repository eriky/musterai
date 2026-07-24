// File: src/services/agent.service.ts
import { ulid } from 'ulid';
import crypto from 'node:crypto';
import { DatabaseAdapter } from '../db/adapter.js';
import { Agent, RegisterAgent, UpdateAgentStatus } from '../shared/types.js';
import { EventService } from './event.service.js';

export class AgentService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async getHumanSecretToken(): Promise<string> {
    const rows = await this.db.query<any>("SELECT value FROM system_settings WHERE key = 'human_secret_token'");
    if (rows.length > 0 && rows[0].value) {
      return rows[0].value;
    }

    // Generate a default human owner secret token
    const token = `cap_sec_${crypto.randomBytes(12).toString('hex')}`;
    const created_at = new Date().toISOString();
    await this.db.execute(
      "INSERT OR REPLACE INTO system_settings (key, value, created_at) VALUES ('human_secret_token', ?, ?)",
      [token, created_at]
    );
    return token;
  }

  async register(data: RegisterAgent): Promise<Agent> {
    const humanSecret = await this.getHumanSecretToken();

    // Verify secret token if provided
    if (data.secret_token && data.secret_token !== humanSecret) {
      throw new Error('Invalid secret token. Provided secret token does not match the human owner token.');
    }

    const targetId = data.agent_id || data.id;

    // Check if re-binding an existing registered agent
    if (targetId) {
      const existing = await this.getById(targetId);
      if (existing) {
        const last_seen_at = new Date().toISOString();
        const status = data.status || 'active';
        const name = data.name || existing.name;
        const role = data.role || existing.role;

        let capabilitiesStr: string | null = existing.capabilities ? JSON.stringify(existing.capabilities) : null;
        if (data.capabilities) {
          if (typeof data.capabilities === 'string') {
            capabilitiesStr = JSON.stringify(data.capabilities.split(',').map(s => s.trim()));
          } else if (Array.isArray(data.capabilities)) {
            capabilitiesStr = JSON.stringify(data.capabilities);
          }
        }

        await this.db.execute(
          `UPDATE agent_registration
           SET name = ?, role = ?, capabilities = ?, status = ?, last_seen_at = ?
           WHERE id = ?`,
          [name, role, capabilitiesStr, status, last_seen_at, existing.id]
        );

        return (await this.getById(existing.id))!;
      }
    }

    // Create a new agent registration
    const id = targetId || ulid();
    const created_at = new Date().toISOString();
    const last_seen_at = created_at;
    const status = data.status || 'active';
    const name = data.name || 'AI Agent';
    const type = data.type || 'ai_agent';
    const role = data.role || 'contributor';
    const owner_id = data.owner_id || 'human_owner';
    const secret_token = data.secret_token || humanSecret;

    let capabilitiesStr: string | null = null;
    if (data.capabilities) {
      if (typeof data.capabilities === 'string') {
        capabilitiesStr = JSON.stringify(data.capabilities.split(',').map(s => s.trim()));
      } else if (Array.isArray(data.capabilities)) {
        capabilitiesStr = JSON.stringify(data.capabilities);
      }
    }

    await this.db.execute(
      `INSERT INTO agent_registration (id, name, type, role, capabilities, status, last_seen_at, created_at, owner_id, secret_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, type, role, capabilitiesStr, status, last_seen_at, created_at, owner_id, secret_token]
    );

    const agent: Agent = {
      id,
      name,
      type,
      role,
      capabilities: capabilitiesStr ? JSON.parse(capabilitiesStr) : [],
      status,
      last_seen_at,
      created_at,
      owner_id,
      secret_token,
    };

    return agent;
  }

  async unregister(id: string, actorId?: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Agent with ID ${id} not found`);
    await this.db.execute('DELETE FROM agent_registration WHERE id = ?', [id]);
  }

  async update(id: string, data: { name?: string; role?: 'owner' | 'contributor' | 'observer'; capabilities?: string | string[]; status?: 'active' | 'idle' | 'offline'; owner_id?: string | null }): Promise<Agent> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Agent with ID ${id} not found`);

    const name = data.name !== undefined ? data.name : existing.name;
    const role = data.role !== undefined ? data.role : existing.role;
    const status = data.status !== undefined ? data.status : existing.status;
    const owner_id = data.owner_id !== undefined ? data.owner_id : existing.owner_id;

    let capabilitiesStr: string | null = existing.capabilities ? JSON.stringify(existing.capabilities) : null;
    if (data.capabilities !== undefined) {
      if (typeof data.capabilities === 'string') {
        capabilitiesStr = JSON.stringify(data.capabilities.split(',').map(s => s.trim()).filter(Boolean));
      } else if (Array.isArray(data.capabilities)) {
        capabilitiesStr = JSON.stringify(data.capabilities);
      }
    }

    await this.db.execute(
      `UPDATE agent_registration
       SET name = ?, role = ?, capabilities = ?, status = ?, owner_id = ?
       WHERE id = ?`,
      [name, role, capabilitiesStr, status, owner_id, id]
    );

    return (await this.getById(id))!;
  }


  async getById(id: string): Promise<Agent | null> {
    const rows = await this.db.query<any>('SELECT * FROM agent_registration WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return null;

    return {
      ...row,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
    };
  }

  async list(): Promise<Agent[]> {
    const rows = await this.db.query<any>('SELECT * FROM agent_registration ORDER BY created_at ASC');
    const agents = rows.map(row => ({
      ...row,
      capabilities: row.capabilities ? JSON.parse(row.capabilities) : [],
    }));

    // Auto-seed a default human operator if no human agent exists yet
    const hasHuman = agents.some(a => a.type === 'human');
    if (!hasHuman) {
      const defaultHuman = await this.register({
        name: 'Human Operator',
        type: 'human',
        role: 'owner',
        capabilities: ['owner', 'architecture', 'review']
      });
      agents.unshift(defaultHuman);
    }

    return agents;
  }


  async heartbeat(id: string): Promise<Agent> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Agent with ID ${id} not found`);

    const last_seen_at = new Date().toISOString();
    const status = 'active';

    await this.db.execute(
      'UPDATE agent_registration SET last_seen_at = ?, status = ? WHERE id = ?',
      [last_seen_at, status, id]
    );

    return { ...existing, last_seen_at, status };
  }

  async updateStatus(id?: string, status?: UpdateAgentStatus['status']): Promise<void> {
    if (id && status) {
      const last_seen_at = new Date().toISOString();
      await this.db.execute('UPDATE agent_registration SET status = ?, last_seen_at = ? WHERE id = ?', [status, last_seen_at, id]);
      return;
    }

    // Passive update: set agents to 'idle' if >5m, 'offline' if >15m
    const now = new Date().getTime();
    const agents = await this.db.query<any>('SELECT id, status, last_seen_at FROM agent_registration');

    for (const agent of agents) {
      const lastSeen = new Date(agent.last_seen_at).getTime();
      const diffMinutes = (now - lastSeen) / (1000 * 60);

      let newStatus = agent.status;
      if (diffMinutes > 15 && agent.status !== 'offline') {
        newStatus = 'offline';
      } else if (diffMinutes > 5 && agent.status === 'active') {
        newStatus = 'idle';
      }

      if (newStatus !== agent.status) {
        await this.db.execute('UPDATE agent_registration SET status = ? WHERE id = ?', [newStatus, agent.id]);
      }
    }
  }
}
