ALTER TABLE "deals" ADD COLUMN "accepted_quote_id" text;
ALTER TABLE "deals" ADD COLUMN "accepted_quote_version" integer;

CREATE UNIQUE INDEX "deal_quotes_org_id_version_unique" ON "deal_quotes"("organization_id","id","version");
UPDATE "deals" d SET accepted_quote_id=q.id, accepted_quote_version=q.version,
  purchase_type=q.purchase_type, agreed_price_cents=q.total_cents
FROM "deal_quotes" q WHERE q.organization_id=d.organization_id AND q.deal_id=d.id
  AND q.status='accepted' AND d.status IN ('contracted','delivered');
ALTER TABLE "deals" ADD CONSTRAINT "deals_accepted_quote_fk"
  FOREIGN KEY ("organization_id", "accepted_quote_id", "accepted_quote_version")
  REFERENCES "deal_quotes" ("organization_id", "id", "version");
ALTER TABLE "deals" ADD CONSTRAINT "deals_quote_binding_complete"
  CHECK (("accepted_quote_id" IS NULL) = ("accepted_quote_version" IS NULL));
ALTER TABLE "deals" ADD CONSTRAINT "deals_quote_required_after_contract"
  CHECK ("status" NOT IN ('contracted','delivered') OR "accepted_quote_id" IS NOT NULL) NOT VALID;

CREATE TABLE "deal_document_requirements" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "deal_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "quote_version" integer NOT NULL,
  "document_type" text NOT NULL,
  "document_version" integer NOT NULL,
  "provenance" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "required" boolean DEFAULT true NOT NULL,
  "completed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "deal_document_requirements_deal_fk" FOREIGN KEY ("organization_id","location_id","deal_id") REFERENCES "deals"("organization_id","location_id","id"),
  CONSTRAINT "deal_document_requirements_quote_fk" FOREIGN KEY ("organization_id","quote_id","quote_version") REFERENCES "deal_quotes"("organization_id","id","version"),
  CONSTRAINT "deal_document_requirements_id_format" CHECK ("id" ~ '^ddr_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "deal_document_requirements_status" CHECK ("status" IN ('pending','complete','waived')),
  CONSTRAINT "deal_document_requirements_versions" CHECK ("quote_version">0 AND "document_version">0),
  CONSTRAINT "deal_document_requirements_completion" CHECK (("status"='complete')=("completed_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "deal_document_requirements_org_id_unique" ON "deal_document_requirements"("organization_id","id");
CREATE UNIQUE INDEX "deal_document_requirements_version_unique" ON "deal_document_requirements"("organization_id","deal_id","document_type","document_version");
CREATE INDEX "deal_document_requirements_readiness_idx" ON "deal_document_requirements"("organization_id","deal_id","required","status");
INSERT INTO "deal_document_requirements" (id,organization_id,location_id,deal_id,quote_id,quote_version,document_type,document_version,provenance,status,required,completed_by,completed_at,created_by)
SELECT 'ddr_' || substr(md5(d.organization_id || ':' || d.id || ':accepted-quote'),1,24), d.organization_id,d.location_id,d.id,d.accepted_quote_id,d.accepted_quote_version,
  'accepted-quote',d.accepted_quote_version,'canonical-quote','complete',true,d.updated_by,COALESCE(q.accepted_at,d.updated_at),d.updated_by
FROM deals d JOIN deal_quotes q ON q.organization_id=d.organization_id AND q.id=d.accepted_quote_id AND q.version=d.accepted_quote_version
WHERE d.status IN ('contracted','delivered');
ALTER TABLE "deal_document_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_document_requirements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "deal_document_requirements_tenant_select" ON "deal_document_requirements" FOR SELECT USING ("organization_id"=current_setting('app.organization_id',true));
CREATE POLICY "deal_document_requirements_tenant_insert" ON "deal_document_requirements" FOR INSERT WITH CHECK ("organization_id"=current_setting('app.organization_id',true));
CREATE POLICY "deal_document_requirements_tenant_update" ON "deal_document_requirements" FOR UPDATE USING ("organization_id"=current_setting('app.organization_id',true)) WITH CHECK ("organization_id"=current_setting('app.organization_id',true));

CREATE FUNCTION prevent_deal_contract_quote_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF OLD.accepted_quote_id IS NOT NULL AND (NEW.accepted_quote_id,NEW.accepted_quote_version)
    IS DISTINCT FROM (OLD.accepted_quote_id,OLD.accepted_quote_version)
  THEN RAISE EXCEPTION 'Contract Quote binding is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "deals_contract_quote_immutable" BEFORE UPDATE ON "deals" FOR EACH ROW EXECUTE FUNCTION prevent_deal_contract_quote_rewrite();
