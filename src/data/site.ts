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
    photo: '/images/doingu/Nguyễn Trường Sơn_1.jpg',
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

export type Locale = 'vi' | 'en';

export const hero = {
  eyebrow: 'Giải pháp AI cho doanh nghiệp Việt Nam',
  titlePrefix: 'Virai',
  titleSuffix: '— Đồng hành chuyển đổi số bằng trí tuệ nhân tạo',
  description:
    'Giám sát an toàn công trường, chăm sóc người cao tuổi và trợ lý AI nội bộ — ba giải pháp thực tiễn, dễ triển khai, phù hợp điều kiện vận hành tại Việt Nam.',
  primaryCta: 'Khám phá giải pháp',
  secondaryCta: 'Liên hệ tư vấn',
  stats: [
    { label: 'Giải pháp AI', value: '3+' },
    { label: 'Triển khai', value: 'On-premise & Cloud' },
    { label: 'Hỗ trợ', value: '24/7' },
  ],
};

export const aboutHighlights = [
  {
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    title: 'An toàn & Tin cậy',
    desc: 'Giải pháp được thiết kế cho môi trường sản xuất và chăm sóc sức khỏe thực tế.',
  },
  {
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
    title: 'Triển khai nhanh',
    desc: 'Tích hợp linh hoạt với hệ thống camera và hạ tầng hiện có của doanh nghiệp.',
  },
  {
    icon: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
    title: 'Bảo mật dữ liệu',
    desc: 'Hỗ trợ triển khai on-premise, private cloud — dữ liệu không rời khỏi doanh nghiệp.',
  },
];

export const ui = {
  solutionPrefix: 'Giải pháp',
  solutionCta: 'Tư vấn giải pháp này',
  productLead: 'Product Lead',
  visionLabel: 'Tầm nhìn',
  missionLabel: 'Sứ mệnh',
  teamEyebrow: 'Đội ngũ',
  teamTitle: 'Những người đứng sau Virai',
  teamDescription:
    'Bốn đồng sáng lập — kết hợp kinh nghiệm sản phẩm, AI và triển khai thực tế — cùng xây dựng hệ sinh thái giải pháp từ công trường, chăm sóc sức khỏe đến trợ lý AI doanh nghiệp.',
  founderLabel: 'Founder',
  coFounderLabel: 'Co-Founder',
  teamImageAlt: 'Đội ngũ Virai trong chuyến công tác',
  teamImageTitle: 'Khoảnh khắc đội ngũ Virai',
  teamImageDescription: 'Cùng nhau xây dựng công nghệ AI phục vụ doanh nghiệp và cộng đồng Việt Nam.',
  contactEyebrow: 'Liên hệ',
  contactTitle: 'Sẵn sàng tư vấn giải pháp cho doanh nghiệp bạn',
  contactDescription:
    'Để lại thông tin, đội ngũ Virai sẽ liên hệ trong vòng 24 giờ làm việc để tư vấn giải pháp phù hợp nhất.',
  phoneLabel: 'Điện thoại',
  addressLabel: 'Địa chỉ',
  formSuccess: 'Cảm ơn bạn! Chúng tôi đã nhận được tin nhắn và sẽ phản hồi sớm.',
  formError: 'Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin hoặc gửi email trực tiếp.',
  formPending:
    'Form đang chờ cấu hình Formspree trên server. Bạn vẫn có thể gửi yêu cầu qua nút email bên dưới.',
  nameLabel: 'Họ và tên',
  namePlaceholder: 'Nguyễn Văn A',
  emailPlaceholder: 'email@congty.com',
  phonePlaceholder: '0901 234 567',
  solutionLabel: 'Giải pháp quan tâm',
  solutionPlaceholder: '-- Chọn giải pháp --',
  solutionOptions: [
    { value: 'construction', label: 'AI An toàn công trường' },
    { value: 'elderly-care', label: 'AI Camera chăm sóc người cao tuổi' },
    { value: 'ai-agent', label: 'AI Agent + LLM nội bộ' },
    { value: 'other', label: 'Khác / Tư vấn chung' },
  ],
  messageLabel: 'Nội dung',
  messagePlaceholder: 'Mô tả nhu cầu của doanh nghiệp bạn...',
  submitLabel: 'Gửi yêu cầu tư vấn',
  submittingLabel: 'Đang gửi...',
  directEmailLabel: 'Hoặc gửi email trực tiếp',
  emailSubject: 'Yêu cầu tư vấn giải pháp Virai',
  fallbackEmailSubject: 'Yêu cầu tư vấn Virai',
  validationName: 'Vui lòng nhập họ tên (ít nhất 2 ký tự).',
  validationEmail: 'Email không hợp lệ.',
  validationPhone: 'Số điện thoại không hợp lệ (VD: 0901234567).',
  validationMessage: 'Nội dung cần ít nhất 10 ký tự.',
  submitFailure: 'Không gửi được. Vui lòng thử lại hoặc gửi email trực tiếp đến chúng tôi.',
  footerLinksTitle: 'Liên kết',
  footerContactTitle: 'Liên hệ',
  footerRights: 'Bảo lưu mọi quyền.',
  navCta: 'Liên hệ tư vấn',
  mobileMenuLabel: 'Menu di động',
  openMenuLabel: 'Mở menu',
};

