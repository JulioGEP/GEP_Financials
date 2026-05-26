// Financial calculations and aggregations
import type { Venta, Gasto, FinancialData } from '../types/financial';
import type { DateRange } from './periodUtils';
import { monthsInRange } from './periodUtils';

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
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  return items.filter((it) => {
    const d = (it as any).fecha || (it as any).fechaEmision;
    return d instanceof Date && d.getFullYear() === year && d <= today;
  });
}

export function sum<T>(items: T[], fn: (i: T) => number): number {
  return items.reduce((acc, it) => acc + (fn(it) || 0), 0);
}

// Filter helpers
export function ventasActivas(ventas: Venta[]): Venta[] {
  return ventas.filter(v => v.estado !== 'Anulado');
}

export function gastosActivos(gastos: Gasto[]): Gasto[] {
  return gastos.filter(g => g.estado !== 'Anulado');
}

// Projects permanently excluded from all expense metrics
export const PROYECTOS_EXCLUIDOS_GASTOS: string[] = ['TKEF'];

export function excluirProyectosGastos(gastos: Gasto[]): Gasto[] {
  const excluded = new Set(PROYECTOS_EXCLUIDOS_GASTOS.map(p => p.toUpperCase()));
  return gastos.filter(g => !excluded.has((g.proyecto || '').trim().toUpperCase()));
}

// Identifies gastos de personal (group 64 PGC: sueldos, SS empresa, indemnizaciones...)
// Also detects via tags: nómina, salario, personal, RRHH
export function isGastoPersonal(g: Gasto): boolean {
  if (g.cuenta && /^64\d/i.test(g.cuenta.trim())) return true;
  if (g.tags && g.tags.some(t => /^(n[oó]mina|salario|personal|rrhh|ss empresa|seg\.? social)$/i.test(t.trim()))) return true;
  return false;
}

export interface OverviewKpis {
  ingresosYTD: number;
  gastosYTD: number;
  resultadoNeto: number;
  posicionCaja: number;
  saldoDisponible: number | null;  // sum of positive bank accounts
  deudaFinanciera: number | null;  // sum of negative bank accounts (loans)
  posicionNetaBancaria: number | null; // net of all bank accounts
  hasBankData: boolean;
  pendienteCobrar: number;
  pendientePagar: number;
  pendienteProveedores: number;
  pendientePersonal: number;
  pendienteProveedoresVencido: number;
  pendientePersonalVencido: number;
  facturasVencidas: number;
  diasCobroMedio: number;
  ingresosNetoYTD: number;
  gastosNetoYTD: number;
  margenPct: number;
  pendienteCobrarVencido: number;
  pendientePagarVencido: number;
  workingCapital: number;
  facturasVencidasPago: number;
  tasaCobro: number;
  tasaPago: number;
  dpo: number;
  ivaRepercutido: number;
  ivaSoportado: number;
  saldoIVA: number;
  cobradoYTD: number;
  pagadoYTD: number;
}

export function filterByDateRange<T extends { fecha?: Date | null; fechaEmision?: Date | null }>(
  items: T[],
  range: DateRange,
  field: 'fecha' | 'fechaEmision' = 'fecha'
): T[] {
  return items.filter((it) => {
    const d = field === 'fechaEmision'
      ? (it as any).fechaEmision
      : ((it as any).fecha ?? (it as any).fechaEmision);
    return d instanceof Date && d >= range.start && d <= range.end;
  });
}

/** Net sum of all bank accounts (positive + negative). Returns null if no data. */
export function bankBalance(data: FinancialData): number | null {
  if (!data.bankAccounts || data.bankAccounts.length === 0) return null;
  return data.bankAccounts.reduce((acc, a) => acc + (a.balance ?? 0), 0);
}

/** Sum of accounts with positive balance (spendable cash). Returns null if no data. */
export function bankBalanceActive(data: FinancialData): number | null {
  if (!data.bankAccounts || data.bankAccounts.length === 0) return null;
  return data.bankAccounts
    .filter((a) => (a.balance ?? 0) > 0)
    .reduce((acc, a) => acc + a.balance, 0);
}

/** Sum of accounts with negative balance (loans, credit lines, overdrafts). Returns null if no data. */
export function bankBalanceDebt(data: FinancialData): number | null {
  if (!data.bankAccounts || data.bankAccounts.length === 0) return null;
  return data.bankAccounts
    .filter((a) => (a.balance ?? 0) < 0)
    .reduce((acc, a) => acc + a.balance, 0);
}

