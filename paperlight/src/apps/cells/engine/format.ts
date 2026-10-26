import { isError, type CellValue, type Scalar } from './values.ts';

export interface NumberFormat {
  id: string;
  label: string;
  /** What the bar's format button shows. */
  short: string;
  /** The Excel format code written into .xlsx files. */
  code: string;
}

export const NUMBER_FORMATS: NumberFormat[] = [
  { id: 'general', label: 'Automatic', short: 'Automatic', code: 'General' },
  { id: 'number', label: 'Number', short: 'Number', code: '#,##0.00' },
  { id: 'whole', label: 'Whole number', short: 'Whole', code: '#,##0' },
  { id: 'currency', label: 'Currency', short: 'Currency', code: '$#,##0.00' },
  { id: 'percent', label: 'Percent', short: 'Percent', code: '0%' },
  { id: 'percent1', label: 'Percent, one decimal', short: 'Percent', code: '0.0%' },
  { id: 'date', label: 'Date', short: 'Date', code: 'd mmm yyyy' },
  { id: 'iso', label: 'Date, ISO', short: 'ISO date', code: 'yyyy-mm-dd' },
  { id: 'time', label: 'Time', short: 'Time', code: 'hh:mm' },
  { id: 'text', label: 'Plain text', short: 'Text', code: '@' },
];

export function formatLabel(code: string | undefined) {
  if (!code || code === 'General') return 'Automatic';
  return NUMBER_FORMATS.find((format) => format.code === code)?.short ?? 'Custom';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function dateToSerial(date: Date) {
  return (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()) - EPOCH) / DAY_MS;
}

export function serialToDate(serial: number) {
  return new Date(EPOCH + Math.round(serial * DAY_MS));
}

export function todaySerial() {
  const now = new Date();
  return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH) / DAY_MS;
}

export function nowSerial() {
  const now = new Date();
  return (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()) - EPOCH) / DAY_MS;
}

