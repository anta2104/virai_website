import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeHandle } from '../src/lib/tiktok/handle.ts';

describe('normalizeHandle', () => {
  it('nhận link đầy đủ, link thiếu giao thức, @handle và handle trần', () => {
    assert.equal(normalizeHandle('https://www.tiktok.com/@Shop.ABC?lang=vi'), 'shop.abc');
    assert.equal(normalizeHandle('tiktok.com/@abc_1/video/7301234567'), 'abc_1');
    assert.equal(normalizeHandle('  @MyHandle '), 'myhandle');
    assert.equal(normalizeHandle('myhandle'), 'myhandle');
  });

  it('từ chối đầu vào không hợp lệ', () => {
    assert.equal(normalizeHandle(''), null);
    assert.equal(normalizeHandle('a'), null);
    assert.equal(normalizeHandle('https://www.tiktok.com/discover'), null);
    assert.equal(normalizeHandle('có dấu'), null);
    assert.equal(normalizeHandle('abc.'), null);
    assert.equal(normalizeHandle('<script>'), null);
  });
});
