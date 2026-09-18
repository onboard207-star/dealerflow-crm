-- Migration backfills must read every tenant's legacy authority. The migration
-- connection is the schema owner, so temporarily remove FORCE only from the
-- source tables inside this transaction; FORCE is restored before commit (or
-- automatically restored by transaction rollback). Application sessions never
-- receive this migration context.
ALTER TABLE "deal_quotes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_lines" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_status_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_commercial_terms" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_finance_terms" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_lease_terms" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_incentive_applications" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_backend_product_snapshots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_profitability_snapshots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_approvals" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deals" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "trade_appraisals" NO FORCE ROW LEVEL SECURITY;

CREATE TABLE "quote_product_scenarios" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "stable_key" text NOT NULL,
  "position" integer NOT NULL,
  "product_kind" text NOT NULL,
  "inventory_unit_id" text,
  "product_reference" text NOT NULL,
  "label" text NOT NULL,
  "transaction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_type" text NOT NULL,
  "source_reference" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_product_scenarios_quote_fk" FOREIGN KEY ("organization_id","quote_id") REFERENCES "deal_quotes"("organization_id","id") ON DELETE RESTRICT,
  CONSTRAINT "quote_product_scenarios_inventory_fk" FOREIGN KEY ("organization_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","id") ON DELETE RESTRICT,
  CONSTRAINT "quote_product_scenarios_id_format" CHECK ("id" ~ '^qps_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_product_scenarios_stable_key" CHECK (char_length(trim("stable_key")) BETWEEN 1 AND 160),
  CONSTRAINT "quote_product_scenarios_position" CHECK ("position" >= 0),
  CONSTRAINT "quote_product_scenarios_product_kind" CHECK ("product_kind" IN ('vehicle','generic')),
  CONSTRAINT "quote_product_scenarios_product_reference" CHECK (char_length(trim("product_reference")) BETWEEN 1 AND 300),
  CONSTRAINT "quote_product_scenarios_label" CHECK (char_length(trim("label")) BETWEEN 1 AND 200),
  CONSTRAINT "quote_product_scenarios_source" CHECK ("source_type" IN ('application','provider','import','legacy-backfill')),
  CONSTRAINT "quote_product_scenarios_source_reference" CHECK ("source_reference" IS NULL OR char_length("source_reference") <= 500)
);
CREATE UNIQUE INDEX "quote_product_scenarios_org_id_unique" ON "quote_product_scenarios" ("organization_id","id");
CREATE UNIQUE INDEX "quote_product_scenarios_quote_stable_unique" ON "quote_product_scenarios" ("organization_id","quote_id","stable_key");
CREATE UNIQUE INDEX "quote_product_scenarios_quote_position_unique" ON "quote_product_scenarios" ("organization_id","quote_id","position");
CREATE UNIQUE INDEX "quote_product_scenarios_quote_id_unique" ON "quote_product_scenarios" ("organization_id","quote_id","id");

