export const applicationEnvironments = [
  "development",
  "test",
  "staging",
  "production",
] as const;

export type ApplicationEnvironment =
  (typeof applicationEnvironments)[number];

export type DatabaseSslMode = "disable" | "verify-full";

export interface ServerEnvironment {
  appEnvironment: ApplicationEnvironment;
  databaseUrl?: string;
  databaseSslMode?: DatabaseSslMode;
  authSecret?: string;
  authUrl?: string;
  jobSecret?: string;
  emailProvider?: "resend";
  resendApiKey?: string;
  emailFrom?: string;
  emailReplyTo?: string;
  alertWebhookUrl?: string;
  alertWebhookSecret?: string;
  aiProvider?: "openai";
  openaiApiKey?: string;
  aiModel?: string;
}

export interface EnvironmentRequirements {
  database?: boolean;
  authentication?: boolean;
  jobs?: boolean;
  email?: boolean;
  ai?: boolean;
}

export class EnvironmentConfigurationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Server environment configuration is invalid.");
    this.name = "EnvironmentConfigurationError";
    this.issues = [...issues];
  }
}

export function parseServerEnvironment(
  source: Readonly<Record<string, string | undefined>>,
  requirements: EnvironmentRequirements = {},
): ServerEnvironment {
  const issues: string[] = [];
  const appEnvironment = parseApplicationEnvironment(source.APP_ENV, issues);
  const databaseUrl = readOptional(source.DATABASE_URL);
  const databaseSslMode = readOptional(source.DATABASE_SSL_MODE);
  const authSecret = readOptional(source.BETTER_AUTH_SECRET);
  const authUrl = readOptional(source.BETTER_AUTH_URL);
  const jobSecret = readOptional(source.DEALERFLOW_JOB_SECRET);
  const emailProvider = readOptional(source.DEALERFLOW_EMAIL_PROVIDER);
  const resendApiKey = readOptional(source.RESEND_API_KEY);
  const emailFrom = readOptional(source.DEALERFLOW_EMAIL_FROM);
  const emailReplyTo = readOptional(source.DEALERFLOW_EMAIL_REPLY_TO);
  const alertWebhookUrl = readOptional(source.DEALERFLOW_ALERT_WEBHOOK_URL);
  const alertWebhookSecret = readOptional(source.DEALERFLOW_ALERT_WEBHOOK_SECRET);
  const aiProvider=readOptional(source.DEALERFLOW_AI_PROVIDER);
  const openaiApiKey=readOptional(source.OPENAI_API_KEY);
  const aiModel=readOptional(source.DEALERFLOW_AI_MODEL);

  if (requirements.database && !databaseUrl) {
    issues.push("DATABASE_URL is required for database operations.");
  }

  if (databaseUrl && !isPostgresUrl(databaseUrl)) {
    issues.push("DATABASE_URL must use the postgres or postgresql protocol.");
  }

  if (
    databaseSslMode &&
    databaseSslMode !== "disable" &&
    databaseSslMode !== "verify-full"
  ) {
    issues.push("DATABASE_SSL_MODE must be disable or verify-full.");
  }

  if (requirements.authentication && !authSecret) {
    issues.push("BETTER_AUTH_SECRET is required for authentication.");
  }

  if (authSecret && authSecret.length < 32) {
    issues.push("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  if (requirements.authentication && !authUrl) {
    issues.push("BETTER_AUTH_URL is required for authentication.");
  }

  if (authUrl && !isValidApplicationUrl(authUrl, appEnvironment)) {
    issues.push(
      appEnvironment === "development" || appEnvironment === "test"
        ? "BETTER_AUTH_URL must be an HTTP or HTTPS application URL."
        : "BETTER_AUTH_URL must use HTTPS outside development and test.",
    );
  }
  if (requirements.jobs && !jobSecret) issues.push("DEALERFLOW_JOB_SECRET is required for internal jobs.");
  if (jobSecret && jobSecret.length < 32) issues.push("DEALERFLOW_JOB_SECRET must contain at least 32 characters.");
  if (emailProvider && emailProvider !== "resend") issues.push("DEALERFLOW_EMAIL_PROVIDER must be resend.");
  if (requirements.email && emailProvider !== "resend") issues.push("DEALERFLOW_EMAIL_PROVIDER=resend is required for email delivery.");
  if (requirements.email && !resendApiKey) issues.push("RESEND_API_KEY is required for email delivery.");
  if (requirements.email && !emailFrom) issues.push("DEALERFLOW_EMAIL_FROM is required for email delivery.");
  if (emailFrom && !isMailbox(emailFrom)) issues.push("DEALERFLOW_EMAIL_FROM must contain a valid email address.");
  if (emailReplyTo && !isMailbox(emailReplyTo)) issues.push("DEALERFLOW_EMAIL_REPLY_TO must contain a valid email address.");
  if (Boolean(alertWebhookUrl) !== Boolean(alertWebhookSecret)) issues.push("DEALERFLOW_ALERT_WEBHOOK_URL and DEALERFLOW_ALERT_WEBHOOK_SECRET must be configured together.");
  if (alertWebhookUrl && !isValidApplicationUrl(alertWebhookUrl, appEnvironment)) issues.push("DEALERFLOW_ALERT_WEBHOOK_URL must be HTTPS outside development and test.");
  if (alertWebhookSecret && alertWebhookSecret.length < 32) issues.push("DEALERFLOW_ALERT_WEBHOOK_SECRET must contain at least 32 characters.");
  if(aiProvider&&aiProvider!=="openai")issues.push("DEALERFLOW_AI_PROVIDER must be openai.");
  if(requirements.ai&&aiProvider!=="openai")issues.push("DEALERFLOW_AI_PROVIDER=openai is required for AI recommendations.");
  if(requirements.ai&&!openaiApiKey)issues.push("OPENAI_API_KEY is required for AI recommendations.");
  if(requirements.ai&&!aiModel)issues.push("DEALERFLOW_AI_MODEL is required for AI recommendations.");
  if(aiModel&&!/^[a-zA-Z0-9._-]{2,100}$/.test(aiModel))issues.push("DEALERFLOW_AI_MODEL is invalid.");

  if (issues.length > 0) {
    throw new EnvironmentConfigurationError(issues);
  }

  return Object.freeze({
    appEnvironment,
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(databaseSslMode === "disable" || databaseSslMode === "verify-full"
      ? { databaseSslMode }
      : {}),
    ...(authSecret ? { authSecret } : {}),
    ...(authUrl ? { authUrl } : {}),
    ...(jobSecret ? { jobSecret } : {}),
    ...(emailProvider === "resend" ? { emailProvider } : {}),
    ...(resendApiKey ? { resendApiKey } : {}),
    ...(emailFrom ? { emailFrom } : {}),
    ...(emailReplyTo ? { emailReplyTo } : {}),
    ...(alertWebhookUrl ? { alertWebhookUrl } : {}),
    ...(alertWebhookSecret ? { alertWebhookSecret } : {}),
    ...(aiProvider==="openai"?{aiProvider}:{}),
    ...(openaiApiKey?{openaiApiKey}:{}),
    ...(aiModel?{aiModel}:{}),
  });
}

function isMailbox(value: string): boolean {
  const match = value.match(/^(?:[^<>]+\s+<)?([^<>\s]+@[^<>\s]+)>?$/);
  return Boolean(match?.[1] && /^[^@]+@[^@]+\.[^@]+$/.test(match[1]));
}

function parseApplicationEnvironment(
  value: string | undefined,
  issues: string[],
): ApplicationEnvironment {
  const candidate = value ?? "development";
  const environment = applicationEnvironments.find(
    (item) => item === candidate,
  );

  if (!environment) {
    issues.push("APP_ENV must be development, test, staging, or production.");
    return "development";
  }

  return environment;
}

function readOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function isValidApplicationUrl(
  value: string,
  environment: ApplicationEnvironment,
): boolean {
  try {
    const url = new URL(value);
    if (environment === "development" || environment === "test") {
      return url.protocol === "http:" || url.protocol === "https:";
    }
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
