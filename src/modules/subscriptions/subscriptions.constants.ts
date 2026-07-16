export type SubscriptionPlan = {
  id: 'pro' | 'business';
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  accountType: 'pro' | 'business';
  features: string[];
  highlight?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'pro',
    name: 'Tài khoản Pro',
    tagline: 'Cho môi giới cá nhân hoạt động hiệu quả hơn',
    monthly: 299000,
    yearly: 2189000,
    accountType: 'pro',
    highlight: true,
    features: [
      'Đăng tin không giới hạn',
      'Ưu tiên hiển thị trong tìm kiếm',
      'Huy hiệu Môi giới chuyên nghiệp',
      'Báo cáo hiệu suất chi tiết',
      'Hỗ trợ làm mới tin 10 lần/tháng',
    ],
  },
  {
    id: 'business',
    name: 'Tài khoản Doanh nghiệp',
    tagline: 'Tạo Organization, quản lý đội ngũ và ví doanh nghiệp',
    monthly: 990000,
    yearly: 8990000,
    accountType: 'business',
    features: [
      'Tạo 1 Organization workspace',
      'Quản lý thành viên & phân quyền',
      'Ví Organization & ngân sách đăng tin',
      'Quy trình duyệt tin nội bộ',
      'Dashboard & báo cáo doanh nghiệp',
    ],
  },
];
