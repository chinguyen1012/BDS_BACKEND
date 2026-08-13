import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ProjectStatus } from '../../common/enums/project.enums';
import { QueryPublicProjectDto } from './dto/query-public-project.dto';
import {
  CreateProjectDto,
  QueryAdminProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { Project, ProjectDocument } from './schemas/project.schema';
import {
  normalizePagination,
  paginatedResult,
} from '../../common/utils/pagination.util';

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const SEED_PROJECTS: Array<Partial<Project>> = [
  {
    name: 'Vinhomes Grand Park',
    slug: 'vinhomes-grand-park',
    developer: 'Vinhomes',
    province: 'Thành phố Hồ Chí Minh',
    ward: 'Long Thạnh Mỹ',
    address: 'Nguyễn Xiển, Quận 9',
    description:
      'Đại đô thị sinh thái quy mô lớn với hệ sinh thái tiện ích nội khu đầy đủ, kết nối thuận tiện tới trung tâm TP.HCM.',
    highlights: ['Đại lộ mua sắm', 'Công viên 36ha', 'Bể bơi 4 mùa', 'Trường Vinschool'],
    status: ProjectStatus.SELLING,
    priceFrom: 2500000000,
    priceTo: 8500000000,
    areaFrom: 45,
    areaTo: 120,
    propertyTypes: ['apartment', 'shophouse'],
    featured: true,
    coverImage:
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
    ],
  },
  {
    name: 'The Global City',
    slug: 'the-global-city',
    developer: 'Masterise Homes',
    province: 'Thành phố Hồ Chí Minh',
    ward: 'An Phú',
    address: 'Đường số 2, Thủ Đức',
    description:
      'Khu đô thị quốc tế với chuẩn sống cao cấp, không gian xanh và tiện ích thương mại – giải trí hiện đại.',
    highlights: ['Khu thương mại', 'Công viên trung tâm', 'Chuẩn quốc tế'],
    status: ProjectStatus.SELLING,
    priceFrom: 4500000000,
    priceTo: 15000000000,
    areaFrom: 55,
    areaTo: 150,
    propertyTypes: ['apartment', 'villa'],
    featured: true,
    coverImage:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200',
    images: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200',
    ],
  },
  {
    name: 'Masteri Centre Point',
    slug: 'masteri-centre-point',
    developer: 'Masterise Homes',
    province: 'Thành phố Hồ Chí Minh',
    ward: 'Tân Phú',
    address: 'Xa lộ Hà Nội, Thủ Đức',
    description:
      'Dự án căn hộ cao cấp kết nối Metro, phù hợp cho cư dân làm việc tại khu vực phía Đông TP.HCM.',
    highlights: ['Gần Metro', 'Hồ bơi vô cực', 'Sky lounge'],
    status: ProjectStatus.SELLING,
    priceFrom: 3200000000,
    priceTo: 6800000000,
    areaFrom: 48,
    areaTo: 95,
    propertyTypes: ['apartment'],
    featured: true,
    coverImage:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200',
    ],
  },
  {
    name: 'Aqua City',
    slug: 'aqua-city',
    developer: 'Novaland',
    province: 'Đồng Nai',
    ward: 'Phước Khánh',
    address: 'Biên Hòa, Đồng Nai',
    description:
      'Đô thị sinh thái ven sông với quy hoạch đồng bộ, ưu tiên không gian sống xanh và tiện ích nội khu.',
    highlights: ['Ven sông', 'Sân golf', 'Khu thể thao'],
    status: ProjectStatus.SELLING,
    priceFrom: 1800000000,
    priceTo: 12000000000,
    areaFrom: 50,
    areaTo: 200,
    propertyTypes: ['apartment', 'villa', 'project-land'],
    featured: true,
    coverImage:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
    ],
  },
  {
    name: 'NovaWorld Phan Thiết',
    slug: 'novaworld-phan-thiet',
    developer: 'Novaland',
    province: 'Bình Thuận',
    ward: 'Tiến Thành',
    address: 'Phan Thiết, Bình Thuận',
    description:
      'Siêu đô thị du lịch – nghỉ dưỡng với hệ sinh thái giải trí, khách sạn và second home ven biển.',
    highlights: ['Ven biển', 'Sân golf 18 lỗ', 'Khu giải trí'],
    status: ProjectStatus.SELLING,
    priceFrom: 2500000000,
    priceTo: 20000000000,
    areaFrom: 60,
    areaTo: 350,
    propertyTypes: ['villa', 'project-land'],
    featured: false,
    coverImage:
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200',
    images: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200',
    ],
  },
  {
    name: 'Sun Urban City',
    slug: 'sun-urban-city',
    developer: 'Sun Group',
    province: 'Hà Nội',
    ward: 'Nam An Khánh',
    address: 'Hoài Đức, Hà Nội',
    description:
      'Khu đô thị hiện đại phía Tây Hà Nội với mật độ xây dựng hợp lý và tiện ích đồng bộ.',
    highlights: ['Khu vui chơi', 'Trường học', 'Công viên nội khu'],
    status: ProjectStatus.SELLING,
    priceFrom: 2200000000,
    priceTo: 7500000000,
    areaFrom: 42,
    areaTo: 110,
    propertyTypes: ['apartment', 'shophouse'],
    featured: false,
    coverImage:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    ],
  },
  {
    name: 'Ecopark',
    slug: 'ecopark',
    developer: 'Ecopark Group',
    province: 'Hưng Yên',
    ward: 'Văn Giang',
    address: 'Văn Giang, Hưng Yên',
    description:
      'Khu đô thị sinh thái lớn phía Đông Hà Nội, nổi bật với không gian xanh và cộng đồng cư dân văn minh.',
    highlights: ['Hồ lớn', 'Khu thể thao', 'Trường liên cấp'],
    status: ProjectStatus.HANDED_OVER,
    priceFrom: 3000000000,
    priceTo: 18000000000,
    areaFrom: 55,
    areaTo: 250,
    propertyTypes: ['apartment', 'villa', 'townhouse'],
    featured: true,
    coverImage:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200',
    ],
  },
  {
    name: 'Celadon City',
    slug: 'celadon-city',
    developer: 'Gamuda Land',
    province: 'Thành phố Hồ Chí Minh',
    ward: 'Sơn Kỳ',
    address: 'Tân Phú, TP.HCM',
    description:
      'Khu đô thị xanh với công viên trung tâm lớn, phù hợp gia đình trẻ tại khu Tây TP.HCM.',
    highlights: ['Công viên 16ha', 'Trung tâm thương mại', 'Hồ bơi'],
    status: ProjectStatus.SELLING,
    priceFrom: 2800000000,
    priceTo: 9000000000,
    areaFrom: 50,
    areaTo: 130,
    propertyTypes: ['apartment', 'townhouse'],
    featured: false,
    coverImage:
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1200',
    images: [
      'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=1200',
    ],
  },
  {
    name: 'Waterpoint',
    slug: 'waterpoint',
    developer: 'Nam Long',
    province: 'Long An',
    ward: 'Tân Lân',
    address: 'Bến Lức, Long An',
    description:
      'Khu đô thị ven sông phía Nam TP.HCM, tập trung vào không gian sống yên bình và tiện ích gia đình.',
    highlights: ['Ven sông', 'Clubhouse', 'Khu dịch vụ'],
    status: ProjectStatus.SELLING,
    priceFrom: 1500000000,
    priceTo: 6500000000,
    areaFrom: 45,
    areaTo: 120,
    propertyTypes: ['apartment', 'townhouse', 'project-land'],
    featured: false,
    coverImage:
      'https://images.unsplash.com/photo-1600047509807-ba8f84dca19d?w=1200',
    images: [
      'https://images.unsplash.com/photo-1600047509807-ba8f84dca19d?w=1200',
    ],
  },
  {
    name: 'Lancaster Legacy',
    slug: 'lancaster-legacy',
    developer: 'Trung Thủy Group',
    province: 'Đà Nẵng',
    ward: 'Hòa Xuân',
    address: 'Hòa Xuân, Đà Nẵng',
    description:
      'Dự án căn hộ cao cấp ven sông Hàn, mang phong cách kiến trúc hiện đại tại trung tâm Đà Nẵng.',
    highlights: ['View sông Hàn', 'Sky bar', 'Gym cao cấp'],
    status: ProjectStatus.UPCOMING,
    priceFrom: 3500000000,
    priceTo: 8000000000,
    areaFrom: 52,
    areaTo: 105,
    propertyTypes: ['apartment'],
    featured: false,
    coverImage:
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200',
    images: [
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200',
    ],
  },
];

