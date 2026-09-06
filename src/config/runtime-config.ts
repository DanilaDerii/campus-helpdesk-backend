export type RuntimeEnvironment = "development" | "test" | "production";

export interface RuntimeConfiguration {
  environment: RuntimeEnvironment;
  host: string;
  port: number;
  publicBasePath: string;
}

export class RuntimeConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(`Invalid runtime configuration: ${code}`);
    this.name = "RuntimeConfigurationError";
  }
}

const environments = new Set<RuntimeEnvironment>([
  "development",
  "test",
  "production",
]);
const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
const logLevels = new Set(["debug", "info", "warn", "error"]);

function readRequired(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new RuntimeConfigurationError(`MISSING_${name}`);
  }

  return value;
}

function requireHttpsUrl(value: string, code: string): void {
  try {
    if (new URL(value).protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new RuntimeConfigurationError(code);
  }
}

function readPublicBasePath(
  values: NodeJS.ProcessEnv,
  environment: RuntimeEnvironment,
): string {
  const value = environment === "production"
    ? readRequired(values, "PUBLIC_BASE_PATH")
    : values.PUBLIC_BASE_PATH?.trim() || "/";

  if (
    value !== "/" &&
    !/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*\/?$/.test(value)
  ) {
    throw new RuntimeConfigurationError("INVALID_PUBLIC_BASE_PATH");
  }

  return value === "/" ? value : value.replace(/\/$/, "");
}

export function readRuntimeConfiguration(
  values: NodeJS.ProcessEnv = process.env,
): RuntimeConfiguration {
  const environmentValue = values.NODE_ENV?.trim() || "development";

  if (!environments.has(environmentValue as RuntimeEnvironment)) {
    throw new RuntimeConfigurationError("INVALID_NODE_ENV");
  }

  const environment = environmentValue as RuntimeEnvironment;
  const publicBasePath = readPublicBasePath(values, environment);
  const portValue = values.PORT?.trim() || "3000";
  const port = Number(portValue);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RuntimeConfigurationError("INVALID_PORT");
  }

  const host = values.HOST?.trim() || "127.0.0.1";

  if (!loopbackHosts.has(host)) {
    throw new RuntimeConfigurationError("HOST_MUST_BE_LOOPBACK");
  }

  const logLevel = values.LOG_LEVEL?.trim();

  if (logLevel && !logLevels.has(logLevel)) {
    throw new RuntimeConfigurationError("INVALID_LOG_LEVEL");
  }

  if (environment === "production") {
    requireHttpsUrl(
      readRequired(values, "KEY_VAULT_URL"),
      "INVALID_KEY_VAULT_URL",
    );
    const senderEmail = readRequired(values, "BREVO_SENDER_EMAIL");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
      throw new RuntimeConfigurationError("INVALID_BREVO_SENDER_EMAIL");
    }
    readRequired(values, "ENTRA_TENANT_ID");
    readRequired(values, "ENTRA_CLIENT_ID");
    requireHttpsUrl(
      readRequired(values, "ENTRA_REDIRECT_URI"),
      "INVALID_ENTRA_REDIRECT_URI",
    );
  } else {
    readRequired(values, "DATABASE_URL");
    readRequired(values, "JWT_SECRET");
  }

  return { environment, host, port, publicBasePath };
}
