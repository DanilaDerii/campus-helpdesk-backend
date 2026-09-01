import { createApp } from "./app.js";
import { disconnectDatabase } from "./database/prisma.js";
import { startNotificationRetryWorker } from "./services/notification.service.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port);
let stopNotificationRetryWorker = () => {};

server.on("listening", () => {
  console.log(`Campus HelpDesk listening on port ${port}`);
  stopNotificationRetryWorker = startNotificationRetryWorker();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Campus HelpDesk failed to start: ${error.message}`);
  process.exitCode = 1;
});

let isShuttingDown = false;

function shutDown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  stopNotificationRetryWorker();
  console.log(`Received ${signal}; shutting down Campus HelpDesk`);

  server.close(() => {
    void disconnectDatabase()
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error("Failed to close the database connection", error);
        process.exit(1);
      });
  });
}

process.once("SIGINT", () => shutDown("SIGINT"));
process.once("SIGTERM", () => shutDown("SIGTERM"));
