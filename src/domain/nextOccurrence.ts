import type { Alarm, Weekday } from '@/domain/types';

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const setTime = (date: Date, hour: number, minute: number): Date => {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function nextOccurrence(alarm: Alarm, now: Date): Date | null {
  if (!alarm.enabled) return null;

  const targetToday = setTime(now, alarm.hour, alarm.minute);

  if (alarm.weekdays.length === 0) {
    return targetToday.getTime() >= now.getTime() ? targetToday : null;
  }

  const validIndices = new Set(alarm.weekdays.map((w) => WEEKDAY_INDEX[w]));

  for (let offset = 0; offset < 8; offset++) {
    const candidate = setTime(addDays(now, offset), alarm.hour, alarm.minute);
    const isValidWeekday = validIndices.has(candidate.getDay());
    const isFuture = candidate.getTime() >= now.getTime();
    if (isValidWeekday && isFuture) return candidate;
  }

  return null;
}
