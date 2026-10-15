import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeInsights,
  durationBuckets,
  halvesTrend,
  normalizeCaption,
  openingPatterns,
} from '../src/lib/tiktok/insights.ts';
import type { VideoData } from '../src/lib/tiktok/provider.ts';

function video(partial: Partial<VideoData> & { tiktokId: string }): VideoData {
  return {
    url: `https://www.tiktok.com/@a/video/${partial.tiktokId}`,
    caption: null,
    durationS: 30,
    postedAt: 1_790_000_000,
    musicTitle: null,
    hashtags: [],
    coverUrl: null,
    views: 1000,
    likes: 50,
    comments: 5,
    shares: 5,
    saves: 5,
    ...partial,
  };
}

describe('normalizeCaption', () => {
  it('bỏ hashtag, emoji, link và hạ chữ thường', () => {
    assert.equal(normalizeCaption('Sự thật KHÔNG ai nói 😅 #review https://t.co/x @ban'), 'sự thật không ai nói');
  });
});

describe('openingPatterns', () => {
  it('gom video theo 4 chữ đầu và xếp theo trung vị view', () => {
    const videos = [
      video({ tiktokId: '1', caption: 'Sự thật không ai nói với bạn về review mỹ phẩm #a', views: 30_000 }),
      video({ tiktokId: '2', caption: 'Sự thật không ai nói với bạn về mẹo hay', views: 50_000 }),
      video({ tiktokId: '3', caption: 'Ai hỏi mình hoài nên làm luôn video unbox', views: 2_000 }),
      video({ tiktokId: '4', caption: 'Ai hỏi mình hoài nên làm luôn video review', views: 3_000 }),
      video({ tiktokId: '5', caption: 'vlog 4 #hust', views: 1_000 }),
    ];
    const patterns = openingPatterns(videos, 3_000);
    assert.equal(patterns.length, 2);
    assert.equal(patterns[0]!.template, 'sự thật không ai');
    assert.equal(patterns[0]!.count, 2);
    assert.equal(patterns[0]!.medianViews, 40_000);
    assert.ok(patterns[0]!.multiple > 13);
    assert.equal(patterns[0]!.example, 'Sự thật không ai nói với bạn về mẹo hay');
  });
});

describe('durationBuckets / halvesTrend', () => {
  it('chia độ dài thành nhóm và bỏ nhóm rỗng', () => {
    const videos = [
      video({ tiktokId: '1', durationS: 15, views: 100 }),
      video({ tiktokId: '2', durationS: 70, views: 900 }),
      video({ tiktokId: '3', durationS: 80, views: 700 }),
    ];
    const buckets = durationBuckets(videos, 700);
    assert.deepEqual(buckets.map((b) => [b.label, b.count, b.medianViews]), [
      ['dưới 20 giây', 1, 100],
      ['trên 60 giây', 2, 800],
    ]);
  });

  it('so nửa cũ với nửa mới', () => {
    const videos = Array.from({ length: 8 }, (_, i) =>
      video({ tiktokId: String(i), postedAt: 1_790_000_000 + i * 86_400, views: i < 4 ? 100 : 200 }),
    );
    const trend = halvesTrend(videos)!;
    assert.equal(trend.firstMedian, 100);
    assert.equal(trend.secondMedian, 200);
    assert.equal(trend.change, 1);
    assert.equal(halvesTrend(videos.slice(0, 5)), null);
  });
});

describe('computeInsights', () => {
  it('tính tầm với, hashtag cơ hội và video được lưu nhiều nhất', () => {
    const videos = [
      video({ tiktokId: '1', views: 1000, saves: 100, hashtags: ['hiem'] }),
      video({ tiktokId: '2', views: 5000, saves: 10, hashtags: ['hiem'] }),
      video({ tiktokId: '3', views: 1200, saves: 1, hashtags: ['fyp'] }),
      video({ tiktokId: '4', views: 900, saves: 1, hashtags: ['fyp'] }),
      video({ tiktokId: '5', views: 800, saves: 1, hashtags: ['fyp'] }),
      video({ tiktokId: '6', views: 700, saves: 1, hashtags: ['fyp'] }),
    ];
    const insights = computeInsights(
      videos,
      { displayName: null, avatarUrl: null, bio: null, followers: 500, following: 0, likesTotal: 0, videoCount: 6 },
      1_790_000_000 + 86_400 * 3,
    );
    assert.equal(insights.channelMedian, 950);
    assert.equal(insights.viewsPerFollower, 950 / 500);
    assert.equal(insights.mostSaved!.tiktokId, '1');
    assert.deepEqual(insights.tagOpportunities.map((t) => t.name), ['hiem']);
    assert.deepEqual(insights.tagNoise.map((t) => t.name), []);
    assert.equal(Math.round(insights.rhythm.daysSinceLast!), 3);
  });
});
