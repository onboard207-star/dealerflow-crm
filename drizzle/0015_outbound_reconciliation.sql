ALTER TABLE "communication_send_attempts" ADD COLUMN "resolution_evidence_reference" text;
ALTER TABLE "communication_send_attempts" ADD COLUMN "resolved_at" timestamptz;
ALTER TABLE "communication_send_attempts" ADD COLUMN "resolved_by" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "communication_send_attempts" ADD CONSTRAINT "send_attempts_resolution_consistent"
  CHECK (("resolution_evidence_reference" is null) = ("resolved_at" is null));
CREATE INDEX "send_attempts_reconciliation_idx" ON "communication_send_attempts"
  ("organization_id", "status", "created_at") WHERE "status" = 'delivery-unknown';
