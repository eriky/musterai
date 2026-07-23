// File: src/services/project.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Project, CreateProject, CAPEvent } from '../shared/types.js';
import { NotFoundError } from '../shared/errors.js';

export class ProjectService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
  ) {}

  async create(data: CreateProject): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: ulid(),
      name: data.name,
      description: data.description || null,
      created_at: now,
      updated_at: now
    };

    await this.db.execute(
      `INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [project.id, project.name, project.description, project.created_at, project.updated_at]
    );

    return project;
  }

  async list(): Promise<Project[]> {
    return this.db.query<Project>(`SELECT * FROM projects ORDER BY created_at DESC`);
  }

  async getById(id: string): Promise<Project> {
    const rows = await this.db.query<Project>(`SELECT * FROM projects WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Project with ID ${id} not found`);
    }
    return rows[0];
  }

  async update(id: string, data: Partial<CreateProject>): Promise<Project> {
    const project = await this.getById(id);
    const updatedName = data.name !== undefined ? data.name : project.name;
    const updatedDescription = data.description !== undefined ? data.description : project.description;
    const updatedAt = new Date().toISOString();

    await this.db.execute(
      `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
      [updatedName, updatedDescription, updatedAt, id]
    );

    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    const project = await this.getById(id);
    await this.db.execute(`DELETE FROM projects WHERE id = ?`, [id]);
  }

  async getSummary(id: string): Promise<any> {
    const project = await this.getById(id);
    
    const boards = await this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM boards WHERE project_id = ?`, [id]);
    const agents = await this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM agent_registrations WHERE project_id = ?`, [id]);
    const docs = await this.db.query<{ count: number }>(`SELECT COUNT(*) as count FROM documents WHERE project_id = ?`, [id]);
    
    const cards = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM cards c
       JOIN boards b ON c.board_id = b.id
       WHERE b.project_id = ?`, [id]
    );

    return {
      ...project,
      board_count: boards[0].count,
      agent_count: agents[0].count,
      document_count: docs[0].count,
      card_count: cards[0].count
    };
  }
}
