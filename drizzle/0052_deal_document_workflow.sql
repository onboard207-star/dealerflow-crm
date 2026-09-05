ALTER TABLE "deal_document_requirements" ADD COLUMN "source_type" text;
ALTER TABLE "deal_document_requirements" ADD COLUMN "waiver_allowed" boolean DEFAULT false NOT NULL;
ALTER TABLE "deal_document_requirements" ADD COLUMN "template_id" text;
ALTER TABLE "deal_document_requirements" ADD COLUMN "template_version" integer;
ALTER TABLE "deal_document_requirements" ADD COLUMN "external_reference" text;
ALTER TABLE "deal_document_requirements" ADD COLUMN "idempotency_key" text;
ALTER TABLE "deal_document_requirements" ADD COLUMN "waived_by" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "deal_document_requirements" ADD COLUMN "waived_at" timestamptz;
ALTER TABLE "deal_document_requirements" ADD COLUMN "waiver_reason" text;
UPDATE "deal_document_requirements" SET source_type=CASE WHEN provenance='canonical-quote' THEN 'canonical-quote' ELSE 'external-reference' END,
  idempotency_key='backfill:'||id;
UPDATE "deal_document_requirements" SET waiver_allowed=true,waived_at=updated_at,waiver_reason='Legacy approved waiver' WHERE status='waived';
ALTER TABLE "deal_document_requirements" ALTER COLUMN "source_type" SET DEFAULT 'external-reference';
ALTER TABLE "deal_document_requirements" ALTER COLUMN "source_type" SET NOT NULL;
ALTER TABLE "deal_document_requirements" ALTER COLUMN "idempotency_key" SET NOT NULL;
ALTER TABLE "deal_document_requirements" DROP CONSTRAINT "deal_document_requirements_status";
ALTER TABLE "deal_document_requirements" DROP CONSTRAINT "deal_document_requirements_completion";
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_status" CHECK (status IN ('pending','generated','provided','complete','waived','unavailable'));
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_source" CHECK (source_type IN ('internal-generated','uploaded','external-reference','canonical-quote'));
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_completion" CHECK ((status='complete')=(completed_at IS NOT NULL));
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_waiver" CHECK ((status='waived')=(waived_at IS NOT NULL) AND (status<>'waived' OR (waiver_allowed AND waiver_reason IS NOT NULL)));
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_template" CHECK ((template_id IS NULL)=(template_version IS NULL));
ALTER TABLE "deal_document_requirements" ADD CONSTRAINT "deal_document_requirements_external_reference" CHECK (external_reference IS NULL OR (char_length(external_reference)<=500 AND external_reference !~* '^[a-z]+://'));
CREATE UNIQUE INDEX "deal_document_requirements_idempotency_unique" ON "deal_document_requirements"("organization_id","idempotency_key");

CREATE TABLE "deal_document_status_events"(
  "id" text PRIMARY KEY NOT NULL,"organization_id" text NOT NULL,"requirement_id" text NOT NULL,"from_status" text,"to_status" text NOT NULL,"reason" text,"occurred_at" timestamptz DEFAULT now() NOT NULL,"idempotency_key" text NOT NULL,"created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "deal_document_status_events_requirement_fk" FOREIGN KEY("organization_id","requirement_id") REFERENCES "deal_document_requirements"("organization_id","id"),
  CONSTRAINT "deal_document_status_events_id_format" CHECK(id ~ '^dde_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_document_status_events_status" CHECK(to_status IN ('pending','generated','provided','complete','waived','unavailable')),
  CONSTRAINT "deal_document_status_events_changed" CHECK(from_status IS NULL OR from_status<>to_status),
  CONSTRAINT "deal_document_status_events_reason_length" CHECK(reason IS NULL OR char_length(reason)<=1000)
);
CREATE UNIQUE INDEX "deal_document_status_events_org_id_unique" ON "deal_document_status_events"("organization_id","id");
CREATE UNIQUE INDEX "deal_document_status_events_idempotency_unique" ON "deal_document_status_events"("organization_id","idempotency_key");
ALTER TABLE "deal_document_status_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_document_status_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_document_status_events_tenant_select" ON "deal_document_status_events" FOR SELECT USING(organization_id=current_setting('app.organization_id',true));
CREATE POLICY "deal_document_status_events_tenant_insert" ON "deal_document_status_events" FOR INSERT WITH CHECK(organization_id=current_setting('app.organization_id',true));

INSERT INTO "deal_document_status_events"(id,organization_id,requirement_id,to_status,occurred_at,idempotency_key,created_by)
SELECT 'dde_'||substr(md5(organization_id||':'||id||':created'),1,24),organization_id,id,status,created_at,'backfill:'||id,created_by FROM "deal_document_requirements";

INSERT INTO "role_capabilities"(role_id,organization_id,capability)
SELECT r.id,r.organization_id,c.capability FROM roles r CROSS JOIN LATERAL unnest(
  CASE r.key
    WHEN 'owner' THEN ARRAY['document.read','document.manage','document.complete','document.waive']
    WHEN 'general-manager' THEN ARRAY['document.read','document.manage','document.complete','document.waive']
    WHEN 'finance-manager' THEN ARRAY['document.read','document.manage','document.complete','document.waive']
    WHEN 'controller' THEN ARRAY['document.read','document.manage','document.complete']
    WHEN 'sales-manager' THEN ARRAY['document.read']
    WHEN 'salesperson' THEN ARRAY['document.read']
    ELSE ARRAY[]::text[] END
) c(capability) WHERE r.system ON CONFLICT DO NOTHING;