CREATE TABLE "quote_payment_scenarios" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "product_scenario_id" text NOT NULL,
  "stable_key" text NOT NULL,
  "position" integer NOT NULL,
  "mode" text NOT NULL,
  "calculation_status" text NOT NULL,
  "term_months" integer,
  "apr_basis_points" integer,
  "cash_down_cents" integer DEFAULT 0 NOT NULL,
  "amount_financed_cents" integer,
  "payment_cents" integer,
  "total_payment_cents" integer,
  "finance_charge_cents" integer,
  "mode_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_type" text NOT NULL,
  "source_label" text NOT NULL,
  "source_reference" text,
  "calculation_policy_version" text NOT NULL,
  "rounding_policy_version" text NOT NULL,
  "calculation_fingerprint" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_payment_scenarios_product_fk" FOREIGN KEY ("organization_id","quote_id","product_scenario_id") REFERENCES "quote_product_scenarios"("organization_id","quote_id","id") ON DELETE RESTRICT,
  CONSTRAINT "quote_payment_scenarios_id_format" CHECK ("id" ~ '^qpy_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_payment_scenarios_stable_key" CHECK (char_length(trim("stable_key")) BETWEEN 1 AND 160),
  CONSTRAINT "quote_payment_scenarios_position" CHECK ("position" >= 0),
  CONSTRAINT "quote_payment_scenarios_mode" CHECK ("mode" IN ('cash','finance','lease')),
  CONSTRAINT "quote_payment_scenarios_status" CHECK ("calculation_status" IN ('complete','incomplete')),
  CONSTRAINT "quote_payment_scenarios_term" CHECK ("term_months" IS NULL OR "term_months" BETWEEN 1 AND 120),
  CONSTRAINT "quote_payment_scenarios_apr" CHECK ("apr_basis_points" IS NULL OR "apr_basis_points" BETWEEN 0 AND 10000),
  CONSTRAINT "quote_payment_scenarios_amounts" CHECK (
    "cash_down_cents" >= 0 AND
    ("amount_financed_cents" IS NULL OR "amount_financed_cents" >= 0) AND
    ("payment_cents" IS NULL OR "payment_cents" >= 0) AND
    ("total_payment_cents" IS NULL OR "total_payment_cents" >= 0) AND
    ("finance_charge_cents" IS NULL OR "finance_charge_cents" >= 0)
  ),
  CONSTRAINT "quote_payment_scenarios_complete_cash" CHECK ("mode" <> 'cash' OR ("calculation_status"='complete' AND "total_payment_cents" IS NOT NULL)),
  CONSTRAINT "quote_payment_scenarios_complete_finance" CHECK ("mode" <> 'finance' OR "calculation_status"='incomplete' OR ("term_months" IS NOT NULL AND "apr_basis_points" IS NOT NULL AND "amount_financed_cents" IS NOT NULL AND "payment_cents" IS NOT NULL AND "total_payment_cents" IS NOT NULL AND "finance_charge_cents" IS NOT NULL)),
  CONSTRAINT "quote_payment_scenarios_complete_lease" CHECK ("mode" <> 'lease' OR ("calculation_status"='complete' AND "term_months" IS NOT NULL AND "payment_cents" IS NOT NULL AND "total_payment_cents" IS NOT NULL AND "mode_metadata" ?& ARRAY['adjustedCapCostCents','residualValueCents','moneyFactorPpm','acquisitionFeeCents','capCostReductionCents','rebateCents'])),
  CONSTRAINT "quote_payment_scenarios_source" CHECK ("source_type" IN ('manual-entry','lender-quote','oem-program','dealer-program','legacy-quote')),
  CONSTRAINT "quote_payment_scenarios_source_label" CHECK (char_length(trim("source_label")) BETWEEN 1 AND 200),
  CONSTRAINT "quote_payment_scenarios_source_reference" CHECK ("source_reference" IS NULL OR char_length("source_reference") <= 500),
  CONSTRAINT "quote_payment_scenarios_policy_versions" CHECK (char_length(trim("calculation_policy_version")) BETWEEN 1 AND 100 AND char_length(trim("rounding_policy_version")) BETWEEN 1 AND 100),
  CONSTRAINT "quote_payment_scenarios_fingerprint" CHECK ("calculation_fingerprint" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "quote_payment_scenarios_org_id_unique" ON "quote_payment_scenarios" ("organization_id","id");
CREATE UNIQUE INDEX "quote_payment_scenarios_product_stable_unique" ON "quote_payment_scenarios" ("organization_id","product_scenario_id","stable_key");
CREATE UNIQUE INDEX "quote_payment_scenarios_product_position_unique" ON "quote_payment_scenarios" ("organization_id","product_scenario_id","position");
CREATE UNIQUE INDEX "quote_payment_scenarios_fingerprint_idx" ON "quote_payment_scenarios" ("organization_id","quote_id","calculation_fingerprint");

CREATE TABLE "quote_trade_snapshots" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "product_scenario_id" text NOT NULL,
  "trade_appraisal_id" text NOT NULL,
  "position" integer NOT NULL,
  "appraisal_version" integer NOT NULL,
  "appraisal_revision_at" timestamptz NOT NULL,
  "appraisal_allowance_cents" integer NOT NULL,
  "quote_allowance_cents" integer NOT NULL,
  "payoff_cents" integer NOT NULL,
  "equity_cents" integer NOT NULL,
  "quote_adjustment_cents" integer DEFAULT 0 NOT NULL,
  "adjustment_reason" text,
  "tax_treatment_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_type" text NOT NULL,
  "source_reference" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "quote_trade_snapshots_product_fk" FOREIGN KEY ("organization_id","quote_id","product_scenario_id") REFERENCES "quote_product_scenarios"("organization_id","quote_id","id") ON DELETE RESTRICT,
  CONSTRAINT "quote_trade_snapshots_appraisal_fk" FOREIGN KEY ("organization_id","trade_appraisal_id") REFERENCES "trade_appraisals"("organization_id","id") ON DELETE RESTRICT,
  CONSTRAINT "quote_trade_snapshots_id_format" CHECK ("id" ~ '^qts_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "quote_trade_snapshots_position" CHECK ("position" >= 0),
  CONSTRAINT "quote_trade_snapshots_appraisal_version" CHECK ("appraisal_version" > 0),
  CONSTRAINT "quote_trade_snapshots_amounts" CHECK ("appraisal_allowance_cents" >= 0 AND "quote_allowance_cents" >= 0 AND "payoff_cents" >= 0),
  CONSTRAINT "quote_trade_snapshots_equity" CHECK ("equity_cents" = "quote_allowance_cents" - "payoff_cents"),
  CONSTRAINT "quote_trade_snapshots_adjustment" CHECK ("quote_adjustment_cents" = "quote_allowance_cents" - "appraisal_allowance_cents"),
  CONSTRAINT "quote_trade_snapshots_adjustment_reason" CHECK (("quote_adjustment_cents"=0 AND "adjustment_reason" IS NULL) OR ("quote_adjustment_cents"<>0 AND char_length(trim("adjustment_reason")) BETWEEN 1 AND 1000)),
  CONSTRAINT "quote_trade_snapshots_source" CHECK ("source_type" IN ('application','provider','import','legacy-backfill')),
  CONSTRAINT "quote_trade_snapshots_source_reference" CHECK ("source_reference" IS NULL OR char_length("source_reference") <= 500)
);
CREATE UNIQUE INDEX "quote_trade_snapshots_org_id_unique" ON "quote_trade_snapshots" ("organization_id","id");
CREATE UNIQUE INDEX "quote_trade_snapshots_product_position_unique" ON "quote_trade_snapshots" ("organization_id","product_scenario_id","position");
CREATE UNIQUE INDEX "quote_trade_snapshots_product_appraisal_unique" ON "quote_trade_snapshots" ("organization_id","product_scenario_id","trade_appraisal_id");

CREATE TEMP TABLE "quote_vnext_legacy_baseline" ON COMMIT DROP AS
SELECT quote.organization_id,quote.id quote_id,
  md5(to_jsonb(quote)::text) quote_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(line) ORDER BY line.id)::text FROM deal_quote_lines line WHERE line.organization_id=quote.organization_id AND line.quote_id=quote.id),'[]')) line_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_commercial_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]')) commercial_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_finance_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]')) finance_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_lease_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]')) lease_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_incentive_applications item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]')) incentive_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_backend_product_snapshots item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]')) backend_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_profitability_snapshots item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]')) profitability_hash,
  md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM deal_quote_approvals item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]')) approval_hash
