CREATE TABLE "inventory_unit_events"("id" text PRIMARY KEY,"organization_id" text NOT NULL,"inventory_unit_id" text NOT NULL,"kind" text NOT NULL,"from_status" "inventory_status","to_status" "inventory_status" NOT NULL,"old_price_cents" integer,"new_price_cents" integer,"reason" text,"occurred_at" timestamptz DEFAULT now() NOT NULL,"idempotency_key" text NOT NULL,"created_by" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,CONSTRAINT "inventory_unit_events_id_format" CHECK("id"~'^iue_[a-z0-9_-]{6,64}$'),CONSTRAINT "inventory_unit_events_kind" CHECK("kind" IN('created','pricing','status')),CONSTRAINT "inventory_unit_events_price_nonnegative" CHECK(("old_price_cents" IS NULL OR "old_price_cents">=0) AND ("new_price_cents" IS NULL OR "new_price_cents">=0)),CONSTRAINT "inventory_unit_events_reason_length" CHECK("reason" IS NULL OR length(trim("reason")) BETWEEN 1 AND 1000),CONSTRAINT "inventory_unit_events_same_inventory_fk" FOREIGN KEY("organization_id","inventory_unit_id") REFERENCES "inventory_units"("organization_id","id"));
CREATE UNIQUE INDEX "inventory_unit_events_organization_id_unique" ON "inventory_unit_events"("organization_id","id");CREATE UNIQUE INDEX "inventory_unit_events_idempotency_unique" ON "inventory_unit_events"("organization_id","idempotency_key");CREATE INDEX "inventory_unit_events_inventory_time_idx" ON "inventory_unit_events"("organization_id","inventory_unit_id","occurred_at");ALTER TABLE "inventory_unit_events" ENABLE ROW LEVEL SECURITY;ALTER TABLE "inventory_unit_events" FORCE ROW LEVEL SECURITY;CREATE POLICY "inventory_unit_events_current_tenant_select" ON "inventory_unit_events" FOR SELECT USING("organization_id"=nullif(current_setting('app.organization_id',true),''));CREATE POLICY "inventory_unit_events_current_tenant_insert" ON "inventory_unit_events" FOR INSERT WITH CHECK("organization_id"=nullif(current_setting('app.organization_id',true),''));

CREATE FUNCTION record_deal_inventory_status_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('hold','sold') THEN
    INSERT INTO inventory_unit_events(id,organization_id,inventory_unit_id,kind,from_status,to_status,old_price_cents,new_price_cents,reason,idempotency_key,created_by)
    VALUES('iue_'||md5(NEW.organization_id||NEW.id||NEW.status),NEW.organization_id,NEW.id,'status',OLD.status,NEW.status,OLD.list_price_cents,NEW.list_price_cents,'Deal-controlled inventory transition','deal-inventory:'||NEW.id||':'||NEW.status,NEW.updated_by);
  END IF;RETURN NEW;
END $$;
CREATE TRIGGER "inventory_deal_status_event" AFTER UPDATE OF status ON "inventory_units" FOR EACH ROW EXECUTE FUNCTION record_deal_inventory_status_event();

CREATE FUNCTION record_trade_inventory_creation_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.idempotency_key LIKE 'trade-acquisition:%' THEN
    INSERT INTO inventory_unit_events(id,organization_id,inventory_unit_id,kind,to_status,new_price_cents,reason,idempotency_key,created_by)
    VALUES('iue_'||md5(NEW.organization_id||NEW.id||'created'),NEW.organization_id,NEW.id,'created',NEW.status,NEW.list_price_cents,'Trade acquisition','create:'||NEW.idempotency_key,NEW.created_by);
  END IF;RETURN NEW;
END $$;
CREATE TRIGGER "inventory_trade_creation_event" AFTER INSERT ON "inventory_units" FOR EACH ROW EXECUTE FUNCTION record_trade_inventory_creation_event();
