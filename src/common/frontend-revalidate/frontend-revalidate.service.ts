import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FrontendRevalidateService {
  private readonly logger = new Logger(FrontendRevalidateService.name);

  constructor(private readonly config: ConfigService) {}

  /** Lấy origin FE đầu tiên từ FRONTEND_URL (có thể là CSV). */
  private frontendOrigin(): string | null {
    const raw =
      this.config.get<string>('REVALIDATE_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      '';
    const first = raw
      .split(',')
      .map((s) => s.trim())
      .find(Boolean);
    return first?.replace(/\/$/, '') || null;
  }

  /**
   * Gọi Next.js on-demand revalidation (không throw — tránh làm fail transaction chính).
   */
  async revalidate(input: {
    tags?: string[];
    paths?: string[];
  }): Promise<void> {
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    const origin = this.frontendOrigin();
    if (!secret || !origin) {
      this.logger.debug(
        'Bỏ qua revalidate: thiếu REVALIDATE_SECRET hoặc FRONTEND_URL',
      );
      return;
    }

    const tags = input.tags?.filter(Boolean) ?? [];
    const paths = input.paths?.filter(Boolean) ?? [];
    if (!tags.length && !paths.length) return;

    try {
      const res = await fetch(`${origin}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tags, paths }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `Revalidate thất bại (${res.status}): ${text.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Revalidate lỗi mạng: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Invalidate trang chi tiết + danh sách tin đăng. */
  revalidateListing(id: string) {
    return this.revalidate({
      tags: [`listing-${id}`, 'listings'],
      paths: [`/properties/${id}`, '/properties'],
    });
  }

  revalidateNews(slug: string) {
    return this.revalidate({
      tags: [`news-${slug}`, 'news'],
      paths: [`/news/${slug}`, '/news'],
    });
  }

  revalidateProject(slug: string) {
    return this.revalidate({
      tags: [`project-${slug}`, 'projects'],
      paths: [`/projects/${slug}`, '/projects'],
    });
  }
}
