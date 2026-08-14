import type { RequestHandler } from "express";
import { developmentLogin } from "../services/auth.service.js";
import { HttpError } from "../shared/http-error.js";

function readEmail(body: unknown): string {
  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    typeof body.email !== "string" ||
    body.email.trim() === ""
  ) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "A non-empty email string is required",
    );
  }

  return body.email;
}

export const developmentLoginController: RequestHandler = async (
  request,
  response,
) => {
  const result = await developmentLogin(readEmail(request.body));
  response.status(200).json(result);
};

export const currentUserController: RequestHandler = (request, response) => {
  if (!request.authenticatedUser) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Login is required");
  }

  response.status(200).json({ user: request.authenticatedUser });
};
