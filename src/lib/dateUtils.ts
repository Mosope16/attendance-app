// Safe Date and Time Formatting Utilities
// Eliminates "Invalid Date" errors on Android/Hermes caused by Postgres timestamp strings or missing Intl options

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Safely parses any date string, timestamp, or Date object into a valid Date.
 * Handles Postgres timestamps (e.g. "2026-09-24 20:15:00+00"), missing 'T',
 * timezone offsets without colons, numbers, and null/undefined values.
 */
export function parseSafeDate(input: any): Date {
  if (!input) return new Date();

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  if (typeof input === 'string') {
    let clean = input.trim();

    // If Postgres format with space separator "YYYY-MM-DD HH:MM:SS" -> replace first space with 'T'
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(clean)) {
      clean = clean.replace(' ', 'T');
    }

    // If timezone is "+00" or "-05" (missing minutes), append ":00"
    if (/[+-]\d{2}$/.test(clean)) {
      clean = clean + ':00';
    }

    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Try parsing standard ISO fallback
    const fallback = new Date(input);
    if (!isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return new Date();
}

/**
 * Formats time as "HH:MM AM/PM" (e.g. "04:15 PM")
 */
export function formatTime(input: any): string {
  const d = parseSafeDate(input);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;

  return `${hoursStr}:${minutesStr} ${ampm}`;
}

/**
 * Formats date as "Day, Month Date" (e.g. "Thu, 24 Sep" or "24 Sep 2026")
 */
export function formatDate(
  input: any,
  options: { showDay?: boolean; showYear?: boolean } = { showDay: true, showYear: false }
): string {
  const d = parseSafeDate(input);
  const dayName = DAYS_SHORT[d.getDay()];
  const monthName = MONTHS_SHORT[d.getMonth()];
  const dateNum = d.getDate();
  const year = d.getFullYear();

  let result = '';
  if (options.showDay) {
    result += `${dayName}, `;
  }
  result += `${dateNum} ${monthName}`;
  if (options.showYear) {
    result += ` ${year}`;
  }

  return result;
}

/**
 * Formats combined date and time: "Thu, 24 Sep · 04:15 PM"
 */
export function formatDateTime(input: any): string {
  const dateStr = formatDate(input, { showDay: true, showYear: false });
  const timeStr = formatTime(input);
  return `${dateStr} · ${timeStr}`;
}

/**
 * Returns human-friendly relative time ("Just now", "5 mins ago", "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(input: any): string {
  const d = parseSafeDate(input);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  if (diffSec < 172800) return 'Yesterday';

  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days} days ago`;

  return formatDate(d, { showDay: false, showYear: true });
}
