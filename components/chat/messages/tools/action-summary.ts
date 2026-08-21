export function visibleActionSummary(summary: unknown, fallback: string): string {
  if (typeof summary === 'string') {
    const bounded = summary.replace(/\s+/g, ' ').trim()
    if (bounded && bounded.length <= 240) return bounded
  }

  return fallback
}
