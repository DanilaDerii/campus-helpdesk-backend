/** Local environment and Azure Key Vault implementations share this contract. */
export interface SecretProvider {
  get(name: string): Promise<string>;
}
