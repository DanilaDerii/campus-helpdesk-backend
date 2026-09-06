import { createApp } from "./app.js";
import { disconnectDatabase } from "./database/prisma.js";
import { logEvent, safeErrorDetails } from "./logging/logger.js";
import { startNotificationRetryWorker } from "./services/notification.service.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port);
let stopNotificationRetryWorker = () => {};

server.on("listening", () => {
  logEvent("info", "server_listening", { operation: "startup", port });
  stopNotificationRetryWorker = startNotificationRetryWorker();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  logEvent("error", "server_start_failed", {
    operation: "startup", ...safeErrorDetails(error),
  });
  process.exitCode = 1;
});

let isShuttingDown = false;

function shutDown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  stopNotificationRetryWorker();
  logEvent("info", "server_stopping", { operation: "shutdown", signal });

  server.close(() => {
    void disconnectDatabase()
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        logEvent("error", "database_close_failed", {
          operation: "shutdown", ...safeErrorDetails(error),
        });
        process.exit(1);
      });
  });
}

process.once("SIGINT", () => shutDown("SIGINT"));
process.once("SIGTERM", () => shutDown("SIGTERM"));