export function computeOverviewKpis(data: FinancialData, dateRange?: DateRange, now = new Date()): OverviewKpis {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const activeVentas = ventasActivas(data.ventas);
  const activeGastos = gastosActivos(data.gastos);

  const ventasYTD = dateRange
    ? activeVentas.filter(v => v.fecha && v.fecha >= dateRange.start && v.fecha <= dateRange.end)
    : ytdFilter(activeVentas, now);
  const gastosYTD = dateRange
    ? activeGastos.filter(g => g.fechaEmision && g.fechaEmision >= dateRange.start && g.fechaEmision <= dateRange.end)
    : ytdFilter(activeGastos, now);

  // P&L with IVA (total)
  const ingresosYTD = sum(ventasYTD, (v) => v.total);
  const gastosTotalYTD = sum(gastosYTD, (g) => g.total);

  // P&L without IVA (subtotal)
  const ingresosNetoYTD = sum(ventasYTD, (v) => v.subtotal);
  const gastosNetoYTD = sum(gastosYTD, (g) => g.subtotal);

  // Resultado neto is pre-VAT
  const resultadoNeto = ingresosNetoYTD - gastosNetoYTD;
  const margenPct = ingresosNetoYTD > 0 ? (resultadoNeto / ingresosNetoYTD) * 100 : 0;

  // Cash position: prefer real available bank balance (positive accounts only);
  // fall back to cobrado-pagado when no bank data
  const totalCobrado = sum(activeVentas, (v) => v.cobrado);
  const totalPagado = sum(activeGastos, (g) => g.pagado);
  const saldoDisponible = bankBalanceActive(data);
  const deudaFinanciera = bankBalanceDebt(data);
  const posicionNetaBancaria = bankBalance(data);
  const hasBankData = saldoDisponible !== null;
  const posicionCaja = saldoDisponible !== null ? saldoDisponible : totalCobrado - totalPagado;

  // Pending (all active, not just YTD)
  const pendienteCobrar = sum(activeVentas, (v) => v.pendiente);
  const pendientePagar = sum(activeGastos, (g) => g.pendiente);

  // Split pending payables: proveedores vs personal
  const gastosPersonal = activeGastos.filter(isGastoPersonal);
  const gastosProveedores = activeGastos.filter(g => !isGastoPersonal(g));
  const pendientePersonal = sum(gastosPersonal, (g) => g.pendiente);
  const pendienteProveedores = sum(gastosProveedores, (g) => g.pendiente);

  // Overdue receivables
  const pendienteCobrarVencido = sum(
    activeVentas.filter(v => v.estado === 'Vencido'),
    (v) => v.pendiente
  );

  // Overdue payables: estado === 'Vencido' OR (pendiente > 0 && vencimiento < today)
  const overdueGastos = activeGastos.filter(
    g => g.estado === 'Vencido' || (g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
  );
  const pendientePagarVencido = sum(overdueGastos, (g) => g.pendiente);

  const overdueProveedores = gastosProveedores.filter(
    g => g.estado === 'Vencido' || (g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
  );
  const overduePersonal = gastosPersonal.filter(
    g => g.estado === 'Vencido' || (g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
  );
  const pendienteProveedoresVencido = sum(overdueProveedores, (g) => g.pendiente);
  const pendientePersonalVencido = sum(overduePersonal, (g) => g.pendiente);

  const workingCapital = pendienteCobrar - pendientePagar;

  // Overdue invoices counts
  const facturasVencidas = activeVentas.filter(
    (v) => v.vencimiento && v.vencimiento.getTime() < today.getTime() && v.pendiente > 0
  ).length;

  const facturasVencidasPago = activeGastos.filter(
    (g) => g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime()
  ).length;

  // Tasa cobro / pago
  const totalActiveFacturado = sum(activeVentas, (v) => v.total);
  const totalActiveGastos = sum(activeGastos, (g) => g.total);
  const tasaCobro = totalActiveFacturado > 0 ? (totalCobrado / totalActiveFacturado) * 100 : 0;
  const tasaPago = totalActiveGastos > 0 ? (totalPagado / totalActiveGastos) * 100 : 0;

  // DSO: avg days from fecha to fechaCobro (active ventas)
  const cobradas = activeVentas.filter((v) => v.fecha && v.fechaCobro);
  const dso = cobradas.length
    ? cobradas.reduce((acc, v) => acc + daysBetween(v.fecha!, v.fechaCobro!), 0) /
      cobradas.length
    : 0;

  // DPO: avg days from fechaEmision to fechaPago
  const pagadasGastos = activeGastos.filter((g) => g.fechaEmision && g.fechaPago);
  const dpo = pagadasGastos.length
    ? pagadasGastos.reduce((acc, g) => acc + daysBetween(g.fechaEmision!, g.fechaPago!), 0) /
      pagadasGastos.length
    : 0;

  // IVA balance (YTD, active)
  const ivaRepercutido = sum(ventasYTD, (v) => v.iva);
  const ivaSoportado = sum(gastosYTD, (g) => g.iva);
  const saldoIVA = ivaRepercutido - ivaSoportado;

  // Cobrado/pagado within the period's invoices
  const cobradoYTD = sum(ventasYTD, (v) => v.cobrado);
  const pagadoYTD = sum(gastosYTD, (g) => g.pagado);

  return {
    ingresosYTD,
    gastosYTD: gastosTotalYTD,
    resultadoNeto,
    posicionCaja,
    saldoDisponible,
    deudaFinanciera,
    posicionNetaBancaria,
    hasBankData,
    pendienteCobrar,
    pendientePagar,
    pendienteProveedores,
    pendientePersonal,
    pendienteProveedoresVencido,
    pendientePersonalVencido,
    facturasVencidas,
    diasCobroMedio: Math.round(dso),
    ingresosNetoYTD,
    gastosNetoYTD,
    margenPct,
    pendienteCobrarVencido,
    pendientePagarVencido,
    workingCapital,
    facturasVencidasPago,
    tasaCobro,
    tasaPago,
    dpo: Math.round(dpo),
    ivaRepercutido,
    ivaSoportado,
    saldoIVA,
    cobradoYTD,
    pagadoYTD,
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
    if (!v.fecha || v.estado === 'Anulado') continue;
    const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].ingresos += v.total;
  }
  for (const g of data.gastos) {
    if (!g.fechaEmision || g.estado === 'Anulado') continue;
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

// Monthly actual cash flows using fechaCobro / fechaPago (real money movement)
export interface MonthlyCashFlowPoint {
  month: string;
  label: string;
  cobros: number;
  pagos: number;
  neto: number;
}

export function monthlyCobrosYPagos(
  data: FinancialData,
  monthsBack = 12,
  now = new Date()
): MonthlyCashFlowPoint[] {
  const buckets: Record<string, MonthlyCashFlowPoint> = {};
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = {
      month: key,
      label: `${MONTH_LABELS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      cobros: 0,
      pagos: 0,
      neto: 0,
    };
  }
  for (const v of data.ventas) {
    if (!v.fechaCobro || v.estado === 'Anulado') continue;
    const key = `${v.fechaCobro.getFullYear()}-${String(v.fechaCobro.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].cobros += v.cobrado;
  }
  for (const g of data.gastos) {
    if (!g.fechaPago || g.estado === 'Anulado') continue;
    const key = `${g.fechaPago.getFullYear()}-${String(g.fechaPago.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].pagos += g.pagado;
  }
  const arr = Object.values(buckets);
  arr.forEach((p) => (p.neto = p.cobros - p.pagos));
  return arr;
}

// Stacked monthly ventas breakdown
export interface MonthlyVentasStackedPoint {
  month: string;
  label: string;
  cobrado: number;
  pendiente: number;
  vencido: number;
}

export function monthlyVentasStacked(
  ventas: Venta[],
  monthsBack = 12,
  now = new Date()
): MonthlyVentasStackedPoint[] {
  const buckets: Record<string, MonthlyVentasStackedPoint> = {};
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = {
      month: key,
      label: `${MONTH_LABELS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      cobrado: 0,
      pendiente: 0,
      vencido: 0,
    };
  }
  for (const v of ventas) {
    if (!v.fecha || v.estado === 'Anulado') continue;
    const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) continue;
    buckets[key].cobrado += v.cobrado;
    if (v.estado === 'Vencido') {
      buckets[key].vencido += v.pendiente;
    } else {
      buckets[key].pendiente += v.pendiente;
    }
  }
  return Object.values(buckets);
}

// Estado distribution for donut charts
export interface EstadoSummary {
  estado: string;
  value: number;
  count: number;
  color: string;
}

const ESTADO_COLORS: Record<string, string> = {
  'Pagado': '#22c55e',
  'Cobrado': '#22c55e',
  'Pendiente': '#3b82f6',
  'Vencido': '#ef4444',
  'Anulado': '#9ca3af',
};

export function estadoDistributionVentas(ventas: Venta[]): EstadoSummary[] {
  const map = new Map<string, EstadoSummary>();
  for (const v of ventas) {
    const k = v.estado || 'Desconocido';
    const existing = map.get(k) || {
      estado: k,
      value: 0,
      count: 0,
      color: ESTADO_COLORS[k] || '#6b7280',
    };
    existing.value += v.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export function estadoDistributionGastos(gastos: Gasto[]): EstadoSummary[] {
  const map = new Map<string, EstadoSummary>();
  for (const g of gastos) {
    const k = g.estado || 'Desconocido';
    const existing = map.get(k) || {
      estado: k,
      value: 0,
      count: 0,
      color: ESTADO_COLORS[k] || '#6b7280',
    };
    existing.value += g.total;
    existing.count += 1;
    map.set(k, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
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

// Top tags by gastos subtotal
export function topTagsGastos(gastos: Gasto[], top = 10): TopGroup[] {
  const map = new Map<string, TopGroup>();
  for (const g of gastos) {
    if (!g.tags || !Array.isArray(g.tags)) continue;
    for (const tag of g.tags) {
      if (!tag) continue;
      const existing = map.get(tag) || { name: tag, value: 0, count: 0 };
      existing.value += g.subtotal;
      existing.count += 1;
      map.set(tag, existing);
    }
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

// Aging for payables (gastos)
export function agingGastos(gastos: Gasto[], now = new Date()): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { range: '0-30 días', value: 0, count: 0, color: '#22c55e' },
    { range: '31-60 días', value: 0, count: 0, color: '#f59e0b' },
    { range: '61-90 días', value: 0, count: 0, color: '#ef4444' },
    { range: '90+ días', value: 0, count: 0, color: '#7f1d1d' },
  ];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (const g of gastos) {
    if (g.pendiente <= 0 || !g.vencimiento) continue;
    if (g.vencimiento.getTime() >= today.getTime()) continue;
    const days = daysBetween(g.vencimiento, today);
    let idx = 0;
    if (days <= 30) idx = 0;
    else if (days <= 60) idx = 1;
    else if (days <= 90) idx = 2;
    else idx = 3;
    buckets[idx].value += g.pendiente;
    buckets[idx].count += 1;
  }
  return buckets;
}

// Monthly gastos by top cuenta (for stacked chart)
export function monthlyCuentaGastos(
  gastos: Gasto[],
  monthsBack = 6,
  top = 5,
  now = new Date()
): { data: Array<Record<string, string | number>>; cuentas: string[] } {
  const activeGastos = gastosActivos(gastos);

  // Get top N cuentas by total value
  const cuentaMap = new Map<string, number>();
  for (const g of activeGastos) {
    const k = g.cuenta || 'Sin clasificar';
    cuentaMap.set(k, (cuentaMap.get(k) || 0) + g.subtotal);
  }
  const topCuentas = Array.from(cuentaMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name]) => name);

  // Build monthly buckets
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const months: Array<{ key: string; label: string }> = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: `${MONTH_LABELS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
    });
  }

  const data = months.map(({ key, label }) => {
    const row: Record<string, string | number> = { month: key, label };
    for (const c of topCuentas) {
      row[c] = 0;
    }
    return row;
  });

  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  for (const g of activeGastos) {
    if (!g.fechaEmision) continue;
    const key = `${g.fechaEmision.getFullYear()}-${String(g.fechaEmision.getMonth() + 1).padStart(2, '0')}`;
    const idx = monthIndex.get(key);
    if (idx === undefined) continue;
    const cuenta = g.cuenta || 'Sin clasificar';
    if (topCuentas.includes(cuenta)) {
      (data[idx][cuenta] as number) += g.subtotal;
    }
  }

  return { data, cuentas: topCuentas };
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

  // Use available balance (positive accounts) as cash starting point, not net (which includes loans)
  const activeBal = bankBalanceActive(data);
  const currentCash = activeBal !== null
    ? activeBal
    : sum(data.ventas, (v) => v.cobrado) - sum(data.gastos, (g) => g.pagado);

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
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '00')}`,
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
  return ventasActivas(data.ventas)
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento >= today && v.vencimiento <= limit)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function upcomingPayables(data: FinancialData, days = 90, now = new Date()): Gasto[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  return gastosActivos(data.gastos)
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento >= today && g.vencimiento <= limit)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function overdueReceivables(data: FinancialData, now = new Date()): Venta[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return ventasActivas(data.ventas)
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento.getTime() < today.getTime())
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

export function overduePayables(data: FinancialData, now = new Date()): Gasto[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return gastosActivos(data.gastos)
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
}

// Range-aware wrappers that derive monthsBack from a DateRange
export function monthlyDataForRange(data: FinancialData, range: DateRange): MonthlyPoint[] {
  const months = Math.max(1, monthsInRange(range.start, range.end));
  return monthlyRevenueVsExpenses(data, months, range.end);
}

export function cashFlowDataForRange(data: FinancialData, range: DateRange): MonthlyCashFlowPoint[] {
  const months = Math.max(1, monthsInRange(range.start, range.end));
  return monthlyCobrosYPagos(data, months, range.end);
}

export function ventasStackedForRange(ventas: Venta[], range: DateRange): MonthlyVentasStackedPoint[] {
  const months = Math.max(1, monthsInRange(range.start, range.end));
  return monthlyVentasStacked(ventas, months, range.end);
}

export function cuentaGastosForRange(
  gastos: Gasto[],
  range: DateRange,
  top = 5
): { data: Array<Record<string, string | number>>; cuentas: string[] } {
  const months = Math.max(1, monthsInRange(range.start, range.end));
  return monthlyCuentaGastos(gastos, months, top, range.end);
}
