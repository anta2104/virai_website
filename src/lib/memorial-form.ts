import { jdFromDate, parseIsoDate } from './lunar';
import { todayInVietnam } from './format';

export const SPECIES_OPTIONS = [
  { value: 'cho', label: 'Chó' },
  { value: 'meo', label: 'Mèo' },
  { value: 'khac', label: 'Loài khác' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'duc', label: 'Bạn trai' },
  { value: 'cai', label: 'Bạn gái' },
  { value: 'khong_ro', label: 'Không rõ' },
] as const;

export interface BasicInfo {
  petName: string;
  species: string;
  breed: string;
  gender: string;
  birthDate: string;
  deathDate: string;
}

export const EMPTY_BASIC_INFO: BasicInfo = {
  petName: '',
  species: 'cho',
  breed: '',
  gender: 'khong_ro',
  birthDate: '',
  deathDate: '',
};

/** Đọc và kiểm tra thông tin cơ bản từ form. Trả về cả giá trị để render lại. */
export function parseBasicInfo(form: FormData): { values: BasicInfo; error: string | null } {
  const values: BasicInfo = {
    petName: String(form.get('petName') ?? '').trim().slice(0, 60),
    species: String(form.get('species') ?? 'khac'),
    breed: String(form.get('breed') ?? '').trim().slice(0, 80),
    gender: String(form.get('gender') ?? 'khong_ro'),
    birthDate: String(form.get('birthDate') ?? '').trim(),
    deathDate: String(form.get('deathDate') ?? '').trim(),
  };

  if (!SPECIES_OPTIONS.some((option) => option.value === values.species)) {
    values.species = 'khac';
  }
  if (!GENDER_OPTIONS.some((option) => option.value === values.gender)) {
    values.gender = 'khong_ro';
  }

  const error = validateBasicInfo(values);
  return { values, error };
}

function validateBasicInfo(values: BasicInfo): string | null {
  if (!values.petName) return 'Bạn cho biết tên của bé nhé.';

  const birth = values.birthDate ? parseIsoDate(values.birthDate) : null;
  const death = values.deathDate ? parseIsoDate(values.deathDate) : null;

  if (values.birthDate && !birth) return 'Ngày sinh chưa đúng.';
  if (values.deathDate && !death) return 'Ngày bé rời đi chưa đúng.';

  const today = parseIsoDate(todayInVietnam())!;
  const todayJd = jdFromDate(today.day, today.month, today.year);

  if (birth && jdFromDate(birth.day, birth.month, birth.year) > todayJd) {
    return 'Ngày sinh không thể ở tương lai.';
  }
  if (death && jdFromDate(death.day, death.month, death.year) > todayJd) {
    return 'Ngày bé rời đi không thể ở tương lai.';
  }
  if (
    birth &&
    death &&
    jdFromDate(death.day, death.month, death.year) < jdFromDate(birth.day, birth.month, birth.year)
  ) {
    return 'Ngày bé rời đi phải sau ngày sinh.';
  }
  return null;
}

/** Chuyển sang dạng lưu vào D1 (chuỗi rỗng → null). */
export function toDbFields(values: BasicInfo) {
  return {
    petName: values.petName,
    species: values.species,
    breed: values.breed || null,
    gender: values.gender,
    birthDate: values.birthDate || null,
    deathDate: values.deathDate || null,
  };
}
