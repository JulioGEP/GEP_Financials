import { useState } from 'react';
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
} from '../../lib/calculations';
import { generateAlerts } from '../../lib/alerts';
import { usePeriod } from '../../context/PeriodContext';

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
  const pendientePagar = gastos.reduce((s, g) => s + g.pendiente, 0);
  const wc = pendienteCobrar - pendientePagar;

  // Top clientes con pendiente
  const clienteMap = new Map<string, number>();
  for (const v of ventas) {
    if (v.pendiente <= 0) continue;
    clienteMap.set(v.cliente, (clienteMap.get(v.cliente) ?? 0) + v.pendiente);
  }
  const topClientes = Array.from(clienteMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Top proveedores con pendiente
  const proveedorMap = new Map<string, number>();
  for (const g of gastos) {
    if (g.pendiente <= 0) continue;
    proveedorMap.set(g.proveedor, (proveedorMap.get(g.proveedor) ?? 0) + g.pendiente);
  }
  const topProveedores = Array.from(proveedorMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Pendiente cobrar', value: formatCurrency(pendienteCobrar), color: 'text-amber-600' },
          { label: 'Pendiente pagar', value: formatCurrency(pendientePagar), color: 'text-gep-red' },
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
    .filter((g) => g.pendiente > 0)
    .sort((a, b) => (a.vencimiento?.getTime() ?? 0) - (b.vencimiento?.getTime() ?? 0));
  const total = pending.reduce((s, g) => s + g.pendiente, 0);
  const vencido = pending.filter(g => g.vencimiento && g.vencimiento < today).reduce((s, g) => s + g.pendiente, 0);
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Total pendiente pagar', value: formatCurrency(total), color: 'text-amber-600' },
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
        {pending.length === 0 && <p className="text-center text-gray-400 py-8">Sin facturas pendientes.</p>}
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

// ---------- Main Overview component ----------

export function Overview({ data, loading }: OverviewProps) {
  const { dateRange, prevDateRange, label } = usePeriod();
  const [openModal, setOpenModal] = useState<MetricKey | null>(null);

  if (loading || !data) {
    return <OverviewSkeleton />;
  }

  const kpis = computeOverviewKpis(data, dateRange);
  const prevKpis = computeOverviewKpis(data, prevDateRange);
  const monthly = monthlyDataForRange(data, dateRange);
  const cashFlow = cashFlowDataForRange(data, dateRange);
  const alerts = generateAlerts(data).slice(0, 4);

  // Period-filtered sets
  const allActiveVentas = ventasActivas(data.ventas);
  const allActiveGastos = gastosActivos(data.gastos);
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
      title: 'Pendiente Pagar',
      subtitle: 'Facturas de gastos con importe pendiente',
      content: <PendientePagarModal gastos={allActiveGastos} />,
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

      {/* Row 1 - P&L Hero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Facturación"
          value={formatCurrency(kpis.ingresosYTD)}
          subtitle={`IVA incluido · ${label}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          emphasis
          trend={`Neto: ${formatCurrency(kpis.ingresosNetoYTD)}`}
          trendDirection="neutral"
          comparison={{
            prevValue: formatCurrency(prevKpis.ingresosYTD),
            delta: fmtDelta(deltaIngresos),
            direction: deltaDirection(deltaIngresos),
          }}
          onClick={() => open('facturacion')}
        />
        <KpiCard
          title="Gastos"
          value={formatCurrency(kpis.gastosYTD)}
          subtitle={`IVA incluido · ${label}`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          trend={`Neto: ${formatCurrency(kpis.gastosNetoYTD)}`}
          trendDirection="neutral"
          comparison={{
            prevValue: formatCurrency(prevKpis.gastosYTD),
            delta: fmtDelta(deltaGastos),
            direction: deltaDirection(deltaGastos),
          }}
          onClick={() => open('gastos')}
        />
        <KpiCard
          title="Resultado Neto"
          value={formatCurrency(kpis.resultadoNeto)}
          subtitle={`Margen: ${kpis.margenPct.toFixed(1)}%`}
          icon={<Activity className="w-5 h-5" />}
          color={kpis.resultadoNeto >= 0 ? 'green' : 'red'}
          emphasis
          trend={`${kpis.margenPct.toFixed(1)}% margen operativo`}
          trendDirection={kpis.resultadoNeto >= 0 ? 'up' : 'down'}
          comparison={{
            prevValue: formatCurrency(prevKpis.resultadoNeto),
            delta: fmtDelta(deltaResultado),
            direction: deltaDirection(deltaResultado),
          }}
          onClick={() => open('resultado')}
        />
      </div>

      {/* Row 2 - Tesorería */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Posición de Caja"
          value={formatCurrency(kpis.posicionCaja)}
          subtitle="Cobrado - Pagado real"
          icon={<Wallet className="w-5 h-5" />}
          color={kpis.posicionCaja >= 0 ? 'blue' : 'red'}
          emphasis
          onClick={() => open('caja')}
        />
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
          title="Pendiente Pagar"
          value={formatCurrency(kpis.pendientePagar)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendientePagarVencido)}`}
          icon={<ReceiptText className="w-5 h-5" />}
          color="amber"
          onClick={() => open('pendientePagar')}
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
