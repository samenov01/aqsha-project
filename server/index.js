const fs = require("fs");
const { PORT, DATA_DIR, UPLOAD_DIR } = require("./config");
const { createApp } = require("./app");
const { initDb } = require("./db/init");
const { close } = require("./db/client");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function bootstrap() {
  await initDb();

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`aqsha server running at http://localhost:${PORT}`);
  });

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
