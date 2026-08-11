CREATE TABLE `guestbook_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`memorial_id` text NOT NULL,
	`author_name` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ip_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`memorial_id`) REFERENCES `memorials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `guestbook_memorial_idx` ON `guestbook_entries` (`memorial_id`,`status`);--> statement-breakpoint
CREATE TABLE `memorials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`pet_name` text NOT NULL,
	`species` text DEFAULT 'khac' NOT NULL,
	`breed` text,
	`gender` text DEFAULT 'khong_ro' NOT NULL,
	`birth_date` text,
	`death_date` text,
	`birth_date_lunar` text,
	`death_date_lunar` text,
	`bio` text,
	`story_notes` text,
	`theme` text DEFAULT 'am-ap' NOT NULL,
	`cover_photo_id` text,
	`is_premium` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT 0 NOT NULL,
	`visit_count` integer DEFAULT 0 NOT NULL,
	`candle_count` integer DEFAULT 0 NOT NULL,
	`flower_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memorials_slug_unique` ON `memorials` (`slug`);--> statement-breakpoint
CREATE INDEX `memorials_user_idx` ON `memorials` (`user_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`memorial_id` text,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`payment_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`shipping_info` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memorial_id`) REFERENCES `memorials`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_payment_code_unique` ON `orders` (`payment_code`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`memorial_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text DEFAULT 'image/jpeg' NOT NULL,
	`width` integer,
	`height` integer,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`memorial_id`) REFERENCES `memorials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_memorial_idx` ON `photos` (`memorial_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`memorial_id` text NOT NULL,
	`type` text NOT NULL,
	`next_date` text NOT NULL,
	`label` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`last_sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`memorial_id`) REFERENCES `memorials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`next_date`,`enabled`);--> statement-breakpoint
CREATE INDEX `reminders_memorial_idx` ON `reminders` (`memorial_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);