import { db } from '../database.js';

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_summarized: number;
  created_at: string;
}

export function insertMessage(
  conversationId: number,
  role: 'user' | 'assistant' | 'system',
  content: string
): Message {
  const result = db
    .prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
    .run(conversationId, role, content);
  const id = Number(result.lastInsertRowid);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as unknown as Message;
}

export function getRecentMessages(
  conversationId: number,
  limit: number,
  onlyUnsummarized = false
): Message[] {
  const query = onlyUnsummarized
    ? `SELECT * FROM messages
       WHERE conversation_id = ? AND is_summarized = 0
       ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`;

  const rows = db.prepare(query).all(conversationId, limit) as unknown as Message[];
  // Return oldest first (DESC → reverse)
  return rows.reverse();
}

export function getOldestUnsummarized(conversationId: number, limit: number): Message[] {
  return db
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ? AND is_summarized = 0
       ORDER BY created_at ASC LIMIT ?`
    )
    .all(conversationId, limit) as unknown as Message[];
}

export function countUnsummarized(conversationId: number): number {
  const row = db
    .prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND is_summarized = 0'
    )
    .get(conversationId) as unknown as { count: number } | undefined;
  return row?.count ?? 0;
}

export function markMessagesAsSummarized(ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE messages SET is_summarized = 1 WHERE id IN (${placeholders})`).run(...ids);
}
