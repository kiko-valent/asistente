# Workflow: Asistente Personal IA — Telegram Bot

## Objetivo
Asistente personal inteligente accesible por Telegram. Responde mensajes de texto y notas de voz. Recuerda conversaciones pasadas y preferencias del usuario.

## Inputs requeridos
| Variable | Dónde se configura |
|----------|-------------------|
| TELEGRAM_BOT_TOKEN | .env |
| TELEGRAM_ALLOWED_USER_IDS | .env |
| OPENAI_API_KEY | .env |

## Pipeline de ejecución

### Mensaje de texto
1. Usuario envía texto → `bot.on('message:text')`
2. `authGuard` verifica que el userId está permitido
3. `ensureActiveConversation(userId)` — obtiene o crea conversación activa
4. `insertMessage(convId, 'user', text)` — guarda el mensaje
5. `assembleContext(userId, convId)` — construye contexto con presupuesto de tokens
6. `createChatCompletion(context)` — llama a OpenAI (con indicador de typing)
7. `insertMessage(convId, 'assistant', reply)` — guarda la respuesta
8. `maybeAutoSummarize(convId)` — comprueba si hay que resumir (async)
9. `ctx.reply(reply)` — responde al usuario

### Nota de voz / audio
1. Usuario envía voz → `bot.on('message:voice')` o `bot.on('message:audio')`
2. `authGuard` verifica userId
3. `ctx.getFile()` → construye URL de descarga de Telegram
4. Descarga el OGG a `.tmp/<fileId>.ogg`
5. `transcribeAudio(tmpPath)` → llama a OpenAI transcription API
6. Muestra transcripción al usuario (en cursiva)
7. Continúa como mensaje de texto con la transcripción
8. Limpia el archivo temporal en bloque `finally`

## Estrategia de memoria y contexto

### Presupuesto de tokens (3000 total)
- Layer 1: System prompt (~150 tokens, fijo)
- Layer 2: Recuerdos del usuario (max 300 tokens, top 10 por importancia)
- Layer 3: Resúmenes de conversaciones anteriores (max 500 tokens, últimos 3)
- Layer 4: Mensajes recientes (resto del presupuesto, hasta 20 mensajes)

### Auto-resumen
- Trigger: cuando hay ≥ 30 mensajes sin resumir en la conversación activa
- Acción: resumir los 20 más antiguos con `gpt-4o-mini` → guardar en `summaries` → marcar como resumidos
- El resumen se ejecuta de forma asíncrona (no bloquea la respuesta al usuario)

### Recuerdos persistentes
- `/remember <hecho>` guarda directamente en la tabla `memories`
- No hay extracción automática (evita doblar el coste de API por mensaje)
- Los recuerdos se incluyen en cada contexto ordenados por importancia

## Base de datos (SQLite)

### Tablas
- `conversations` — sesiones de conversación por usuario
- `messages` — todos los mensajes intercambiados
- `summaries` — resúmenes comprimidos de mensajes antiguos
- `memories` — hechos persistentes del usuario

### Localización
- Local: `./data/assistant.db`
- Docker: `/app/data/assistant.db` (volumen montado desde `./data`)

## Comandos disponibles
| Comando | Acción |
|---------|--------|
| `/start` | Saludo inicial |
| `/help` | Lista de comandos |
| `/status` | Estadísticas (conversaciones, mensajes, recuerdos) |
| `/memory` | Ver recuerdos guardados |
| `/remember <hecho>` | Guardar recuerdo importante |
| `/clear` | Reiniciar conversación (recuerdos se mantienen) |

## Seguridad
- `TELEGRAM_ALLOWED_USER_IDS` restringe el acceso al bot
- Mensajes de usuarios no autorizados son rechazados silenciosamente (se loggea)
- El token de Telegram nunca sale de las variables de entorno

## Mantenimiento y problemas conocidos

### Rate limits de OpenAI
- Si se recibe un error 429, la SDK de OpenAI no reintenta automáticamente
- Considera envolver `createChatCompletion` en un retry con backoff si el uso es intensivo
- El modelo de resumen siempre usa `gpt-4o-mini` para controlar costes

### Transcripción de audio
- Telegram envía voz en formato OGG/Opus → OpenAI lo acepta nativamente
- Si `gpt-4o-transcribe` no está disponible, hay fallback a `whisper-1`
- Archivos temporales se guardan en `.tmp/` y se borran después de transcribir

### SQLite en producción
- WAL mode habilitado → lectura concurrente sin bloqueos
- El bot es single-process → no hay riesgo de corrupción por concurrencia
- Backups: copia periódica del archivo `data/assistant.db`

## Despliegue en VPS con Dokploy

### Prerequisitos
- VPS con Docker instalado
- Repositorio subido a GitHub
- Variables de entorno configuradas en Dokploy

### Pasos
1. Crear app en Dokploy apuntando al repo de GitHub
2. Configurar variables de entorno (mismas que `.env.example`)
3. Configurar volumen persistente: `./data` → `/app/data`
4. Hacer deploy

### Volumen persistente (MUY IMPORTANTE)
El archivo SQLite contiene toda la memoria del asistente. Sin volumen persistente, se borrará en cada redeploy.

En Dokploy, configurar el volumen en la sección "Volumes":
- Host path: `/opt/asistente-data` (o la ruta que prefieras en el VPS)
- Container path: `/app/data`
