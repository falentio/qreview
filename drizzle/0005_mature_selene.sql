ALTER TABLE `qr_codes` ADD `claimable` integer DEFAULT true NOT NULL;
--> statement-breakpoint
-- The default keeps legacy inserts compatible; current runtime writes may override it.
-- Existing organization rows are owned; null organizations are imported/orphaned.
UPDATE `qr_codes`
SET `claimable` = CASE WHEN `organization_id` IS NULL THEN 1 ELSE 0 END;
