import type { Context, NextFunction } from 'grammy';
import { config } from '../../config.js';
import { logger } from '../../utils/logger.js';

export async function authGuard(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId) {
    logger.warn('Message received with no user ID, ignoring');
    return;
  }

  if (!config.allowedUserIds.includes(userId)) {
    logger.warn(`Unauthorized access attempt from user ${userId}`);
    await ctx.reply('No tienes permiso para usar este bot.');
    return;
  }

  await next();
}
