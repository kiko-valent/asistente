import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// Resolve gog binary: use GOG_PATH env var, or search known locations
function resolveGogBinary(): string {
  if (config.gogPath) return config.gogPath;
  // Fallback for Windows when PATH hasn't been refreshed yet
  const windowsFallback = 'C:\\Users\\kiko\\bin\\gog.exe';
  if (process.platform === 'win32' && existsSync(windowsFallback)) return windowsFallback;
  return 'gog';
}

// ---------------------------------------------------------------------------
// Internal: run the gog CLI safely (no shell, so no injection risk)
// ---------------------------------------------------------------------------
function runGog(args: string[], input?: string): string {
  const env = { ...process.env };
  if (config.gogAccount) env['GOG_ACCOUNT'] = config.gogAccount;

  const binary = resolveGogBinary();
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    input,
    env,
    timeout: 30_000,
  });

  if (result.error) {
    throw new Error(`gog CLI not found or failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const errMsg = result.stderr?.trim() || `exit code ${result.status}`;
    throw new Error(`gog error: ${errMsg}`);
  }

  return result.stdout?.trim() ?? '';
}

// ---------------------------------------------------------------------------
// Tool executor: called by runAgentLoop when OpenAI picks a tool
// ---------------------------------------------------------------------------
export async function executeGogTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  logger.info(`Executing Google tool: ${name}`, args);

  try {
    switch (name) {
      case 'gmail_search': {
        const cliArgs = ['gmail', 'search', String(args['query']), '--json'];
        if (args['max']) cliArgs.push('--max', String(args['max']));
        return runGog(cliArgs);
      }

      case 'gmail_messages_search': {
        const cliArgs = ['gmail', 'messages', 'search', String(args['query']), '--json'];
        if (args['max']) cliArgs.push('--max', String(args['max']));
        return runGog(cliArgs);
      }

      case 'gmail_send': {
        const cliArgs = [
          'gmail', 'send',
          '--to', String(args['to']),
          '--subject', String(args['subject']),
          '--body-file', '-',
        ];
        return runGog(cliArgs, String(args['body']));
      }

      case 'calendar_list_events': {
        const calendarId = String(args['calendar_id'] ?? 'primary');
        const cliArgs = [
          'calendar', 'events', calendarId,
          '--from', String(args['from']),
          '--to', String(args['to']),
          '--json',
        ];
        return runGog(cliArgs);
      }

      case 'calendar_create_event': {
        const calendarId = String(args['calendar_id'] ?? 'primary');
        const cliArgs = [
          'calendar', 'create', calendarId,
          '--summary', String(args['summary']),
          '--from', String(args['from']),
          '--to', String(args['to']),
        ];
        if (args['event_color']) cliArgs.push('--event-color', String(args['event_color']));
        return runGog(cliArgs);
      }

      case 'drive_search': {
        const cliArgs = ['drive', 'search', String(args['query']), '--json'];
        if (args['max']) cliArgs.push('--max', String(args['max']));
        return runGog(cliArgs);
      }

      case 'contacts_list': {
        const cliArgs = ['contacts', 'list', '--json'];
        if (args['max']) cliArgs.push('--max', String(args['max']));
        return runGog(cliArgs);
      }

      case 'sheets_get': {
        const cliArgs = [
          'sheets', 'get',
          String(args['sheet_id']),
          String(args['range']),
          '--json',
        ];
        return runGog(cliArgs);
      }

      case 'sheets_update': {
        const cliArgs = [
          'sheets', 'update',
          String(args['sheet_id']),
          String(args['range']),
          '--values-json', String(args['values_json']),
          '--input', 'USER_ENTERED',
        ];
        return runGog(cliArgs);
      }

      case 'docs_cat': {
        return runGog(['docs', 'cat', String(args['doc_id'])]);
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Google tool "${name}" failed: ${message}`);
    // Return error as string so the AI can explain it to the user naturally
    return `Error ejecutando ${name}: ${message}`;
  }
}

