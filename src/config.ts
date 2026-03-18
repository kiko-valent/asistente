import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[config] Missing required environment variable: ${key}`);
  return val;
}

function parseAllowedUserIds(raw: string): number[] {
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10));

  if (ids.some(isNaN)) {
    throw new Error('[config] TELEGRAM_ALLOWED_USER_IDS must be comma-separated integers');
  }
  return ids;
}

export const config = {
  // Telegram
  telegramToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  allowedUserIds: parseAllowedUserIds(requireEnv('TELEGRAM_ALLOWED_USER_IDS')),

  // OpenAI
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-transcribe',

  // Database
  databaseUrl: process.env.DATABASE_URL ?? './data/assistant.db',

  // Google Workspace (gog CLI)
  gogAccount: process.env.GOG_ACCOUNT ?? '',
  gogPath: process.env.GOG_PATH ?? '',

  // App
  logLevel: (process.env.LOG_LEVEL ?? 'info') as LogLevel,
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

export type Config = typeof config;
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
