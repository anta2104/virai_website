/**
 * Kiểm tra dựng prompt studio — chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPhotoshootPrompt,
  buildPortraitPrompt,
  findBlockedKeyword,
  sanitizeFragment,
  scenePrompt,
} from '../src/lib/studio/prompt.ts';

const persona = { promptBase: 'A 26-year-old Vietnamese woman with long black hair', style: 'minimal beige' };
const product = { name: 'Serum Bright 30ml', description: 'chai thủy tinh hổ phách', category: 'Mỹ phẩm' };

describe('buildPhotoshootPrompt', () => {
  it('giữ nguyên mô tả người mẫu và tên sản phẩm', () => {
    const prompt = buildPhotoshootPrompt(persona, product, { scene: 'studio', index: 0 });
    assert.ok(prompt.startsWith(persona.promptBase));
    assert.ok(prompt.includes('Serum Bright 30ml'));
    assert.ok(prompt.includes('clean studio backdrop'));
    assert.ok(prompt.includes('no watermark'));
  });

  it('mỗi ảnh một góc máy khác nhau', () => {
    const first = buildPhotoshootPrompt(persona, product, { scene: 'studio', index: 0 });
    const second = buildPhotoshootPrompt(persona, product, { scene: 'studio', index: 1 });
    assert.notEqual(first, second);
  });

  it('bối cảnh tự nhập được dùng nguyên văn sau khi làm sạch', () => {
    assert.equal(scenePrompt('bàn trang điểm\n cạnh cửa sổ'), 'bàn trang điểm cạnh cửa sổ');
    assert.equal(scenePrompt('cafe'), 'bright minimalist cafe, wooden table, natural light');
  });

  it('cắt chuỗi dài và bỏ xuống dòng để không phá prompt', () => {
    const long = 'a'.repeat(500);
    assert.equal(sanitizeFragment(long, 100).length, 100);
    assert.equal(sanitizeFragment('  x \r\n y  '), 'x y');
  });
});

describe('buildPortraitPrompt', () => {
  it('không chứa sản phẩm, có chỉ dẫn chân dung', () => {
    const prompt = buildPortraitPrompt(persona);
    assert.ok(prompt.includes('portrait'));
    assert.ok(!prompt.includes('product'));
  });
});

describe('findBlockedKeyword', () => {
  it('chặn nhóm sản phẩm không nhận', () => {
    assert.equal(findBlockedKeyword('Rượu vang Đà Lạt'), 'rượu');
    assert.equal(findBlockedKeyword('Tinh dầu', null, 'quảng cáo casino online'), 'casino');
  });

  it('cho qua sản phẩm bình thường', () => {
    assert.equal(findBlockedKeyword('Serum vitamin C', 'chai 30ml', 'tông ấm'), null);
    // "bia" là tiền tố của nhiều từ khác (biang, biển) — chỉ chặn khi đứng riêng
    assert.equal(findBlockedKeyword('Biển quảng cáo mini'), null);
  });
});

describe('findBlockedKeyword khớp theo ranh giới từ', () => {
  it('không chặn oan sản phẩm thường chứa chuỗi con', () => {
    assert.equal(findBlockedKeyword('Áo thun unisex basic'), null);
    assert.equal(findBlockedKeyword('Tripod điện thoại mini'), null);
    assert.equal(findBlockedKeyword('Bia đá trang trí'), 'bia');
  });

  it('vẫn chặn từ khoá đứng riêng', () => {
    assert.equal(findBlockedKeyword('Rượu vang Đà Lạt'), 'rượu');
    assert.equal(findBlockedKeyword('pod hút 1 lần'), 'pod');
    assert.equal(findBlockedKeyword('phim 18+ hot'), '18+');
  });
});
