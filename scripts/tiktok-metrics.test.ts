import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bestSlots, compactNumber, computeMetrics, vietnamSlot } from '../src/lib/tiktok/metrics.ts';
import { MockProvider } from '../src/lib/tiktok/provider.ts';
import type { VideoData } from '../src/lib/tiktok/provider.ts';

function video(partial: Partial<VideoData> & { tiktokId: string }): VideoData {
  return {
    url: `https://www.tiktok.com/@t/video/${partial.tiktokId}`,
    caption: null,
    durationS: 30,
    postedAt: 1_700_000_000,
    musicTitle: null,
    hashtags: [],
    coverUrl: null,
    views: 1000,
    likes: 50,
    comments: 5,
    shares: 3,
    saves: 2,
    ...partial,
  };
}

describe('computeMetrics', () => {
  it('tính tổng, trung vị và tỉ lệ tương tác', () => {
    const m = computeMetrics([
      video({ tiktokId: '1', views: 1000, likes: 100, comments: 10, shares: 5, saves: 5 }),
      video({ tiktokId: '2', views: 3000, likes: 300, comments: 30, shares: 15, saves: 15 }),
    ]);
    assert.equal(m.videoCount, 2);
    assert.equal(m.views.total, 4000);
    assert.equal(m.views.median, 2000);
    assert.equal(m.engagementRate, 480 / 4000);
    assert.equal(m.saveRate, 20 / 4000);
    assert.equal(m.shareRate, 20 / 4000);
  });

  it('chọn video nổi bật khi view vượt 2 lần trung vị', () => {
    const videos = [1, 2, 3, 4, 20].map((k) => video({ tiktokId: String(k), views: k * 1000 }));
    const m = computeMetrics(videos);
    assert.deepEqual(
      m.topVideos.map((v) => v.tiktokId),
      ['20'],
    );
    assert.ok(m.topVideos[0]!.multiple > 6);
  });

  it('đếm tần suất đăng theo tuần và hashtag', () => {
    const day = 86_400;
    const videos = Array.from({ length: 14 }, (_, i) =>
      video({ tiktokId: String(i), postedAt: 1_700_000_000 + i * day, hashtags: i % 2 ? ['a'] : ['a', 'b'] }),
    );
    const m = computeMetrics(videos);
    // 14 video trong 13 ngày ≈ 7,5 video/tuần
    assert.ok(m.postsPerWeek > 7 && m.postsPerWeek < 8, String(m.postsPerWeek));
    assert.equal(m.hashtags[0]?.name, 'a');
    assert.equal(m.hashtags[0]?.count, 14);
    assert.equal(m.hashtags[1]?.count, 7);
  });

  it('rỗng thì không chia cho 0', () => {
    const m = computeMetrics([]);
    assert.equal(m.engagementRate, 0);
    assert.equal(m.postsPerWeek, 0);
    assert.equal(m.avgDurationS, null);
    assert.equal(m.topVideos.length, 0);
  });
});

describe('vietnamSlot', () => {
  it('đổi epoch sang giờ và thứ Việt Nam', () => {
    // 2024-01-01T00:00:00Z = 07:00 thứ Hai giờ Việt Nam
    assert.deepEqual(vietnamSlot(1_704_067_200), { hour: 7, weekday: 1 });
    // 2024-01-06T17:30:00Z = 00:30 Chủ nhật 07/01 giờ Việt Nam
    assert.deepEqual(vietnamSlot(1_704_562_200), { hour: 0, weekday: 0 });
  });
});

describe('bestSlots', () => {
  it('ưu tiên khung có từ 3 video, bỏ khung ít mẫu dù trung vị cao', () => {
    const slots = bestSlots([
      { slot: 1, count: 1, medianViews: 99_999 },
      { slot: 2, count: 3, medianViews: 500 },
      { slot: 3, count: 2, medianViews: 900 },
      { slot: 4, count: 4, medianViews: 700 },
    ]);
    assert.deepEqual(slots.map((s) => s.slot), [4, 2]);
  });

  it('không khung nào đủ 3 video thì hạ chuẩn xuống 2', () => {
    const slots = bestSlots([
      { slot: 1, count: 1, medianViews: 99_999 },
      { slot: 3, count: 2, medianViews: 900 },
      { slot: 5, count: 2, medianViews: 300 },
    ]);
    assert.deepEqual(slots.map((s) => s.slot), [3, 5]);
  });
});

describe('compactNumber', () => {
  it('rút gọn theo kiểu Việt Nam', () => {
    assert.equal(compactNumber(950), '950');
    assert.equal(compactNumber(12_345), '12,3K');
    assert.equal(compactNumber(1_000), '1K');
    assert.equal(compactNumber(2_500_000), '2,5M');
  });
});

describe('MockProvider', () => {
  it('sinh dữ liệu lặp lại được theo handle', async () => {
    const provider = new MockProvider();
    const [a, b] = await Promise.all([provider.fetchVideos('demo', 30), provider.fetchVideos('demo', 30)]);
    assert.equal(a.length, 30);
    assert.deepEqual(a.map((v) => v.views), b.map((v) => v.views));
    const profile = await provider.fetchProfile('demo');
    assert.ok(profile.followers > 0);
    const m = computeMetrics(a);
    assert.ok(m.topVideos.length >= 1, 'mock nên có video nổi bật');
  });
});
