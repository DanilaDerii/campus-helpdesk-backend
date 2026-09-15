import "dotenv/config";
import {
  readRuntimeConfiguration,
  RuntimeConfigurationError,
} from "./config/runtime-config.js";

let configuration;

try {
  configuration = readRuntimeConfiguration();
} catch (error: unknown) {
  const code = error instanceof RuntimeConfigurationError
    ? error.code : "UNKNOWN_CONFIGURATION_ERROR";
  console.error(`Startup configuration invalid: ${code}`);
  process.exit(1);
}

process.env.NODE_ENV = configuration.environment;
process.env.PUBLIC_BASE_PATH = configuration.publicBasePath;

const [
  { createApp },
  { disconnectDatabase },
] = await Promise.all([
  import("./app.js"),
  import("./data_access/prisma.js"),
]);

const app = createApp();
const server = app.listen(configuration.port, configuration.host);

server.on("listening", () => {
  console.log(
    `Campus HelpDesk listening on ${configuration.host}:${configuration.port}`,
  );
});

server.once("error", (_error: NodeJS.ErrnoException) => {
  console.error("Campus HelpDesk failed to start");
  void disconnectDatabase()
    .finally(() => process.exit(1));
});

let isShuttingDown = false;

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function shutDown(signal: NodeJS.Signals): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Campus HelpDesk stopping: ${signal}`);

  const forcedExit = setTimeout(() => {
    console.error("Campus HelpDesk shutdown timed out");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  void closeServer()
    .then(() => disconnectDatabase())
    .then(() => {
      clearTimeout(forcedExit);
      process.exit(0);
    })
    .catch(() => {
      clearTimeout(forcedExit);
      console.error("Campus HelpDesk shutdown failed");
      process.exit(1);
    });
}

process.once("SIGINT", () => shutDown("SIGINT"));
process.once("SIGTERM", () => shutDown("SIGTERM"));
