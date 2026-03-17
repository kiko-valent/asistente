import { db } from '../database.js';

export interface Summary {
  id: number;
  conversation_id: number;
  content: string;
  messages_covered: number;
  created_at: string;
}

export function insertSummary(
  conversationId: number,
  content: string,
  messagesCovered: number
): void {
  db.prepare(
    'INSERT INTO summaries (conversation_id, content, messages_covered) VALUES (?, ?, ?)'
  ).run(conversationId, content, messagesCovered);
}

export function getSummariesForConversation(
  conversationId: number,
  limit: number
): Summary[] {
  const rows = db
    .prepare(
      'SELECT * FROM summaries WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
    )
    .all(conversationId, limit) as unknown as Summary[];
  return rows.reverse(); // oldest first for context assembly
}
