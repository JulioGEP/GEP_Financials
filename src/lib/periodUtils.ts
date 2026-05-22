// Period selection utilities for date range filtering

export type PeriodPreset =
  | 'year_current'
  | 'year_prev'
  | 'q_current'
  | 'q_prev'
  | 'q1' | 'q2' | 'q3' | 'q4'
  | 'month_current'
  | 'month_prev'
  | 'week_current'
  | 'week_prev'
  | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

const MONTH_SHORT_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function currentQuarter(month: number): number {
  return Math.floor(month / 3) + 1;
}

function quarterRange(year: number, q: number): DateRange {
  const startMonth = (q - 1) * 3;
  return {
    start: startOfDay(new Date(year, startMonth, 1)),
    end: endOfDay(new Date(year, startMonth + 3, 0)),
  };
}

export function getPeriodDateRange(
  preset: PeriodPreset,
  customStart?: Date,
  customEnd?: Date,
  now = new Date()
): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = currentQuarter(month);
  const dow = now.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;

  switch (preset) {
    case 'year_current':
      return {
        start: startOfDay(new Date(year, 0, 1)),
        end: minDate(endOfDay(new Date(year, 11, 31)), endOfDay(now)),
      };
    case 'year_prev':
      return {
        start: startOfDay(new Date(year - 1, 0, 1)),
        end: endOfDay(new Date(year - 1, 11, 31)),
      };
    case 'q_current': {
      const qr = quarterRange(year, q);
      return { start: qr.start, end: minDate(qr.end, endOfDay(now)) };
    }
    case 'q_prev': {
      const prevQ = q === 1 ? 4 : q - 1;
      return quarterRange(q === 1 ? year - 1 : year, prevQ);
    }
    case 'q1': return quarterRange(year, 1);
    case 'q2': return quarterRange(year, 2);
    case 'q3': return quarterRange(year, 3);
    case 'q4': return quarterRange(year, 4);
    case 'month_current':
      return {
        start: startOfDay(new Date(year, month, 1)),
        end: minDate(endOfDay(new Date(year, month + 1, 0)), endOfDay(now)),
      };
    case 'month_prev': {
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      return {
        start: startOfDay(new Date(py, pm, 1)),
        end: endOfDay(new Date(py, pm + 1, 0)),
      };
    }
    case 'week_current': {
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysFromMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: startOfDay(monday), end: minDate(endOfDay(sunday), endOfDay(now)) };
    }
    case 'week_prev': {
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysFromMonday - 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: startOfDay(monday), end: endOfDay(sunday) };
    }
    case 'custom':
      return {
        start: startOfDay(customStart ?? new Date(year, 0, 1)),
        end: endOfDay(customEnd ?? now),
      };
    default:
      return {
        start: startOfDay(new Date(year, 0, 1)),
        end: minDate(endOfDay(new Date(year, 11, 31)), endOfDay(now)),
      };
  }
}

// Returns the same period shifted back one full year (for year-over-year comparison)
export function getPrevYearDateRange(range: DateRange): DateRange {
  const start = new Date(range.start);
  start.setFullYear(start.getFullYear() - 1);
  const end = new Date(range.end);
  end.setFullYear(end.getFullYear() - 1);
  return { start, end };
}

export function getPeriodLabel(
  preset: PeriodPreset,
  customStart?: Date,
  customEnd?: Date,
  now = new Date()
): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = currentQuarter(month);

  switch (preset) {
    case 'year_current': return `Año ${year}`;
    case 'year_prev': return `Año ${year - 1}`;
    case 'q_current': return `T${q} ${year}`;
    case 'q_prev': {
      const prevQ = q === 1 ? 4 : q - 1;
      return `T${prevQ} ${q === 1 ? year - 1 : year}`;
    }
    case 'q1': return `T1 ${year}`;
    case 'q2': return `T2 ${year}`;
    case 'q3': return `T3 ${year}`;
    case 'q4': return `T4 ${year}`;
    case 'month_current': return `${MONTH_SHORT_ES[month]} ${year}`;
    case 'month_prev': {
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      return `${MONTH_SHORT_ES[pm]} ${py}`;
    }
    case 'week_current': return 'Semana actual';
    case 'week_prev': return 'Semana anterior';
    case 'custom': {
      if (customStart && customEnd) {
        const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        return `${fmt(customStart)} – ${fmt(customEnd)}`;
      }
      return 'Personalizado';
    }
    default: return `Año ${year}`;
  }
}

export function monthsInRange(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}