export const siteEn = {
  ...site,
  title: 'Virai — AI Solutions for Businesses',
  description:
    'Virai provides three core AI solutions: construction safety monitoring, elderly care camera systems, and enterprise AI Agents for knowledge automation.',
  locale: 'en_US',
};

export const contactEn = {
  ...contact,
  address: 'Vietnam',
};

export const aboutEn = {
  title: 'About Virai',
  paragraphs: [
    'Virai is an AI technology company focused on turning artificial intelligence into practical solutions for production, construction, healthcare, and enterprise operations. We develop computer vision and large language model (LLM) products that help organizations improve efficiency, safety, and decision-making.',
    'With an engineering team experienced in AI product development, Virai provides solutions that are practical, easy to deploy, and aligned with real operating conditions — from construction sites and elderly care facilities to modern business offices.',
  ],
};

export const visionMissionEn = {
  title: 'Virai Direction',
  vision:
    'To become a trusted AI technology partner in Vietnam, helping organizations adopt practical, scalable, and responsible AI solutions for safety, healthcare, and digital transformation.',
  mission:
    'To apply artificial intelligence responsibly in daily life and business operations: protecting people on construction sites and at home, increasing enterprise productivity, and respecting privacy and local deployment conditions.',
  teamImage: visionMission.teamImage,
  values: [
    {
      title: 'Practical',
      description: 'Solutions designed for real construction sites, care environments, factories, and offices.',
    },
    {
      title: 'Safe & Reliable',
      description: 'We prioritize people, data protection, and operational reliability in every AI product.',
    },
    {
      title: 'Continuous Innovation',
      description: 'We combine computer vision, LLMs, and RAG to solve real business problems.',
    },
    {
      title: 'Long-Term Partnership',
      description: 'We work closely with customers from discovery and pilot to operation and scale.',
    },
  ],
};

export const teamEn: TeamMember[] = [
  {
    name: 'Vu Nhat Tan',
    role: 'Founder & CEO',
    photo: '/images/doingu/vu-nhat-tan.png',
    bio: 'Leads company strategy, business development, and Virai’s AI product vision — connecting technology with real market needs.',
    focus: ['Strategy', 'Business development', 'Partnerships & deployment'],
    featured: true,
  },
  {
    name: 'Nguyen Truong Son',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/Nguyễn Trường Sơn_1.jpg',
    bio: 'Leads the AI camera product for elderly care, including fall detection, health anomaly alerts, and real-time notifications for families and caregivers.',
    focus: ['Product', 'Healthcare AI', 'Elderly care camera'],
  },
  {
    name: 'Nguyen Khac Hieu',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/nguyen-khac-hieu.png',
    bio: 'Designs and leads the construction safety AI product, from operational requirements and PPE detection to on-site monitoring experience.',
    focus: ['Product', 'Computer Vision', 'Construction safety'],
  },
  {
    name: 'Thai Ba Bao',
    role: 'Co-Founder & Product Lead',
    photo: '/images/doingu/thai-ba-bao.png',
    bio: 'Leads AI Agent, LLM, and enterprise knowledge systems (RAG) that help organizations automate knowledge-intensive workflows.',
    focus: ['LLM & RAG', 'AI Agent', 'Digital enterprise'],
  },
];

