CREATE TABLE `creator_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`handle` text NOT NULL,
	`creator_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`input_hash` text,
	`metrics_json` text,
	`result_json` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `creator_analyses_user_idx` ON `creator_analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `creator_analyses_handle_idx` ON `creator_analyses` (`handle`,`status`);--> statement-breakpoint
CREATE TABLE `creators` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text DEFAULT 'tiktok' NOT NULL,
	`handle` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`bio` text,
	`followers` integer DEFAULT 0 NOT NULL,
	`following` integer DEFAULT 0 NOT NULL,
	`likes_total` integer DEFAULT 0 NOT NULL,
	`video_count` integer DEFAULT 0 NOT NULL,
	`fetched_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creators_platform_handle_unique` ON `creators` (`platform`,`handle`);--> statement-breakpoint
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_ledger_user_idx` ON `credit_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_reason_ref_unique` ON `credit_ledger` (`reason`,`ref_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`images_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `products_user_idx` ON `products` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `studio_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model_id` text NOT NULL,
	`product_id` text NOT NULL,
	`kind` text DEFAULT 'photoshoot' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`brief_json` text NOT NULL,
	`prompt` text,
	`provider` text DEFAULT 'workers-ai' NOT NULL,
	`result_keys_json` text,
	`cost_credits` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `virtual_models`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `studio_jobs_user_idx` ON `studio_jobs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `video_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `video_snapshots_video_idx` ON `video_snapshots` (`video_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`tiktok_id` text NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`duration_s` integer,
	`posted_at` integer,
	`music_title` text,
	`hashtags_json` text,
	`cover_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_creator_tiktok_unique` ON `videos` (`creator_id`,`tiktok_id`);--> statement-breakpoint
CREATE INDEX `videos_creator_posted_idx` ON `videos` (`creator_id`,`posted_at`);--> statement-breakpoint
CREATE TABLE `virtual_models` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tagline` text NOT NULL,
	`persona_json` text NOT NULL,
	`portrait_key` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_models_slug_unique` ON `virtual_models` (`slug`);--> statement-breakpoint
ALTER TABLE `orders` ADD `meta` text;--> statement-breakpoint
-- 5 người mẫu ảo mặc định. persona_json.promptBase viết tiếng Anh vì model sinh ảnh
-- bám prompt tiếng Anh tốt hơn; phần hiển thị cho người dùng là tiếng Việt.
INSERT INTO `virtual_models` (`id`, `slug`, `name`, `tagline`, `persona_json`, `sort_order`) VALUES
('vm_linh', 'linh', 'Linh', 'Chị gái mỹ phẩm, da đẹp tự nhiên',
 '{"age":26,"gender":"nữ","appearance":"Da sáng tự nhiên, tóc đen dài thẳng, gương mặt thanh tú, nụ cười nhẹ","style":"Tối giản, tông be và trắng, trang điểm nhẹ","voice":"Dịu dàng, tin cậy, như chị gái tư vấn","niches":["mỹ phẩm","chăm sóc da","làm đẹp"],"promptBase":"A 26-year-old Vietnamese woman with clear natural skin, long straight black hair, delicate features and a soft smile, minimal beige and white styling, light natural makeup"}', 1),
('vm_minh', 'minh', 'Minh', 'Anh bạn công nghệ, gọn gàng và rõ ràng',
 '{"age":29,"gender":"nam","appearance":"Tóc ngắn gọn, kính gọng mảnh, dáng cao vừa, gương mặt sáng","style":"Áo thun trơn hoặc sơ mi tối màu, phong cách tối giản","voice":"Rõ ràng, đi thẳng vào tính năng, hơi hài","niches":["công nghệ","phụ kiện điện thoại","đồ gia dụng thông minh"],"promptBase":"A 29-year-old Vietnamese man with short neat hair, thin-framed glasses, bright friendly face, wearing a plain dark t-shirt or dark shirt, minimalist tech-reviewer look"}', 2),
('vm_thao', 'thao', 'Thảo', 'Mẹ bỉm thông thái, ấm áp và thực tế',
 '{"age":32,"gender":"nữ","appearance":"Tóc búi thấp, gương mặt phúc hậu, nụ cười ấm","style":"Áo màu pastel, không gian nhà cửa sáng sủa","voice":"Thân tình, chia sẻ kinh nghiệm thật, không phô trương","niches":["mẹ và bé","gia dụng","thực phẩm"],"promptBase":"A 32-year-old Vietnamese mother with hair in a low bun, kind warm face and gentle smile, wearing soft pastel clothing, bright cozy home setting"}', 3),
('vm_khoa', 'khoa', 'Khoa', 'Bạn tập gym thân thiện, năng lượng tích cực',
 '{"age":27,"gender":"nam","appearance":"Vóc dáng săn chắc, tóc undercut, da rám nắng nhẹ, cười tươi","style":"Đồ thể thao, tông đen và xanh navy","voice":"Hào hứng, khích lệ, nói ngắn gọn","niches":["thể thao","thực phẩm bổ sung","đồ tập"],"promptBase":"A 27-year-old athletic Vietnamese man with an undercut hairstyle, lightly tanned skin, fit build, bright energetic smile, wearing black and navy sportswear"}', 4),
('vm_an', 'an', 'An', 'Gen Z thời trang, cá tính và bắt trend',
 '{"age":22,"gender":"nữ","appearance":"Tóc ngắn nhuộm nâu hạt dẻ, mắt to, gương mặt trẻ trung","style":"Street style, layer nhiều lớp, phụ kiện nổi bật","voice":"Nhanh, bắt trend, dùng từ của Gen Z vừa phải","niches":["thời trang","phụ kiện","giày dép"],"promptBase":"A 22-year-old Vietnamese woman with short chestnut-dyed hair, large expressive eyes, youthful face, Gen Z street style with layered outfits and bold accessories"}', 5);
