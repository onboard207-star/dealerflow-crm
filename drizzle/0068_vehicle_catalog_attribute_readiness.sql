ALTER TABLE "vehicle_catalog_attributes"
  ADD COLUMN "readiness" text NOT NULL DEFAULT 'needs-review';

UPDATE "vehicle_catalog_attributes" attribute
SET "readiness" = COALESCE(NULLIF(node.value->>'readiness',''),'needs-review')
FROM "vehicle_catalog_releases" release
CROSS JOIN LATERAL jsonb_array_elements(release."manifest"->'nodes') node(value)
WHERE release."id"=attribute."release_id"
  AND upper(trim(node.value->>'stableKey'))=attribute."stable_key"
  AND COALESCE(NULLIF(node.value->>'readiness',''),'needs-review') IN
    ('needs-review','in-progress','verified','pilot-ready','blocked','not-applicable');

ALTER TABLE "vehicle_catalog_attributes"
  ADD CONSTRAINT "vehicle_catalog_attributes_readiness"
  CHECK ("readiness" IN ('needs-review','in-progress','verified','pilot-ready','blocked','not-applicable'));
