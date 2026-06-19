/** Tiny class-name joiner (no clsx dependency). Filters falsy, joins with spaces. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
