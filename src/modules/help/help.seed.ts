import { HelpStatus } from '../../common/enums/help.enums';

/** Seed khi collection trống — admin có thể sửa/xóa sau. */
export const HELP_SEED = [
  {
    title: 'Trợ giúp DatViet Land là gì?',
    slug: 'gioi-thieu-tro-giup',
    summary:
      'Trung tâm hướng dẫn nội bộ — đăng tin, gói dịch vụ, tổ chức và bảng giá đất.',
    categoryId: 'bat-dau',
    categoryTitle: 'Bắt đầu với DatViet Land',
    categoryBlurb: 'Tài khoản, đăng tin lần đầu và cách đọc bảng giá đất.',
    categoryAccent: '#A86F44',
    tags: ['giới thiệu'],
    sortOrder: 1,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'tip',
        title: 'Quản lý bởi Admin hệ thống',
        text: 'Các bài trợ giúp lưu trên hệ thống. Admin có thể thêm, sửa, xóa hoặc ẩn (bản nháp) bất kỳ lúc nào từ Dashboard Admin → Trợ giúp.',
      },
      {
        type: 'p',
        text: 'DatViet Land Trợ giúp giúp bạn tìm nhanh cách đăng tin, quản lý tổ chức, nạp ví, đẩy tin và tra cứu bảng giá đất theo nghị quyết địa phương.',
      },
      {
        type: 'h2',
        id: 'cach-dung',
        text: 'Cách dùng trung tâm trợ giúp',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Tìm theo từ khóa',
            text: 'Gõ chủ đề ở ô tìm kiếm trên trang chủ Trợ giúp.',
          },
          {
            title: 'Duyệt theo danh mục',
            text: 'Mỗi danh mục gom các bài liên quan.',
          },
          {
            title: 'Đọc bài chi tiết',
            text: 'Mỗi bài có mục lục, khối Tip / Lưu ý và FAQ.',
          },
        ],
      },
    ],
  },
  {
    title: 'Hướng dẫn đăng tin trên DatViet Land',
    slug: 'huong-dan-dang-tin',
    summary: 'Các bước tạo tin bán/cho thuê từ kênh người bán.',
    categoryId: 'tin-dang',
    categoryTitle: 'Tin đăng & gói tin',
    categoryBlurb: 'Loại tin, thời hạn hiển thị, đẩy tin và quy định duyệt.',
    categoryAccent: '#8B5E3C',
    tags: ['đăng tin', 'người bán'],
    sortOrder: 2,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'p',
        text: 'Bạn đăng tin từ Kênh người bán. Tin cần đủ thông tin pháp lý cơ bản, ảnh thật và giá rõ ràng trước khi gửi duyệt.',
      },
      {
        type: 'h2',
        id: 'cac-buoc',
        text: 'Các bước đăng tin',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Vào kênh người bán',
            text: 'Đăng nhập → Dashboard → Đăng tin mới.',
          },
          {
            title: 'Điền thông tin BĐS',
            text: 'Chọn mục đích bán/thuê, loại hình, địa chỉ, diện tích và giá.',
          },
          {
            title: 'Thêm ảnh & liên hệ',
            text: 'Tải ảnh rõ nét, điền người liên hệ.',
          },
          {
            title: 'Chọn gói & gửi duyệt',
            text: 'Chọn gói hiển thị phù hợp rồi gửi chờ duyệt.',
          },
        ],
      },
      {
        type: 'caution',
        title: 'Lưu ý',
        text: 'Tin thiếu địa chỉ hoặc ảnh mờ có thể bị từ chối.',
      },
    ],
  },
  {
    title: 'Gói tin và đẩy tin',
    slug: 'goi-tin-va-day-tin',
    summary: 'Cách tin được ưu tiên hiển thị và đấu giá vị trí đẩy tin.',
    categoryId: 'tin-dang',
    categoryTitle: 'Tin đăng & gói tin',
    categoryBlurb: 'Loại tin, thời hạn hiển thị, đẩy tin và quy định duyệt.',
    categoryAccent: '#8B5E3C',
    tags: ['gói tin', 'đẩy tin'],
    sortOrder: 3,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'h2',
        id: 'goi-tin',
        text: 'Gói tin',
      },
      {
        type: 'ul',
        items: [
          'Mỗi gói quy định thời hạn hiển thị và quyền lợi ưu tiên.',
          'Khi hết hạn, tin có thể cần gia hạn.',
          'Gói hội viên có thể kèm ưu đãi đăng tin.',
        ],
      },
      {
        type: 'h2',
        id: 'day-tin',
        text: 'Đẩy tin (đấu giá vị trí)',
      },
      {
        type: 'p',
        text: 'Đẩy tin giúp tin vào dải vị trí nổi bật theo ngày. Bạn đặt giá/ngày; hệ thống xếp hạng theo mức giá.',
      },
    ],
  },
  {
    title: 'Tra cứu bảng giá đất',
    slug: 'bang-gia-dat',
    summary: 'HCM, Hà Nội (VT1–VT4) và Đồng Nai theo nghị quyết HĐND.',
    categoryId: 'bat-dau',
    categoryTitle: 'Bắt đầu với DatViet Land',
    categoryBlurb: 'Tài khoản, đăng tin lần đầu và cách đọc bảng giá đất.',
    categoryAccent: '#A86F44',
    tags: ['bảng giá đất'],
    sortOrder: 4,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'p',
        text: 'DatViet Land cung cấp tra cứu bảng giá đất tại /bang-gia-dat. Đơn vị nguồn thường là 1000đ/m².',
      },
      {
        type: 'ul',
        items: [
          'TP. Hồ Chí Minh — NQ 87/2025/NQ-HĐND',
          'Hà Nội — NQ 52/2025/NQ-HĐND (VT1–VT4)',
          'Đồng Nai — NQ 28/2025/NQ-HĐND',
        ],
      },
    ],
  },
  {
    title: 'Tổ chức (Organization) và ví',
    slug: 'to-chuc-va-vi',
    summary: 'Tạo org, mời thành viên, nạp ví org và phân ngân sách.',
    categoryId: 'to-chuc',
    categoryTitle: 'Tổ chức & ví',
    categoryBlurb: 'Organization, nạp tiền, ngân sách và phân quyền thành viên.',
    categoryAccent: '#6B4F3A',
    tags: ['organization', 'ví'],
    sortOrder: 5,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'p',
        text: 'Tài khoản doanh nghiệp dùng Organization để đăng tin chung, chia ví và phân quyền Owner / Manager / Member.',
      },
      {
        type: 'steps',
        items: [
          {
            title: 'Tạo Organization',
            text: 'Dashboard → Tổ chức → Tạo mới.',
          },
          {
            title: 'Mời thành viên',
            text: 'Gửi lời mời theo email.',
          },
          {
            title: 'Nạp ví org',
            text: 'Owner/Manager nạp ví tổ chức để đăng tin / đẩy tin.',
          },
        ],
      },
    ],
  },
  {
    title: 'Nạp tiền và thanh toán',
    slug: 'nap-tien-thanh-toan',
    summary: 'Các hình thức nạp ví cá nhân / tổ chức.',
    categoryId: 'to-chuc',
    categoryTitle: 'Tổ chức & ví',
    categoryBlurb: 'Organization, nạp tiền, ngân sách và phân quyền thành viên.',
    categoryAccent: '#6B4F3A',
    tags: ['nạp tiền'],
    sortOrder: 6,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'p',
        text: 'Bạn nạp vào ví cá nhân hoặc ví Organization để trả phí đăng tin, đẩy tin và các dịch vụ khác.',
      },
      {
        type: 'ul',
        items: [
          'Chuyển khoản / QR',
          'Cổng thanh toán được cấu hình trên hệ thống',
          'Chuyển từ ví cá nhân sang ví org (khi được phép)',
        ],
      },
    ],
  },
  {
    title: 'Câu hỏi thường gặp',
    slug: 'cau-hoi-thuong-gap',
    summary: 'FAQ nhanh về tin đăng, tài khoản và thanh toán.',
    categoryId: 'chinh-sach',
    categoryTitle: 'Quy định & hỗ trợ',
    categoryBlurb: 'Điều khoản, bảo mật và câu hỏi thường gặp.',
    categoryAccent: '#4A3728',
    tags: ['FAQ'],
    sortOrder: 7,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'faq',
        items: [
          {
            q: 'Tôi quên mật khẩu?',
            a: 'Dùng luồng quên mật khẩu trên trang đăng nhập. Liên hệ support@nearland.vn nếu cần.',
          },
          {
            q: 'Tin org khác tin cá nhân thế nào?',
            a: 'Tin org thuộc Organization, dùng ví/ngân sách org. Tin cá nhân gắn tài khoản riêng.',
          },
        ],
      },
    ],
  },
  {
    title: 'Quy định đăng tin',
    slug: 'quy-dinh-dang-tin',
    summary: 'Nội dung được phép, chế tài và trách nhiệm người đăng.',
    categoryId: 'chinh-sach',
    categoryTitle: 'Quy định & hỗ trợ',
    categoryBlurb: 'Điều khoản, bảo mật và câu hỏi thường gặp.',
    categoryAccent: '#4A3728',
    tags: ['quy định'],
    sortOrder: 8,
    status: HelpStatus.PUBLISHED,
    blocks: [
      {
        type: 'p',
        text: 'Người đăng chịu trách nhiệm về tính trung thực của thông tin, ảnh và pháp lý BĐS.',
      },
      {
        type: 'ul',
        items: [
          'Không đăng tin giả, ảnh không liên quan, dẫn dụ sai giá',
          'Không đăng nội dung xúc phạm hoặc vi phạm pháp luật',
          'Không spam liên hệ',
        ],
      },
    ],
  },
];