FROM deal_quotes quote;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM deal_quotes quote
    LEFT JOIN quote_lease_terms lease ON lease.organization_id=quote.organization_id AND lease.quote_id=quote.id
    WHERE quote.purchase_type='lease' AND lease.quote_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Quote vNext backfill refused: a legacy lease Quote has incomplete provider terms';
  END IF;
END $$;

INSERT INTO "quote_product_scenarios" (
  id,organization_id,quote_id,stable_key,position,product_kind,inventory_unit_id,
  product_reference,label,transaction_metadata,source_type,source_reference,created_by,created_at
)
SELECT 'qps_'||substr(md5(quote.organization_id||':'||quote.id||':default-product'),1,24),
  quote.organization_id,quote.id,'legacy:default-product',0,'vehicle',deal.inventory_unit_id,
  'vehicle:'||deal.primary_vehicle_id,'Primary vehicle',
  jsonb_build_object('purchaseType',quote.purchase_type::text),'legacy-backfill','deal_quote:'||quote.id,
  quote.created_by,quote.created_at
FROM deal_quotes quote
JOIN deals deal ON deal.organization_id=quote.organization_id AND deal.id=quote.deal_id
ON CONFLICT (organization_id,quote_id,stable_key) DO NOTHING;

INSERT INTO "quote_trade_snapshots" (
  id,organization_id,quote_id,product_scenario_id,trade_appraisal_id,position,
  appraisal_version,appraisal_revision_at,appraisal_allowance_cents,quote_allowance_cents,
  payoff_cents,equity_cents,quote_adjustment_cents,adjustment_reason,tax_treatment_metadata,
  source_type,source_reference,created_by,created_at
)
SELECT 'qts_'||substr(md5(terms.organization_id||':'||terms.quote_id||':'||terms.trade_appraisal_id),1,24),
  terms.organization_id,terms.quote_id,product.id,appraisal.id,0,
  appraisal.version,appraisal.updated_at,appraisal.allowance_cents,terms.trade_allowance_cents,
  terms.trade_payoff_cents,terms.trade_equity_cents,terms.trade_allowance_cents-appraisal.allowance_cents,
  CASE WHEN terms.trade_allowance_cents=appraisal.allowance_cents THEN NULL ELSE 'Legacy quote-specific allowance adjustment.' END,
  jsonb_build_object('treatment','legacy-unspecified'),'legacy-backfill','trade_appraisal:'||appraisal.id,
  terms.created_by,terms.created_at
