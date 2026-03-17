import OpenAI from 'openai';
import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Send a chat completion request to OpenAI.
 * Returns the assistant's reply text.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  model = config.chatModel
): Promise<string> {
  logger.debug(`Chat completion with ${messages.length} messages, model: ${model}`);

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  logger.debug(`Chat completion received (${content.length} chars)`);
  return content;
}

/**
 * Transcribe an audio file to text using OpenAI.
 * Accepts OGG/Opus (Telegram voice notes) natively — no ffmpeg needed.
 *
 * Falls back to whisper-1 if the primary transcription model fails.
 */
export async function transcribeAudio(filePath: string): Promise<string> {
  logger.debug(`Transcribing audio: ${filePath}, model: ${config.transcriptionModel}`);

  async function tryTranscribe(model: string): Promise<string> {
    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model,
      response_format: 'text',
    });
    // When response_format is 'text', the SDK returns a plain string
    // but TypeScript types it as Transcription. Cast is safe here.
    return response as unknown as string;
  }

  try {
    return await tryTranscribe(config.transcriptionModel);
  } catch (err) {
    // Fallback: if primary model fails (quota, availability), try whisper-1
    if (config.transcriptionModel !== 'whisper-1') {
      logger.warn(
        `Transcription model "${config.transcriptionModel}" failed, falling back to whisper-1`,
        err
      );
      return tryTranscribe('whisper-1');
    }
    throw err;
  }
}
