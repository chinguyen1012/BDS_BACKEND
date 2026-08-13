import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { NewsStatus } from '../../common/enums/news.enums';
import {
  CreateNewsDto,
  QueryAdminNewsDto,
  QueryPublicNewsDto,
  UpdateNewsDto,
} from './dto/news.dto';
import { NewsArticle, NewsDocument } from './schemas/news.schema';

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
}

const SEED_NEWS: Array<Partial<NewsArticle>> = [
  {
    title: 'Thị trường nhà phố phía Đông TP.HCM quý này: nguồn cung tăng nhẹ',
    slug: 'thi-truong-nha-pho-phia-dong-tphcm',
    excerpt:
      'Các khu vực Thủ Đức, Quận 9 cũ ghi nhận nguồn cung nhà phố tăng nhẹ, thanh khoản ổn định ở phân khúc trung cấp.',
    content: `Thị trường nhà phố khu Đông TP.HCM trong quý gần đây cho thấy tín hiệu phục hồi nhẹ.

Nguồn cung mới chủ yếu đến từ các dự án đã bàn giao và sản phẩm thứ cấp. Người mua quan tâm nhiều hơn tới pháp lý rõ ràng, vị trí kết nối hạ tầng và tiện ích xung quanh.

Chuyên gia nhận định phân khúc trung cấp vẫn chiếm ưu thế nhờ nhu cầu ở thực. Các sản phẩm có giá hợp lý, sổ hồng sẵn sàng giao dịch được quan tâm nhiều hơn sản phẩm đầu cơ.

Người mua nên ưu tiên kiểm tra quy hoạch, hạ tầng giao thông và khả năng thanh khoản trước khi quyết định.`,
    coverImage:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1400',
    category: 'Thị trường',
    status: NewsStatus.PUBLISHED,
    featured: true,
    authorName: 'Ban biên tập',
    publishedAt: new Date(),
  },
  {
    title: '5 lưu ý pháp lý trước khi mua đất nền dự án',
    slug: '5-luu-y-phap-ly-truoc-khi-mua-dat-nen',
    excerpt:
      'Từ giấy tờ chủ đầu tư đến quy hoạch chi tiết, đây là những điểm cần kiểm tra kỹ trước khi đặt cọc đất nền.',
    content: `Mua đất nền dự án đòi hỏi người mua chủ động kiểm tra pháp lý ngay từ đầu.

Thứ nhất, xác minh chủ đầu tư có đủ điều kiện chuyển nhượng theo quy định hiện hành. Thứ hai, đối chiếu quy hoạch 1/500 và hạ tầng đã hoàn thiện.

Thứ ba, kiểm tra sổ đỏ/sổ hồng hoặc điều kiện cấp sổ. Thứ tư, đọc kỹ hợp đồng đặt cọc và tiến độ thanh toán. Thứ năm, nên tham vấn luật sư hoặc chuyên gia độc lập nếu giá trị giao dịch lớn.

Những bước này giúp giảm rủi ro tranh chấp và chậm cấp sổ về sau.`,
    coverImage:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1400',
    category: 'Pháp lý',
    status: NewsStatus.PUBLISHED,
    featured: true,
    authorName: 'Ban biên tập',
    publishedAt: new Date(Date.now() - 86400000),
  },
  {
    title: 'Xu hướng căn hộ cao cấp: ưu tiên không gian sống xanh',
    slug: 'xu-huong-can-ho-cao-cap-khong-gian-song-xanh',
    excerpt:
      'Người mua phân khúc cao cấp ngày càng chú trọng mật độ xây dựng thấp, công viên nội khu và tiện ích sức khỏe.',
    content: `Không chỉ vị trí và thương hiệu chủ đầu tư, không gian xanh đang trở thành tiêu chí quyết định ở phân khúc căn hộ cao cấp.

Các dự án có công viên lớn, hồ cảnh quan, gym và không gian cộng đồng được đánh giá cao hơn. Người mua sẵn sàng chi trả thêm cho trải nghiệm sống bền vững và riêng tư.

Trong tương lai gần, các dự án kết hợp wellness, retail và giáo dục nội khu sẽ tiếp tục dẫn dắt xu hướng.`,
    coverImage:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400',
    category: 'Xu hướng',
    status: NewsStatus.PUBLISHED,
    featured: false,
    authorName: 'Ban biên tập',
    publishedAt: new Date(Date.now() - 2 * 86400000),
  },
  {
    title: 'Cách định giá nhà khi bán nhanh nhưng không lỗ',
    slug: 'cach-dinh-gia-nha-khi-ban-nhanh',
    excerpt:
      'Định giá hợp lý dựa trên giao dịch thực tế trong khu vực giúp rút ngắn thời gian bán và giữ biên lợi nhuận.',
    content: `Muốn bán nhanh, giá phải cạnh tranh so với các giao dịch thành công gần nhất trong bán kính 1–2 km.

Nên khảo sát 5–8 căn tương đương về diện tích, pháp lý và hiện trạng. Trừ hao nếu nhà cần sửa chữa hoặc vị trí kém hơn. Cộng thêm nếu đã hoàn thiện đẹp, gần tiện ích.

Đăng tin với hình ảnh chất lượng và mô tả trung thực giúp tăng tỷ lệ liên hệ. Điều chỉnh giá sau 2–3 tuần nếu lượng quan tâm thấp.`,
    coverImage:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1400',
    category: 'Tips mua bán',
    status: NewsStatus.PUBLISHED,
    featured: false,
    authorName: 'Ban biên tập',
    publishedAt: new Date(Date.now() - 3 * 86400000),
  },
  {
    title: 'Dự án đại đô thị ven sông: cơ hội dài hạn cho nhà đầu tư',
    slug: 'du-an-dai-do-thi-ven-song',
    excerpt:
      'Các đại đô thị ven sông thu hút nhờ không gian sống, tiện ích đồng bộ và tiềm năng tăng giá theo hạ tầng.',
    content: `Đại đô thị ven sông thường có quy hoạch dài hơi, mật độ thấp và hệ tiện ích nội khu phong phú.

Nhà đầu tư cần đánh giá tiến độ hạ tầng kết nối, năng lực chủ đầu tư và khả năng hấp thụ của khu vực. Nên ưu tiên sản phẩm có pháp lý rõ, vị trí đẹp trong dự án và thanh khoản thứ cấp tốt.

Đây là kênh phù hợp hơn với chiến lược nắm giữ trung – dài hạn thay vì lướt sóng ngắn hạn.`,
    coverImage:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400',
    category: 'Dự án',
    status: NewsStatus.PUBLISHED,
    featured: true,
    authorName: 'Ban biên tập',
    publishedAt: new Date(Date.now() - 4 * 86400000),
  },
  {
    title: 'Phân tích: vì sao căn hộ 2 phòng ngủ vẫn dẫn đầu thanh khoản',
    slug: 'phan-tich-can-ho-2-phong-ngu',
    excerpt:
      'Căn hộ 2PN phù hợp nhu cầu ở thực của gia đình trẻ và dễ cho thuê, nên duy trì thanh khoản ổn định.',
    content: `Căn hộ 2 phòng ngủ chiếm tỷ trọng lớn trong giao dịch nhờ diện tích tối ưu và mức giá dễ tiếp cận hơn căn 3PN.

Đối với người mua ở thực, đây là lựa chọn cân bằng giữa không gian và ngân sách. Với nhà đầu tư cho thuê, nhóm khách thuê gia đình nhỏ và chuyên gia trẻ khá ổn định.

Khi chọn căn, nên ưu tiên hướng nhà, tầng trung, gần thang máy và tiện ích nội khu được vận hành tốt.`,
    coverImage:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400',
    category: 'Phân tích',
    status: NewsStatus.PUBLISHED,
    featured: false,
    authorName: 'Ban biên tập',
    publishedAt: new Date(Date.now() - 5 * 86400000),
  },
];

