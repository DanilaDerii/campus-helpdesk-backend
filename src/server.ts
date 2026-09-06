import "dotenv/config";
import {
  readRuntimeConfiguration,
  RuntimeConfigurationError,
} from "./config/runtime-config.js";
import { logEvent, safeErrorDetails } from "./logging/logger.js";

let configuration;

try {
  configuration = readRuntimeConfiguration();
} catch (error: unknown) {
  logEvent("error", "startup_configuration_invalid", {
    operation: "startup",
    configuration: error instanceof RuntimeConfigurationError
      ? error.code : "UNKNOWN_CONFIGURATION_ERROR",
  });
  process.exit(1);
}

process.env.NODE_ENV = configuration.environment;
process.env.PUBLIC_BASE_PATH = configuration.publicBasePath;

const [
  { createApp },
  { disconnectDatabase },
  { startNotificationRetryWorker },
] = await Promise.all([
  import("./app.js"),
  import("./database/prisma.js"),
  import("./services/notification.service.js"),
]);

const app = createApp();
const server = app.listen(configuration.port, configuration.host);
let stopNotificationRetryWorker = async () => {};

server.on("listening", () => {
  logEvent("info", "server_listening", {
    operation: "startup",
    host: configuration.host,
    port: configuration.port,
  });
  stopNotificationRetryWorker = startNotificationRetryWorker();
});

server.once("error", (error: NodeJS.ErrnoException) => {
  logEvent("error", "server_start_failed", {
    operation: "startup", ...safeErrorDetails(error),
  });
  void stopNotificationRetryWorker()
    .then(() => disconnectDatabase())
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

  logEvent("info", "server_stopping", { operation: "shutdown", signal });

  const forcedExit = setTimeout(() => {
    logEvent("error", "server_shutdown_timed_out", {
      operation: "shutdown", signal,
    });
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  void Promise.all([
    closeServer(),
    stopNotificationRetryWorker(),
  ])
    .then(() => disconnectDatabase())
    .then(() => {
      clearTimeout(forcedExit);
      process.exit(0);
    })
    .catch((error: unknown) => {
      clearTimeout(forcedExit);
      logEvent("error", "server_shutdown_failed", {
        operation: "shutdown", ...safeErrorDetails(error),
      });
      process.exit(1);
    });
}

process.once("SIGINT", () => shutDown("SIGINT"));
process.once("SIGTERM", () => shutDown("SIGTERM"));
