/**
 * Parse a date string in YYYY-MM-DD format (e.g. from <input type="date">) as local date.
 * Using new Date("YYYY-MM-DD") interprets as UTC midnight, which can shift to the previous day in US timezones.
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString || typeof dateString !== 'string') {
    return new Date(dateString);
  }
  const [y, m, d] = dateString.split('-').map(Number);
  if (y == null || m == null || d == null) {
    return new Date(dateString);
  }
  // month is 0-indexed in Date
  return new Date(y, m - 1, d);
}
