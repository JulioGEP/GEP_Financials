// Financial calculations and aggregations
import type { Venta, Gasto, FinancialData } from '../types/financial';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function isOverdue(vencimiento: Date | null, pendiente: number, now = new Date()): boolean {
  if (!vencimiento || pendiente <= 0) return false;
  return vencimiento.getTime() < now.setHours(0, 0, 0, 0);
}

export function ytdFilter<T extends { fecha?: Date | null; fechaEmision?: Date | null }>(
  items: T[],
  now = new Date()
): T[] {
  const year = now.getFullYear();
  return items.filter((it) => {
    const d = (it as any).fecha || (it as any).fechaEmision;
    return d instanceof Date && d.getFullYear() === year;
  });
}

export function sum<T>(items: T[], fn: (i: T) => number): number {
  return items.reduce((acc, it) => acc + (fn(it) || 0), 0);
}

export interface OverviewKpis {
  ingresosYTD: number;
  gastosYTD: number;
  resultadoNeto: number;
  posicionCaja: number;
  pendienteCobrar: number;
  pendientePagar: number;
  facturasVencidas: number;
  diasCobroMedio: number;
}

export function computeOverviewKpis(data: FinancialData, now = new Date()): OverviewKpis {
  const ventasYTD = ytdFilter(data.ventas, now);
  const gastosYTD = ytdFilter(data.gastos, now);

  const ingresosYTD = sum(ventasYTD, (v) => v.total);
  const gastosTotalYTD = sum(gastosYTD, (g) => g.total);
  const resultadoNeto = ingresosYTD - gastosTotalYTD;

  const totalCobrado = sum(data.ventas, (v) => v.cobrado);
  const totalPagado = sum(data.gastos, (g) => g.pagado);
  const posicionCaja = totalCobrado - totalPagado;

  const pendienteCobrar = sum(data.ventas, (v) => v.pendiente);
  const pendientePagar = sum(data.gastos, (g) => g.pendiente);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const facturasVencidas = data.ventas.filter(
    (v) => v.vencimiento && v.vencimiento.getTime() < today.getTime() && v.pendiente > 0
  ).length;

  const cobradas = data.ventas.filter((v) => v.fecha && v.fechaCobro);
  const dso = cobradas.length
    ? cobradas.reduce((acc, v) => acc + daysBetween(v.fecha!, v.fechaCobro!), 0) /
      cobradas.length
    : 0;

  return {
    ingresosYTD,
    gastosYTD: gastosTotalYTD,
    resultadoNeto,
    posicionCaja,
    pendienteCobrar,
    pendientePagar,
    facturasVencidas,
    diasCobroMedio: Math.round(dso),
  };
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // MMM YY
  ingresos: number;
  gastos: number;
  neto: number;
}

const MONTH_LABELS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export function monthlyRevenueVsExpenses(
  data: FinancialData,
  monthsBack = 12,
  now = new Date()
): MonthlyPoint[] {
  const buckets: Record<string, MonthlyPoint> = {};
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = {
      month: key,
      label: `${MONTH_LABELS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      ingresos: 0,
      gastos: 0,
      neto: 0,
    };
  }
  for (const v of data.ventas) {
    if (!v.fecha) continue;
    const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].ingresos += v.total;
  }
  for (const g of data.gastos) {
    if (!g.fechaEmision) continue;
    const key = `${g.fechaEmision.getFullYear()}-${String(g.fechaEmision.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].gastos += g.total;
  }
  const arr = Object.values(buckets);
  arr.forEach((p) => (p.neto = p.ingresos - p.gastos));
  return arr;
}

export interface CashPoint {
  date: string;
  label: string;
  cash: number;
}

export function cashPositionTrend(data: FinancialData, monthsBack = 12, now = new Date()): CashPoint[] {
  const points: CashPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const cobradoAcc = data.ventas
      .filter((v) => v.fechaCobro && v.fechaCobro <= endOfMonth)
      .reduce((acc, v) => acc + v.cobrado, 0);
    const pagadoAcc = data.gastos
      .filter((g) => g.fechaPago && g.fechaPago <= endOfMonth)
      .reduce((acc, g) => acc + g.pagado, 0);
    points.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      cash: cobradoAcc - pagadoAcc,
    });
  }
  return points;
}

export interface TopGroup {
  name: string;
  value: number;
  count: number;
}

