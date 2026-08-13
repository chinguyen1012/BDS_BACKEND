export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = slugify(base) || 'org';
  if (!(await exists(slug))) return slug;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${slug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${slug}-${Date.now()}`;
}
