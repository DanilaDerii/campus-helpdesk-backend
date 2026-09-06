import { AsyncLocalStorage } from "node:async_hooks";

export const requestLogContext = new AsyncLocalStorage<{ requestId: string }>();

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  operation?: string;
  code?: string;
  causeCode?: string;
  errorType?: string;
  upstreamStatus?: number;
  statusCode?: number;
  notificationId?: number;
  attempt?: number;
  nextAttemptAt?: string;
  port?: number;
  signal?: string;
  users?: number;
  categories?: number;
}

const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const errorNames = new Set([
  "Error", "TypeError", "RangeError", "SyntaxError", "AbortError", "TimeoutError",
  "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError",
  "PrismaClientInitializationError", "PrismaClientValidationError",
  "RestError", "AggregateAuthenticationError", "CredentialUnavailableError",
  "ClientAuthError", "ServerError",
]);
const errorCodes = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EADDRINUSE",
  "invalid_client", "invalid_grant", "invalid_scope", "temporarily_unavailable",
]);

// Use an allowlist: SDK messages, bodies, stacks and headers can contain secrets.
export function safeErrorDetails(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorType: "UnknownError" };

  const details: LogFields = {
    errorType: errorNames.has(error.name) ? error.name : "Error",
  };
  const code = "code" in error ? error.code
    : "errorCode" in error ? error.errorCode : undefined;
  if (typeof code === "string" && (errorCodes.has(code) || /^P\d{4}$/.test(code))) {
    details.code = code;
  }
  const status = "statusCode" in error ? error.statusCode : undefined;
  if (
    typeof status === "number" && Number.isInteger(status) &&
    status >= 100 && status <= 599
  ) {
    details.upstreamStatus = status;
  }
  return details;
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const setting = process.env.LOG_LEVEL;
  const minimum = setting && Object.hasOwn(levels, setting)
    ? levels[setting as LogLevel]
    : levels.info;
  if (levels[level] < minimum) return;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    requestId: requestLogContext.getStore()?.requestId,
    ...fields,
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}
