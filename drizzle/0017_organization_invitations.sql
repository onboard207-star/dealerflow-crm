CREATE TYPE "organization_invitation_status" AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TABLE "organization_invitations" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "token_hash" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "organization_invitation_status" DEFAULT 'pending' NOT NULL,
  "all_locations" boolean DEFAULT false NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "invited_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "accepted_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "accepted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organization_invitations_id_format" CHECK ("id" ~ '^oin_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "organization_invitations_expiry" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "organization_invitations_acceptance" CHECK (("accepted_at" IS NULL) = ("accepted_by" IS NULL))
);
CREATE UNIQUE INDEX "organization_invitations_token_unique" ON "organization_invitations" ("token_hash");
CREATE UNIQUE INDEX "organization_invitations_org_id_unique" ON "organization_invitations" ("organization_id", "id");
CREATE UNIQUE INDEX "organization_invitations_idempotency_unique" ON "organization_invitations" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "organization_invitations_pending_email_unique" ON "organization_invitations" ("organization_id", lower("email")) WHERE "status" = 'pending';
CREATE INDEX "organization_invitations_org_status_idx" ON "organization_invitations" ("organization_id", "status", "created_at");

CREATE TABLE "organization_invitation_roles" (
  "invitation_id" text NOT NULL REFERENCES "organization_invitations"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  PRIMARY KEY ("invitation_id", "role_id"),
  CONSTRAINT "invitation_roles_same_org_invitation_fk" FOREIGN KEY ("organization_id", "invitation_id") REFERENCES "organization_invitations"("organization_id", "id")
);
CREATE TABLE "organization_invitation_locations" (
  "invitation_id" text NOT NULL REFERENCES "organization_invitations"("id") ON DELETE CASCADE,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "location_id" text NOT NULL REFERENCES "locations"("id") ON DELETE CASCADE,
  PRIMARY KEY ("invitation_id", "location_id"),
  CONSTRAINT "invitation_locations_same_org_invitation_fk" FOREIGN KEY ("organization_id", "invitation_id") REFERENCES "organization_invitations"("organization_id", "id"),
  CONSTRAINT "invitation_locations_same_org_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id")
);
ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitation_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitation_roles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitation_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitation_locations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organization_invitations_staff_manage" ON "organization_invitations" USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '') AND EXISTS (
    SELECT 1 FROM organization_memberships m JOIN membership_roles mr ON mr.membership_id=m.id AND mr.organization_id=m.organization_id
    JOIN role_capabilities rc ON rc.role_id=mr.role_id AND rc.organization_id=m.organization_id
    WHERE m.organization_id="organization_invitations"."organization_id" AND m.user_id=nullif(current_setting('app.user_id', true), '') AND m.status='active' AND rc.capability='staff.manage'
  )
) WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '') AND EXISTS (
    SELECT 1 FROM organization_memberships m JOIN membership_roles mr ON mr.membership_id=m.id AND mr.organization_id=m.organization_id
    JOIN role_capabilities rc ON rc.role_id=mr.role_id AND rc.organization_id=m.organization_id
    WHERE m.organization_id="organization_invitations"."organization_id" AND m.user_id=nullif(current_setting('app.user_id', true), '') AND m.status='active' AND rc.capability='staff.manage'
  )
);
CREATE POLICY "organization_invitations_recipient_accept" ON "organization_invitations" FOR UPDATE USING (
  "organization_id"=nullif(current_setting('app.organization_id',true),'') AND "token_hash"=nullif(current_setting('app.invitation_token_hash',true),'') AND "status"='pending' AND "expires_at">now() AND EXISTS (SELECT 1 FROM users u WHERE u.id=nullif(current_setting('app.user_id',true),'') AND u.active AND u.email_verified AND lower(u.email)=lower("organization_invitations"."email"))
) WITH CHECK ("organization_id"=nullif(current_setting('app.organization_id',true),'') AND "status"='accepted');
CREATE POLICY "organization_invitations_recipient_read" ON "organization_invitations" FOR SELECT USING (
  "organization_id"=nullif(current_setting('app.organization_id',true),'') AND "token_hash"=nullif(current_setting('app.invitation_token_hash',true),'') AND EXISTS (SELECT 1 FROM users u WHERE u.id=nullif(current_setting('app.user_id',true),'') AND u.active AND u.email_verified AND lower(u.email)=lower("organization_invitations"."email"))
);
CREATE POLICY "organization_invitation_roles_staff_manage" ON "organization_invitation_roles" USING (EXISTS (SELECT 1 FROM organization_invitations i WHERE i.id="invitation_id"));
CREATE POLICY "organization_invitation_locations_staff_manage" ON "organization_invitation_locations" USING (EXISTS (SELECT 1 FROM organization_invitations i WHERE i.id="invitation_id"));

REVOKE ALL ON "organization_invitations", "organization_invitation_roles", "organization_invitation_locations" FROM PUBLIC;