@Injectable()
export class ProjectsService implements OnModuleInit {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.projectModel.countDocuments();
    if (count === 0) {
      await this.projectModel.insertMany(SEED_PROJECTS);
    }
  }

  async findPublicProjects(query: QueryPublicProjectDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const filter: Record<string, unknown> = { published: true };

    if (query.developer?.trim()) {
      filter.developer = { $regex: query.developer.trim(), $options: 'i' };
    }
    if (query.province?.trim()) {
      filter.province = { $regex: query.province.trim(), $options: 'i' };
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { developer: { $regex: search, $options: 'i' } },
        { province: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.projectModel
        .find(filter)
        .sort({ featured: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.projectModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findPublicDevelopers() {
    const rows = await this.projectModel
      .aggregate<{ _id: string; count: number }>([
        { $match: { published: true } },
        { $group: { _id: '$developer', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ])
      .exec();

    return rows.map((row) => ({
      developer: row._id,
      count: row.count,
    }));
  }

  async findPublicOne(slug: string) {
    const project = await this.projectModel
      .findOneAndUpdate(
        { slug: slug.trim().toLowerCase(), published: true },
        { $inc: { views: 1 } },
        { new: true },
      )
      .lean()
      .exec();

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án');
    }

    return project;
  }

  async findAdmin(query: QueryAdminProjectDto) {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const search = query.search.trim();
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { developer: { $regex: search, $options: 'i' } },
        { province: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.projectModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.projectModel.countDocuments(filter),
    ]);

    return paginatedResult(items, total, page, limit);
  }

  async findAdminOne(id: string) {
    const project = await this.projectModel.findById(id).lean().exec();
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    return project;
  }

  private async uniqueSlug(base: string, excludeId?: string) {
    let slug = slugify(base) || `project-${Date.now()}`;
    let i = 0;
    while (true) {
      const candidate = i === 0 ? slug : `${slug}-${i}`;
      const existing = await this.projectModel
        .findOne({
          slug: candidate,
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        })
        .select('_id')
        .exec();
      if (!existing) return candidate;
      i += 1;
    }
  }

  async create(dto: CreateProjectDto) {
    const slug = await this.uniqueSlug(dto.slug || dto.name);
    return this.projectModel.create({
      ...dto,
      slug,
      images: dto.images ?? [],
      floorPlanImages: dto.floorPlanImages ?? [],
      infrastructureImages: dto.infrastructureImages ?? [],
      highlights: dto.highlights ?? [],
      propertyTypes: dto.propertyTypes ?? [],
      published: dto.published ?? true,
      featured: dto.featured ?? false,
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.projectModel.findById(id).exec();
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    if (dto.slug || dto.name) {
      const nextSlug = await this.uniqueSlug(
        dto.slug || dto.name || project.name,
        id,
      );
      project.slug = nextSlug;
    }

    const assignable: (keyof UpdateProjectDto)[] = [
      'name',
      'developer',
      'developerLogo',
      'coverImage',
      'images',
      'floorPlanImages',
      'infrastructureImages',
      'province',
      'district',
      'ward',
      'street',
      'address',
      'latitude',
      'longitude',
      'description',
      'introduction',
      'floorPlanContent',
      'infrastructure',
      'locationNote',
      'highlights',
      'status',
      'priceFrom',
      'priceTo',
      'areaFrom',
      'areaTo',
      'propertyTypes',
      'featured',
      'published',
    ];

    for (const key of assignable) {
      if (dto[key] !== undefined) {
        (project as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }

    await project.save();
    return project;
  }

  async remove(id: string) {
    const project = await this.projectModel.findByIdAndDelete(id).exec();
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    return { ok: true };
  }

  /** Gợi ý chọn dự án khi đăng tin */
  async findOptions(search?: string) {
    const filter: Record<string, unknown> = { published: true };
    if (search?.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }
    return this.projectModel
      .find(filter)
      .sort({ featured: -1, name: 1 })
      .limit(50)
      .select(
        'name slug province district ward street address latitude longitude developer',
      )
      .lean()
      .exec();
  }
}
