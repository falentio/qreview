PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `qr_codes_new` (
	`id` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL,
	`slug` text NOT NULL,
	`raw_google_maps_url` text,
	`google_place_id` text,
	`canonical_review_url` text,
	`organization_id` text,
	`created_by_id` text NOT NULL,
	`claimed_by_id` text,
	`claimed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `qr_codes_new` (
	`id`,
	`alias`,
	`slug`,
	`raw_google_maps_url`,
	`google_place_id`,
	`canonical_review_url`,
	`organization_id`,
	`created_by_id`,
	`claimed_by_id`,
	`claimed_at`,
	`created_at`,
	`updated_at`,
	`deleted_at`
)
SELECT
	`id`,
	CASE WHEN length(trim(`content`)) > 0 THEN substr(trim(`content`), 1, 120) ELSE 'Imported QR code' END,
	lower(substr(hex(randomblob(5)), 1, 10)),
	CASE WHEN trim(`content`) LIKE 'https://google.com/maps%'
		OR trim(`content`) LIKE 'https://www.google.com/maps%'
		OR trim(`content`) LIKE 'https://maps.google.com/%'
		THEN trim(`content`) ELSE NULL END,
	NULL,
	NULL,
	NULL,
	'migration',
	NULL,
	NULL,
	`created_at`,
	`created_at`,
	NULL
FROM `qr_codes`;
--> statement-breakpoint
DROP TABLE `qr_codes`;
--> statement-breakpoint
ALTER TABLE `qr_codes_new` RENAME TO `qr_codes`;
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_codes_slug_unique` ON `qr_codes` (`slug`);
--> statement-breakpoint
CREATE INDEX `qr_codes_organizationId_idx` ON `qr_codes` (`organization_id`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;
