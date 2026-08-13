import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type LandPriceCity = 'hcm' | 'hanoi' | 'dongnai';

export type DongNaiAppendix = 'pl1' | 'pl3' | 'pl4' | 'pl6' | 'pl8';

export type VtPrices = {
  vt1: number | null;
  vt2: number | null;
  vt3: number | null;
  vt4: number | null;
};

export type LandPriceRow = {
  city: LandPriceCity;
  region: string;
  regionDetail?: string;
  ward?: string;
  area?: string;
  stt: number | null;
  sttLabel?: string;
  layoutVariant?: 'from-to' | 'street-only';
  street: string;
  from: string;
  to: string;
  residential: number | VtPrices | null;
  commercial: number | VtPrices | null;
  production: number | VtPrices | null;
  /** Đồng Nai appendix-specific extras */
  name?: string;
  location?: string;
  group?: string;
  price?: number | null;
  perennial?: number | null;
  annual?: number | null;
  aquaculture?: number | null;
  forest?: number | null;
  perennialMin?: number | null;
  annualMin?: number | null;
  aquacultureMin?: number | null;
  forestMin?: number | null;
  perennialMax?: number | null;
  annualMax?: number | null;
  aquacultureMax?: number | null;
  forestMax?: number | null;
  searchText: string;
};

export type LandPriceMeta = {
  city: LandPriceCity;
  title: string;
  sourceUrl: string;
  resolution: string;
  unit: string;
  layout: 'hcm' | 'hanoi-vt' | 'dongnai-multi';
  columns?: { key: string; label: string; no: number }[];
  parsedAt: string;
  totalRows: number;
  totalRegions: number;
  totalPages: number;
  totalWards?: number;
  totalAreas?: number;
  defaultAppendix?: string;
  appendix?: string;
  appendixTitle?: string;
  appendixLayout?: string;
};

export type AppendixSummary = {
  key: string;
  title: string;
  layout: string;
  totalRows: number;
  totalRegions: number;
};

type RawDataset = {
  meta: Record<string, unknown>;
  wards?: string[];
  areas?: { area: string; areaDetail?: string }[] | string[];
  rows?: Record<string, unknown>[];
  appendices?: Record<
    string,
    {
      key?: string;
      title?: string;
      layout?: string;
      unit?: string;
      sourceUrl?: string;
      regions?: string[];
      rows?: Record<string, unknown>[];
      note?: string;
    }
  >;
};

type LandPriceDataset = {
  meta: LandPriceMeta;
  regions: string[];
  regionDetails: Record<string, string>;
  rows: LandPriceRow[];
  appendices?: AppendixSummary[];
  byAppendix?: Record<
    string,
    {
      meta: LandPriceMeta;
      regions: string[];
      rows: LandPriceRow[];
    }
  >;
};

const CITY_FILES: Record<LandPriceCity, string> = {
  hcm: 'land-prices-hcm.json',
  hanoi: 'land-prices-hanoi.json',
  dongnai: 'land-prices-dongnai.json',
};

const CITY_FALLBACK: Record<LandPriceCity, LandPriceMeta> = {
  hcm: {
    city: 'hcm',
    title: 'Bảng giá đất TP. Hồ Chí Minh',
    sourceUrl:
      'https://cdn.thuvienphapluat.vn/uploads/danluat///FileAttack/TT/20040/phu-luc-bang-gia-dat-tp-hcm.pdf',
    resolution: 'Nghị quyết số 87/2025/NQ-HĐND ngày 26/12/2025',
    unit: '1000đ/m²',
    layout: 'hcm',
    parsedAt: '',
    totalRows: 0,
    totalRegions: 0,
    totalPages: 0,
  },
  hanoi: {
    city: 'hanoi',
    title: 'Bảng giá đất TP. Hà Nội',
    sourceUrl:
      'https://cdn.thuvienphapluat.vn/Uploads/danluat/FileAttack/TT/19885/Nghị-quyết-52-2025-NQ-HĐND.pdf',
    resolution: 'Nghị quyết số 52/2025/NQ-HĐND',
    unit: '1000đ/m²',
    layout: 'hanoi-vt',
    parsedAt: '',
    totalRows: 0,
    totalRegions: 0,
    totalPages: 0,
  },
  dongnai: {
    city: 'dongnai',
    title: 'Bảng giá đất tỉnh Đồng Nai',
    sourceUrl:
      'https://talai.dongnai.gov.vn/vi/van-ban/detail/NGhi-quyet-Quy-dinh-Bang-gia-dat-lan-dau-tren-dia-ban-tinh-Dong-Nai-nam-2026-66/',
    resolution: 'Nghị quyết số 28/2025/NQ-HĐND',
    unit: '1000đ/m²',
    layout: 'dongnai-multi',
    defaultAppendix: 'pl3',
    parsedAt: '',
    totalRows: 0,
    totalRegions: 0,
    totalPages: 0,
  },
};

