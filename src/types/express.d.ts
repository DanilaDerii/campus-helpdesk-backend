import type { AuthenticatedUser } from "../services/auth/index.js";

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser;
    }
  }
}

export {};
