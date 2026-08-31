CREATE TABLE IF NOT EXISTS `qr_code_legacy_content` (
	`qr_code_id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
-- An older lossy 0003 may have already discarded non-Google legacy content.
INSERT OR IGNORE INTO `qr_code_legacy_content` (`qr_code_id`, `content`)
SELECT `id`, `raw_google_maps_url`
FROM `qr_codes`
WHERE `raw_google_maps_url` IS NOT NULL;
