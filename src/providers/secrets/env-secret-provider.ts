import type { SecretProvider } from "./secret-provider.js";

/** Local development provider backed by process environment variables. */
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  async get(name: string): Promise<string> {
    const value = this.environment[name];

    if (!value || value.trim() === "") {
      throw new Error(`${name} is required`);
    }

    return value;
  }
}
