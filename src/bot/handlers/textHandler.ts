import type { Context } from 'grammy';
import { withTyping } from '../helpers/sendTyping.js';
import { ensureActiveConversation, assembleContext } from '../../services/memory.js';
import { createChatCompletion } from '../../services/openai.js';
import { insertMessage } from '../../db/queries/messages.js';
import { maybeAutoSummarize } from '../../services/summarizer.js';
import { logger } from '../../utils/logger.js';

export async function handleText(ctx: Context, userText: string): Promise<void> {
  const userId = ctx.from!.id;
  logger.info(`Text from user ${userId}: ${userText.substring(0, 80)}`);

  const conversation = ensureActiveConversation(userId);

  // Save the user message
  insertMessage(conversation.id, 'user', userText);

  // Build context and call AI
  const messages = assembleContext(userId, conversation.id);

  const reply = await withTyping(ctx, () => createChatCompletion(messages));

  // Save assistant response
  insertMessage(conversation.id, 'assistant', reply);

  // Trigger summarization check (async, non-blocking for user experience)
  maybeAutoSummarize(conversation.id).catch((err) =>
    logger.error('Summarization error', err)
  );

  await ctx.reply(reply);
}

export async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;
  await handleText(ctx, text);
}