@Injectable()
export class NewsService implements OnModuleInit {
  constructor(
    @InjectModel(NewsArticle.name)
    private readonly newsModel: Model<NewsDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.newsModel.countDocuments();
    if (count === 0) {
      await this.newsModel.insertMany(SEED_NEWS);
    }
  }

  private async ensureUniqueSlug(base: string, excludeId?: string) {
    let slug = slugify(base) || `tin-${Date.now()}`;
    let i = 0;
    while (true) {
      const candidate = i === 0 ? slug : `${slug}-${i}`;
      const existing = await this.newsModel
        .findOne({
          slug: candidate,
          ...(excludeId && Types.ObjectId.isValid(excludeId)
            ? { _id: { $ne: new Types.ObjectId(excludeId) } }
            : {}),
        })
        .select('_id')
        .lean()
        .exec();
      if (!existing) return candidate;
      i += 1;
      if (i > 50) {
        throw new ConflictException('Không thể tạo slug duy nhất');
      }
    }
  }

  async findPublic(query: QueryPublicNewsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 9;
    const filter: Record<string, unknown> = {
      status: NewsStatus.PUBLISHED,
    };

    if (query.category?.trim()) {
      filter.category = query.category.trim();
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.newsModel
        .find(filter)
        .sort(
          query.sort === 'views'
            ? { views: -1, publishedAt: -1 }
            : { featured: -1, publishedAt: -1, createdAt: -1 },
        )
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.newsModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findPublicCategories() {
    const rows = await this.newsModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: NewsStatus.PUBLISHED } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .exec();

    return rows.map((row) => ({
      category: row._id,
      count: row.count,
    }));
  }

  async findPublicOne(slug: string) {
    const article = await this.newsModel
      .findOneAndUpdate(
        { slug: slug.trim().toLowerCase(), status: NewsStatus.PUBLISHED },
        { $inc: { views: 1 } },
        { new: true },
      )
      .lean()
      .exec();

    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return article;
  }

  async findAdmin(query: QueryAdminNewsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.category?.trim()) filter.category = query.category.trim();
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.newsModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.newsModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findAdminOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    const article = await this.newsModel.findById(id).lean().exec();
    if (!article) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return article;
  }

