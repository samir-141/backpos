export function todayInLima(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isPreviousDayInLima(
  date: Date,
  referenceDate: Date = new Date(),
): boolean {
  const dateKey = todayInLima(date);
  const currentKey = todayInLima(referenceDate);
  return dateKey < currentKey;
}
