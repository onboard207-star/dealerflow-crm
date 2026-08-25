import { NextResponse } from "next/server";

import { collectTwilioForm, normalizeTwilioEvent, TwilioWebhookError, verifyTwilioSignature } from "@/lib/integrations/twilio";
import { getDatabasePool } from "@/lib/server/database";
import { EnvironmentIntegrationCredentialResolver, TwilioRouteResolver, TwilioWebhookProcessor } from "@/lib/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ webhookKey: string }> }

export async function POST(request: Request, context: Context) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
      return response(415, "unsupported_media_type");
    }
    const { webhookKey } = await context.params;
    const parameters = collectTwilioForm(new URLSearchParams(await request.text()));
    const accountSid = typeof parameters.AccountSid === "string" ? parameters.AccountSid : "";
    const pool = getDatabasePool();
    const route = await new TwilioRouteResolver(pool).resolve(webhookKey, accountSid);
    if (!route) return response(404, "integration_not_found");
    const authToken = await new EnvironmentIntegrationCredentialResolver().resolve(route.credentialReference);
    const publicUrl = `${route.publicBaseUrl}/api/webhooks/twilio/${webhookKey}`;
    if (!verifyTwilioSignature({ authToken, signature: request.headers.get("x-twilio-signature") ?? "", url: publicUrl, parameters })) {
      return response(403, "invalid_signature");
    }
    const event = normalizeTwilioEvent(parameters);
    const result = await new TwilioWebhookProcessor(pool).process(route, event, parameters);
    return NextResponse.json({ accepted: true, result }, { status: result === "unmatched" ? 202 : 200,
      headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof TwilioWebhookError) {
      return error.code === "unsupported-event" ? new Response(null, { status: 204 }) : response(400, error.code);
    }
    return response(500, "webhook_processing_failed");
  }
}

function response(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
