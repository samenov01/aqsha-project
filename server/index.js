const fs = require("fs");
const { PORT, DATA_DIR, UPLOAD_DIR } = require("./config");
const { createApp } = require("./app");
const { initDb } = require("./db/init");
const { close, all } = require("./db/client");
const { startTelegramBot } = require("./telegram-bot");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function bootstrap() {
  await initDb();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`JumysAI server running at http://localhost:${PORT}`);
  });

  // Start Telegram bot (only if TELEGRAM_BOT_TOKEN is set)
  startTelegramBot();

  const shutdown = async () => {
    server.close(async () => {
      await close();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

// trigger restart
