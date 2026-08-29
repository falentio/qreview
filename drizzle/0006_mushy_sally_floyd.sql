CREATE TABLE `qr_analytics_hourly` (
	`qr_code_id` text NOT NULL,
	`bucket_start` integer NOT NULL,
	`redirect_attempts` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`qr_code_id`, `bucket_start`),
	FOREIGN KEY (`qr_code_id`) REFERENCES `qr_codes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qr_analytics_hourly_bucket_start_idx` ON `qr_analytics_hourly` (`bucket_start`);