import { Router, type RequestHandler } from "express";
import {
  clearAuthenticationCookie,
  developmentLogin,
  setAuthenticationCookie,
} from "../services/auth/index.js";
import { requireAuthentication, requireSameOrigin } from "./guardrails/authentication.js";
import {
  readRequestObject,
  readStringValue,
  requireAuthenticatedUser,
} from "./guardrails/validation.js";

const developmentLoginHandler: RequestHandler = async (request, response) => {
  const body = readRequestObject(request.body);
  const result = await developmentLogin(readStringValue(body.email, "email"));
  setAuthenticationCookie(
    response,
    result.accessToken,
    result.expiresInSeconds,
  );
  response.status(200).json(result);
};

const currentUserHandler: RequestHandler = (request, response) => {
  response.status(200).json({ user: requireAuthenticatedUser(request) });
};

const logoutHandler: RequestHandler = (_request, response) => {
  clearAuthenticationCookie(response);
  response.status(204).send();
};

export const authRoutes = Router();

authRoutes.post("/auth/dev-login", developmentLoginHandler);
authRoutes.post("/auth/logout", requireSameOrigin, logoutHandler);
authRoutes.get("/me", requireAuthentication, currentUserHandler);
