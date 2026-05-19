export const site = {
  name: 'Virai',
  title: 'Virai — Giải pháp AI cho doanh nghiệp',
  description:
    'Virai cung cấp các giải pháp trí tuệ nhân tạo: giám sát an toàn công trường, chăm sóc người cao tuổi, và trợ lý AI nội bộ cho doanh nghiệp.',
  url: 'https://virai.com.vn',
  locale: 'vi_VN',
};

const formspreeId =
  (import.meta.env.PUBLIC_FORMSPREE_FORM_ID as string | undefined)?.trim() ||
  'mykvzbla';

/** Formspree: đăng ký tại https://formspree.io → đặt PUBLIC_FORMSPREE_FORM_ID trên Cloudflare Pages */
export const contact = {
  email: 'tanvn@virai.com.vn',
  phone: '0966286480',
  address: 'Việt Nam',
  formEndpoint: formspreeId ? `https://formspree.io/f/${formspreeId}` : '',
  formReady: Boolean(formspreeId),
};

export const about = {
  title: 'Về Virai',
  paragraphs: [
    'Virai là đơn vị tiên phong trong lĩnh vực ứng dụng trí tuệ nhân tạo (AI) vào thực tiễn sản xuất, xây dựng và chăm sóc sức khỏe tại Việt Nam. Chúng tôi phát triển các giải pháp computer vision và large language model (LLM) giúp doanh nghiệp nâng cao hiệu quả vận hành, đảm bảo an toàn và tối ưu chi phí.',
    'Với đội ngũ kỹ sư AI giàu kinh nghiệm, Virai cam kết mang đến công nghệ thực tiễn, dễ triển khai và phù hợp với điều kiện vận hành tại Việt Nam — từ công trường xây dựng, cơ sở chăm sóc người cao tuổi đến văn phòng doanh nghiệp.',
  ],
};

export const visionMission = {
  title: 'Định hướng phát triển Virai',
  vision:
    'Trở thành đối tác công nghệ AI đáng tin cậy hàng đầu tại Việt Nam — nơi doanh nghiệp tìm thấy giải pháp an toàn công trường, chăm sóc sức khỏe và chuyển đổi số bền vững, có thể triển khai thực tế và mở rộng quy mô.',
  mission:
    'Ứng dụng trí tuệ nhân tạo vào đời sống và sản xuất một cách có trách nhiệm: bảo vệ con người tại công trường và trong gia đình, nâng cao năng suất doanh nghiệp, đồng thời tôn trọng quyền riêng tư và điều kiện vận hành tại Việt Nam.',
  teamImage: '/images/doingu/team-virai.jpg',
  values: [
    {
      title: 'Thực tiễn',
      description: 'Giải pháp triển khai được ngay tại công trường, nhà xưởng và văn phòng — không chỉ là demo.',
    },
    {
      title: 'An toàn & Tin cậy',
      description: 'Ưu tiên bảo vệ con người, dữ liệu và tuân thủ quy định trong mọi sản phẩm AI.',
    },
    {
      title: 'Đổi mới liên tục',
      description: 'Kết hợp computer vision, LLM và RAG để giải quyết bài toán thật của doanh nghiệp Việt.',
    },
    {
      title: 'Đồng hành dài hạn',
      description: 'Làm việc sát khách hàng từ khảo sát, pilot đến vận hành và mở rộng quy mô.',
    },
  ],
};

export interface TeamMember {
  name: string;
  role: string;
  photo: string;
  bio: string;
  focus: string[];
  featured?: boolean;
}

export const team: TeamMember[] = [
  {
    name: 'Vũ Nhật Tân',
    role: 'Founder & CEO',
    photo: '/images/doingu/vu-nhat-tan.png',
    bio: 'Định hướng chiến lược, phát triển kinh doanh và xây dựng tầm nhìn sản phẩm AI cho Virai — kết nối công nghệ với nhu cầu thực tế của thị trường Việt Nam.',
    focus: ['Chiến lược', 'Phát triển kinh doanh', 'Đối tác & triển khai'],
    featured: true,
  },
  {
    name: 'Nguyễn Trường Sơn',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/nguyen-truong-son.jpg',
    bio: 'Phụ trách sản phẩm camera AI chăm sóc người cao tuổi — phát hiện té ngã, bất thường sức khỏe và cảnh báo tức thời cho người thân, cơ sở y tế.',
    focus: ['Product', 'Healthcare AI', 'Camera chăm sóc người già'],
  },
  {
    name: 'Nguyễn Khắc Hiếu',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/nguyen-khac-hieu.png',
    bio: 'Thiết kế và dẫn dắt sản phẩm AI an toàn công trường — từ yêu cầu nghiệp vụ, nhận diện PPE đến trải nghiệm giám sát trên hiện trường.',
    focus: ['Product', 'Computer Vision', 'An toàn công trường'],
  },
  {
    name: 'Thái Bá Bảo',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/thai-ba-bao.png',
    bio: 'Dẫn dắt phát triển AI Agent, LLM và hệ thống tri thức nội bộ (RAG) — giúp doanh nghiệp tự động hóa quy trình làm việc.',
    focus: ['LLM & RAG', 'AI Agent', 'Doanh nghiệp số'],
  },
];

export const teamStats = [
  { value: '4', label: 'Đồng sáng lập' },
  { value: '3', label: 'Giải pháp AI lõi' },
  { value: '100%', label: 'Tập trung thị trường VN' },
];

