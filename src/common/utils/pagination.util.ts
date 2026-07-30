export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

export function normalizePagination(
  page?: number | string,
  limit?: number | string,
  fallbackLimit: number = DEFAULT_PAGE_SIZE,
) {
  const rawPage = Number(page);
  const rawLimit = Number(limit);
  const safePage =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const safeLimit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      MIN_PAGE_SIZE,
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.floor(rawLimit)
        : fallbackLimit,
    ),
  );
  const skip = (safePage - 1) * safeLimit;
  return { page: safePage, limit: safeLimit, skip };
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit) || 1),
  };
}