export const teamStatsEn = [
  { value: '4', label: 'Co-founders' },
  { value: '3', label: 'Core AI solutions' },
  { value: '100%', label: 'Focused on Vietnam market' },
];

export const solutionsEn: Solution[] = [
  {
    id: 'construction',
    number: '01',
    title: 'Intelligent Construction Safety Monitoring',
    subtitle: 'Construction Safety AI',
    productLead: 'Nguyen Khac Hieu',
    description:
      'Improve site operations, workplace safety, and workforce management with real-time computer vision. The system analyzes video streams, detects safety violations, and sends instant alerts to supervisors.',
    features: [
      'Real-time workplace safety monitoring and alerts',
      'Detection of dangerous behavior and safety rule violations',
      'PPE monitoring, including helmets, reflective vests, and safety harnesses',
      'Workforce activity and progress monitoring',
      'Operational analytics to optimize cost and performance',
      'Instant alerts to managers when incidents occur',
    ],
    images: solutions[0].images,
  },
  {
    id: 'elderly-care',
    number: '02',
    title: 'Smart Monitoring for Elderly Care',
    subtitle: 'AI Care Camera',
    productLead: 'Nguyen Truong Son',
    description:
      'An AI camera system for homes and care facilities that detects falls, seizures, and dangerous situations early while protecting privacy and avoiding video storage.',
    features: [
      'Real-time fall detection with immediate alerts',
      'Recognition of seizures and health-related anomalies',
      'Daily activity monitoring and abnormal behavior detection',
      'Notifications to family members or medical staff through an app',
      'Privacy-first design — behavior analysis without video storage',
      'Periodic health and activity reports',
    ],
    images: solutions[1].images,
    reverse: true,
  },
  {
    id: 'ai-agent',
    number: '03',
    title: 'AI Agent for Enterprise Knowledge and Automation',
    subtitle: 'AI Agent + LLM',
    description:
      'An LLM-powered AI assistant that helps employees search internal documents, automate workflows, and improve productivity. It can be deployed on-premise or in a private cloud to protect enterprise data.',
    features: [
      'Internal chatbot for documents, processes, and company policies',
      'Intelligent Q&A on enterprise knowledge bases (RAG)',
      'Summarization of reports, emails, and long documents',
      'Multilingual support, including Vietnamese and English',
      'Integration with Slack, Microsoft Teams, and Zalo OA',
      'Data security through on-premise or private cloud deployment',
    ],
    images: solutions[2].images,
  },
];

export const navLinksEn = [
  { href: '#about', label: 'About' },
  { href: '#vision', label: 'Vision' },
  { href: '#team', label: 'Team' },
  { href: '#solutions', label: 'Solutions' },
  { href: '#contact', label: 'Contact' },
];

export const heroEn = {
  eyebrow: 'AI solutions for modern businesses',
  titlePrefix: 'Virai',
  titleSuffix: '— Practical AI for digital transformation',
  description:
    'Virai provides three core AI solutions: construction safety monitoring, elderly care camera systems, and enterprise AI Agents for knowledge automation.',
  primaryCta: 'Explore solutions',
  secondaryCta: 'Contact us',
  stats: [
    { label: 'AI solutions', value: '3+' },
    { label: 'Deployment', value: 'On-premise & Cloud' },
    { label: 'Support', value: '24/7' },
  ],
};