export interface Solution {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  images: { src: string; alt: string }[];
  productLead?: string;
  reverse?: boolean;
}

export const solutions: Solution[] = [
  {
    id: 'construction',
    number: '01',
    title: 'Giám sát an toàn lao động thông minh tại công trường',
    subtitle: 'AI An toàn công trường',
    productLead: 'Nguyễn Khắc Hiếu',
    description:
      'Nâng cao hiệu quả vận hành, đảm bảo an toàn lao động và tối ưu quản lý nhân sự tại công trường xây dựng. Hệ thống computer vision phân tích video theo thời gian thực, phát hiện vi phạm và cảnh báo tức thì.',
    features: [
      'Theo dõi và cảnh báo an toàn lao động theo thời gian thực',
      'Phát hiện hành vi nguy hiểm hoặc vi phạm quy định an toàn',
      'Giám sát sử dụng đồ bảo hộ lao động (mũ, áo phản quang, dây an toàn...)',
      'Theo dõi hiệu suất và tiến độ làm việc của đội thi công',
      'Phân tích dữ liệu vận hành, tối ưu chi phí',
      'Gửi cảnh báo tức thời đến quản lý khi có sự cố',
    ],
    images: [
      {
        src: '/images/solutions/construction/PPE-Detection-1-1.png',
        alt: 'AI nhận diện mũ bảo hộ, áo phản quang và găng tay',
      },
      {
        src: '/images/solutions/construction/ppe-detection-construction.png',
        alt: 'Phát hiện helmet và vest trên công trường',
      },
      {
        src: '/images/solutions/construction/construction-site.jpg',
        alt: 'Công trường xây dựng được giám sát bằng AI',
      },
      {
        src: '/images/solutions/construction/worker-scaffold.jpg',
        alt: 'Công nhân làm việc trên công trường với đồ bảo hộ',
      },
    ],
  },
  {
    id: 'elderly-care',
    number: '02',
    title: 'Giám sát thông minh cho người cao tuổi',
    subtitle: 'AI Camera chăm sóc',
    productLead: 'Nguyễn Trường Sơn',
    description:
      'Hệ thống camera AI theo dõi người già tại nhà hoặc cơ sở chăm sóc, phát hiện sớm té ngã, co giật và các tình huống nguy hiểm — bảo vệ quyền riêng tư, không lưu trữ video.',
    features: [
      'Phát hiện té ngã theo thời gian thực và cảnh báo ngay lập tức',
      'Nhận diện co giật, bất thường về sức khỏe',
      'Giám sát hoạt động hàng ngày, phát hiện bất thường',
      'Thông báo đến người thân / nhân viên y tế qua ứng dụng',
      'Bảo vệ quyền riêng tư — chỉ phân tích hành vi, không lưu video',
      'Báo cáo sức khỏe và hoạt động định kỳ',
    ],
    images: [
      {
        src: '/images/solutions/elderly-care/elderly-home.jpg',
        alt: 'Người cao tuổi sinh hoạt tại nhà an toàn',
      },
      {
        src: '/images/solutions/elderly-care/smart-camera.jpg',
        alt: 'Camera thông minh giám sát trong nhà',
      },
      {
        src: '/images/solutions/elderly-care/elderly-care-home.jpg',
        alt: 'Chăm sóc người cao tuổi tại nhà',
      },
      {
        src: '/images/solutions/elderly-care/caregiver.jpg',
        alt: 'Nhân viên chăm sóc hỗ trợ người cao tuổi',
      },
    ],
    reverse: true,
  },
  {
    id: 'ai-agent',
    number: '03',
    title: 'Trợ lý AI thông minh cho doanh nghiệp',
    subtitle: 'AI Agent + LLM',
    description:
      'Chatbot AI tích hợp LLM, hỗ trợ tra cứu tài liệu nội bộ, tự động hóa quy trình và nâng cao năng suất làm việc. Triển khai on-premise hoặc private cloud, bảo mật dữ liệu doanh nghiệp.',
    features: [
      'Chatbot nội bộ tra cứu tài liệu, quy trình, chính sách công ty',
      'Hỏi đáp thông minh trên cơ sở tri thức doanh nghiệp (RAG)',
      'Tóm tắt báo cáo, email, tài liệu dài',
      'Hỗ trợ đa ngôn ngữ (Tiếng Việt, Tiếng Anh...)',
      'Tích hợp Slack, Microsoft Teams, Zalo OA',
      'Bảo mật dữ liệu — triển khai on-premise hoặc private cloud',
    ],
    images: [
      {
        src: '/images/solutions/ai-agent/chatbot-work.jpg',
        alt: 'Nhân viên làm việc với trợ lý AI trên máy tính',
      },
      {
        src: '/images/solutions/ai-agent/team-office.jpg',
        alt: 'Đội ngũ doanh nghiệp họp và làm việc nhóm',
      },
      {
        src: '/images/solutions/ai-agent/document-work.jpg',
        alt: 'Tra cứu tài liệu và tri thức nội bộ doanh nghiệp',
      },
      {
        src: '/images/solutions/ai-agent/ai-technology.jpg',
        alt: 'Công nghệ AI và machine learning',
      },
    ],
  },
];

export const navLinks = [
  { href: '#about', label: 'Giới thiệu' },
  { href: '#vision', label: 'Tầm nhìn' },
  { href: '#team', label: 'Đội ngũ' },
  { href: '#solutions', label: 'Giải pháp' },
  { href: '#contact', label: 'Liên hệ' },
];
