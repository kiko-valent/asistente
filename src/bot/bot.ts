import { Bot } from 'grammy';
import { config } from '../config.js';
import { authGuard } from './middleware/authGuard.js';
import {
  handleStart,
  handleHelp,
  handleStatus,
  handleMemory,
  handleRemember,
  handleClear,
} from './handlers/commands.js';
import { handleTextMessage } from './handlers/textHandler.js';
import { handleVoice } from './handlers/voiceHandler.js';
import { logger } from '../utils/logger.js';

export function buildBot(): Bot {
  const bot = new Bot(config.telegramToken);

  // Auth guard: runs before every update
  bot.use(authGuard);

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('status', handleStatus);
  bot.command('memory', handleMemory);
  bot.command('remember', handleRemember);
  bot.command('clear', handleClear);

  // Text messages (exclude commands)
  bot.on('message:text', handleTextMessage);

  // Voice notes and audio files
  bot.on('message:voice', handleVoice);
  bot.on('message:audio', handleVoice);

  // Error handler
  bot.catch((err) => {
    logger.error('Unhandled bot error', {
      message: err.message,
      update: err.ctx?.update,
    });
  });

  return bot;
}