export const aboutHighlightsEn = [
  {
    icon: aboutHighlights[0].icon,
    title: 'Safe & Reliable',
    desc: 'Built for real production, construction, and care environments.',
  },
  {
    icon: aboutHighlights[1].icon,
    title: 'Fast Deployment',
    desc: 'Flexible integration with existing camera systems and enterprise infrastructure.',
  },
  {
    icon: aboutHighlights[2].icon,
    title: 'Data Security',
    desc: 'Supports on-premise and private cloud deployment so business data stays under control.',
  },
];

export const uiEn = {
  solutionPrefix: 'Solution',
  solutionCta: 'Request consultation',
  productLead: 'Product Lead',
  visionLabel: 'Vision',
  missionLabel: 'Mission',
  teamEyebrow: 'Team',
  teamTitle: 'The People Behind Virai',
  teamDescription:
    'Four co-founders combine product, AI, and real-world deployment experience to build solutions for construction sites, healthcare, and enterprise AI workflows.',
  founderLabel: 'Founder',
  coFounderLabel: 'Co-Founder',
  teamImageAlt: 'Virai team during a company trip',
  teamImageTitle: 'Virai team moment',
  teamImageDescription: 'Building AI technology for businesses and communities together.',
  contactEyebrow: 'Contact',
  contactTitle: 'Ready to discuss AI solutions for your business?',
  contactDescription:
    'Leave your information and the Virai team will contact you within 24 business hours to recommend the right solution.',
  phoneLabel: 'Phone',
  addressLabel: 'Address',
  formSuccess: 'Thank you! We have received your message and will respond soon.',
  formError: 'Something went wrong. Please check your information or email us directly.',
  formPending:
    'The form is waiting for Formspree configuration on the server. You can still send a request by email below.',
  nameLabel: 'Full name',
  namePlaceholder: 'John Smith',
  emailPlaceholder: 'email@company.com',
  phonePlaceholder: '+84 901 234 567',
  solutionLabel: 'Solution of interest',
  solutionPlaceholder: '-- Select a solution --',
  solutionOptions: [
    { value: 'construction', label: 'Construction Safety AI' },
    { value: 'elderly-care', label: 'AI Elderly Care Camera' },
    { value: 'ai-agent', label: 'Enterprise AI Agent + LLM' },
    { value: 'other', label: 'Other / General consultation' },
  ],
  messageLabel: 'Message',
  messagePlaceholder: 'Describe your business needs...',
  submitLabel: 'Send consultation request',
  submittingLabel: 'Sending...',
  directEmailLabel: 'Or email us directly',
  emailSubject: 'Virai solution consultation request',
  fallbackEmailSubject: 'Virai consultation request',
  validationName: 'Please enter your full name (at least 2 characters).',
  validationEmail: 'Please enter a valid email address.',
  validationPhone: 'Please enter a valid phone number.',
  validationMessage: 'Message must be at least 10 characters.',
  submitFailure: 'Unable to send. Please try again or email us directly.',
  footerLinksTitle: 'Links',
  footerContactTitle: 'Contact',
  footerRights: 'All rights reserved.',
  navCta: 'Contact us',
  mobileMenuLabel: 'Mobile menu',
  openMenuLabel: 'Open menu',
};

export const content = {
  vi: {
    site,
    contact,
    about,
    visionMission,
    team,
    teamStats,
    solutions,
    navLinks,
    hero,
    aboutHighlights,
    ui,
    language: {
      current: 'vi' as Locale,
      currentLabel: 'VI',
      alternateHref: '/en/',
      alternateLabel: 'EN',
      htmlLang: 'vi',
    },
  },
  en: {
    site: siteEn,
    contact: contactEn,
    about: aboutEn,
    visionMission: visionMissionEn,
    team: teamEn,
    teamStats: teamStatsEn,
    solutions: solutionsEn,
    navLinks: navLinksEn,
    hero: heroEn,
    aboutHighlights: aboutHighlightsEn,
    ui: uiEn,
    language: {
      current: 'en' as Locale,
      currentLabel: 'EN',
      alternateHref: '/',
      alternateLabel: 'VI',
      htmlLang: 'en',
    },
  },
};

export type PageContent = (typeof content)[Locale];
