import { betterAuth } from "better-auth/minimal";

import { generateEntityId } from "@/lib/core/identifiers";
import { parseServerEnvironment } from "@/lib/server/config";
import { getDatabasePool } from "@/lib/server/database";
import { PostgresTransactionalEmailQueue, createPasswordResetEmail, createVerificationEmail } from "@/lib/server/email";
import { isInvitationSignupAllowed } from "./invitation-signup";

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (authInstance) return authInstance;
  authInstance = createAuth();
  return authInstance;
}

function createAuth() {
  const environment = parseServerEnvironment(process.env, {
    database: true,
    authentication: true,
  });
  const emailQueue = new PostgresTransactionalEmailQueue(getDatabasePool());

  return betterAuth({
    database: getDatabasePool(),
    secret: environment.authSecret,
    baseURL: environment.authUrl,
    trustedOrigins: environment.authUrl ? [environment.authUrl] : [],
    databaseHooks:{user:{create:{before:async(user,context)=>context?.path!=="/sign-up/email"||isInvitationSignupAllowed(getDatabasePool(),{email:user.email,callbackURL:context.body?.callbackURL})}}},
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        await emailQueue.enqueue(createPasswordResetEmail({ recipientEmail: user.email, actionUrl: url, idempotencyKey: `password-reset:${token}` }));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        await emailQueue.enqueue(createVerificationEmail({ recipientEmail: user.email, actionUrl: url, idempotencyKey: `email-verification:${token}` }));
      },
    },
    user: {
      modelName: "users",
      fields: {
        name: "display_name",
        emailVerified: "email_verified",
        image: "image_url",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      modelName: "auth_sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    account: {
      modelName: "auth_accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        idToken: "id_token",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      modelName: "auth_verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    advanced: {
      database: {
        generateId: ({ model }) =>
          model === "user" || model === "users"
            ? generateEntityId("usr")
            : crypto.randomUUID(),
      },
      useSecureCookies:
        environment.appEnvironment === "staging" ||
        environment.appEnvironment === "production",
    },
  });
}
