import 'dotenv/config';
import { runMigrations } from './db/schema.js';
import { buildBot } from './bot/bot.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting Asistente 24h...');

  // Initialize database schema
  runMigrations();

  // Build and start the bot
  const bot = buildBot();

  // Graceful shutdown
  process.once('SIGINT', () => {
    logger.info('SIGINT received, stopping bot...');
    bot.stop();
  });
  process.once('SIGTERM', () => {
    logger.info('SIGTERM received, stopping bot...');
    bot.stop();
  });

  await bot.start({
    onStart: (info) => {
      logger.info(`Bot @${info.username} is running`);
    },
  });
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