export function topClientes(ventas: Venta[], top = 8): TopGroup[] {
  const map = new Map<string, TopGroup>();
  for (const v of ventas) {
    const k = v.cliente || 'Sin asignar';
    const existing = map.get(k) || { name: k, value: 0, count: 0 };
    existing.value += v.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, top);
}

export function topProyectos<T extends { proyecto: string; total: number }>(
  items: T[],
  top = 8
): TopGroup[] {
  const map = new Map<string, TopGroup>();
  for (const it of items) {
    const k = it.proyecto || 'Sin proyecto';
    const existing = map.get(k) || { name: k, value: 0, count: 0 };
    existing.value += it.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, top);
}

export function topProveedores(gastos: Gasto[], top = 8): TopGroup[] {
  const map = new Map<string, TopGroup>();
  for (const g of gastos) {
    const k = g.proveedor || 'Sin asignar';
    const existing = map.get(k) || { name: k, value: 0, count: 0 };
    existing.value += g.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, top);
}

export function topCuentasGastos(gastos: Gasto[], top = 8): TopGroup[] {
  const map = new Map<string, TopGroup>();
  for (const g of gastos) {
    const k = g.cuenta || 'Sin clasificar';
    const existing = map.get(k) || { name: k, value: 0, count: 0 };
    existing.value += g.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, top);
}

export interface AgingBucket {
  range: string;
  value: number;
  count: number;
  color: string;
}

export function agingAnalysis(ventas: Venta[], now = new Date()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: '0-30 días', value: 0, count: 0, color: '#22c55e' },
    { range: '31-60 días', value: 0, count: 0, color: '#f59e0b' },
    { range: '61-90 días', value: 0, count: 0, color: '#ef4444' },
    { range: '90+ días', value: 0, count: 0, color: '#7f1d1d' },
  ];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (const v of ventas) {
    if (v.pendiente <= 0 || !v.vencimiento) continue;
    if (v.vencimiento.getTime() >= today.getTime()) continue;
    const days = daysBetween(v.vencimiento, today);
    let idx = 0;
    if (days <= 30) idx = 0;
    else if (days <= 60) idx = 1;
    else if (days <= 90) idx = 2;
    else idx = 3;
    buckets[idx].value += v.pendiente;
    buckets[idx].count += 1;
  }
  return buckets;
}

export interface CashFlowProjection {
  month: string;
  label: string;
  receivables: number;
  payables: number;
  net: number;
  cumulative: number;
}

export function projectedCashFlow(
  data: FinancialData,
  monthsAhead = 6,
  now = new Date()
): CashFlowProjection[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const currentCash =
    sum(data.ventas, (v) => v.cobrado) - sum(data.gastos, (g) => g.pagado);

  const points: CashFlowProjection[] = [];
  let cumulative = currentCash;

  for (let i = 0; i < monthsAhead; i++) {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
    const receivables = data.ventas
      .filter(
        (v) =>
          v.pendiente > 0 &&
          v.vencimiento &&
          v.vencimiento >= start &&
          v.vencimiento <= end
      )
      .reduce((acc, v) => acc + v.pendiente, 0);
    const payables = data.gastos
      .filter(
        (g) =>
          g.pendiente > 0 &&
          g.vencimiento &&
          g.vencimiento >= start &&
          g.vencimiento <= end
      )
      .reduce((acc, g) => acc + g.pendiente, 0);
    const net = receivables - payables;
    cumulative += net;
    points.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS_ES[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`,
      receivables,
      payables,
      net,
      cumulative,
    });
  }
  return points;
}

export function netNextNDays(data: FinancialData, days: number, now = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  const inflow = data.ventas
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento >= today && v.vencimiento <= limit)
    .reduce((acc, v) => acc + v.pendiente, 0);
  const outflow = data.gastos
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento >= today && g.vencimiento <= limit)
    .reduce((acc, g) => acc + g.pendiente, 0);
  return inflow - outflow;
}

export function upcomingReceivables(data: FinancialData, days = 90, now = new Date()): Venta[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return data.ventas
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento >= today && v.vencimiento <= limit)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function upcomingPayables(data: FinancialData, days = 90, now = new Date()): Gasto[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return data.gastos
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento >= today && g.vencimiento <= limit)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function overdueReceivables(data: FinancialData, now = new Date()): Venta[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return data.ventas
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento.getTime() < today.getTime())
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function overduePayables(data: FinancialData, now = new Date()): Gasto[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return data.gastos
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}