FROM quote_commercial_terms terms
JOIN quote_product_scenarios product ON product.organization_id=terms.organization_id AND product.quote_id=terms.quote_id AND product.stable_key='legacy:default-product'
JOIN trade_appraisals appraisal ON appraisal.organization_id=terms.organization_id AND appraisal.id=terms.trade_appraisal_id
WHERE terms.trade_appraisal_id IS NOT NULL
ON CONFLICT (organization_id,product_scenario_id,trade_appraisal_id) DO NOTHING;

WITH legacy_input AS (
  SELECT quote.*,product.id product_scenario_id,
    commercial.cash_down_cents,commercial.amount_financed_cents,
    finance.apr_basis_points,finance.term_months finance_term_months,finance.estimated_payment_cents,
    finance.source_type finance_source_type,finance.source_label finance_source_label,finance.source_reference finance_source_reference,
    lease.adjusted_cap_cost_cents,lease.residual_value_cents,lease.money_factor_ppm,lease.term_months lease_term_months,
    lease.annual_mileage,lease.acquisition_fee_cents,lease.cap_cost_reduction_cents,lease.rebate_cents,lease.base_payment_cents,
    lease.source_type lease_source_type,lease.source_label lease_source_label,lease.source_reference lease_source_reference,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('stableKey','trade:'||snapshot.trade_appraisal_id,'appraisalVersion',snapshot.appraisal_version,'quoteAllowanceCents',snapshot.quote_allowance_cents,'payoffCents',snapshot.payoff_cents,'equityCents',snapshot.equity_cents,'quoteAdjustmentCents',snapshot.quote_adjustment_cents) ORDER BY snapshot.position,snapshot.id) FROM quote_trade_snapshots snapshot WHERE snapshot.organization_id=quote.organization_id AND snapshot.product_scenario_id=product.id),'[]'::jsonb) trades,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('stableKey','line:'||line.id,'position',line.position,'category',line.category::text,'quantity',line.quantity,'unitAmountCents',line.unit_amount_cents,'totalCents',line.total_cents) ORDER BY line.position,line.id) FROM deal_quote_lines line WHERE line.organization_id=quote.organization_id AND line.quote_id=quote.id),'[]'::jsonb) lines,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('stableKey','incentive:'||incentive.id,'amountCents',incentive.amount_cents,'eligibilityStatus',incentive.eligibility_status::text,'programId',incentive.program_id) ORDER BY incentive.id) FROM quote_incentive_applications incentive WHERE incentive.organization_id=quote.organization_id AND incentive.quote_id=quote.id),'[]'::jsonb) incentives,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('stableKey','product:'||backend.id,'sellCents',backend.sell_cents,'costCents',backend.cost_cents,'grossCents',backend.gross_cents,'productId',backend.product_id) ORDER BY backend.id) FROM quote_backend_product_snapshots backend WHERE backend.organization_id=quote.organization_id AND backend.quote_id=quote.id),'[]'::jsonb) optional_products
  FROM deal_quotes quote
  JOIN quote_product_scenarios product ON product.organization_id=quote.organization_id AND product.quote_id=quote.id AND product.stable_key='legacy:default-product'
  LEFT JOIN quote_commercial_terms commercial ON commercial.organization_id=quote.organization_id AND commercial.quote_id=quote.id
  LEFT JOIN quote_finance_terms finance ON finance.organization_id=quote.organization_id AND finance.quote_id=quote.id
  LEFT JOIN quote_lease_terms lease ON lease.organization_id=quote.organization_id AND lease.quote_id=quote.id
), fingerprinted AS (
  SELECT input.*,
    jsonb_build_object(
      'quoteVersion',input.version,
      'productScenario',jsonb_build_object('stableKey','legacy:default-product','subtotalCents',input.subtotal_cents,'feeCents',input.fee_cents,'taxCents',input.tax_cents,'discountCents',input.discount_cents,'totalCents',input.total_cents),
      'paymentScenario',jsonb_build_object('stableKey','legacy:'||input.purchase_type::text,'mode',input.purchase_type::text,'cashDownCents',COALESCE(input.cash_down_cents,0),'amountFinancedCents',input.amount_financed_cents,'aprBasisPoints',input.apr_basis_points,'financeTermMonths',input.finance_term_months,'leaseTermMonths',input.lease_term_months,'estimatedPaymentCents',input.estimated_payment_cents,'basePaymentCents',input.base_payment_cents),
      'trades',input.trades,'lines',input.lines,'incentives',input.incentives,'optionalProducts',input.optional_products,
      'sourceRevisions',jsonb_build_array(jsonb_build_object('stableKey','legacy-quote:'||input.id,'financeSourceReference',input.finance_source_reference,'leaseSourceReference',input.lease_source_reference)),
      'policies',jsonb_build_object('calculation','legacy-backfill-v1','rounding','legacy-preserved-v1','taxAndFee','legacy-quote-values-v1')
    ) payload
  FROM legacy_input input
)
INSERT INTO "quote_payment_scenarios" (
  id,organization_id,quote_id,product_scenario_id,stable_key,position,mode,calculation_status,
  term_months,apr_basis_points,cash_down_cents,amount_financed_cents,payment_cents,total_payment_cents,
  finance_charge_cents,mode_metadata,source_type,source_label,source_reference,
  calculation_policy_version,rounding_policy_version,calculation_fingerprint,created_by,created_at
)
SELECT 'qpy_'||substr(md5(input.organization_id||':'||input.id||':legacy:'||input.purchase_type::text),1,24),
  input.organization_id,input.id,input.product_scenario_id,'legacy:'||input.purchase_type::text,0,input.purchase_type::text,
  CASE WHEN input.purchase_type='finance' AND (input.finance_term_months IS NULL OR input.apr_basis_points IS NULL OR input.amount_financed_cents IS NULL OR input.estimated_payment_cents IS NULL) THEN 'incomplete' ELSE 'complete' END,
  CASE WHEN input.purchase_type='finance' THEN input.finance_term_months WHEN input.purchase_type='lease' THEN input.lease_term_months ELSE NULL END,
  CASE WHEN input.purchase_type='finance' THEN input.apr_basis_points ELSE NULL END,
  COALESCE(input.cash_down_cents,0),CASE WHEN input.purchase_type='finance' THEN input.amount_financed_cents ELSE NULL END,
  CASE WHEN input.purchase_type='finance' THEN input.estimated_payment_cents WHEN input.purchase_type='lease' THEN input.base_payment_cents WHEN input.purchase_type='cash' THEN input.total_cents ELSE NULL END,
  CASE WHEN input.purchase_type='finance' AND input.estimated_payment_cents IS NOT NULL AND input.finance_term_months IS NOT NULL THEN input.estimated_payment_cents*input.finance_term_months WHEN input.purchase_type='lease' THEN input.base_payment_cents*input.lease_term_months WHEN input.purchase_type='cash' THEN input.total_cents ELSE NULL END,
  CASE WHEN input.purchase_type='finance' AND input.estimated_payment_cents IS NOT NULL AND input.finance_term_months IS NOT NULL AND input.amount_financed_cents IS NOT NULL THEN GREATEST(input.estimated_payment_cents*input.finance_term_months-input.amount_financed_cents,0) ELSE NULL END,
  CASE WHEN input.purchase_type='lease' THEN jsonb_build_object('adjustedCapCostCents',input.adjusted_cap_cost_cents,'residualValueCents',input.residual_value_cents,'moneyFactorPpm',input.money_factor_ppm,'annualMileage',input.annual_mileage,'acquisitionFeeCents',input.acquisition_fee_cents,'capCostReductionCents',input.cap_cost_reduction_cents,'rebateCents',input.rebate_cents) ELSE '{}'::jsonb END,
  COALESCE(input.finance_source_type::text,input.lease_source_type::text,'legacy-quote'),
  COALESCE(input.finance_source_label,input.lease_source_label,'Legacy immutable Quote'),
  COALESCE(input.finance_source_reference,input.lease_source_reference,'deal_quote:'||input.id),
  'legacy-backfill-v1','legacy-preserved-v1',encode(digest(convert_to(input.payload::text,'UTF8'),'sha256'),'hex'),
  input.created_by,input.created_at
