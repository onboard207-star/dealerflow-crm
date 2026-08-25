ALTER TABLE "transactional_email_messages" ADD COLUMN "organization_id" text REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "transactional_email_messages" ADD COLUMN "invitation_id" text;
ALTER TABLE "transactional_email_messages" ADD CONSTRAINT "transactional_email_invitation_scope" CHECK (("invitation_id" IS NULL) = ("organization_id" IS NULL));
ALTER TABLE "transactional_email_messages" ADD CONSTRAINT "transactional_email_same_org_invitation_fk" FOREIGN KEY ("organization_id", "invitation_id") REFERENCES "organization_invitations"("organization_id", "id") ON DELETE CASCADE;
CREATE INDEX "transactional_email_invitation_idx" ON "transactional_email_messages" ("organization_id", "invitation_id", "created_at") WHERE "invitation_id" IS NOT NULL;
