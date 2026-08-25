import { createHash, randomBytes } from "node:crypto";

import { generateEntityId } from "@/lib/core/identifiers";
import { AuthorizationError, assertAuthorized, type AuthorizationActor } from "@/lib/platform/auth";
import type { OrganizationScope, RequestContext } from "@/lib/platform/data";

export interface TwilioIntegrationInput extends OrganizationScope {
  providerAccountId: string; credentialReference: string; publicBaseUrl: string;
  defaultFromAddress?: string;
}
export interface TwilioIntegrationRecord extends TwilioIntegrationInput {
  id: string; active: boolean;
}
export interface IntegrationConfigurationSession {
  createTwilio(context: RequestContext, input: TwilioIntegrationInput & { id: string; webhookKeyHash: string }): Promise<TwilioIntegrationRecord>;
}
export interface IntegrationConfigurationProvider {
  transaction<Result>(operation: (session: IntegrationConfigurationSession) => Promise<Result>): Promise<Result>;
}
export interface ProvisionTwilioRequest extends TwilioIntegrationInput {
  actor: AuthorizationActor; correlationId: string;
}
export interface ProvisionTwilioResult {
  integration: TwilioIntegrationRecord;
  webhookUrl: string;
  webhookKey: string;
}
export class IntegrationConfigurationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) { super("Integration configuration is invalid."); this.name = "IntegrationConfigurationError"; this.issues = [...issues]; }
}

export class ProvisionTwilioIntegrationService {
  constructor(private readonly provider: IntegrationConfigurationProvider,
    private readonly createWebhookKey: () => string = () => randomBytes(32).toString("base64url")) {}

  async provision(request: ProvisionTwilioRequest): Promise<ProvisionTwilioResult> {
    validate(request);
    const membership = assertAuthorized(request.actor, { capability: "organization.configure",
      organizationId: request.organizationId, locationId: request.locationId });
    if (!request.locationId && membership.locationIds !== "all") {
      throw new AuthorizationError("location-access-required");
    }
    const webhookKey = this.createWebhookKey();
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(webhookKey)) throw new Error("Webhook key generator returned an unsafe key.");
    const context: RequestContext = { actorId: request.actor.userId,
      organizationId: request.organizationId, correlationId: request.correlationId,
      ...(request.locationId ? { locationId: request.locationId } : {}) };
    const integration = await this.provider.transaction((session) => session.createTwilio(context, {
      id: generateEntityId("int"), organizationId: request.organizationId,
      ...(request.locationId ? { locationId: request.locationId } : {}),
      providerAccountId: request.providerAccountId, credentialReference: request.credentialReference,
      publicBaseUrl: request.publicBaseUrl.replace(/\/$/, ""),
      ...(request.defaultFromAddress ? { defaultFromAddress: request.defaultFromAddress } : {}),
      webhookKeyHash: createHash("sha256").update(webhookKey).digest("hex"),
    }));
    return { integration, webhookKey,
      webhookUrl: `${integration.publicBaseUrl}/api/webhooks/twilio/${webhookKey}` };
  }
}

function validate(request: ProvisionTwilioRequest) {
  const issues: string[] = [];
  if (!/^AC[a-fA-F0-9]{32}$/.test(request.providerAccountId)) issues.push("providerAccountId must be a Twilio Account SID.");
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(request.credentialReference)) issues.push("credentialReference is invalid.");
  if (!/^https:\/\/[^/]+(?::[0-9]+)?\/?$/.test(request.publicBaseUrl)) issues.push("publicBaseUrl must be an HTTPS origin without a path.");
  if (request.defaultFromAddress && !/^\+[1-9]\d{7,14}$/.test(request.defaultFromAddress)) issues.push("defaultFromAddress must use E.164 format.");
  if (!request.correlationId.trim()) issues.push("correlationId is required.");
  if (issues.length) throw new IntegrationConfigurationError(issues);
}
