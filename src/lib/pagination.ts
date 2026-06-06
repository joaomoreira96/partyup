export const DEFAULT_PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 10;

export type PaginationSlice<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export function parsePageParam(value: string | undefined | null): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function clampPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  return Math.min(Math.max(1, page), safeTotal);
}

export function paginateSlice<T>(
  items: T[],
  page: number,
  pageSize: number
): PaginationSlice<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = clampPage(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);

  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    rangeStart: totalItems === 0 ? 0 : start + 1,
    rangeEnd: end,
  };
}

export function buildPageSearchParams(
  current: URLSearchParams | string,
  page: number,
  pageParam = "page"
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current.toString()
  );

  if (page <= 1) params.delete(pageParam);
  else params.set(pageParam, String(page));

  const query = params.toString();
  return query ? `?${query}` : "";
}
