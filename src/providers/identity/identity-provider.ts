export interface ExternalIdentity {
  microsoftOid: string;
  email: string;
  displayName: string;
}

/** Development and Microsoft Entra implementations will follow this contract. */
export interface IdentityProvider {
  completeLogin(input: unknown): Promise<ExternalIdentity>;
}
