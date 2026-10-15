-- Kênh chỉ có video giả (id mock: 19 số, bắt đầu 73, 7 số cuối là chỉ số 0000000-0000029)
-- thì chuyển sang platform 'mock' và giữ nguyên video.
UPDATE `creators` SET `platform` = 'mock'
WHERE `platform` = 'tiktok' AND `id` IN (
  SELECT `creator_id` FROM `videos`
  GROUP BY `creator_id`
  HAVING SUM(CASE WHEN `tiktok_id` GLOB '73??????????00000[0-9][0-9]' THEN 0 ELSE 1 END) = 0
);--> statement-breakpoint
-- Kênh thật mà có video giả lẫn vào thì xoá video giả (snapshot xoá theo khoá ngoại).
DELETE FROM `video_snapshots` WHERE `video_id` IN (
  SELECT v.`id` FROM `videos` v JOIN `creators` c ON c.`id` = v.`creator_id`
  WHERE c.`platform` = 'tiktok' AND v.`tiktok_id` GLOB '73??????????00000[0-9][0-9]'
);--> statement-breakpoint
DELETE FROM `videos` WHERE `id` IN (
  SELECT v.`id` FROM `videos` v JOIN `creators` c ON c.`id` = v.`creator_id`
  WHERE c.`platform` = 'tiktok' AND v.`tiktok_id` GLOB '73??????????00000[0-9][0-9]'
);
