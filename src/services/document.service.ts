// File: src/services/document.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Document, CreateDocument, UpdateDocument, DocumentVersion, CAPEvent, DocumentStatus } from '../shared/types.js';
import { NotFoundError } from '../shared/errors.js';

import { EventService } from './event.service.js';

export class DocumentService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateDocument): Promise<Document> {
    const now = new Date().toISOString();
    const docId = ulid();

    const doc: Document = {
      id: docId,
      project_id: data.project_id,
      parent_id: data.parent_id || null,
      title: data.title,
      content: data.content,
      status: 'draft',
      author_id: data.author_id,
      version: 1,
      created_at: now,
      updated_at: now
    };

    await this.db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO documents (id, project_id, parent_id, title, content, status, author_id, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.project_id, doc.parent_id, doc.title, doc.content, doc.status, doc.author_id, doc.version, doc.created_at, doc.updated_at]
      );

      const verId = ulid();
      await tx.execute(
        `INSERT INTO document_versions (id, document_id, version, content, author_id, change_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [verId, doc.id, doc.version, doc.content, doc.author_id, 'Initial creation', now]
      );
    });

    await this.eventService?.emit(doc.project_id, 'document', doc.id, 'created', doc.author_id, { title: doc.title, version: doc.version });

    return doc;
  }

  async list(projectId: string, filters?: { status?: DocumentStatus; parentId?: string }): Promise<Document[]> {
    let sql = `SELECT * FROM documents WHERE project_id = ?`;
    const params: any[] = [projectId];

    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    if (filters?.parentId !== undefined) {
      if (filters.parentId === null) {
        sql += ` AND parent_id IS NULL`;
      } else {
        sql += ` AND parent_id = ?`;
        params.push(filters.parentId);
      }
    }

    sql += ` ORDER BY updated_at DESC`;

    return this.db.query<Document>(sql, params);
  }

  async getById(id: string, version?: number): Promise<Document> {
    const rows = await this.db.query<Document>(`SELECT * FROM documents WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new NotFoundError(`Document with ID ${id} not found`);
    }
    const doc = rows[0];

    if (version !== undefined) {
      const verRows = await this.db.query<DocumentVersion>(
        `SELECT * FROM document_versions WHERE document_id = ? AND version = ?`, [id, version]
      );
      if (verRows.length > 0) {
        doc.content = verRows[0].content;
        doc.version = verRows[0].version;
      } else {
        throw new NotFoundError(`Version ${version} of Document ${id} not found`);
      }
    }

    return doc;
  }

  async update(id: string, data: UpdateDocument): Promise<Document> {
    const doc = await this.getById(id);
    const now = new Date().toISOString();
    const newVersion = doc.version + 1;

    const updatedTitle = data.title !== undefined ? data.title : doc.title;
    const updatedContent = data.content !== undefined ? data.content : doc.content;
    const authorId = data.author_id || doc.author_id;

    await this.db.transaction(async (tx) => {
      await tx.execute(
        `UPDATE documents SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?`,
        [updatedTitle, updatedContent, newVersion, now, id]
      );

      const verId = ulid();
      await tx.execute(
        `INSERT INTO document_versions (id, document_id, version, content, author_id, change_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [verId, doc.id, newVersion, updatedContent, authorId, data.change_summary || null, now]
      );
    });

    await this.eventService?.emit(doc.project_id, 'document', doc.id, 'updated', authorId, { title: updatedTitle, version: newVersion, change_summary: data.change_summary });

    return this.getById(id);
  }

  async setStatus(id: string, status: DocumentStatus): Promise<Document> {
    const doc = await this.getById(id);
    const now = new Date().toISOString();
    await this.db.execute(`UPDATE documents SET status = ?, updated_at = ? WHERE id = ?`, [status, now, id]);
    await this.eventService?.emit(doc.project_id, 'document', id, 'status_changed', doc.author_id, { status });
    return this.getById(id);
  }

  async getHistory(id: string): Promise<DocumentVersion[]> {
    return this.db.query<DocumentVersion>(
      `SELECT * FROM document_versions WHERE document_id = ? ORDER BY version DESC`, [id]
    );
  }
}
