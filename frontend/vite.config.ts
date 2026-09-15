import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served under /helpdesk/. The router and API client read this via import.meta.env.BASE_URL.
const base = process.env.VITE_BASE_PATH ?? "/helpdesk/";
const basePrefix = base.replace(/\/$/, "");

const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3000";

// Strip the prefix like Nginx does in production.
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
