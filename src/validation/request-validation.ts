import type { Request } from "express";
import { HttpError } from "../errors/http-error.js";
import type { AuthenticatedUser } from "../services/auth.service.js";

export type RequestObject = Record<string, unknown>;

interface StringValueOptions {
  allowEmpty?: boolean;
  maximumLength?: number;
}

export function readRequestObject(body: unknown): RequestObject {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "A JSON object request body is required",
    );
  }

  return body as RequestObject;
}

export function hasOwnField(body: RequestObject, field: string): boolean {
  return Object.hasOwn(body, field);
}

export function requireAnyField(
  body: RequestObject,
  fields: readonly string[],
): void {
  if (!fields.some((field) => hasOwnField(body, field))) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `At least one of ${fields.join(" or ")} is required`,
    );
  }
}

export function readStringValue(
  value: unknown,
  field: string,
  options: StringValueOptions = {},
): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "INVALID_REQUEST", `${field} must be a string`);
  }

  const normalizedValue = value.trim();

  if (!options.allowEmpty && normalizedValue === "") {
    throw new HttpError(400, "INVALID_REQUEST", `${field} is required`);
  }

  if (
    options.maximumLength !== undefined &&
    normalizedValue.length > options.maximumLength
  ) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must not exceed ${options.maximumLength} characters`,
    );
  }

  return normalizedValue;
}

export function readPositiveIntegerValue(
  value: unknown,
  field: string,
): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must be a positive integer`,
    );
  }

  return Number(value);
}

export function readPositiveIntegerParameter(
  value: string | string[] | undefined,
  parameter: string,
  errorCode: string,
): number {
  const parsedValue = typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new HttpError(
      400,
      errorCode,
      `${parameter} must be a positive integer`,
    );
  }

  return parsedValue;
}

export function readEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
): T {
  if (
    typeof value !== "string" ||
    !allowedValues.includes(value as T)
  ) {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must be one of: ${allowedValues.join(", ")}`,
    );
  }

  return value as T;
}

export function readBooleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      `${field} must be a boolean`,
    );
  }

  return value;
}

export function requireAuthenticatedUser(
  request: Request,
): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Login is required");
  }

  return request.authenticatedUser;
}