// ---------------------------------------------------------------------------
// Tool schemas for OpenAI function calling
// ---------------------------------------------------------------------------
export const GOOGLE_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'gmail_search',
      description:
        'Busca hilos de email en Gmail. Devuelve un resultado por hilo (thread). Usa para búsquedas generales de correo.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Query de búsqueda de Gmail. Soporta operadores como: newer_than:7d, from:ejemplo.com, subject:factura, in:inbox, is:unread, etc.',
          },
          max: {
            type: 'integer',
            description: 'Número máximo de resultados (default 10, max recomendado 20).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_messages_search',
      description:
        'Busca emails individuales en Gmail (no agrupados por hilo). Usar cuando se necesita ver cada mensaje por separado.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Query de búsqueda de Gmail con operadores estándar.',
          },
          max: {
            type: 'integer',
            description: 'Número máximo de mensajes (default 10).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_send',
      description:
        'Envía un email. IMPORTANTE: Solo llamar tras confirmación explícita del usuario.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Dirección de email del destinatario.' },
          subject: { type: 'string', description: 'Asunto del email.' },
          body: {
            type: 'string',
            description: 'Cuerpo del email en texto plano. Usa \\n para saltos de línea.',
          },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calendar_list_events',
      description: 'Lista eventos de Google Calendar en un rango de fechas.',
      parameters: {
        type: 'object',
        properties: {
          calendar_id: {
            type: 'string',
            description: 'ID del calendario. Usa "primary" para el calendario principal.',
          },
          from: {
            type: 'string',
            description: 'Fecha/hora de inicio en formato ISO 8601 (ej: 2024-01-15T00:00:00Z).',
          },
          to: {
            type: 'string',
            description: 'Fecha/hora de fin en formato ISO 8601.',
          },
        },
        required: ['calendar_id', 'from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calendar_create_event',
      description:
        'Crea un evento en Google Calendar. IMPORTANTE: Solo llamar tras confirmación explícita del usuario.',
      parameters: {
        type: 'object',
        properties: {
          calendar_id: {
            type: 'string',
            description: 'ID del calendario. Usa "primary" para el principal.',
          },
          summary: { type: 'string', description: 'Título del evento.' },
          from: {
            type: 'string',
            description: 'Inicio del evento en ISO 8601 (ej: 2024-01-15T10:00:00Z).',
          },
          to: {
            type: 'string',
            description: 'Fin del evento en ISO 8601.',
          },
          event_color: {
            type: 'integer',
            description: 'Color del evento (1-11). Opcional.',
          },
        },
        required: ['calendar_id', 'summary', 'from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'drive_search',
      description: 'Busca archivos en Google Drive.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Término de búsqueda (nombre de archivo, tipo, etc.).',
          },
          max: {
            type: 'integer',
            description: 'Número máximo de resultados (default 10).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'contacts_list',
      description: 'Lista los contactos de Google Contacts.',
      parameters: {
        type: 'object',
        properties: {
          max: {
            type: 'integer',
            description: 'Número máximo de contactos a devolver (default 20).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sheets_get',
      description: 'Lee datos de un Google Sheet.',
      parameters: {
        type: 'object',
        properties: {
          sheet_id: { type: 'string', description: 'ID del spreadsheet.' },
          range: {
            type: 'string',
            description: 'Rango en notación A1 (ej: "Hoja1!A1:D10" o "A1:D10").',
          },
        },
        required: ['sheet_id', 'range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sheets_update',
      description:
        'Actualiza celdas en un Google Sheet. IMPORTANTE: Solo llamar tras confirmación explícita del usuario.',
      parameters: {
        type: 'object',
        properties: {
          sheet_id: { type: 'string', description: 'ID del spreadsheet.' },
          range: { type: 'string', description: 'Rango en notación A1.' },
          values_json: {
            type: 'string',
            description:
              'Valores como JSON array de arrays (ej: \'[["A","B"],["1","2"]]\').',
          },
        },
        required: ['sheet_id', 'range', 'values_json'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docs_cat',
      description: 'Lee el contenido de un Google Doc como texto plano.',
      parameters: {
        type: 'object',
        properties: {
          doc_id: { type: 'string', description: 'ID del documento de Google Docs.' },
        },
        required: ['doc_id'],
      },
    },
  },
];
