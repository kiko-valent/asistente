import type { Context } from 'grammy';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { config } from '../../config.js';
import { transcribeAudio } from '../../services/openai.js';
import { handleText } from './textHandler.js';
import { logger } from '../../utils/logger.js';

export async function handleVoice(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const fileId = ctx.message?.voice?.file_id ?? ctx.message?.audio?.file_id;

  if (!fileId) {
    await ctx.reply('No pude leer el audio. Intenta de nuevo.');
    return;
  }

  // Notify user we're processing
  await ctx.replyWithChatAction('typing');

  // Ensure temp directory exists
  const tmpDir = '.tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const tmpPath = path.join(tmpDir, `${fileId}.ogg`);

  try {
    // Download the file from Telegram
    const file = await ctx.getFile();
    if (!file.file_path) {
      throw new Error('Telegram returned no file_path');
    }

    const downloadUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
    logger.debug(`Downloading audio from Telegram for user ${userId}`);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Telegram download failed: ${response.status}`);
    }

    // Write to disk
    await pipeline(
      Readable.fromWeb(response.body as import('stream/web').ReadableStream),
      fs.createWriteStream(tmpPath)
    );

    logger.debug(`Audio saved to ${tmpPath}, transcribing...`);

    // Transcribe
    const transcript = await transcribeAudio(tmpPath);
    logger.info(`Transcription for user ${userId}: ${transcript.substring(0, 80)}`);

    if (!transcript.trim()) {
      await ctx.reply('No pude entender el audio. ¿Puedes repetirlo o escribirlo?');
      return;
    }

    // Let the user know what was transcribed
    await ctx.reply(`🎤 _${transcript}_`, { parse_mode: 'Markdown' });

    // Process as text
    await handleText(ctx, transcript);
  } catch (err) {
    logger.error('Voice handler error', err);
    await ctx.reply('Hubo un error al procesar el audio. Por favor, intenta de nuevo.');
  } finally {
    // Always clean up temp file
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
}
