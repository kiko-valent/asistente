import {
  countUnsummarized,
  getOldestUnsummarized,
  markMessagesAsSummarized,
} from '../db/queries/messages.js';
import { insertSummary } from '../db/queries/summaries.js';
import { createChatCompletion } from './openai.js';
import { logger } from '../utils/logger.js';

// Trigger summarization when unsummarized messages exceed this threshold
const SUMMARIZE_THRESHOLD = 30;

// How many messages to summarize per batch
const SUMMARIZE_BATCH_SIZE = 20;

// Always use gpt-4o-mini for summaries to keep cost predictable
const SUMMARY_MODEL = 'gpt-4o-mini';

/**
 * Check if the conversation needs summarization and run it if so.
 * This is called after every message save but runs asynchronously.
 */
export async function maybeAutoSummarize(conversationId: number): Promise<void> {
  const unsummarizedCount = countUnsummarized(conversationId);

  if (unsummarizedCount < SUMMARIZE_THRESHOLD) {
    return;
  }

  logger.info(
    `Conversation ${conversationId} has ${unsummarizedCount} unsummarized messages — summarizing oldest ${SUMMARIZE_BATCH_SIZE}`
  );

  const toSummarize = getOldestUnsummarized(conversationId, SUMMARIZE_BATCH_SIZE);
  if (toSummarize.length === 0) return;

  // Build a transcript for the AI
  const transcript = toSummarize
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  try {
    const summaryText = await createChatCompletion(
      [
        {
          role: 'system',
          content:
            'Resume el siguiente segmento de conversación en 3-5 frases concisas. ' +
            'Conserva los hechos clave, decisiones tomadas, temas importantes y contexto relevante. ' +
            'Escribe el resumen en español, en tercera persona si es necesario.',
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
      SUMMARY_MODEL
    );

    insertSummary(conversationId, summaryText, toSummarize.length);
    markMessagesAsSummarized(toSummarize.map((m) => m.id));

    logger.info(
      `Summarized ${toSummarize.length} messages for conversation ${conversationId}`
    );
  } catch (err) {
    // Summarization failing should not block the user
    logger.error(`Failed to summarize conversation ${conversationId}`, err);
  }
}
