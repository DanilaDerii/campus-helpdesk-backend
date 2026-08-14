import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port);

server.on("listening", () => {
  console.log(`Campus HelpDesk scaffold listening on port ${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`Campus HelpDesk failed to start: ${error.message}`);
  process.exitCode = 1;
});
