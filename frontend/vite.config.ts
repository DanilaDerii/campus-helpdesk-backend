import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The application is served from a sub-path, not from the domain root: the
// deployment host also runs other applications, and "/" and "/api" already
// belong to one of them. Vite rewrites asset URLs in the built index.html to
// match this value and exposes it as import.meta.env.BASE_URL, which the router
// and the API client both read, so the path is configured in exactly one place.
const base = process.env.VITE_BASE_PATH ?? "/helpdesk/";
const basePrefix = base.replace(/\/$/, "");

const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

// Strip the same prefix that Nginx strips in production, so a request looks
// identical to the backend whether it arrived through this development proxy or
// through the deployed reverse proxy. Without this, development and production
// would disagree about the path, which is exactly the class of bug that only
// shows up after deploying.
const stripBase = (path: string) => path.replace(basePrefix, "");

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      [`${basePrefix}/api`]: { target: apiTarget, rewrite: stripBase },
      [`${basePrefix}/health`]: { target: apiTarget, rewrite: stripBase },
      [`${basePrefix}/ready`]: { target: apiTarget, rewrite: stripBase },
    },
  },
});
