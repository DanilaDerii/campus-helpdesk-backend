import type { RequestHandler } from "express";
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
  response.status(200).json(result);
};

export const currentUserController: RequestHandler = (request, response) => {
  response.status(200).json({ user: requireAuthenticatedUser(request) });
};
