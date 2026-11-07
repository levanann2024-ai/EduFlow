type TimetableSession = 'morning' | 'afternoon';

interface PeriodTimes {
  start: string;
  end: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  reminders?: boolean;
}

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const PERIOD_TIMES: Record<TimetableSession, PeriodTimes[]> = {
  morning: [
    { start: '07:15', end: '08:00' },
    { start: '08:15', end: '09:00' },
    { start: '09:10', end: '09:55' },
    { start: '10:00', end: '10:45' },
    { start: '11:00', end: '11:40' },
  ],
  afternoon: [
    { start: '13:15', end: '14:00' },
    { start: '14:05', end: '14:50' },
    { start: '14:55', end: '15:45' },
    { start: '16:00', end: '16:40' },
    { start: '16:50', end: '17:30' },
  ],
};

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addCalendarDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function createPeriodCalendarEvent(input: {
  id: string;
  date: string;
  session: TimetableSession | null;
  period: number;
  title: string;
  description?: string;
  reminders?: boolean;
}): CalendarEvent {
  if (!isDateKey(input.date)) {
    throw new Error('Ngày của tiết học không hợp lệ.');
  }
  const periodTimes = input.session ? PERIOD_TIMES[input.session][input.period - 1] : undefined;
  if (!periodTimes) {
    return {
      id: input.id,
      title: input.title,
      description: input.description,
      startDate: input.date,
      endDate: addCalendarDays(input.date, 1),
    };
  }
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    startDate: input.date,
    startTime: periodTimes.start,
    endTime: periodTimes.end,
    reminders: input.reminders,
  };
}

function getVietnamLocalDateTime(value: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hour = part('hour');
  const minute = part('minute');
  const second = part('second');
  if (!year || !month || !day || !hour || !minute || !second) return null;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
  };
}

export function createDeadlineCalendarEvent(input: {
  id: string;
  startsAt: string | null | undefined;
  title: string;
  description?: string;
}): CalendarEvent | null {
  if (!input.startsAt) return null;
  const localStart = getVietnamLocalDateTime(input.startsAt);
  if (!localStart) return null;
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    startDate: localStart.date,
    startTime: localStart.time,
    durationMinutes: 15,
    reminders: true,
  };
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function compactDate(value: string) {
  return value.replace(/-/g, '');
}

function compactDateTime(date: string, time: string) {
  const compactTime = time.replace(/:/g, '');
  return `${compactDate(date)}T${compactTime}${compactTime.length === 4 ? '00' : ''}`;
}

function hashId(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `eduflow-${(hash >>> 0).toString(16)}@calendar.eduflow`;
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (bytes + characterBytes > 75) {
      parts.push(current);
      current = ' ';
      bytes = 1;
    }
    current += character;
    bytes += characterBytes;
  }
  parts.push(current);
  return parts.join('\r\n');
}

function serializeEvent(event: CalendarEvent) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${hashId(event.id)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
  ];
  if (event.startTime) {
    lines.push(`DTSTART;TZID=${TIME_ZONE}:${compactDateTime(event.startDate, event.startTime)}`);
    if (event.endTime) {
      lines.push(`DTEND;TZID=${TIME_ZONE}:${compactDateTime(event.startDate, event.endTime)}`);
    } else if (event.durationMinutes) {
      lines.push(`DURATION:PT${event.durationMinutes}M`);
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(event.endDate ?? addCalendarDays(event.startDate, 1))}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.reminders) {
    for (const trigger of ['-P1D', '-PT1H']) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(`Sắp đến hạn: ${event.title}`)}`,
        `TRIGGER:${trigger}`,
        'END:VALARM',
      );
    }
  }
  lines.push('END:VEVENT');
  return lines;
}

export function buildCalendarFile(events: CalendarEvent[], calendarName: string) {
  const uniqueEvents = new Map<string, CalendarEvent>();
  for (const event of events) uniqueEvents.set(event.id, event);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EduFlow//School Calendar//VI',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TIME_ZONE}`,
    `X-LIC-LOCATION:${TIME_ZONE}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0700',
    'TZOFFSETTO:+0700',
    'TZNAME:ICT',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const event of uniqueEvents.values()) lines.push(...serializeEvent(event));
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function downloadCalendarFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
