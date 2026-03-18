import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { GOOGLE_TOOLS, executeGogTool } from './googleTools.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

const MAX_AGENT_ITERATIONS = 10;

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Send a chat completion request to OpenAI.
 * Returns the assistant's reply text.
 * Used by the summarizer — no tools attached.
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
 * Agentic loop with Google Workspace tools.
 * Runs until OpenAI stops calling tools or MAX_AGENT_ITERATIONS is reached.
 * Used by textHandler for all user messages.
 */
export async function runAgentLoop(
  messages: ChatMessage[],
  model = config.chatModel
): Promise<string> {
  // Convert to OpenAI SDK types (compatible, just needs to be cast)
  const internalMessages: ChatCompletionMessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
    logger.debug(`Agent loop iteration ${iteration + 1}, messages: ${internalMessages.length}`);

    const response = await client.chat.completions.create({
      model,
      messages: internalMessages,
      tools: GOOGLE_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('OpenAI returned no choices');

    const { finish_reason, message } = choice;

    if (finish_reason === 'stop' || finish_reason === 'length') {
      return message.content ?? '';
    }

    if (finish_reason === 'tool_calls' && message.tool_calls?.length) {
      // Append the assistant message (with tool_calls) to history
      internalMessages.push(message);

      // Execute each tool call and append results
      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const result = await executeGogTool(toolCall.function.name, args);

        internalMessages.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
        });
      }

      // Continue loop to let the model respond with results
      continue;
    }

    // Unexpected finish reason — return whatever content we have
    return message.content ?? '';
  }

  throw new Error('Agent loop exceeded maximum iterations without a final response');
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
