import type { CommandContext, Context } from 'grammy';
import { getStats, deactivateAllConversations, createConversation } from '../../db/queries/conversations.js';
import { listMemories, insertMemory } from '../../db/queries/memories.js';
import { logger } from '../../utils/logger.js';

export async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const name = ctx.from?.first_name ?? 'amigo';
  await ctx.reply(
    `¡Hola, ${name}! Soy tu asistente personal IA. 🤖\n\n` +
    `Puedes hablarme normalmente o enviarme notas de voz.\n` +
    `Escribe /help para ver los comandos disponibles.`
  );
}

export async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
  await ctx.reply(
    `*Comandos disponibles:*\n\n` +
    `/start — Saludo inicial\n` +
    `/help — Mostrar esta ayuda\n` +
    `/status — Ver estadísticas del asistente\n` +
    `/memory — Ver tus recuerdos guardados\n` +
    `/remember <hecho> — Guardar un recuerdo importante\n` +
    `/clear — Empezar conversación nueva\n\n` +
    `También puedes enviarme:\n` +
    `• Mensajes de texto\n` +
    `• Notas de voz o audios`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from!.id;
  const stats = getStats(userId);
  await ctx.reply(
    `*Estado del asistente:*\n\n` +
    `💬 Conversaciones: ${stats.conversationCount}\n` +
    `📝 Mensajes totales: ${stats.messageCount}\n` +
    `🧠 Recuerdos guardados: ${stats.memoryCount}`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleMemory(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from!.id;
  const memories = listMemories(userId);

  if (memories.length === 0) {
    await ctx.reply(
      'No tienes recuerdos guardados.\n\nUsa /remember <hecho> para guardar algo importante.'
    );
    return;
  }

  const list = memories
    .map((m, i) => `${i + 1}. ${m.content}`)
    .join('\n');

  await ctx.reply(`*Tus recuerdos:*\n\n${list}`, { parse_mode: 'Markdown' });
}

export async function handleRemember(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from!.id;
  const text = ctx.match?.trim();

  if (!text) {
    await ctx.reply('Uso: /remember <hecho importante>\n\nEjemplo: /remember Prefiero respuestas cortas y directas');
    return;
  }

  insertMemory(userId, text, 7);
  logger.info(`Memory saved for user ${userId}: ${text.substring(0, 50)}`);
  await ctx.reply(`✅ Guardado: "${text}"`);
}

export async function handleClear(ctx: CommandContext<Context>): Promise<void> {
  const userId = ctx.from!.id;
  deactivateAllConversations(userId);
  createConversation(userId);
  logger.info(`Conversation cleared for user ${userId}`);
  await ctx.reply(
    '🔄 Conversación reiniciada.\n\nHe empezado una sesión nueva. Los recuerdos importantes se mantienen.'
  );
}