function normalizeCity(value?: string): LandPriceCity {
  const v = (value || 'hcm').toLowerCase().trim();
  if (v === 'hanoi' || v === 'hn' || v === 'ha-noi' || v === 'ha noi') {
    return 'hanoi';
  }
  if (
    v === 'dongnai' ||
    v === 'dong-nai' ||
    v === 'dn' ||
    v === 'đồng nai' ||
    v === 'dong nai'
  ) {
    return 'dongnai';
  }
  return 'hcm';
}

function normalizeAppendix(
  city: LandPriceCity,
  appendix?: string,
  defaultAppendix?: string,
): string | undefined {
  if (city !== 'dongnai') return undefined;
  const a = (appendix || defaultAppendix || 'pl3').toLowerCase().trim();
  if (['pl1', 'pl3', 'pl4', 'pl6', 'pl8'].includes(a)) return a;
  return defaultAppendix || 'pl3';
}

@Injectable()
export class LandPricesService implements OnModuleInit {
  private readonly logger = new Logger(LandPricesService.name);
  private datasets: Record<LandPriceCity, LandPriceDataset> = {
    hcm: this.emptyDataset('hcm'),
    hanoi: this.emptyDataset('hanoi'),
    dongnai: this.emptyDataset('dongnai'),
  };
  private fileMtimes: Record<LandPriceCity, number> = {
    hcm: 0,
    hanoi: 0,
    dongnai: 0,
  };

  onModuleInit() {
    this.loadCity('hcm');
    this.loadCity('hanoi');
    this.loadCity('dongnai');
  }

  private emptyDataset(city: LandPriceCity): LandPriceDataset {
    return {
      meta: { ...CITY_FALLBACK[city] },
      regions: [],
      regionDetails: {},
      rows: [],
    };
  }

  private dataPath(city: LandPriceCity) {
    return path.join(process.cwd(), 'data', CITY_FILES[city]);
  }

  /** Reload JSON khi file đổi (parse lại không cần restart Nest). */
  private ensureFresh(city: LandPriceCity) {
    const file = this.dataPath(city);
    if (!fs.existsSync(file)) {
      if (this.fileMtimes[city] !== 0) {
        this.fileMtimes[city] = 0;
        this.datasets[city] = this.emptyDataset(city);
      }
      return;
    }
    const mtime = fs.statSync(file).mtimeMs;
    if (mtime !== this.fileMtimes[city]) {
      this.loadCity(city);
    }
  }

  private ensureAllFresh() {
    (Object.keys(CITY_FILES) as LandPriceCity[]).forEach((c) =>
      this.ensureFresh(c),
    );
  }

  private loadCity(city: LandPriceCity) {
    const file = this.dataPath(city);
    if (!fs.existsSync(file)) {
      this.logger.warn(`Missing ${file}. Run parse script for ${city}.`);
      this.datasets[city] = this.emptyDataset(city);
      this.fileMtimes[city] = 0;
      return;
    }

    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as RawDataset;
    this.datasets[city] =
      city === 'dongnai'
        ? this.normalizeDongNai(raw)
        : this.normalizeDataset(city, raw);
    this.fileMtimes[city] = fs.statSync(file).mtimeMs;
    this.logger.log(
      `Loaded ${this.datasets[city].meta.totalRows} ${city} land price rows`,
    );
  }

