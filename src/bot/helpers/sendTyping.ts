import type { Context } from 'grammy';

/**
 * Sends a "typing..." indicator while an async operation runs.
 * Refreshes every 4 seconds (Telegram expires it at 5s).
 */
export async function withTyping<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
  await ctx.replyWithChatAction('typing');

  const interval = setInterval(() => {
    ctx.replyWithChatAction('typing').catch(() => undefined);
  }, 4000);

  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}
