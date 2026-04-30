export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

const VIETNAM_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function toVietnamParts(date: Date): DateParts | null {
  const partMap: Partial<Record<string, string>> = {};

  for (const part of VIETNAM_PARTS_FORMATTER.formatToParts(date)) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day' ||
      part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      partMap[part.type] = part.value;
    }
  }

  if (!partMap.year || !partMap.month || !partMap.day ||
    !partMap.hour || !partMap.minute || !partMap.second) {
    return null;
  }

  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hour: partMap.hour,
    minute: partMap.minute,
    second: partMap.second,
  };
}

export function toVietnamDateTime(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = toVietnamParts(date);
  if (!parts) {
    return null;
  }

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

