// File: src/services/comment.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Comment, CreateComment, CAPEvent } from '../shared/types.js';

import { EventService } from './event.service.js';

export class CommentService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateComment): Promise<Comment> {
    const now = new Date().toISOString();
    const comment: Comment = {
      id: ulid(),
      card_id: data.card_id,
      author_id: data.author_id,
      content: data.content,
      created_at: now,
      updated_at: now
    };

    await this.db.execute(
      `INSERT INTO comments (id, card_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [comment.id, comment.card_id, comment.author_id, comment.content, comment.created_at]
    );

    const rows = await this.db.query<{project_id: string}>(
      `SELECT b.project_id FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE c.id = ?`,
      [comment.card_id]
    );
    if (rows.length > 0) {
      await this.eventService?.emit(rows[0].project_id, 'comment', comment.id, 'created', comment.author_id, { content: comment.content, card_id: comment.card_id });
    }

    return comment;
  }

  async listByCard(cardId: string): Promise<Comment[]> {
    return this.db.query<Comment>(`SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC`, [cardId]);
  }
}
