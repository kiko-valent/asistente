import { db } from '../database.js';

export interface Conversation {
  id: number;
  user_id: number;
  created_at: string;
  title: string | null;
  is_active: number;
}

export interface ConversationStats {
  conversationCount: number;
  messageCount: number;
  memoryCount: number;
}

export function getActiveConversation(userId: number): Conversation | undefined {
  return db
    .prepare(
      'SELECT * FROM conversations WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    )
    .get(userId) as unknown as Conversation | undefined;
}

export function createConversation(userId: number): Conversation {
  const result = db
    .prepare('INSERT INTO conversations (user_id) VALUES (?)')
    .run(userId);
  const id = Number(result.lastInsertRowid);
  return db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as unknown as Conversation;
}

export function deactivateConversation(id: number): void {
  db.prepare('UPDATE conversations SET is_active = 0 WHERE id = ?').run(id);
}

export function deactivateAllConversations(userId: number): void {
  db.prepare('UPDATE conversations SET is_active = 0 WHERE user_id = ?').run(userId);
}

export function getStats(userId: number): ConversationStats {
  const convRow = db
    .prepare('SELECT COUNT(*) as count FROM conversations WHERE user_id = ?')
    .get(userId) as unknown as { count: number } | undefined;

  const msgRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ?`
    )
    .get(userId) as unknown as { count: number } | undefined;

  const memRow = db
    .prepare('SELECT COUNT(*) as count FROM memories WHERE user_id = ?')
    .get(userId) as unknown as { count: number } | undefined;

  return {
    conversationCount: convRow?.count ?? 0,
    messageCount: msgRow?.count ?? 0,
    memoryCount: memRow?.count ?? 0,
  };
}
