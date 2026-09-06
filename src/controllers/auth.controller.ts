import type { RequestHandler } from "express";
import {
  clearAuthenticationCookie,
  setAuthenticationCookie,
} from "../services/auth-cookie.js";
import { developmentLogin } from "../services/auth.service.js";
import {
  readRequestObject,
  readStringValue,
  requireAuthenticatedUser,
} from "../validation/request-validation.js";

export const developmentLoginController: RequestHandler = async (
  request,
  response,
) => {
  const body = readRequestObject(request.body);
  const result = await developmentLogin(readStringValue(body.email, "email"));
  setAuthenticationCookie(
    response,
    result.accessToken,
    result.expiresInSeconds,
  );
  response.status(200).json(result);
};

export const currentUserController: RequestHandler = (request, response) => {
  response.status(200).json({ user: requireAuthenticatedUser(request) });
};

export const logoutController: RequestHandler = (_request, response) => {
  clearAuthenticationCookie(response);
  response.status(204).send();
};