FROM fingerprinted input
ON CONFLICT (organization_id,product_scenario_id,stable_key) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM quote_vnext_legacy_baseline baseline
    JOIN deal_quotes quote ON quote.organization_id=baseline.organization_id AND quote.id=baseline.quote_id
    WHERE baseline.quote_hash<>md5(to_jsonb(quote)::text)
      OR baseline.line_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(line) ORDER BY line.id)::text FROM deal_quote_lines line WHERE line.organization_id=quote.organization_id AND line.quote_id=quote.id),'[]'))
      OR baseline.commercial_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_commercial_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]'))
      OR baseline.finance_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_finance_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]'))
      OR baseline.lease_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(terms))::text FROM quote_lease_terms terms WHERE terms.organization_id=quote.organization_id AND terms.quote_id=quote.id),'[]'))
      OR baseline.incentive_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_incentive_applications item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]'))
      OR baseline.backend_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_backend_product_snapshots item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]'))
      OR baseline.profitability_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM quote_profitability_snapshots item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]'))
      OR baseline.approval_hash<>md5(COALESCE((SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)::text FROM deal_quote_approvals item WHERE item.organization_id=quote.organization_id AND item.quote_id=quote.id),'[]'))
  ) THEN
    RAISE EXCEPTION 'Quote vNext backfill reconciliation failed: legacy financial or lifecycle evidence changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM quote_vnext_legacy_baseline baseline
    WHERE (SELECT count(*) FROM quote_product_scenarios product WHERE product.organization_id=baseline.organization_id AND product.quote_id=baseline.quote_id AND product.stable_key='legacy:default-product')<>1
       OR (SELECT count(*) FROM quote_payment_scenarios payment WHERE payment.organization_id=baseline.organization_id AND payment.quote_id=baseline.quote_id)<>1
  ) THEN
    RAISE EXCEPTION 'Quote vNext backfill reconciliation failed: legacy Quote scenario cardinality is invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM quote_vnext_legacy_baseline baseline
    LEFT JOIN quote_commercial_terms terms ON terms.organization_id=baseline.organization_id AND terms.quote_id=baseline.quote_id
    WHERE (SELECT count(*) FROM quote_trade_snapshots snapshot WHERE snapshot.organization_id=baseline.organization_id AND snapshot.quote_id=baseline.quote_id)
      <> CASE WHEN terms.trade_appraisal_id IS NULL THEN 0 ELSE 1 END
  ) THEN
    RAISE EXCEPTION 'Quote vNext backfill reconciliation failed: legacy Trade snapshot cardinality is invalid';
  END IF;
