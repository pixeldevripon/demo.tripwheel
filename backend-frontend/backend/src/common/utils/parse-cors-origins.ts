export function parseCorsOrigins(env?: string): string[] {
  return (env ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
