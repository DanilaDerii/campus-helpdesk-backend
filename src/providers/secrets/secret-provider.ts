/** Local and Azure Key Vault implementations will follow this contract. */
export interface SecretProvider {
  get(name: string): Promise<string>;
}
