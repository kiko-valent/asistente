# Asistente Personal IA

Tu asistente personal de inteligencia artificial, accesible desde Telegram.

Recibe tus mensajes de texto y notas de voz, los entiende, recuerda el contexto de conversaciones anteriores y responde usando la API de OpenAI.

---

## Qué hace

- Responde mensajes de texto en Telegram
- Acepta notas de voz y audios, los transcribe y responde
- Recuerda conversaciones pasadas (base de datos local)
- Gestiona el contexto de forma eficiente (no envía todo el historial a OpenAI, solo lo relevante)
- Aprende tus preferencias si usas el comando `/remember`

---

## Instalación en local

### Requisitos previos

- [Node.js 20+](https://nodejs.org)
- Una cuenta de [Telegram](https://telegram.org)
- Una cuenta de [OpenAI](https://platform.openai.com)

### 1. Obtener el token del bot de Telegram

1. Abre Telegram y busca **@BotFather**
2. Escribe `/newbot` y sigue las instrucciones
3. Al final te dará un token, algo como `123456789:ABCdef...`

### 2. Obtener tu ID de usuario de Telegram

1. Busca **@userinfobot** en Telegram
2. Escribe `/start` y te dirá tu ID numérico (ej: `123456789`)

### 3. Configurar las variables de entorno

Copia el archivo de ejemplo y rellena tus datos:

```bash
cp .env.example .env
```

Abre el archivo `.env` con cualquier editor de texto y rellena:

```
TELEGRAM_BOT_TOKEN=el_token_que_te_dio_botfather
TELEGRAM_ALLOWED_USER_IDS=tu_id_de_telegram
OPENAI_API_KEY=sk-...tu_api_key_de_openai
```

El resto de variables ya tienen valores por defecto y no necesitas cambiarlos para empezar.

### 4. Instalar dependencias y arrancar

```bash
npm install
npm run dev
```

Si todo está bien, verás algo como:

```
[INFO] Database opened at ./data/assistant.db
[INFO] Database schema ready
[INFO] Bot @NombreDeTuBot is running
```

Ahora ve a Telegram y escribe `/start` a tu bot.

---

## Comandos disponibles

| Comando | Qué hace |
|---------|----------|
| `/start` | Saludo inicial |
| `/help` | Ver todos los comandos |
| `/status` | Ver cuántas conversaciones y mensajes tienes |
| `/memory` | Ver tus recuerdos guardados |
| `/remember <hecho>` | Guardar algo importante para que el asistente lo recuerde siempre |
| `/clear` | Empezar conversación nueva (los recuerdos se mantienen) |

**Ejemplos de uso de `/remember`:**
- `/remember Prefiero respuestas cortas y directas`
- `/remember Trabajo en marketing digital`
- `/remember Mi nombre es Carlos`

---

## Cómo funciona la memoria

El asistente no envía todo el historial de conversación a OpenAI (eso sería caro). En cambio:

1. **Mensajes recientes**: los últimos 20 mensajes se incluyen siempre
2. **Resúmenes**: cuando la conversación crece, los mensajes antiguos se resumen automáticamente
3. **Recuerdos**: los datos que guardas con `/remember` siempre están disponibles
4. **Control de costes**: nunca se envían más de ~3000 tokens de contexto

---

## Despliegue con Docker (uso local)

Si prefieres usar Docker en lugar de instalar Node.js:

```bash
# Copiar y configurar .env
cp .env.example .env
# (editar .env con tus tokens)

# Construir y arrancar
docker compose up -d

# Ver logs
docker compose logs -f

# Parar
docker compose down
```

---

## Despliegue en un VPS con Dokploy

> Esta sección es para cuando quieras tener el bot funcionando las 24h en un servidor.

### Prerequisitos
- Un VPS con Docker instalado (cualquier proveedor: Hetzner, DigitalOcean, etc.)
- [Dokploy](https://dokploy.com) instalado en el VPS
- El proyecto subido a GitHub

### Pasos

1. **Subir el proyecto a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU_USUARIO/asistente-24h.git
   git push -u origin main
   ```

2. **En Dokploy**, crear una nueva aplicación:
   - Tipo: Docker Compose
   - Repositorio: tu repo de GitHub
   - Branch: `main`

3. **Configurar las variables de entorno** en Dokploy (mismas que tu `.env`)

4. **Configurar el volumen persistente** — ESTO ES IMPORTANTE:

   En la sección "Volumes" de Dokploy:
   - Host path: `/opt/asistente-data`
   - Container path: `/app/data`

   **¿Por qué es importante?**
   El archivo `assistant.db` contiene toda la memoria del bot (conversaciones, recuerdos, etc.). Si no configuras el volumen, cada vez que hagas un redeploy o el servidor se reinicie, el bot perderá toda su memoria.

   Con el volumen configurado, el archivo está guardado en el servidor (`/opt/asistente-data`) y el bot siempre lo encuentra aunque el contenedor se reinicie.

5. **Hacer deploy** desde Dokploy

### Backup de la base de datos

Para hacer una copia de seguridad de la memoria del bot, simplemente copia el archivo:

```bash
# En el VPS
cp /opt/asistente-data/assistant.db /opt/asistente-data/assistant.db.backup
```

---

## Estructura del proyecto

```
Asistente_24h/
├── src/
│   ├── index.ts          # Punto de entrada
│   ├── config.ts         # Variables de entorno
│   ├── bot/              # Handlers de Telegram
│   ├── services/         # Lógica de IA y memoria
│   ├── db/               # Base de datos SQLite
│   └── utils/            # Utilidades
├── data/                 # Base de datos (gitignored, persistente)
├── workflows/            # Documentación del sistema
├── .env.example          # Template de configuración
├── Dockerfile
└── docker-compose.yml
```

---

## Modelos usados

| Función | Modelo |
|---------|--------|
| Chat principal | `gpt-4o-mini` (configurable) |
| Transcripción de voz | `gpt-4o-transcribe` (con fallback a `whisper-1`) |
| Resúmenes de contexto | `gpt-4o-mini` (fijo, para controlar coste) |
