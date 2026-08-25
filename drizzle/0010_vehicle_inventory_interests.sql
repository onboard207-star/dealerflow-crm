CREATE TYPE "inventory_status" AS ENUM ('available','hold','sold','unavailable');
CREATE TYPE "vehicle_interest_role" AS ENUM ('primary','alternative','trade');
CREATE TYPE "vehicle_interest_status" AS ENUM ('active','inactive','purchased');

CREATE UNIQUE INDEX "leads_organization_customer_id_unique"
  ON "leads" ("organization_id", "customer_id", "id");

CREATE TABLE "vehicles" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "vin" text NOT NULL,
  "year" integer NOT NULL,
  "make" text NOT NULL,
  "model" text NOT NULL,
  "trim" text,
  "exterior_color" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicles_id_format" CHECK ("id" ~ '^veh_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "vehicles_vin_format" CHECK ("vin" ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  CONSTRAINT "vehicles_year_range" CHECK ("year" between 1886 and 2200)
);
CREATE UNIQUE INDEX "vehicles_organization_id_unique" ON "vehicles" ("organization_id", "id");
CREATE UNIQUE INDEX "vehicles_organization_vin_unique" ON "vehicles" ("organization_id", "vin");
CREATE INDEX "vehicles_organization_description_idx" ON "vehicles" ("organization_id", "year", "make", "model");

CREATE TABLE "inventory_units" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "location_id" text NOT NULL,
  "vehicle_id" text NOT NULL,
  "stock_number" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "inventory_status" DEFAULT 'available' NOT NULL,
  "list_price_cents" integer,
  "acquired_at" timestamptz,
  "sold_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_units_same_organization_location_fk" FOREIGN KEY ("organization_id", "location_id") REFERENCES "locations"("organization_id", "id"),
  CONSTRAINT "inventory_units_same_organization_vehicle_fk" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id"),
  CONSTRAINT "inventory_units_id_format" CHECK ("id" ~ '^inv_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "inventory_units_price_nonnegative" CHECK ("list_price_cents" is null or "list_price_cents" >= 0),
  CONSTRAINT "inventory_units_sold_consistency" CHECK ("status" <> 'sold' or "sold_at" is not null)
);
CREATE UNIQUE INDEX "inventory_units_organization_id_unique" ON "inventory_units" ("organization_id", "id");
CREATE UNIQUE INDEX "inventory_units_organization_stock_unique" ON "inventory_units" ("organization_id", "stock_number");
CREATE UNIQUE INDEX "inventory_units_organization_idempotency_unique" ON "inventory_units" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "inventory_units_active_vehicle_unique" ON "inventory_units" ("organization_id", "vehicle_id") WHERE "status" in ('available', 'hold');
CREATE INDEX "inventory_units_location_status_idx" ON "inventory_units" ("organization_id", "location_id", "status");

CREATE TABLE "lead_vehicle_interests" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "lead_id" text NOT NULL,
  "vehicle_id" text NOT NULL,
  "role" "vehicle_interest_role" NOT NULL,
  "status" "vehicle_interest_status" DEFAULT 'active' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "idempotency_key" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "vehicle_interests_same_lead_customer_fk" FOREIGN KEY ("organization_id", "customer_id", "lead_id") REFERENCES "leads"("organization_id", "customer_id", "id"),
  CONSTRAINT "vehicle_interests_same_organization_vehicle_fk" FOREIGN KEY ("organization_id", "vehicle_id") REFERENCES "vehicles"("organization_id", "id"),
  CONSTRAINT "vehicle_interests_id_format" CHECK ("id" ~ '^vhi_[a-z0-9_-]{6,64}$'),
  CONSTRAINT "vehicle_interests_priority_nonnegative" CHECK ("priority" >= 0),
  CONSTRAINT "vehicle_interests_notes_length" CHECK ("notes" is null or char_length("notes") <= 1000)
);
CREATE UNIQUE INDEX "vehicle_interests_organization_id_unique" ON "lead_vehicle_interests" ("organization_id", "id");
CREATE UNIQUE INDEX "vehicle_interests_organization_idempotency_unique" ON "lead_vehicle_interests" ("organization_id", "idempotency_key");
CREATE UNIQUE INDEX "vehicle_interests_active_role_unique" ON "lead_vehicle_interests" ("organization_id", "lead_id", "role", "priority") WHERE "status" = 'active';
CREATE INDEX "vehicle_interests_customer_idx" ON "lead_vehicle_interests" ("organization_id", "customer_id", "status");

ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_current_tenant_all" ON "vehicles" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "inventory_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_units" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_units_current_tenant_all" ON "inventory_units" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
ALTER TABLE "lead_vehicle_interests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_vehicle_interests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_interests_current_tenant_all" ON "lead_vehicle_interests" FOR ALL
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
