import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { HelpStatus } from '../../common/enums/help.enums';
import {
  CreateHelpCategoryDto,
  CreateHelpDto,
  QueryAdminHelpDto,
  QueryPublicHelpDto,
  UpdateHelpCategoryDto,
  UpdateHelpDto,
} from './dto/help.dto';
import { HELP_SEED } from './help.seed';
import { HelpArticle, HelpArticleDocument } from './schemas/help-article.schema';
import {
  HelpCategory,
  HelpCategoryDocument,
} from './schemas/help-category.schema';

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

const BLOCK_TYPES = new Set([
  'p',
  'h2',
  'h3',
  'tip',
  'note',
  'caution',
  'steps',
  'ul',
  'faq',
]);

const CATEGORY_SEED = [
  {
    key: 'bat-dau',
    title: 'Bắt đầu với DatViet Land',
    blurb: 'Tài khoản, đăng tin lần đầu và cách đọc bảng giá đất.',
    accent: '#A86F44',
    sortOrder: 1,
  },
  {
    key: 'tin-dang',
    title: 'Tin đăng & gói tin',
    blurb: 'Loại tin, thời hạn hiển thị, đẩy tin và quy định duyệt.',
    accent: '#8B5E3C',
    sortOrder: 2,
  },
  {
    key: 'to-chuc',
    title: 'Tổ chức & ví',
    blurb: 'Organization, nạp tiền, ngân sách và phân quyền thành viên.',
    accent: '#6B4F3A',
    sortOrder: 3,
  },
  {
    key: 'chinh-sach',
    title: 'Quy định & hỗ trợ',
    blurb: 'Điều khoản, bảo mật và câu hỏi thường gặp.',
    accent: '#4A3728',
    sortOrder: 4,
  },
];

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chuẩn hoá blocks; nếu rỗng/hỏng nhưng có HTML thì tạo 1 khối p fallback. */
function normalizeBlocks(
  blocks: unknown,
  contentHtml?: string,
): Record<string, unknown>[] {
  const fallbackText =
    stripHtml(contentHtml || '') || 'Nội dung định dạng';
  const fallback: Record<string, unknown>[] = [
    { type: 'p', text: fallbackText.slice(0, 5000) },
  ];

  if (!Array.isArray(blocks) || !blocks.length) {
    if (contentHtml?.trim()) return fallback;
    throw new BadRequestException('Nội dung bài cần ít nhất một khối');
  }

  const normalized: Record<string, unknown>[] = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const raw = blocks[i];
    // Một số client/pipe gửi nhầm string JSON của từng khối
    let item: unknown = raw;
    if (typeof raw === 'string') {
      try {
        item = JSON.parse(raw);
      } catch {
        item = { type: 'p', text: raw };
      }
    }
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const block = { ...(item as Record<string, unknown>) };
    const type = String(block.type || '');
    if (!BLOCK_TYPES.has(type)) continue;
    normalized.push(block);
  }

  if (!normalized.length) {
    if (contentHtml?.trim()) return fallback;
    throw new BadRequestException(
      'Khối nội dung không hợp lệ (cần object có type: p, h2, …)',
    );
  }
  return normalized;
}

@Injectable()
export class HelpService implements OnModuleInit {
  constructor(
    @InjectModel(HelpArticle.name)
    private readonly helpModel: Model<HelpArticleDocument>,
    @InjectModel(HelpCategory.name)
    private readonly categoryModel: Model<HelpCategoryDocument>,
  ) {}

  async onModuleInit() {
    const catCount = await this.categoryModel.countDocuments();
    if (catCount === 0) {
      await this.categoryModel.insertMany(CATEGORY_SEED);
    }
    const count = await this.helpModel.countDocuments();
    if (count === 0) {
      await this.helpModel.insertMany(HELP_SEED);
    }
  }