/** Excel's "General": up to ten significant digits, scientific for very large or small numbers. */
export function formatGeneral(value: number) {
  if (!Number.isFinite(value)) return '#NUM!';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e11 || abs < 1e-9) {
    const [mantissa, exponent] = value.toExponential(5).split('e');
    const trimmed = mantissa.replace(/\.?0+$/, '');
    const exp = Number(exponent);
    return `${trimmed}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
  }
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(10)));
}

function isDateCode(code: string) {
  const bare = code.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  return /[yd]/i.test(bare) || /h/i.test(bare) || (/m/i.test(bare) && !/[0#]/.test(bare));
}

function formatDate(serial: number, code: string) {
  const date = serialToDate(serial);
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const d = date.getUTCDate();
  const h = date.getUTCHours();
  const mi = date.getUTCMinutes();
  const s = date.getUTCSeconds();
  const ampm = /am\/pm/i.test(code);
  let out = '';
  let i = 0;
  let lastWasHour = false;
  while (i < code.length) {
    const rest = code.slice(i);
    const quoted = /^"([^"]*)"/.exec(rest);
    if (quoted) {
      out += quoted[1];
      i += quoted[0].length;
      continue;
    }
    const token = /^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm|\\.)/i.exec(rest);
    if (!token) {
      out += rest[0] === '\\' ? '' : rest[0];
      i += 1;
      continue;
    }
    const t = token[0].toLowerCase();
    i += token[0].length;
    if (t.startsWith('\\')) {
      out += token[0][1];
    } else if (t === 'yyyy') out += y;
    else if (t === 'yy') out += String(y).slice(-2);
    else if (t === 'mmmm') out += MONTHS_LONG[mo];
    else if (t === 'mmm') out += MONTHS[mo];
    else if (t === 'mm' || t === 'm') {
      // "m" right after an hour, or before seconds, means minutes.
      const nextLetter = /[a-z]/i.exec(code.slice(i));
      const minutes = lastWasHour || nextLetter?.[0].toLowerCase() === 's';
      const value = minutes ? mi : mo + 1;
      out += t === 'mm' ? String(value).padStart(2, '0') : value;
    } else if (t === 'dddd') out += DAYS_LONG[date.getUTCDay()];
    else if (t === 'ddd') out += DAYS[date.getUTCDay()];
    else if (t === 'dd') out += String(d).padStart(2, '0');
    else if (t === 'd') out += d;
    else if (t === 'hh' || t === 'h') {
      const hour = ampm ? h % 12 || 12 : h;
      out += t === 'hh' ? String(hour).padStart(2, '0') : hour;
    } else if (t === 'ss') out += String(s).padStart(2, '0');
    else if (t === 's') out += s;
    else if (t === 'am/pm') out += h < 12 ? 'AM' : 'PM';
    lastWasHour = t === 'hh' || t === 'h';
  }
  return out;
}

function formatNumberCode(value: number, code: string) {
  const sections = code.split(';');
  let section = sections[0];
  let number = value;
  if (value < 0 && sections[1] !== undefined) {
    section = sections[1];
    number = Math.abs(value);
  } else if (value === 0 && sections[2] !== undefined) {
    section = sections[2];
  }
  // Drop colour and condition tags such as [Red].
  section = section.replace(/\[[^\]]*\]/g, '');
  const percent = (section.match(/%/g) ?? []).length;
  number *= 100 ** percent;

  const digits = /[0#?][0#?,.]*/.exec(section.replace(/"[^"]*"/g, (m) => '\u0000'.repeat(m.length)));
  if (!digits) return section.replace(/"([^"]*)"/g, '$1');
  const pattern = digits[0];
  const dot = pattern.indexOf('.');
  const decimals = dot === -1 ? 0 : pattern.slice(dot + 1).replace(/[^0#?]/g, '').length;
  const grouping = (dot === -1 ? pattern : pattern.slice(0, dot)).includes(',');
  let text = Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: dot === -1 ? 0 : pattern.slice(dot + 1).replace(/[^0]/g, '').length,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
  if (/^0\./.test(text) && /^#\./.test(pattern)) text = text.slice(1);
  const sign = number < 0 && sections[1] === undefined ? '-' : '';
  const before = section.slice(0, digits.index).replace(/"([^"]*)"/g, '$1').replace(/[_*\\]./g, (m) => (m[0] === '\\' ? m[1] : ''));
  const after = section.slice(digits.index + pattern.length).replace(/"([^"]*)"/g, '$1').replace(/[_*\\]./g, (m) => (m[0] === '\\' ? m[1] : ''));
  return `${sign}${before}${text}${after}`;
}

export function formatValue(value: CellValue, code?: string): string {
  if (value === null) return '';
  if (isError(value)) return value.error;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  if (!code || code === 'General' || code === '@') return formatGeneral(value);
  try {
    return isDateCode(code) ? formatDate(value, code) : formatNumberCode(value, code);
  } catch {
    return formatGeneral(value);
  }
}

/** What the edit field shows for a stored value: never grouping or symbols, so it parses back. */
export function editText(value: Scalar, code?: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return /^[=+\-]|^'/.test(value) || looksNumeric(value) ? `'${value}` : value;
  if (code && isDateCode(code)) return formatDate(value, /h/i.test(code) ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd');
  if (code && code.includes('%')) return `${formatGeneral(value * 100)}%`;
  return formatGeneral(value);
}

function looksNumeric(text: string) {
  return parseInput(text).value !== text;
}

export interface ParsedInput {
  value: Scalar;
  /** A number format the input implies, such as 12% or $4.50. */
  format?: string;
}

const MONTH_INDEX = new Map(MONTHS.map((name, index) => [name.toLowerCase(), index]));

/** Turns what someone typed into a stored value, the way a spreadsheet does. Formulas are handled elsewhere. */
export function parseInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (text === '') return { value: null };
  if (raw.startsWith("'")) return { value: raw.slice(1) };
  if (/^(true|false)$/i.test(text)) return { value: text.toUpperCase() === 'TRUE' };

  const plain = /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:[eE][-+]?\d+)?$/;
  const percent = /^([-+]?[\d,]*\.?\d+)\s*%$/.exec(text);
  if (percent && plain.test(percent[1])) {
    const decimals = percent[1].split('.')[1]?.length ?? 0;
    return { value: Number(percent[1].replace(/,/g, '')) / 100, format: decimals > 0 ? '0.0%' : '0%' };
  }
  const currency = /^(-?)([$€£₹])\s?([\d,]*\.?\d+)$/.exec(text);
  if (currency && plain.test(currency[3])) {
    const amount = Number(currency[3].replace(/,/g, ''));
    return { value: currency[1] ? -amount : amount, format: `${currency[2]}#,##0.00` };
  }
  if (/\d/.test(text) && plain.test(text)) {
    const grouped = text.includes(',');
    const decimals = text.split('.')[1]?.replace(/[eE].*/, '').length ?? 0;
    return { value: Number(text.replace(/,/g, '')), format: grouped ? (decimals > 0 ? '#,##0.00' : '#,##0') : undefined };
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(text);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    const ms = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
    const check = new Date(ms);
    if (check.getUTCMonth() === Number(m) - 1) {
      return { value: (ms - EPOCH) / DAY_MS, format: hh ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd' };
    }
  }
  const spoken = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(text);
  if (spoken && MONTH_INDEX.has(spoken[2].toLowerCase())) {
    const ms = Date.UTC(Number(spoken[3]), MONTH_INDEX.get(spoken[2].toLowerCase())!, Number(spoken[1]));
    return { value: (ms - EPOCH) / DAY_MS, format: 'd mmm yyyy' };
  }
  const time = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (time && Number(time[1]) < 24 && Number(time[2]) < 60) {
    return { value: (Number(time[1]) * 60 + Number(time[2])) / 1440, format: 'hh:mm' };
  }
  return { value: raw };
}
