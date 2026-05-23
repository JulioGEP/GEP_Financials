import { useState, useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Scale,
  Hourglass,
  ReceiptText,
  AlertOctagon,
  AlertTriangle,
  Clock,
  CalendarCheck,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Zap,
} from 'lucide-react';
import type { FinancialData, Venta, Gasto } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { AlertCard } from '../ui/AlertCard';
import { MetricModal } from '../ui/MetricModal';
import { formatCurrency } from '../../lib/parseData';
import {
  computeOverviewKpis,
  monthlyDataForRange,
  cashFlowDataForRange,
  ventasActivas,
  gastosActivos,
  filterByDateRange,
  daysBetween,
  isGastoPersonal,
} from '../../lib/calculations';
import { generateAlerts } from '../../lib/alerts';
import { usePeriod } from '../../context/PeriodContext';
import { EntityFilters, applyGastoFilters, applyVentaFilters, getFilterOptions, type FilterState } from '../ui/EntityFilters';

interface OverviewProps {
  data: FinancialData | null;
  loading: boolean;
}

type MetricKey =
  | 'facturacion'
  | 'gastos'
  | 'resultado'
  | 'caja'
  | 'working'
  | 'pendienteCobrar'
  | 'pendientePagar'
  | 'pendientePersonal'
  | 'cobrosVencidos'
  | 'pagosVencidos'
  | 'dso'
  | 'dpo';

