export const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatShortDate = (date: string) =>
  new Date(`${date}T12:00:00-05:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export const todayInputValue = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export const buildHourOptions = () => {
  const options: string[] = [];
  for (let minutes = 8 * 60; minutes <= 18 * 60; minutes += 15) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    options.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }
  return options;
};

export const DURATION_OPTIONS = [15, 30, 45, 60];

export const parseTimeToMinutes = (value: string) => {
  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
};

export const normalizeTimeInput = (value: string) => {
  const clean = value.trim();
  const compactMatch = clean.match(/^(\d{1,2})(\d{2})$/);
  const splitMatch = clean.match(/^(\d{1,2})(?::(\d{1,2}))?$/);

  const hours = compactMatch ? Number(compactMatch[1]) : splitMatch ? Number(splitMatch[1]) : NaN;
  const minutes = compactMatch ? Number(compactMatch[2]) : splitMatch?.[2] ? Number(splitMatch[2]) : 0;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return clean;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const addMinutesToTime = (value: string, minutesToAdd: number) => {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return '';

  const next = minutes + minutesToAdd;
  if (next > 23 * 60 + 59) return '';

  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`;
};

export const minutesBetweenTimes = (start: string, end: string) => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  return endMinutes - startMinutes;
};

export const isSameDay = (isoValue: string, date: string) =>
  new Date(isoValue).toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota',
  }) === date;
