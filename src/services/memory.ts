import type { ChatMessage } from './openai.js';
import {
  getActiveConversation,
  createConversation,
  type Conversation,
} from '../db/queries/conversations.js';
import { getRecentMessages } from '../db/queries/messages.js';
import { getSummariesForConversation } from '../db/queries/summaries.js';
import { getTopMemories } from '../db/queries/memories.js';
import { countTokens } from '../utils/tokenCounter.js';
import { logger } from '../utils/logger.js';

// Maximum tokens to send as context to OpenAI
const TOKEN_BUDGET = 3000;

// Reserved token budgets for each context layer
const BUDGET_SYSTEM_PROMPT = 300; // increased to accommodate Google tools description
const BUDGET_MEMORIES = 300;
const BUDGET_SUMMARIES = 500;
// Remainder goes to recent messages

const SYSTEM_PROMPT = `Eres un asistente personal inteligente, útil y amable. Tienes acceso al historial de conversación del usuario y a recuerdos importantes sobre él.

Responde de forma natural, directa y concisa. Adapta tu tono y estilo a las preferencias del usuario. Si el usuario ha guardado recuerdos o preferencias, tenlos en cuenta siempre.

Tienes acceso a las herramientas de Google Workspace del usuario: Gmail, Calendar, Drive, Contactos, Sheets y Docs. Úsalas proactivamente cuando el usuario pregunte por sus correos, eventos, archivos o datos. Para acciones de escritura (enviar emails, crear o modificar eventos, actualizar hojas de cálculo), SIEMPRE pide confirmación explícita al usuario antes de ejecutar la acción.

Fecha actual: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;

/**
 * Get or create an active conversation for the user.
 */
export function ensureActiveConversation(userId: number): Conversation {
  const existing = getActiveConversation(userId);
  if (existing) return existing;

  logger.debug(`Creating new conversation for user ${userId}`);
  return createConversation(userId);
}

/**
 * Assemble the context to send to OpenAI for a given user and conversation.
 * Applies token budget constraints:
 *   1. System prompt (fixed)
 *   2. User memories (top 10, max BUDGET_MEMORIES tokens)
 *   3. Recent summaries (last 3, max BUDGET_SUMMARIES tokens)
 *   4. Recent messages (last 20, fills remaining budget)
 */
export function assembleContext(userId: number, conversationId: number): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let remainingBudget = TOKEN_BUDGET;

  // --- Layer 1: System prompt ---
  messages.push({ role: 'system', content: SYSTEM_PROMPT });
  remainingBudget -= Math.min(countTokens(SYSTEM_PROMPT), BUDGET_SYSTEM_PROMPT);

  // --- Layer 2: User memories ---
  const memories = getTopMemories(userId, 10);
  if (memories.length > 0) {
    const memoriesText =
      'Datos importantes sobre el usuario:\n' +
      memories.map((m) => `• ${m.content}`).join('\n');
    const memoryTokens = countTokens(memoriesText);

    if (memoryTokens <= BUDGET_MEMORIES && remainingBudget > BUDGET_MEMORIES) {
      messages.push({ role: 'system', content: memoriesText });
      remainingBudget -= memoryTokens;
      logger.debug(`Context: added ${memories.length} memories (${memoryTokens} tokens)`);
    }
  }

  // --- Layer 3: Conversation summaries ---
  const summaries = getSummariesForConversation(conversationId, 3);
  for (const summary of summaries) {
    // Keep some budget reserved for recent messages
    if (remainingBudget - BUDGET_SUMMARIES < 200) break;

    const summaryText = `[Resumen de conversación anterior]: ${summary.content}`;
    const summaryTokens = countTokens(summaryText);

    if (summaryTokens <= BUDGET_SUMMARIES) {
      messages.push({ role: 'system', content: summaryText });
      remainingBudget -= summaryTokens;
      logger.debug(`Context: added summary (${summaryTokens} tokens)`);
    }
  }

  // --- Layer 4: Recent messages ---
  const recentMessages = getRecentMessages(conversationId, 20, true);
  const fitted: ChatMessage[] = [];

  // Fit messages newest-first into remaining budget, then reverse for chronological order
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    const tokens = countTokens(msg.content);
    if (remainingBudget - tokens < 50) break; // keep ~50 tokens headroom
    fitted.unshift({ role: msg.role, content: msg.content });
    remainingBudget -= tokens;
  }

  messages.push(...fitted);

  logger.debug(
    `Context assembled: ${messages.length} messages, ~${TOKEN_BUDGET - remainingBudget} tokens used`
  );

  return messages;
}
