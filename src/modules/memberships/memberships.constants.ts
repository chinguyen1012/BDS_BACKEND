export type MembershipPlan = {
  id: 'pro' | 'business';
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  accountType: 'pro' | 'business';
  features: string[];
  highlight?: boolean;
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
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
    name: 'Tài khoản doanh nghiệp',
    tagline: 'Cho sàn giao dịch & đội nhóm nhiều nhân viên',
    monthly: 990000,
    yearly: 7128000,
    accountType: 'business',
    features: [
      'Tất cả quyền lợi gói Pro',
      'Quản lý nhiều tài khoản nhân viên',
      'Trang thương hiệu riêng',
      'Tư vấn tối ưu tin đăng 1-1',
      'Hỗ trợ ưu tiên 24/7',
    ],
  },
];
