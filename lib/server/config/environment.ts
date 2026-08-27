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
  mediaProvider?: "r2";
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Bucket?: string;
  r2PublicBaseUrl?: string;
}

export interface EnvironmentRequirements {
  database?: boolean;
  authentication?: boolean;
  jobs?: boolean;
  email?: boolean;
  ai?: boolean;
  media?: boolean;
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
  const mediaProvider=readOptional(source.DEALERFLOW_MEDIA_PROVIDER);
  const r2AccountId=readOptional(source.CLOUDFLARE_R2_ACCOUNT_ID);
  const r2AccessKeyId=readOptional(source.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const r2SecretAccessKey=readOptional(source.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  const r2Bucket=readOptional(source.CLOUDFLARE_R2_BUCKET);
  const r2PublicBaseUrl=readOptional(source.CLOUDFLARE_R2_PUBLIC_BASE_URL);

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
  if(mediaProvider&&mediaProvider!=="r2")issues.push("DEALERFLOW_MEDIA_PROVIDER must be r2.");
  const mediaValues=[r2AccountId,r2AccessKeyId,r2SecretAccessKey,r2Bucket,r2PublicBaseUrl];
  if(mediaValues.some(Boolean)&&mediaProvider!=="r2")issues.push("DEALERFLOW_MEDIA_PROVIDER=r2 is required when Cloudflare R2 settings are present.");
  if(mediaProvider==="r2"&&mediaValues.some((value)=>!value))issues.push("All Cloudflare R2 media settings are required when DEALERFLOW_MEDIA_PROVIDER=r2.");
  if(requirements.media&&mediaProvider!=="r2")issues.push("DEALERFLOW_MEDIA_PROVIDER=r2 is required for inventory media.");
  if(r2AccountId&&!/^[a-f0-9]{32}$/.test(r2AccountId))issues.push("CLOUDFLARE_R2_ACCOUNT_ID is invalid.");
  if(r2Bucket&&!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(r2Bucket))issues.push("CLOUDFLARE_R2_BUCKET is invalid.");
  if(r2PublicBaseUrl&&!isHttpsBaseUrl(r2PublicBaseUrl))issues.push("CLOUDFLARE_R2_PUBLIC_BASE_URL must be an HTTPS origin without credentials, query, or fragment.");

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
    ...(mediaProvider==="r2"?{mediaProvider}:{}),
    ...(r2AccountId?{r2AccountId}:{}),
    ...(r2AccessKeyId?{r2AccessKeyId}:{}),
    ...(r2SecretAccessKey?{r2SecretAccessKey}:{}),
    ...(r2Bucket?{r2Bucket}:{}),
    ...(r2PublicBaseUrl?{r2PublicBaseUrl}:{}),
  });
}

function isHttpsBaseUrl(value:string):boolean{try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{return false;}}

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