  private normalizeDongNai(raw: RawDataset): LandPriceDataset {
    const fallback = CITY_FALLBACK.dongnai;
    const m = raw.meta || {};
    const byAppendix: LandPriceDataset['byAppendix'] = {};
    const appendices: AppendixSummary[] = [];

    for (const [key, section] of Object.entries(raw.appendices || {})) {
      const rows = (section.rows || []).map((r) =>
        this.mapDongNaiRow(key, r),
      );
      const regions =
        Array.isArray(section.regions) && section.regions.length
          ? section.regions
          : [...new Set(rows.map((r) => r.region).filter(Boolean))];

      byAppendix![key] = {
        meta: {
          city: 'dongnai',
          title: String(m.title || fallback.title),
          sourceUrl: String(section.sourceUrl || m.sourceUrl || fallback.sourceUrl),
          resolution: String(m.resolution || fallback.resolution),
          unit: String(section.unit || m.unit || fallback.unit),
          layout: 'dongnai-multi',
          parsedAt: String(m.parsedAt || ''),
          totalRows: rows.length,
          totalRegions: regions.length,
          totalPages: 0,
          defaultAppendix: String(m.defaultAppendix || 'pl3'),
          appendix: key,
          appendixTitle: String(section.title || key),
          appendixLayout: String(section.layout || 'hcm-like'),
        },
        regions,
        rows,
      };
      appendices.push({
        key,
        title: String(section.title || key),
        layout: String(section.layout || ''),
        totalRows: rows.length,
        totalRegions: regions.length,
      });
    }

    const defaultKey = String(m.defaultAppendix || 'pl3');
    const active =
      byAppendix[defaultKey] ||
      byAppendix.pl3 ||
      byAppendix.pl4 ||
      Object.values(byAppendix)[0];

    return {
      meta: {
        city: 'dongnai',
        title: String(m.title || fallback.title),
        sourceUrl: String(m.sourceUrl || fallback.sourceUrl),
        resolution: String(m.resolution || fallback.resolution),
        unit: String(m.unit || fallback.unit),
        layout: 'dongnai-multi',
        parsedAt: String(m.parsedAt || ''),
        totalRows: Number(m.totalRows) || appendices.reduce((s, a) => s + a.totalRows, 0),
        totalRegions: active?.regions.length || 0,
        totalPages: 0,
        defaultAppendix: defaultKey,
      },
      regions: active?.regions || [],
      regionDetails: {},
      rows: active?.rows || [],
      appendices,
      byAppendix,
    };
  }

  private mapDongNaiRow(
    appendix: string,
    r: Record<string, unknown>,
  ): LandPriceRow {
    const region = String(r.region || r.location || r.ward || '');
    const base: LandPriceRow = {
      city: 'dongnai',
      region,
      stt: (r.stt as number | null) ?? null,
      sttLabel: r.sttLabel != null ? String(r.sttLabel) : undefined,
      street: String(r.street || r.name || ''),
      from: String(r.from || ''),
      to: String(r.to || ''),
      residential: (r.residential as number | null) ?? null,
      commercial: (r.commercial as number | null) ?? null,
      production: (r.production as number | null) ?? null,
      searchText: String(r.searchText || '').toLowerCase(),
    };

    if (appendix === 'pl4' || appendix === 'pl6') {
      base.name = String(r.name || '');
      base.location = String(r.location || r.region || '');
      base.group = r.group != null ? String(r.group) : undefined;
      base.price = (r.price as number | null) ?? null;
      base.street = String(r.street || r.name || '');
    }
    if (appendix === 'pl1') {
      base.perennial = (r.perennial as number | null) ?? null;
      base.annual = (r.annual as number | null) ?? null;
      base.aquaculture = (r.aquaculture as number | null) ?? null;
      base.forest = (r.forest as number | null) ?? null;
    }
    if (appendix === 'pl8') {
      base.name = String(r.name || r.region || '');
      base.perennialMin = (r.perennialMin as number | null) ?? null;
      base.annualMin = (r.annualMin as number | null) ?? null;
      base.aquacultureMin = (r.aquacultureMin as number | null) ?? null;
      base.forestMin = (r.forestMin as number | null) ?? null;
      base.perennialMax = (r.perennialMax as number | null) ?? null;
      base.annualMax = (r.annualMax as number | null) ?? null;
      base.aquacultureMax = (r.aquacultureMax as number | null) ?? null;
      base.forestMax = (r.forestMax as number | null) ?? null;
    }
    return base;
  }