  private async ensureUniqueSlug(base: string, excludeId?: string) {
    let slug = slugify(base) || `bai-${Date.now()}`;
    let i = 0;
    while (true) {
      const candidate = i === 0 ? slug : `${slug}-${i}`;
      const existing = await this.helpModel
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

  private async ensureUniqueCategoryKey(base: string, excludeId?: string) {
    let key = slugify(base) || `danh-muc-${Date.now()}`;
    let i = 0;
    while (true) {
      const candidate = i === 0 ? key : `${key}-${i}`;
      const existing = await this.categoryModel
        .findOne({
          key: candidate,
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
        throw new ConflictException('Không thể tạo mã danh mục duy nhất');
      }
    }
  }

  private format(doc: HelpArticleDocument | Record<string, unknown>) {
    const o =
      typeof (doc as HelpArticleDocument).toObject === 'function'
        ? (doc as HelpArticleDocument).toObject()
        : { ...doc };
    const updatedAt = (o as { updatedAt?: Date }).updatedAt;
    return {
      ...o,
      updatedAt: updatedAt
        ? new Date(updatedAt).toISOString().slice(0, 10)
        : undefined,
    };
  }

  private async resolveCategory(categoryId: string) {
    const key = categoryId.trim().toLowerCase();
    const cat = await this.categoryModel.findOne({ key }).lean().exec();
    if (!cat) {
      throw new BadRequestException(
        `Danh mục "${categoryId}" chưa tồn tại. Hãy tạo danh mục trước.`,
      );
    }
    return cat;
  }

  async findPublic(query: QueryPublicHelpDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filter: Record<string, unknown> = {
      status: HelpStatus.PUBLISHED,
    };

    if (query.category?.trim()) {
      filter.categoryId = query.category.trim();
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { categoryTitle: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.helpModel
        .find(filter)
        .sort({ sortOrder: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.helpModel.countDocuments(filter),
    ]);

    return {
      items: items.map((i) => this.format(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findPublicCategories() {
    const cats = await this.categoryModel
      .find()
      .sort({ sortOrder: 1, title: 1 })
      .lean()
      .exec();

    const counts = await this.helpModel.aggregate<{ _id: string; count: number }>([
      { $match: { status: HelpStatus.PUBLISHED } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.count]));

    return cats
      .map((c) => ({
        id: c.key,
        _id: c._id,
        title: c.title,
        blurb: c.blurb || '',
        accent: c.accent || '#A86F44',
        sortOrder: c.sortOrder ?? 0,
        count: countMap.get(c.key) || 0,
      }))
      .filter((c) => c.count > 0 || true);
  }

  /** Public hub: only categories that have published articles (keep empty cats out of hub). */
  async findPublicCategoriesWithArticles() {
    const all = await this.findPublicCategories();
    return all.filter((c) => c.count > 0);
  }

  async findPublicOne(slug: string) {
    const doc = await this.helpModel
      .findOne({
        slug: slug.trim().toLowerCase(),
        status: HelpStatus.PUBLISHED,
      })
      .exec();
    if (!doc) throw new NotFoundException('Không tìm thấy bài trợ giúp');
    return this.format(doc);
  }

  async findAdmin(query: QueryAdminHelpDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.category?.trim()) filter.categoryId = query.category.trim();
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.helpModel
        .find(filter)
        .sort({ sortOrder: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.helpModel.countDocuments(filter),
    ]);

    return {
      items: items.map((i) => this.format(i)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findAdminOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài trợ giúp');
    }
    const doc = await this.helpModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy bài trợ giúp');
    return this.format(doc);
  }

  async create(dto: CreateHelpDto, userId?: string) {
    const contentHtml = (dto.contentHtml || '').trim();
    const blocks = normalizeBlocks(dto.blocks, contentHtml);
    const cat = await this.resolveCategory(dto.categoryId);
    const slug = await this.ensureUniqueSlug(dto.slug || dto.title);
    const doc = await this.helpModel.create({
      title: dto.title.trim(),
      slug,
      summary: dto.summary.trim(),
      categoryId: cat.key,
      categoryTitle: dto.categoryTitle?.trim() || cat.title,
      categoryBlurb: dto.categoryBlurb?.trim() || cat.blurb || '',
      categoryAccent: dto.categoryAccent?.trim() || cat.accent || '#A86F44',
      tags: (dto.tags || []).map((t) => t.trim()).filter(Boolean),
      blocks,
      contentHtml,
      status: dto.status ?? HelpStatus.DRAFT,
      sortOrder: dto.sortOrder ?? 0,
      ...(userId && Types.ObjectId.isValid(userId)
        ? { updatedBy: new Types.ObjectId(userId) }
        : {}),
    });
    return this.format(doc);
  }

  async update(id: string, dto: UpdateHelpDto, userId?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài trợ giúp');
    }
    const existing = await this.helpModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Không tìm thấy bài trợ giúp');

    if (dto.title != null) existing.title = dto.title.trim();
    if (dto.summary != null) existing.summary = dto.summary.trim();
    if (dto.categoryId != null) {
      const cat = await this.resolveCategory(dto.categoryId);
      existing.categoryId = cat.key;
      existing.categoryTitle = dto.categoryTitle?.trim() || cat.title;
      existing.categoryBlurb = dto.categoryBlurb?.trim() || cat.blurb || '';
      existing.categoryAccent =
        dto.categoryAccent?.trim() || cat.accent || '#A86F44';
    } else {
      if (dto.categoryTitle != null) {
        existing.categoryTitle = dto.categoryTitle.trim();
      }
      if (dto.categoryBlurb != null) {
        existing.categoryBlurb = dto.categoryBlurb.trim();
      }
      if (dto.categoryAccent != null) {
        existing.categoryAccent = dto.categoryAccent.trim();
      }
    }
    if (dto.tags != null) {
      existing.tags = dto.tags.map((t) => t.trim()).filter(Boolean);
    }
    if (dto.contentHtml != null) existing.contentHtml = dto.contentHtml.trim();
    if (dto.blocks != null) {
      existing.blocks = normalizeBlocks(
        dto.blocks,
        dto.contentHtml ?? existing.contentHtml,
      );
    }
    if (dto.status != null) existing.status = dto.status;
    if (dto.sortOrder != null) existing.sortOrder = dto.sortOrder;
    if (dto.slug != null || dto.title != null) {
      existing.slug = await this.ensureUniqueSlug(
        dto.slug || existing.title,
        id,
      );
    }
    if (userId && Types.ObjectId.isValid(userId)) {
      existing.updatedBy = new Types.ObjectId(userId);
    }

    await existing.save();
    return this.format(existing);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy bài trợ giúp');
    }
    const res = await this.helpModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException('Không tìm thấy bài trợ giúp');
    return { ok: true };
  }

  async listCategoriesAdmin() {
    const cats = await this.categoryModel
      .find()
      .sort({ sortOrder: 1, title: 1 })
      .lean()
      .exec();
    const counts = await this.helpModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    return cats.map((c) => ({
      ...c,
      id: c.key,
      count: countMap.get(c.key) || 0,
    }));
  }

  async createCategory(dto: CreateHelpCategoryDto) {
    const key = await this.ensureUniqueCategoryKey(dto.key || dto.title);
    try {
      const doc = await this.categoryModel.create({
        key,
        title: dto.title.trim(),
        blurb: dto.blurb?.trim() || '',
        accent: dto.accent?.trim() || '#A86F44',
        sortOrder: dto.sortOrder ?? 0,
      });
      return { ...doc.toObject(), id: doc.key, count: 0 };
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        throw new ConflictException('Mã danh mục đã tồn tại');
      }
      throw err;
    }
  }

  async updateCategory(id: string, dto: UpdateHelpCategoryDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const existing = await this.categoryModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Không tìm thấy danh mục');

    const oldKey = existing.key;
    if (dto.key != null) {
      existing.key = await this.ensureUniqueCategoryKey(dto.key, id);
    }
    if (dto.title != null) existing.title = dto.title.trim();
    if (dto.blurb != null) existing.blurb = dto.blurb.trim();
    if (dto.accent != null) existing.accent = dto.accent.trim();
    if (dto.sortOrder != null) existing.sortOrder = dto.sortOrder;

    await existing.save();

    if (existing.key !== oldKey || dto.title != null || dto.blurb != null || dto.accent != null) {
      await this.helpModel.updateMany(
        { categoryId: oldKey },
        {
          $set: {
            categoryId: existing.key,
            categoryTitle: existing.title,
            categoryBlurb: existing.blurb,
            categoryAccent: existing.accent,
          },
        },
      );
    }

    const count = await this.helpModel.countDocuments({
      categoryId: existing.key,
    });
    return { ...existing.toObject(), id: existing.key, count };
  }

  async removeCategory(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }
    const existing = await this.categoryModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Không tìm thấy danh mục');

    const used = await this.helpModel.countDocuments({
      categoryId: existing.key,
    });
    if (used > 0) {
      throw new BadRequestException(
        `Không xóa được: còn ${used} bài thuộc danh mục này. Hãy chuyển hoặc xóa bài trước.`,
      );
    }

    await this.categoryModel.findByIdAndDelete(id).exec();
    return { ok: true };
  }
}
