/**
 * Hai chế độ của một trang: tưởng niệm và sổ ký ức cho bé còn sống.
 *
 * Câu chữ gom hết vào đây vì đây là chỗ dễ sai nhất của tính năng này — dùng
 * nhầm từ ngữ tưởng niệm cho một bé đang sống là chuyện làm người ta khó chịu
 * thật sự. Trang nào cần đổi lời thì lấy từ `wordingFor()`, không tự viết lại.
 */

export type MemorialMode = 'memorial' | 'living';

export const MODE_OPTIONS = [
  {
    value: 'memorial',
    label: 'Bé đã về cầu vồng',
    hint: 'Trang tưởng niệm: có ngày 49, ngày giỗ theo âm lịch, thắp nến.',
  },
  {
    value: 'living',
    label: 'Bé vẫn đang bên tôi',
    hint: 'Sổ ký ức: ghi lại chuyện lớn lên. Sau này chuyển sang trang tưởng niệm được.',
  },
] as const;

export function isLiving(mode: string | null | undefined): boolean {
  return mode === 'living';
}

/** Đọc `mode` từ form, mọi giá trị lạ đều về 'memorial'. */
export function parseMode(value: unknown): MemorialMode {
  return value === 'living' ? 'living' : 'memorial';
}

export interface ModeWording {
  /** Dòng chữ nhỏ phía trên tên bé */
  eyebrow: string;
  /** Nhãn ô ngày mất trong form */
  deathDateLabel: string;
  /** Nút gửi tình cảm trên trang công khai */
  tributeLabel: string;
  tributeDoneLabel: string;
  /** Câu khi chưa ai gửi gì */
  emptyTribute: (petName: string) => string;
  /** Câu tổng kết số lượt gửi */
  tributeCount: (count: number) => string;
  /** Cùng câu trên nhưng để `{n}` — cho JS phía trình duyệt tự thay số */
  tributeCountTemplate: string;
}

const MEMORIAL_WORDING: ModeWording = {
  eyebrow: 'Tưởng nhớ',
  deathDateLabel: 'Ngày bé rời đi',
  tributeLabel: 'Thắp một ngọn nến',
  tributeDoneLabel: 'Bạn đã thắp nến hôm nay',
  emptyTribute: (petName) => `Chưa có ai thắp nến cho ${petName}. Bạn là người đầu tiên.`,
  tributeCount: (count) => `${count.toLocaleString('vi-VN')} ngọn nến đã được thắp`,
  tributeCountTemplate: '{n} ngọn nến đã được thắp',
};

const LIVING_WORDING: ModeWording = {
  eyebrow: 'Sổ ký ức',
  deathDateLabel: 'Ngày bé rời đi',
  tributeLabel: 'Gửi một chút yêu thương',
  tributeDoneLabel: 'Bạn đã gửi yêu thương hôm nay',
  emptyTribute: (petName) => `Chưa có ai gửi yêu thương cho ${petName}. Bạn là người đầu tiên.`,
  tributeCount: (count) => `${count.toLocaleString('vi-VN')} lượt gửi yêu thương`,
  tributeCountTemplate: '{n} lượt gửi yêu thương',
};

export function wordingFor(mode: string | null | undefined): ModeWording {
  return isLiving(mode) ? LIVING_WORDING : MEMORIAL_WORDING;
}