  private normalizeDataset(
    city: LandPriceCity,
    raw: RawDataset,
  ): LandPriceDataset {
    const fallback = CITY_FALLBACK[city];
    const m = raw.meta || {};

    let regions: string[] = [];
    const regionDetails: Record<string, string> = {};

    if (city === 'hcm') {
      regions = Array.isArray(raw.wards) ? raw.wards : [];
    } else if (Array.isArray(raw.areas)) {
      for (const a of raw.areas) {
        if (typeof a === 'string') {
          regions.push(a);
        } else if (a?.area) {
          regions.push(a.area);
          if (a.areaDetail) regionDetails[a.area] = a.areaDetail;
        }
      }
    }

    const rows: LandPriceRow[] = (raw.rows || []).map((r) => {
      if (city === 'hanoi') {
        const area = String(r.area || '');
        const detail =
          (r.areaDetail as string) || regionDetails[area] || undefined;
        return {
          city,
          region: area,
          regionDetail: detail,
          area,
          stt: (r.stt as number | null) ?? null,
          sttLabel: r.sttLabel != null ? String(r.sttLabel) : undefined,
          layoutVariant:
            (r.layoutVariant as LandPriceRow['layoutVariant']) ||
            (Number(String(area).replace(/\D/g, '')) >= 7
              ? 'street-only'
              : 'from-to'),
          street: String(r.street || ''),
          from: String(r.from || ''),
          to: String(r.to || ''),
          residential: (r.residential as VtPrices) || null,
          commercial: (r.commercial as VtPrices) || null,
          production: (r.production as VtPrices) || null,
          searchText: String(r.searchText || '').toLowerCase(),
        };
      }

      const ward = String(r.ward || '');
      return {
        city,
        region: ward,
        ward,
        stt: (r.stt as number | null) ?? null,
        street: String(r.street || ''),
        from: String(r.from || ''),
        to: String(r.to || ''),
        residential: (r.residential as number | null) ?? null,
        commercial: (r.commercial as number | null) ?? null,
        production: (r.production as number | null) ?? null,
        searchText: String(r.searchText || '').toLowerCase(),
      };
    });

    if (!regions.length) {
      regions = [...new Set(rows.map((r) => r.region).filter(Boolean))];
    }

    const totalRegions =
      Number(m.totalRegions) ||
      Number(m.totalWards) ||
      Number(m.totalAreas) ||
      regions.length;

    const meta: LandPriceMeta = {
      city,
      title: String(m.title || fallback.title),
      sourceUrl: String(m.sourceUrl || fallback.sourceUrl),
      resolution: String(m.resolution || fallback.resolution),
      unit: String(m.unit || fallback.unit),
      layout:
        (m.layout as LandPriceMeta['layout']) ||
        (city === 'hanoi' ? 'hanoi-vt' : 'hcm'),
      columns: m.columns as LandPriceMeta['columns'],
      parsedAt: String(m.parsedAt || ''),
      totalRows: Number(m.totalRows) || rows.length,
      totalRegions,
      totalPages: Number(m.totalPages) || 0,
      totalWards: city === 'hcm' ? totalRegions : undefined,
      totalAreas: city === 'hanoi' ? totalRegions : undefined,
    };

    return { meta, regions, regionDetails, rows };
  }

  listCities() {
    this.ensureAllFresh();
    return (Object.keys(this.datasets) as LandPriceCity[]).map((city) => ({
      city,
      title: this.datasets[city].meta.title,
      layout: this.datasets[city].meta.layout,
      totalRows: this.datasets[city].meta.totalRows,
      totalRegions: this.datasets[city].meta.totalRegions,
    }));
  }

  private resolveSlice(city: LandPriceCity, appendix?: string) {
    this.ensureFresh(city);
    const ds = this.datasets[city];
    if (city !== 'dongnai' || !ds.byAppendix) {
      return {
        meta: ds.meta,
        regions: ds.regions,
        rows: ds.rows,
        appendices: ds.appendices,
      };
    }
    const key = normalizeAppendix(city, appendix, ds.meta.defaultAppendix)!;
    const slice = ds.byAppendix[key] || ds.byAppendix[ds.meta.defaultAppendix || 'pl3'];
    if (!slice) {
      return {
        meta: ds.meta,
        regions: [],
        rows: [],
        appendices: ds.appendices,
      };
    }
    return {
      meta: slice.meta,
      regions: slice.regions,
      rows: slice.rows,
      appendices: ds.appendices,
    };
  }

  getMeta(cityParam?: string, appendix?: string) {
    const city = normalizeCity(cityParam);
    return this.resolveSlice(city, appendix).meta;
  }

  getRegions(cityParam?: string, appendix?: string) {
    const city = normalizeCity(cityParam);
    const slice = this.resolveSlice(city, appendix);
    const details = this.datasets[city].regionDetails || {};
    return slice.regions.map((name) => ({
      name,
      detail: details[name],
    }));
  }

  getAppendices(cityParam?: string) {
    const city = normalizeCity(cityParam);
    this.ensureFresh(city);
    return this.datasets[city].appendices || [];
  }

  getWards() {
    return this.datasets.hcm.regions;
  }

  query(params: {
    city?: string;
    appendix?: string;
    ward?: string;
    area?: string;
    region?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const city = normalizeCity(params.city);
    const slice = this.resolveSlice(city, params.appendix);
    const all = slice.rows;
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));

    let filtered = all;

    const regionFilter = (
      params.region ||
      params.area ||
      params.ward ||
      ''
    ).trim();
    if (regionFilter) {
      const q = regionFilter.toLowerCase();
      filtered = filtered.filter((r) => r.region.toLowerCase() === q);
      if (!filtered.length) {
        filtered = all.filter((r) => r.region.toLowerCase().includes(q));
      }
    }

    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter((r) => r.searchText.includes(q));
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      city,
      appendix: slice.meta.appendix,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      meta: slice.meta,
      regions: this.getRegions(city, params.appendix),
      appendices: slice.appendices || [],
    };
  }
}