function pctDelta(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : 100;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function deltaDirection(delta: number): 'up' | 'down' | 'neutral' {
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'neutral';
}

function fmtDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EstadoBadge({ estado }: { estado: string }) {
  const cls: Record<string, string> = {
    Cobrado: 'bg-green-100 text-green-700',
    Pagado: 'bg-green-100 text-green-700',
    Pendiente: 'bg-blue-100 text-blue-700',
    Vencido: 'bg-red-100 text-red-700',
    Anulado: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${cls[estado] ?? 'bg-gray-100 text-gray-600'}`}>
      {estado}
    </span>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-200">
        {cols.map((c) => (
          <th key={c} className="text-left text-[11px] uppercase tracking-wider font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ---------- Modal content components ----------

function FacturacionModal({ ventas }: { ventas: Venta[] }) {
  const sorted = [...ventas].sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
  const total = sorted.reduce((s, v) => s + v.total, 0);
  const cobrado = sorted.reduce((s, v) => s + v.cobrado, 0);
  const pendiente = sorted.reduce((s, v) => s + v.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total facturado', value: formatCurrency(total), color: 'text-gep-dark' },
          { label: 'Cobrado', value: formatCurrency(cobrado), color: 'text-green-600' },
          { label: 'Pendiente', value: formatCurrency(pendiente), color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Fecha', 'Nº', 'Cliente', 'Descripción', 'Total', 'Cobrado', 'Pendiente', 'Estado', 'Vencimiento']} />
          <tbody>
            {sorted.map((v, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(v.fecha)}</td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{v.num}</td>
                <td className="py-2 pr-4 font-medium text-gep-dark max-w-[180px] truncate">{v.cliente}</td>
                <td className="py-2 pr-4 text-gray-500 max-w-[200px] truncate">{v.descripcion}</td>
                <td className="py-2 pr-4 text-right font-semibold text-gep-dark whitespace-nowrap">{formatCurrency(v.total)}</td>
                <td className="py-2 pr-4 text-right text-green-600 whitespace-nowrap">{formatCurrency(v.cobrado)}</td>
                <td className="py-2 pr-4 text-right text-amber-600 whitespace-nowrap">{formatCurrency(v.pendiente)}</td>
                <td className="py-2 pr-4"><EstadoBadge estado={v.estado} /></td>
                <td className="py-2 text-gray-500 whitespace-nowrap">{fmtDate(v.vencimiento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="text-center text-gray-400 py-8">Sin registros en el período.</p>}
      </div>
    </div>
  );
}

function GastosModal({ gastos }: { gastos: Gasto[] }) {
  const sorted = [...gastos].sort((a, b) => (b.fechaEmision?.getTime() ?? 0) - (a.fechaEmision?.getTime() ?? 0));
  const total = sorted.reduce((s, g) => s + g.total, 0);
  const pagado = sorted.reduce((s, g) => s + g.pagado, 0);
  const pendiente = sorted.reduce((s, g) => s + g.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total gastos', value: formatCurrency(total), color: 'text-gep-dark' },
          { label: 'Pagado', value: formatCurrency(pagado), color: 'text-green-600' },
          { label: 'Pendiente', value: formatCurrency(pendiente), color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Fecha', 'Nº', 'Proveedor', 'Descripción', 'Cuenta', 'Total', 'Pagado', 'Pendiente', 'Estado', 'Vencimiento']} />
          <tbody>
            {sorted.map((g, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(g.fechaEmision)}</td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{g.num}</td>
                <td className="py-2 pr-4 font-medium text-gep-dark max-w-[160px] truncate">{g.proveedor}</td>
                <td className="py-2 pr-4 text-gray-500 max-w-[180px] truncate">{g.descripcion}</td>
                <td className="py-2 pr-4 text-gray-500 max-w-[120px] truncate">{g.cuenta}</td>
                <td className="py-2 pr-4 text-right font-semibold text-gep-dark whitespace-nowrap">{formatCurrency(g.total)}</td>
                <td className="py-2 pr-4 text-right text-green-600 whitespace-nowrap">{formatCurrency(g.pagado)}</td>
                <td className="py-2 pr-4 text-right text-amber-600 whitespace-nowrap">{formatCurrency(g.pendiente)}</td>
                <td className="py-2 pr-4"><EstadoBadge estado={g.estado} /></td>
                <td className="py-2 text-gray-500 whitespace-nowrap">{fmtDate(g.vencimiento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="text-center text-gray-400 py-8">Sin registros en el período.</p>}
      </div>
    </div>
  );
}

function ResultadoModal({ ventas, gastos }: { ventas: Venta[]; gastos: Gasto[] }) {
  const ingresosNeto = ventas.reduce((s, v) => s + v.subtotal, 0);
  const gastosNeto = gastos.reduce((s, g) => s + g.subtotal, 0);
  const resultado = ingresosNeto - gastosNeto;
  const margen = ingresosNeto > 0 ? (resultado / ingresosNeto) * 100 : 0;

  // Group by month
  const monthMap = new Map<string, { label: string; ingresos: number; gastos: number }>();
  const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  for (const v of ventas) {
    if (!v.fecha) continue;
    const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(key) ?? { label: `${LABELS[v.fecha.getMonth()]} ${String(v.fecha.getFullYear()).slice(2)}`, ingresos: 0, gastos: 0 };
    entry.ingresos += v.subtotal;
    monthMap.set(key, entry);
  }
  for (const g of gastos) {
    if (!g.fechaEmision) continue;
    const key = `${g.fechaEmision.getFullYear()}-${String(g.fechaEmision.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(key) ?? { label: `${LABELS[g.fechaEmision.getMonth()]} ${String(g.fechaEmision.getFullYear()).slice(2)}`, ingresos: 0, gastos: 0 };
    entry.gastos += g.subtotal;
    monthMap.set(key, entry);
  }
  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, neto: v.ingresos - v.gastos }));

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Ingresos neto', value: formatCurrency(ingresosNeto), color: 'text-green-600' },
          { label: 'Gastos neto', value: formatCurrency(gastosNeto), color: 'text-gep-red' },
          { label: 'Resultado neto', value: formatCurrency(resultado), color: resultado >= 0 ? 'text-green-600' : 'text-gep-red' },
          { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-green-600' : 'text-gep-red' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3">Desglose mensual (sin IVA)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Mes', 'Ingresos', 'Gastos', 'Resultado', 'Margen']} />
          <tbody>
            {monthly.map((m, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 font-medium text-gep-dark">{m.label}</td>
                <td className="py-2 pr-4 text-right text-green-600">{formatCurrency(m.ingresos)}</td>
                <td className="py-2 pr-4 text-right text-gep-red">{formatCurrency(m.gastos)}</td>
                <td className={`py-2 pr-4 text-right font-semibold ${m.neto >= 0 ? 'text-green-600' : 'text-gep-red'}`}>{formatCurrency(m.neto)}</td>
                <td className={`py-2 text-right ${m.ingresos > 0 && (m.neto / m.ingresos) * 100 >= 0 ? 'text-green-600' : 'text-gep-red'}`}>
                  {m.ingresos > 0 ? `${((m.neto / m.ingresos) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {monthly.length === 0 && <p className="text-center text-gray-400 py-8">Sin registros en el período.</p>}
      </div>
    </div>
  );
}

function CajaModal({ ventas, gastos }: { ventas: Venta[]; gastos: Gasto[] }) {
  const LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthMap = new Map<string, { label: string; cobros: number; pagos: number }>();
  for (const v of ventas) {
    if (!v.fechaCobro || v.cobrado <= 0) continue;
    const key = `${v.fechaCobro.getFullYear()}-${String(v.fechaCobro.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(key) ?? { label: `${LABELS[v.fechaCobro.getMonth()]} ${String(v.fechaCobro.getFullYear()).slice(2)}`, cobros: 0, pagos: 0 };
    entry.cobros += v.cobrado;
    monthMap.set(key, entry);
  }
  for (const g of gastos) {
    if (!g.fechaPago || g.pagado <= 0) continue;
    const key = `${g.fechaPago.getFullYear()}-${String(g.fechaPago.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(key) ?? { label: `${LABELS[g.fechaPago.getMonth()]} ${String(g.fechaPago.getFullYear()).slice(2)}`, cobros: 0, pagos: 0 };
    entry.pagos += g.pagado;
    monthMap.set(key, entry);
  }
  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, neto: v.cobros - v.pagos }));

  const totalCobros = monthly.reduce((s, m) => s + m.cobros, 0);
  const totalPagos = monthly.reduce((s, m) => s + m.pagos, 0);
  const posicion = totalCobros - totalPagos;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total cobrado', value: formatCurrency(totalCobros), color: 'text-green-600' },
          { label: 'Total pagado', value: formatCurrency(totalPagos), color: 'text-gep-red' },
          { label: 'Posición neta', value: formatCurrency(posicion), color: posicion >= 0 ? 'text-green-600' : 'text-gep-red' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3">Movimientos reales por mes</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Mes', 'Cobros reales', 'Pagos reales', 'Saldo neto']} />
          <tbody>
            {monthly.map((m, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 font-medium text-gep-dark">{m.label}</td>
                <td className="py-2 pr-4 text-right text-green-600">{formatCurrency(m.cobros)}</td>
                <td className="py-2 pr-4 text-right text-gep-red">{formatCurrency(m.pagos)}</td>
                <td className={`py-2 text-right font-semibold ${m.neto >= 0 ? 'text-green-600' : 'text-gep-red'}`}>{formatCurrency(m.neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {monthly.length === 0 && <p className="text-center text-gray-400 py-8">Sin movimientos de caja registrados.</p>}
      </div>
    </div>
  );
}

function WorkingCapitalModal({ ventas, gastos }: { ventas: Venta[]; gastos: Gasto[] }) {
  const pendienteCobrar = ventas.reduce((s, v) => s + v.pendiente, 0);
  const pendienteProveedores = gastos.filter(g => !isGastoPersonal(g)).reduce((s, g) => s + g.pendiente, 0);
  const pendientePersonal = gastos.filter(isGastoPersonal).reduce((s, g) => s + g.pendiente, 0);
  const pendientePagar = pendienteProveedores + pendientePersonal;
  const wc = pendienteCobrar - pendientePagar;

  // Top clientes con pendiente
  const clienteMap = new Map<string, number>();
  for (const v of ventas) {
    if (v.pendiente <= 0) continue;
    clienteMap.set(v.cliente, (clienteMap.get(v.cliente) ?? 0) + v.pendiente);
  }
  const topClientes = Array.from(clienteMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Top proveedores con pendiente (excluyendo personal)
  const proveedorMap = new Map<string, number>();
  for (const g of gastos) {
    if (g.pendiente <= 0 || isGastoPersonal(g)) continue;
    proveedorMap.set(g.proveedor, (proveedorMap.get(g.proveedor) ?? 0) + g.pendiente);
  }
  const topProveedores = Array.from(proveedorMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Pendiente cobrar', value: formatCurrency(pendienteCobrar), color: 'text-amber-600' },
          { label: 'Pend. proveedores', value: formatCurrency(pendienteProveedores), color: 'text-gep-red' },
          { label: 'Pend. personal', value: formatCurrency(pendientePersonal), color: 'text-orange-500' },
          { label: 'Capital de trabajo', value: formatCurrency(wc), color: wc >= 0 ? 'text-green-600' : 'text-gep-red' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3">Top clientes — pendiente cobrar</h3>
          <table className="w-full text-sm">
            <TableHeader cols={['Cliente', 'Pendiente']} />
            <tbody>
              {topClientes.map(([cliente, v], i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gep-dark truncate max-w-[180px]">{cliente}</td>
                  <td className="py-2 text-right text-amber-600 font-semibold">{formatCurrency(v)}</td>
                </tr>
              ))}
              {topClientes.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">Sin pendientes.</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-3">Top proveedores — pendiente pagar</h3>
          <table className="w-full text-sm">
            <TableHeader cols={['Proveedor', 'Pendiente']} />
            <tbody>
              {topProveedores.map(([proveedor, v], i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gep-dark truncate max-w-[180px]">{proveedor}</td>
                  <td className="py-2 text-right text-gep-red font-semibold">{formatCurrency(v)}</td>
                </tr>
              ))}
              {topProveedores.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-gray-400">Sin pendientes.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PendienteCobrarModal({ ventas }: { ventas: Venta[] }) {
  const pending = ventas
    .filter((v) => v.pendiente > 0)
    .sort((a, b) => (a.vencimiento?.getTime() ?? 0) - (b.vencimiento?.getTime() ?? 0));
  const total = pending.reduce((s, v) => s + v.pendiente, 0);
  const vencido = pending.filter(v => v.estado === 'Vencido').reduce((s, v) => s + v.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total pendiente cobrar', value: formatCurrency(total), color: 'text-amber-600' },
          { label: 'Del que vencido', value: formatCurrency(vencido), color: 'text-gep-red' },
          { label: 'Facturas pendientes', value: String(pending.length), color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Vencimiento', 'Nº', 'Cliente', 'Descripción', 'Total', 'Pendiente', 'Estado']} />
          <tbody>
            {pending.map((v, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className={`py-2 pr-4 whitespace-nowrap ${v.estado === 'Vencido' ? 'text-gep-red font-semibold' : 'text-gray-500'}`}>{fmtDate(v.vencimiento)}</td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{v.num}</td>
                <td className="py-2 pr-4 font-medium text-gep-dark max-w-[180px] truncate">{v.cliente}</td>
                <td className="py-2 pr-4 text-gray-500 max-w-[200px] truncate">{v.descripcion}</td>
                <td className="py-2 pr-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(v.total)}</td>
                <td className="py-2 pr-4 text-right font-semibold text-amber-600 whitespace-nowrap">{formatCurrency(v.pendiente)}</td>
                <td className="py-2"><EstadoBadge estado={v.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pending.length === 0 && <p className="text-center text-gray-400 py-8">Sin facturas pendientes.</p>}
      </div>
    </div>
  );
}

function PendientePagarModal({ gastos }: { gastos: Gasto[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pending = gastos
    .filter((g) => g.pendiente > 0 && !isGastoPersonal(g))
    .sort((a, b) => (a.vencimiento?.getTime() ?? 0) - (b.vencimiento?.getTime() ?? 0));
  const total = pending.reduce((s, g) => s + g.pendiente, 0);
  const vencido = pending.filter(g => g.vencimiento && g.vencimiento < today).reduce((s, g) => s + g.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total pend. proveedores', value: formatCurrency(total), color: 'text-amber-600' },
          { label: 'Del que vencido', value: formatCurrency(vencido), color: 'text-gep-red' },
          { label: 'Facturas pendientes', value: String(pending.length), color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Vencimiento', 'Nº', 'Proveedor', 'Descripción', 'Cuenta', 'Total', 'Pendiente', 'Estado']} />
          <tbody>
            {pending.map((g, i) => {
              const overdue = g.vencimiento && g.vencimiento < today;
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className={`py-2 pr-4 whitespace-nowrap ${overdue ? 'text-gep-red font-semibold' : 'text-gray-500'}`}>{fmtDate(g.vencimiento)}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{g.num}</td>
                  <td className="py-2 pr-4 font-medium text-gep-dark max-w-[150px] truncate">{g.proveedor}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[180px] truncate">{g.descripcion}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[120px] truncate">{g.cuenta}</td>
                  <td className="py-2 pr-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(g.total)}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-amber-600 whitespace-nowrap">{formatCurrency(g.pendiente)}</td>
                  <td className="py-2"><EstadoBadge estado={g.estado} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pending.length === 0 && <p className="text-center text-gray-400 py-8">Sin facturas de proveedores pendientes.</p>}
      </div>
    </div>
  );
}

function NominasModal({ gastos }: { gastos: Gasto[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pending = gastos
    .filter((g) => g.pendiente > 0 && isGastoPersonal(g))
    .sort((a, b) => (a.vencimiento?.getTime() ?? 0) - (b.vencimiento?.getTime() ?? 0));
  const all = gastos
    .filter(isGastoPersonal)
    .sort((a, b) => (a.vencimiento?.getTime() ?? 0) - (b.vencimiento?.getTime() ?? 0));
  const totalPendiente = pending.reduce((s, g) => s + g.pendiente, 0);
  const totalPagado = all.reduce((s, g) => s + g.pagado, 0);
  const vencido = pending.filter(g => g.vencimiento && g.vencimiento < today).reduce((s, g) => s + g.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Nóminas pend. de pago', value: formatCurrency(totalPendiente), color: 'text-amber-600' },
          { label: 'Del que vencido', value: formatCurrency(vencido), color: 'text-gep-red' },
          { label: 'Ya pagado (mismo período)', value: formatCurrency(totalPagado), color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Vencimiento', 'Nº', 'Descripción', 'Cuenta', 'Total', 'Pagado', 'Pendiente', 'Estado']} />
          <tbody>
            {all.map((g, i) => {
              const overdue = g.pendiente > 0 && g.vencimiento && g.vencimiento < today;
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className={`py-2 pr-4 whitespace-nowrap ${overdue ? 'text-gep-red font-semibold' : 'text-gray-500'}`}>{fmtDate(g.vencimiento)}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{g.num}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[220px] truncate">{g.descripcion || g.proveedor}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[140px] truncate">{g.cuenta}</td>
                  <td className="py-2 pr-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(g.total)}</td>
                  <td className="py-2 pr-4 text-right text-green-600 whitespace-nowrap">{formatCurrency(g.pagado)}</td>
                  <td className={`py-2 pr-4 text-right font-semibold whitespace-nowrap ${g.pendiente > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{formatCurrency(g.pendiente)}</td>
                  <td className="py-2"><EstadoBadge estado={g.estado} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {all.length === 0 && <p className="text-center text-gray-400 py-8">Sin gastos de personal registrados.</p>}
      </div>
    </div>
  );
}

function CobrosVencidosModal({ ventas }: { ventas: Venta[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = ventas
    .filter((v) => v.pendiente > 0 && v.vencimiento && v.vencimiento < today)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
  const total = overdue.reduce((s, v) => s + v.pendiente, 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total vencido', value: formatCurrency(total), color: 'text-gep-red' },
          { label: 'Facturas vencidas', value: String(overdue.length), color: 'text-gep-red' },
          { label: 'Promedio por factura', value: overdue.length ? formatCurrency(total / overdue.length) : '—', color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Vencimiento', 'Días vencido', 'Nº', 'Cliente', 'Descripción', 'Total', 'Pendiente']} />
          <tbody>
            {overdue.map((v, i) => {
              const dias = daysBetween(v.vencimiento!, today);
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-4 text-gep-red font-semibold whitespace-nowrap">{fmtDate(v.vencimiento)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${dias > 90 ? 'bg-red-200 text-red-800' : dias > 60 ? 'bg-red-100 text-red-700' : dias > 30 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {dias}d
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{v.num}</td>
                  <td className="py-2 pr-4 font-medium text-gep-dark max-w-[160px] truncate">{v.cliente}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[180px] truncate">{v.descripcion}</td>
                  <td className="py-2 pr-4 text-right text-gray-600 whitespace-nowrap">{formatCurrency(v.total)}</td>
                  <td className="py-2 text-right font-bold text-gep-red whitespace-nowrap">{formatCurrency(v.pendiente)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {overdue.length === 0 && <p className="text-center text-gray-400 py-8">Sin cobros vencidos.</p>}
      </div>
    </div>
  );
}

function PagosVencidosModal({ gastos }: { gastos: Gasto[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = gastos
    .filter((g) => g.pendiente > 0 && g.vencimiento && g.vencimiento < today)
    .sort((a, b) => (a.vencimiento!.getTime() - b.vencimiento!.getTime()));
  const total = overdue.reduce((s, g) => s + g.pendiente, 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total vencido', value: formatCurrency(total), color: 'text-gep-red' },
          { label: 'Facturas vencidas', value: String(overdue.length), color: 'text-gep-red' },
          { label: 'Promedio por factura', value: overdue.length ? formatCurrency(total / overdue.length) : '—', color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Vencimiento', 'Días vencido', 'Nº', 'Proveedor', 'Descripción', 'Cuenta', 'Pendiente']} />
          <tbody>
            {overdue.map((g, i) => {
              const dias = daysBetween(g.vencimiento!, today);
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-4 text-gep-red font-semibold whitespace-nowrap">{fmtDate(g.vencimiento)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${dias > 90 ? 'bg-red-200 text-red-800' : dias > 60 ? 'bg-red-100 text-red-700' : dias > 30 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {dias}d
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{g.num}</td>
                  <td className="py-2 pr-4 font-medium text-gep-dark max-w-[150px] truncate">{g.proveedor}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[160px] truncate">{g.descripcion}</td>
                  <td className="py-2 pr-4 text-gray-500 max-w-[120px] truncate">{g.cuenta}</td>
                  <td className="py-2 text-right font-bold text-gep-red whitespace-nowrap">{formatCurrency(g.pendiente)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {overdue.length === 0 && <p className="text-center text-gray-400 py-8">Sin pagos vencidos.</p>}
      </div>
    </div>
  );
}

function DsoModal({ ventas }: { ventas: Venta[] }) {
  const cobradas = ventas
    .filter((v) => v.fecha && v.fechaCobro)
    .map((v) => ({ ...v, dias: daysBetween(v.fecha!, v.fechaCobro!) }))
    .sort((a, b) => b.dias - a.dias);
  const avg = cobradas.length ? cobradas.reduce((s, v) => s + v.dias, 0) / cobradas.length : 0;
  const max = cobradas.length ? Math.max(...cobradas.map(v => v.dias)) : 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'DSO promedio', value: `${Math.round(avg)} días`, color: avg <= 30 ? 'text-green-600' : avg <= 60 ? 'text-amber-600' : 'text-gep-red' },
          { label: 'Máximo registrado', value: `${max} días`, color: 'text-gep-dark' },
          { label: 'Facturas cobradas', value: String(cobradas.length), color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Días cobro', 'Nº', 'Cliente', 'F. Factura', 'F. Cobro', 'Total cobrado']} />
          <tbody>
            {cobradas.map((v, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${v.dias > 90 ? 'bg-red-100 text-red-700' : v.dias > 60 ? 'bg-amber-100 text-amber-700' : v.dias > 30 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                    {v.dias}d
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{v.num}</td>
                <td className="py-2 pr-4 font-medium text-gep-dark max-w-[180px] truncate">{v.cliente}</td>
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(v.fecha)}</td>
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(v.fechaCobro)}</td>
                <td className="py-2 text-right text-green-600 font-semibold whitespace-nowrap">{formatCurrency(v.cobrado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cobradas.length === 0 && <p className="text-center text-gray-400 py-8">Sin facturas cobradas registradas.</p>}
      </div>
    </div>
  );
}

function DpoModal({ gastos }: { gastos: Gasto[] }) {
  const pagadas = gastos
    .filter((g) => g.fechaEmision && g.fechaPago)
    .map((g) => ({ ...g, dias: daysBetween(g.fechaEmision!, g.fechaPago!) }))
    .sort((a, b) => b.dias - a.dias);
  const avg = pagadas.length ? pagadas.reduce((s, g) => s + g.dias, 0) / pagadas.length : 0;
  const max = pagadas.length ? Math.max(...pagadas.map(g => g.dias)) : 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'DPO promedio', value: `${Math.round(avg)} días`, color: avg <= 30 ? 'text-green-600' : avg <= 60 ? 'text-amber-600' : 'text-gep-red' },
          { label: 'Máximo registrado', value: `${max} días`, color: 'text-gep-dark' },
          { label: 'Facturas pagadas', value: String(pagadas.length), color: 'text-gep-dark' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-50 p-4">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <TableHeader cols={['Días pago', 'Nº', 'Proveedor', 'F. Factura', 'F. Pago', 'Total pagado']} />
          <tbody>
            {pagadas.map((g, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${g.dias > 90 ? 'bg-red-100 text-red-700' : g.dias > 60 ? 'bg-amber-100 text-amber-700' : g.dias > 30 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                    {g.dias}d
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-gray-600 whitespace-nowrap">{g.num}</td>
                <td className="py-2 pr-4 font-medium text-gep-dark max-w-[180px] truncate">{g.proveedor}</td>
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(g.fechaEmision)}</td>
                <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDate(g.fechaPago)}</td>
                <td className="py-2 text-right text-green-600 font-semibold whitespace-nowrap">{formatCurrency(g.pagado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagadas.length === 0 && <p className="text-center text-gray-400 py-8">Sin facturas pagadas registradas.</p>}
      </div>
    </div>
  );
}

// ---------- Pulse Hero (executive at-a-glance summary) ----------

interface PulseTileProps {
  label: string;
  value: string;
  hint?: string;
  delta?: { text: string; direction: 'up' | 'down' | 'neutral' } | null;
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  highlight?: boolean;
  icon: ReactNode;
  onClick?: () => void;
}

function PulseTile({ label, value, hint, delta, tone, highlight, icon, onClick }: PulseTileProps) {
  const toneText: Record<PulseTileProps['tone'], string> = {
    positive: 'text-green-300',
    negative: 'text-red-300',
    neutral: 'text-white',
    warning: 'text-amber-300',
  };
  const toneDot: Record<PulseTileProps['tone'], string> = {
    positive: 'bg-green-400',
    negative: 'bg-red-400',
    neutral: 'bg-gray-400',
    warning: 'bg-amber-400',
  };
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`relative rounded-xl p-4 transition-all ${
        highlight
          ? 'bg-white/10 ring-1 ring-white/20'
          : 'bg-white/5 ring-1 ring-white/10'
      } ${onClick ? 'cursor-pointer hover:bg-white/15 hover:ring-white/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${toneDot[tone]}`} />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60">
            {label}
          </span>
        </div>
        <div className="text-white/40">{icon}</div>
      </div>
      <div className={`font-bold leading-tight break-words ${highlight ? 'text-2xl' : 'text-xl'} ${toneText[tone]}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-white/60 leading-snug">{hint}</div>
      )}
      {delta && (
        <div className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold ${
          delta.direction === 'up' ? 'text-green-300'
            : delta.direction === 'down' ? 'text-red-300'
            : 'text-white/50'
        }`}>
          {delta.direction === 'up' && <ArrowUpRight className="w-3 h-3" />}
          {delta.direction === 'down' && <ArrowDownRight className="w-3 h-3" />}
          {delta.direction === 'neutral' && <Minus className="w-3 h-3" />}
          <span>{delta.text}</span>
        </div>
      )}
    </div>
  );
}

interface PulseHeroProps {
  label: string;
  kpis: ReturnType<typeof computeOverviewKpis>;
  prevKpis: ReturnType<typeof computeOverviewKpis>;
  deltaIngresos: number;
  deltaGastos: number;
  deltaResultado: number;
  alertsCount: number;
  onOpen: (key: MetricKey) => void;
}

function PulseHero({
  label,
  kpis,
  prevKpis,
  deltaIngresos,
  deltaGastos,
  deltaResultado,
  alertsCount,
  onOpen,
}: PulseHeroProps) {
  const resultadoTone: PulseTileProps['tone'] = kpis.resultadoNeto >= 0 ? 'positive' : 'negative';
  const cajaTone: PulseTileProps['tone'] = kpis.posicionCaja >= 0 ? 'positive' : 'negative';
  const wcTone: PulseTileProps['tone'] = kpis.workingCapital >= 0 ? 'positive' : 'negative';
  const vencidoTotal = kpis.pendienteCobrarVencido + kpis.pendientePagarVencido;
  const vencidoTone: PulseTileProps['tone'] = vencidoTotal > 0 ? 'warning' : 'positive';

  // Resultado vs Facturación → "score" sencillo (margen) para barra de salud
  const margen = kpis.margenPct;
  const healthScore = Math.max(0, Math.min(100, ((margen + 20) / 40) * 100)); // -20% → 0, +20% → 100
  const healthLabel =
    margen >= 15 ? 'Saludable'
    : margen >= 5 ? 'Estable'
    : margen >= 0 ? 'Ajustado'
    : 'Crítico';
  const healthColor =
    margen >= 15 ? 'bg-green-400'
    : margen >= 5 ? 'bg-emerald-400'
    : margen >= 0 ? 'bg-amber-400'
    : 'bg-red-400';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-gep-dark via-gep-dark-light to-gep-dark text-white shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gep-red/20 ring-1 ring-gep-red/40 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-gep-red-light" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white">Pulso Financiero</h2>
            <p className="text-[11px] text-white/50">{label} · vista global del estado</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-white/50">Salud</div>
            <div className="text-sm font-bold">{healthLabel}</div>
          </div>
          <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${healthColor} transition-all`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          {alertsCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gep-red/20 ring-1 ring-gep-red/40 text-[11px] font-semibold text-red-200">
              <AlertOctagon className="w-3 h-3" />
              {alertsCount} alerta{alertsCount === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Tiles */}
      <div className="p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <PulseTile
          label="Resultado Neto"
          value={formatCurrency(kpis.resultadoNeto)}
          hint={`Margen ${kpis.margenPct.toFixed(1)}% · sin IVA`}
          delta={{ text: fmtDelta(deltaResultado), direction: deltaDirection(deltaResultado) }}
          tone={resultadoTone}
          highlight
          icon={<Activity className="w-4 h-4" />}
          onClick={() => onOpen('resultado')}
        />
        <PulseTile
          label="Facturación"
          value={formatCurrency(kpis.ingresosYTD)}
          hint={`vs. ${formatCurrency(prevKpis.ingresosYTD)} año ant.`}
          delta={{ text: fmtDelta(deltaIngresos), direction: deltaDirection(deltaIngresos) }}
          tone="neutral"
          icon={<TrendingUp className="w-4 h-4" />}
          onClick={() => onOpen('facturacion')}
        />
        <PulseTile
          label="Gastos"
          value={formatCurrency(kpis.gastosYTD)}
          hint={`vs. ${formatCurrency(prevKpis.gastosYTD)} año ant.`}
          // En gastos, "subir" es peor → invertimos la dirección visual
          delta={{
            text: fmtDelta(deltaGastos),
            direction:
              deltaGastos > 0.5 ? 'down'
              : deltaGastos < -0.5 ? 'up'
              : 'neutral',
          }}
          tone="neutral"
          icon={<TrendingDown className="w-4 h-4" />}
          onClick={() => onOpen('gastos')}
        />
        <PulseTile
          label="Posición de Caja"
          value={formatCurrency(kpis.posicionCaja)}
          hint="Cobrado − Pagado real"
          tone={cajaTone}
          highlight
          icon={<Wallet className="w-4 h-4" />}
          onClick={() => onOpen('caja')}
        />
        <PulseTile
          label={vencidoTotal > 0 ? 'Vencido (Riesgo)' : 'Capital de Trabajo'}
          value={
            vencidoTotal > 0
              ? formatCurrency(vencidoTotal)
              : formatCurrency(kpis.workingCapital)
          }
          hint={
            vencidoTotal > 0
              ? `Cobrar ${formatCurrency(kpis.pendienteCobrarVencido)} · Pagar ${formatCurrency(kpis.pendientePagarVencido)}`
              : 'Cobros − Pagos pendientes'
          }
          tone={vencidoTotal > 0 ? vencidoTone : wcTone}
          icon={vencidoTotal > 0 ? <AlertTriangle className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
          onClick={() => onOpen(vencidoTotal > 0 ? 'cobrosVencidos' : 'working')}
        />
      </div>
    </div>
  );
}

// ---------- Main Overview component ----------

export function Overview({ data, loading }: OverviewProps) {
  const { dateRange, prevDateRange, label } = usePeriod();
  const [openModal, setOpenModal] = useState<MetricKey | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    proveedor: '',
    cliente: '',
    tags: '',
    cuenta: '',
    proyecto: '',
    estadoIngreso: '',
    estadoGasto: '',
  });
  const options = useMemo(
    () => getFilterOptions(data?.ventas ?? [], data?.gastos ?? []),
    [data?.ventas, data?.gastos],
  );

  if (loading || !data) {
    return <OverviewSkeleton />;
  }

  const allActiveVentas = applyVentaFilters(ventasActivas(data.ventas), filters);
  const allActiveGastos = applyGastoFilters(gastosActivos(data.gastos), filters);
  const scopedData = { ...data, ventas: allActiveVentas, gastos: allActiveGastos };
  const kpis = computeOverviewKpis(scopedData, dateRange);
  const prevKpis = computeOverviewKpis(scopedData, prevDateRange);
  const monthly = monthlyDataForRange(scopedData, dateRange);
  const cashFlow = cashFlowDataForRange(scopedData, dateRange);
  const alerts = generateAlerts(scopedData).slice(0, 4);
  const ventasPeriod = filterByDateRange(allActiveVentas, dateRange);
  const gastosPeriod = filterByDateRange(allActiveGastos, dateRange, 'fechaEmision');

  // Deltas
  const deltaIngresos = pctDelta(kpis.ingresosYTD, prevKpis.ingresosYTD);
  const deltaGastos = pctDelta(kpis.gastosYTD, prevKpis.gastosYTD);
  const deltaResultado = pctDelta(kpis.resultadoNeto, prevKpis.resultadoNeto);
  const deltaIvaRep = pctDelta(kpis.ivaRepercutido, prevKpis.ivaRepercutido);
  const deltaIvaSop = pctDelta(kpis.ivaSoportado, prevKpis.ivaSoportado);

  const open = (key: MetricKey) => setOpenModal(key);
  const close = () => setOpenModal(null);

  // Modal config
  const MODALS: Record<MetricKey, { title: string; subtitle: string; content: React.ReactNode }> = {
    facturacion: {
      title: 'Facturación',
      subtitle: `Detalle de facturas emitidas · ${label}`,
      content: <FacturacionModal ventas={ventasPeriod} />,
    },
    gastos: {
      title: 'Gastos',
      subtitle: `Detalle de gastos registrados · ${label}`,
      content: <GastosModal gastos={gastosPeriod} />,
    },
    resultado: {
      title: 'Resultado Neto',
      subtitle: `Ingresos menos gastos (sin IVA) · ${label}`,
      content: <ResultadoModal ventas={ventasPeriod} gastos={gastosPeriod} />,
    },
    caja: {
      title: 'Posición de Caja',
      subtitle: 'Cobros y pagos reales efectuados',
      content: <CajaModal ventas={allActiveVentas} gastos={allActiveGastos} />,
    },
    working: {
      title: 'Capital de Trabajo',
      subtitle: 'Pendiente cobrar vs pendiente pagar (total activo)',
      content: <WorkingCapitalModal ventas={allActiveVentas} gastos={allActiveGastos} />,
    },
    pendienteCobrar: {
      title: 'Pendiente Cobrar',
      subtitle: 'Facturas de ventas con importe pendiente',
      content: <PendienteCobrarModal ventas={allActiveVentas} />,
    },
    pendientePagar: {
      title: 'Pendiente Pagar — Proveedores',
      subtitle: 'Facturas de proveedores con importe pendiente (excluye personal)',
      content: <PendientePagarModal gastos={allActiveGastos} />,
    },
    pendientePersonal: {
      title: 'Nóminas y Personal Pendiente',
      subtitle: 'Gastos de personal (grupo 64 PGC) con importe pendiente',
      content: <NominasModal gastos={allActiveGastos} />,
    },
    cobrosVencidos: {
      title: 'Cobros Vencidos',
      subtitle: 'Facturas con vencimiento superado y pendiente de cobro',
      content: <CobrosVencidosModal ventas={allActiveVentas} />,
    },
    pagosVencidos: {
      title: 'Pagos Vencidos',
      subtitle: 'Facturas con vencimiento superado y pendiente de pago',
      content: <PagosVencidosModal gastos={allActiveGastos} />,
    },
    dso: {
      title: 'Días de Cobro Medio (DSO)',
      subtitle: 'Plazo promedio desde factura emitida hasta cobro efectivo',
      content: <DsoModal ventas={allActiveVentas} />,
    },
    dpo: {
      title: 'Días de Pago Medio (DPO)',
      subtitle: 'Plazo promedio desde factura recibida hasta pago efectivo',
      content: <DpoModal gastos={allActiveGastos} />,
    },
  };

  return (
    <div className="space-y-6">
      <EntityFilters filters={filters} options={options} onChange={setFilters} />

      {/* Active modal */}
      {openModal && (
        <MetricModal
          open
          onClose={close}
          title={MODALS[openModal].title}
          subtitle={MODALS[openModal].subtitle}
        >
          {MODALS[openModal].content}
        </MetricModal>
      )}

      {/* Row 1 - Pulso Financiero (vista global) */}
      <PulseHero
        label={label}
        kpis={kpis}
        prevKpis={prevKpis}
        deltaIngresos={deltaIngresos}
        deltaGastos={deltaGastos}
        deltaResultado={deltaResultado}
        alertsCount={alerts.length}
        onOpen={open}
      />

      {/* Row 2 - Detalle Pendientes & Capital */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Capital de Trabajo"
          value={formatCurrency(kpis.workingCapital)}
          subtitle="Cobros - Pagos pendientes"
          icon={<Scale className="w-5 h-5" />}
          color={kpis.workingCapital >= 0 ? 'green' : 'red'}
          onClick={() => open('working')}
        />
        <KpiCard
          title="Pendiente Cobrar"
          value={formatCurrency(kpis.pendienteCobrar)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendienteCobrarVencido)}`}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
          onClick={() => open('pendienteCobrar')}
        />
        <KpiCard
          title="Pend. Proveedores"
          value={formatCurrency(kpis.pendienteProveedores)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendienteProveedoresVencido)}`}
          icon={<ReceiptText className="w-5 h-5" />}
          color="amber"
          onClick={() => open('pendientePagar')}
        />
        <KpiCard
          title="Nóminas Pendientes"
          value={formatCurrency(kpis.pendientePersonal)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendientePersonalVencido)}`}
          icon={<Users className="w-5 h-5" />}
          color="amber"
          onClick={() => open('pendientePersonal')}
        />
      </div>

      {/* Row 3 - Riesgo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Cobros Vencidos"
          value={formatCurrency(kpis.pendienteCobrarVencido)}
          subtitle={`${kpis.facturasVencidas} factura(s) sin cobrar`}
          icon={<AlertOctagon className="w-5 h-5" />}
          color="red"
          onClick={() => open('cobrosVencidos')}
        />
        <KpiCard
          title="Pagos Vencidos"
          value={formatCurrency(kpis.pendientePagarVencido)}
          subtitle={`${kpis.facturasVencidasPago} factura(s) sin pagar`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          onClick={() => open('pagosVencidos')}
        />
        <KpiCard
          title="Días Cobro Medio"
          value={`${kpis.diasCobroMedio} días`}
          subtitle="DSO · Plazo medio de cobro"
          icon={<Clock className="w-5 h-5" />}
          color="default"
          trend={`Tasa cobro: ${kpis.tasaCobro.toFixed(1)}%`}
          trendDirection={kpis.tasaCobro >= 80 ? 'up' : 'neutral'}
          onClick={() => open('dso')}
        />
        <KpiCard
          title="Días Pago Medio"
          value={`${kpis.dpo} días`}
          subtitle="DPO · Plazo medio de pago"
          icon={<CalendarCheck className="w-5 h-5" />}
          color="default"
          trend={`Tasa pago: ${kpis.tasaPago.toFixed(1)}%`}
          trendDirection={kpis.tasaPago >= 80 ? 'up' : 'neutral'}
          onClick={() => open('dpo')}
        />
      </div>

      {/* Row 4 - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Ingresos vs Gastos"
          subtitle={`Facturas emitidas · ${label}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" fontSize={11} stroke="#777" />
              <YAxis
                fontSize={11}
                stroke="#777"
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ borderRadius: 8, border: '1px solid #eee' }}
              />
              <Legend />
              <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#e4032d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tesorería Real"
          subtitle={`Cobros y pagos efectivamente realizados · ${label}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={cashFlow} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" fontSize={11} stroke="#777" />
              <YAxis
                fontSize={11}
                stroke="#777"
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ borderRadius: 8, border: '1px solid #eee' }}
              />
              <Legend />
              <Bar dataKey="cobros" name="Cobros" fill="#22c55e" opacity={0.8} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pagos" name="Pagos" fill="#e4032d" opacity={0.8} radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="neto"
                name="Saldo neto"
                stroke="#333"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#333' }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 5 - IVA Balance */}
      <div className="card p-5 bg-gray-50">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">
          Balance IVA · {label}
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-1">IVA Repercutido</div>
            <div className="font-bold text-lg text-gep-dark">{formatCurrency(kpis.ivaRepercutido)}</div>
            <div className="text-xs text-gray-400">IVA cobrado a clientes</div>
            {prevKpis.ivaRepercutido > 0 && (
              <div className="text-[11px] text-gray-400 mt-0.5">
                vs. año ant.: {formatCurrency(prevKpis.ivaRepercutido)}
                <span className={`ml-1 font-semibold ${deltaIvaRep >= 0 ? 'text-green-600' : 'text-gep-red'}`}>
                  {deltaIvaRep >= 0 ? '▲' : '▼'} {fmtDelta(deltaIvaRep)}
                </span>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">IVA Soportado</div>
            <div className="font-bold text-lg text-gep-dark">{formatCurrency(kpis.ivaSoportado)}</div>
            <div className="text-xs text-gray-400">IVA pagado a proveedores</div>
            {prevKpis.ivaSoportado > 0 && (
              <div className="text-[11px] text-gray-400 mt-0.5">
                vs. año ant.: {formatCurrency(prevKpis.ivaSoportado)}
                <span className={`ml-1 font-semibold ${deltaIvaSop >= 0 ? 'text-green-600' : 'text-gep-red'}`}>
                  {deltaIvaSop >= 0 ? '▲' : '▼'} {fmtDelta(deltaIvaSop)}
                </span>
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Saldo IVA a ingresar</div>
            <div className={`font-bold text-lg ${kpis.saldoIVA >= 0 ? 'text-gep-red' : 'text-green-600'}`}>
              {formatCurrency(kpis.saldoIVA)}
            </div>
            <div className="text-xs text-gray-400">
              {kpis.saldoIVA >= 0 ? 'A declarar a Hacienda' : 'A recuperar de Hacienda'}
            </div>
          </div>
        </div>
      </div>

      {/* Row 6 - Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Alertas principales
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
