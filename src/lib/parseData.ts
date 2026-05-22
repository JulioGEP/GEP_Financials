// CSV parsing utilities for Spanish financial sheets
import Papa from 'papaparse';
import type { Venta, Gasto, Estado } from '../types/financial';

/**
 * Parse a Spanish-formatted number string like "7.200,00 €" or "1.234,56"
 * into a JavaScript number. Returns 0 for empty/invalid values.
 */
export function parseSpanishNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  // Remove currency, spaces, non-breaking spaces
  let cleaned = raw
    .replace(/€/g, '')
    .replace(/ /g, '')
    .replace(/\s+/g, '');
  // Detect format: if it contains both "." and "," assume "." is thousands and "," decimal
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Pure thousands separator
    cleaned = cleaned.replace(/\./g, '');
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse Spanish date format DD/MM/YYYY into a Date object.
 * Returns null for empty/invalid values.
 */
export function parseSpanishDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback: try ISO
  const d2 = new Date(raw);
  return isNaN(d2.getTime()) ? null : d2;
}

export function parseTags(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(/[#\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeEstado(raw: unknown): Estado {
  const s = String(raw || '').trim();
  if (!s) return 'Pendiente';
  return s as Estado;
}

function getField(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
    // case-insensitive
    const found = Object.keys(row).find(
      (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
    );
    if (found && row[found] !== undefined && row[found] !== '') return row[found];
  }
  return '';
}

export function parseVentasCSV(csv: string): Venta[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data
    .filter((row) => getField(row, ['Num', 'Número']) || getField(row, ['Cliente']))
    .map<Venta>((row) => {
      const total = parseSpanishNumber(getField(row, ['Total']));
      const cobrado = parseSpanishNumber(getField(row, ['Cobrado']));
      const pendiente = parseSpanishNumber(getField(row, ['Pendiente']));
      return {
        fecha: parseSpanishDate(getField(row, ['Fecha'])),
        num: getField(row, ['Num', 'Número']),
        vencimiento: parseSpanishDate(getField(row, ['Vencimiento'])),
        cliente: getField(row, ['Cliente']),
        descripcion: getField(row, ['Descripción', 'Descripcion']),
        tags: parseTags(getField(row, ['Tags'])),
        cuenta: getField(row, ['Cuenta']),
        formaPago: getField(row, ['F.Pago', 'FPago', 'Forma Pago']),
        proyecto: getField(row, ['Proyecto']),
        subtotal: parseSpanishNumber(getField(row, ['Subtotal'])),
        iva: parseSpanishNumber(getField(row, ['IVA'])),
        retencion: parseSpanishNumber(getField(row, ['Retención', 'Retencion'])),
        empleados: parseSpanishNumber(getField(row, ['Empleados'])),
        recEq: parseSpanishNumber(getField(row, ['Rec. de eq.', 'Rec de eq', 'Rec. eq.'])),
        total,
        cobrado,
        pendiente: pendiente || Math.max(0, total - cobrado),
        estado: normalizeEstado(getField(row, ['Estado'])),
        fechaCobro: parseSpanishDate(getField(row, ['Fecha de cobro', 'Fecha cobro'])),
      };
    });
}

export function parseGastosCSV(csv: string): Gasto[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return parsed.data
    .filter((row) => getField(row, ['Num', 'Número']) || getField(row, ['Proveedor']))
    .map<Gasto>((row) => {
      const total = parseSpanishNumber(getField(row, ['Total']));
      const pagado = parseSpanishNumber(getField(row, ['Pagado']));
      const pendiente = parseSpanishNumber(getField(row, ['Pendiente']));
      return {
        fechaEmision: parseSpanishDate(getField(row, ['Fecha emisión', 'Fecha emision'])),
        num: getField(row, ['Num', 'Número']),
        numInterno: getField(row, ['Num interno', 'Núm interno']),
        fechaContable: parseSpanishDate(getField(row, ['Fecha contable'])),
        vencimiento: parseSpanishDate(getField(row, ['Vencimiento'])),
        proveedor: getField(row, ['Proveedor']),
        descripcion: getField(row, ['Descripción', 'Descripcion']),
        tags: parseTags(getField(row, ['Tags'])),
        cuenta: getField(row, ['Cuenta']),
        proyecto: getField(row, ['Proyecto']),
        subtotal: parseSpanishNumber(getField(row, ['Subtotal'])),
        iva: parseSpanishNumber(getField(row, ['IVA'])),
        retencion: parseSpanishNumber(getField(row, ['Retención', 'Retencion'])),
        empleados: parseSpanishNumber(getField(row, ['Empleados'])),
        recEq: parseSpanishNumber(getField(row, ['Rec. de eq.', 'Rec de eq'])),
        total,
        pagado,
        pendiente: pendiente || Math.max(0, total - pagado),
        estado: normalizeEstado(getField(row, ['Estado'])),
        fechaPago: parseSpanishDate(getField(row, ['Fecha de pago', 'Fecha pago'])),
      };
    });
}

/**
 * Format a number as Spanish currency: "1.234,56 €"
 */
export function formatCurrency(value: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '0,00 €';
  if (opts.compact && Math.abs(value) >= 1000) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return (
        new Intl.NumberFormat('es-ES', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value / 1_000_000) + 'M €'
      );
    }
    if (abs >= 1000) {
      return (
        new Intl.NumberFormat('es-ES', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value / 1000) + 'k €'
      );
    }
  }
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}
