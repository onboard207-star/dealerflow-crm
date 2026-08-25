export interface IntegrationCredentialResolver {
  resolve(reference: string): Promise<string>;
}

export class EnvironmentIntegrationCredentialResolver implements IntegrationCredentialResolver {
  async resolve(reference: string): Promise<string> {
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(reference)) throw new Error("Integration credential reference is invalid.");
    const value = process.env[`DEALERFLOW_INTEGRATION_SECRET_${reference}`]?.trim();
    if (!value) throw new Error("Integration credential is unavailable.");
    return value;
  }
}
