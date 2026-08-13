/** Kiểm nội dung email giao dịch — chạy bằng: npm test */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  orderPaidEmail,
  orderShippedEmail,
  passwordResetEmail,
} from '../src/lib/email.ts';

describe('orderPaidEmail', () => {
  const base = {
    ownerName: 'Lan',
    petName: 'Miu',
    amountText: '119.000₫',
    paymentCode: 'SEVQR7K2M',
    memorialUrl: 'https://virai.com.vn/be/miu',
    physical: false,
  };

  it('nêu đủ tên bé, số tiền và mã đơn', () => {
    const mail = orderPaidEmail(base);
    for (const part of ['Miu', '119.000₫', 'SEVQR7K2M', 'Lan']) {
      assert.ok(mail.html.includes(part), `thiếu "${part}" trong HTML`);
      assert.ok(mail.text.includes(part), `thiếu "${part}" trong bản text`);
    }
    assert.equal(mail.subject, 'Đã nhận thanh toán — Premium đã kích hoạt cho bé Miu');
  });

  it('đơn thường không hứa gửi thẻ', () => {
    const mail = orderPaidEmail(base);
    assert.ok(!mail.html.includes('Thẻ QR khắc sẵn'));
    assert.ok(!mail.text.includes('Thẻ QR khắc sẵn'));
  });

  it('đơn combo mới hẹn ngày gửi thẻ', () => {
    const mail = orderPaidEmail({ ...base, physical: true, shippingDays: 5 });
    assert.ok(mail.html.includes('<strong>5 ngày</strong>'));
    assert.ok(mail.text.includes('khoảng 5 ngày'));
  });

  it('không vỡ khi đơn chưa gắn trang kỷ niệm', () => {
    const mail = orderPaidEmail({ ...base, petName: null, memorialUrl: null });
    assert.equal(mail.subject, 'Đã nhận thanh toán — Premium đã kích hoạt');
    assert.ok(!mail.html.includes('undefined'));
    assert.ok(!mail.text.includes('null'));
  });

  it('thoát HTML trong tên do người dùng nhập', () => {
    const mail = orderPaidEmail({ ...base, ownerName: '<script>x</script>' });
    assert.ok(!mail.html.includes('<script>'));
    assert.ok(mail.html.includes('&lt;script&gt;'));
  });
});

describe('orderShippedEmail', () => {
  it('nhắc lại địa chỉ đã lưu để khách đối chiếu', () => {
    const mail = orderShippedEmail({
      ownerName: 'Lan',
      petName: 'Miu',
      paymentCode: 'SEVQR7K2M',
      recipientName: 'Nguyễn Thị Lan',
      address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
      materialLabel: 'Thẻ kim loại',
    });
    assert.ok(mail.html.includes('Nguyễn Thị Lan'));
    assert.ok(mail.html.includes('12 Nguyễn Huệ'));
    assert.ok(mail.html.includes('Thẻ kim loại'));
    assert.equal(mail.subject, 'Thẻ kỷ niệm của bé Miu đã được gửi đi');
  });

  it('không có địa chỉ thì bỏ hẳn khối đó, không in chỗ trống', () => {
    const mail = orderShippedEmail({
      ownerName: 'Lan',
      petName: null,
      paymentCode: 'SEVQR7K2M',
    });
    assert.ok(!mail.html.includes('Gửi tới:'));
    assert.ok(!mail.html.includes('undefined'));
    assert.ok(!mail.text.includes('undefined'));
  });
});

describe('passwordResetEmail', () => {
  it('đưa link vào cả nút bấm lẫn dạng chữ để dán tay', () => {
    const url = 'https://virai.com.vn/dat-lai-mat-khau?token=abc123';
    const mail = passwordResetEmail({ userName: 'Lan', resetUrl: url, minutesValid: 60 });
    assert.ok(mail.html.includes(`href="${url}"`), 'thiếu link ở nút');
    assert.ok(mail.text.includes(url), 'thiếu link ở bản text');
    assert.ok(mail.html.includes('60 phút'));
    assert.ok(mail.html.includes('bỏ qua thư này'), 'phải trấn an người không yêu cầu');
  });
});
