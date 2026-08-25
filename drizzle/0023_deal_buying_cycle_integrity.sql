CREATE UNIQUE INDEX "deals_buying_cycle_unique"
  ON "deals"("organization_id","lead_id")
  WHERE "status" <> 'cancelled';