  async create(dto: CreateNewsDto, authorId?: string) {
    const slug = await this.ensureUniqueSlug(dto.slug || dto.title);
    const status = dto.status ?? NewsStatus.DRAFT;

    return this.newsModel.create({
      title: dto.title.trim(),
      slug,
      excerpt: dto.excerpt.trim(),
      content: dto.content.trim(),
      coverImage: dto.coverImage?.trim() || undefined,
      category: dto.category?.trim() || 'Thị trường',
      status,
      featured: Boolean(dto.featured),
      authorName: dto.authorName?.trim() || 'Luxury Estate',
      authorId:
        authorId && Types.ObjectId.isValid(authorId)
          ? new Types.ObjectId(authorId)
          : undefined,
      publishedAt: status === NewsStatus.PUBLISHED ? new Date() : null,
    });
  }

  async update(id: string, dto: UpdateNewsDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    const existing = await this.newsModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    if (dto.title !== undefined) existing.title = dto.title.trim();
    if (dto.excerpt !== undefined) existing.excerpt = dto.excerpt.trim();
    if (dto.content !== undefined) existing.content = dto.content.trim();
    if (dto.coverImage !== undefined) {
      existing.coverImage = dto.coverImage.trim() || undefined;
    }
    if (dto.category !== undefined) {
      existing.category = dto.category.trim() || 'Thị trường';
    }
    if (dto.featured !== undefined) existing.featured = Boolean(dto.featured);
    if (dto.authorName !== undefined) {
      existing.authorName = dto.authorName.trim() || 'Luxury Estate';
    }

    if (dto.slug !== undefined || dto.title !== undefined) {
      const base = dto.slug?.trim() || dto.title?.trim() || existing.title;
      existing.slug = await this.ensureUniqueSlug(base, id);
    }

    if (dto.status !== undefined) {
      const prev = existing.status;
      existing.status = dto.status;
      if (
        dto.status === NewsStatus.PUBLISHED &&
        prev !== NewsStatus.PUBLISHED
      ) {
        existing.publishedAt = new Date();
      }
      if (dto.status === NewsStatus.DRAFT) {
        // keep publishedAt history
      }
    }

    await existing.save();
    return existing.toObject();
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    const result = await this.newsModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    return { ok: true };
  }
}