END $$;

CREATE FUNCTION prevent_quote_vnext_child_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quote scenario financial records are immutable; create a new Quote version or scenario';
END $$;
CREATE TRIGGER "quote_product_scenarios_immutable" BEFORE UPDATE OR DELETE ON "quote_product_scenarios" FOR EACH ROW EXECUTE FUNCTION prevent_quote_vnext_child_rewrite();
CREATE TRIGGER "quote_payment_scenarios_immutable" BEFORE UPDATE OR DELETE ON "quote_payment_scenarios" FOR EACH ROW EXECUTE FUNCTION prevent_quote_vnext_child_rewrite();
CREATE TRIGGER "quote_trade_snapshots_immutable" BEFORE UPDATE OR DELETE ON "quote_trade_snapshots" FOR EACH ROW EXECUTE FUNCTION prevent_quote_vnext_child_rewrite();

ALTER TABLE "quote_product_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_product_scenarios" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_product_scenarios_tenant_select" ON "quote_product_scenarios" FOR SELECT USING (organization_id=current_setting('app.organization_id',true));
CREATE POLICY "quote_product_scenarios_tenant_insert" ON "quote_product_scenarios" FOR INSERT WITH CHECK (organization_id=current_setting('app.organization_id',true));
ALTER TABLE "quote_payment_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_payment_scenarios" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_payment_scenarios_tenant_select" ON "quote_payment_scenarios" FOR SELECT USING (organization_id=current_setting('app.organization_id',true));
CREATE POLICY "quote_payment_scenarios_tenant_insert" ON "quote_payment_scenarios" FOR INSERT WITH CHECK (organization_id=current_setting('app.organization_id',true));
ALTER TABLE "quote_trade_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_trade_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_trade_snapshots_tenant_select" ON "quote_trade_snapshots" FOR SELECT USING (organization_id=current_setting('app.organization_id',true));
CREATE POLICY "quote_trade_snapshots_tenant_insert" ON "quote_trade_snapshots" FOR INSERT WITH CHECK (organization_id=current_setting('app.organization_id',true));

ALTER TABLE "deal_quotes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_status_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_commercial_terms" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_finance_terms" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_lease_terms" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_incentive_applications" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_backend_product_snapshots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "quote_profitability_snapshots" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_quote_approvals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "deals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "trade_appraisals" FORCE ROW LEVEL SECURITY;
