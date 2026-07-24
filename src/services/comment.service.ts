// File: src/services/comment.service.ts
import { ulid } from 'ulid';
import { DatabaseAdapter } from '../db/adapter.js';
import { Comment, CreateComment } from '../shared/types.js';
import { EventService } from './event.service.js';

export class CommentService {
  constructor(
    private db: DatabaseAdapter,
    private eventService?: EventService
  ) {}

  async create(data: CreateComment): Promise<Comment> {
    const id = ulid();
    const created_at = new Date().toISOString();

    await this.db.execute(
      `INSERT INTO comment (id, card_id, author_id, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.card_id, data.author_id, data.content, created_at]
    );

    const comment: Comment = {
      id,
      card_id: data.card_id,
      author_id: data.author_id,
      content: data.content,
      created_at,
    };

    if (this.eventService) {
      const cardRows = await this.db.query<{ column_id: string }>('SELECT column_id FROM card WHERE id = ?', [data.card_id]);
      if (cardRows[0]) {
        const projRows = await this.db.query<{ project_id: string }>(
          'SELECT b.project_id FROM "column" col JOIN board b ON col.board_id = b.id WHERE col.id = ?',
          [cardRows[0].column_id]
        );
        if (projRows[0]) {
          await this.eventService.create({
            project_id: projRows[0].project_id,
            entity_type: 'card',
            entity_id: data.card_id,
            action: 'commented',
            actor_id: data.author_id,
            payload: { comment_id: id, content: data.content },
          });
        }
      }
    }

    return comment;
  }

  async listByCard(cardId: string): Promise<Comment[]> {
    return this.db.query<Comment>('SELECT * FROM comment WHERE card_id = ? ORDER BY created_at ASC', [cardId]);
  }
}
