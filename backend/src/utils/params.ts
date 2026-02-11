/**
 * Extract a string parameter from Express v5 params (which can be string | string[]).
 */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}
