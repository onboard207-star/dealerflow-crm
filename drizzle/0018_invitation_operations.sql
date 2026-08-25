ALTER TABLE "organization_invitations" ADD COLUMN "resend_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "organization_invitations" ADD COLUMN "last_sent_at" timestamptz DEFAULT now() NOT NULL;
ALTER TABLE "organization_invitations" ADD COLUMN "revoked_at" timestamptz;
ALTER TABLE "organization_invitations" ADD COLUMN "revoked_by" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_resend_limit" CHECK ("resend_count" >= 0 AND "resend_count" <= 10);
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_revocation" CHECK (("revoked_at" IS NULL) = ("revoked_by" IS NULL));
CREATE INDEX "organization_invitations_rate_limit_idx" ON "organization_invitations" ("organization_id", "invited_by", "created_at");
