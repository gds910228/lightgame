export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '< 1m';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
export function formatScore(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '—';
  return formatNumber(score);
}
export function formatDate(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}
