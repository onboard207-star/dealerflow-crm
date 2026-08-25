CREATE INDEX "customers_organization_name_search_idx"
  ON "customers" ("organization_id", lower("display_name") text_pattern_ops);
CREATE INDEX "leads_organization_created_idx"
  ON "leads" ("organization_id", "created_at" DESC, "id" DESC);
