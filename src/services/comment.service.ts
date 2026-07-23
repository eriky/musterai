// File: src/services/comment.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Comment, CreateComment, CAPEvent } from '../shared/types.js';

export class CommentService {
  constructor(
    private db: DatabaseAdapter,
    private onEvent?: (event: CAPEvent) => Promise<void>
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
      `INSERT INTO comments (id, card_id, author_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [comment.id, comment.card_id, comment.author_id, comment.content, comment.created_at, comment.updated_at]
    );

    return comment;
  }

  async listByCard(cardId: string): Promise<Comment[]> {
    return this.db.query<Comment>(`SELECT * FROM comments WHERE card_id = ? ORDER BY created_at ASC`, [cardId]);
  }
}
