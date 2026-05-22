import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingUp,
  Hourglass,
  Percent,
  AlertOctagon,
  Clock,
  XCircle,
} from 'lucide-react';
import type { FinancialData } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  agingAnalysis,
  topClientes,
  ventasActivas,
  ventasStackedForRange,
  estadoDistributionVentas,
  computeOverviewKpis,
  filterByDateRange,
  sum,
} from '../../lib/calculations';
import { usePeriod } from '../../context/PeriodContext';
import type { Venta } from '../../types/financial';
import { EntityFilters, applyVentaFilters, getFilterOptions, type FilterState } from '../ui/EntityFilters';

interface VentasProps {
  data: FinancialData | null;
  loading: boolean;
}

function pctDelta(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : 100;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function fmtDelta(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function deltaDir(delta: number): 'up' | 'down' | 'neutral' {
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'neutral';
}

export function Ventas({ data, loading }: VentasProps) {
  const { dateRange, prevDateRange, label } = usePeriod();
  const [filters, setFilters] = useState<FilterState>({
    proveedor: '',
    cliente: '',
    tags: '',
    cuenta: '',
    proyecto: '',
    estadoIngreso: '',
    estadoGasto: '',
  });

  if (loading || !data) return <VentasSkeleton />;

  const activas = ventasActivas(data.ventas);
  const options = useMemo(() => getFilterOptions(data.ventas, data.gastos), [data.ventas, data.gastos]);
  const filtered = applyVentaFilters(filterByDateRange(activas, dateRange, 'fecha'), filters);
  const prevFiltered = applyVentaFilters(filterByDateRange(activas, prevDateRange, 'fecha'), filters);

  // Row 1 metrics (period-filtered)
  const totalFacturado = sum(filtered, (v) => v.total);
  const prevTotalFacturado = sum(prevFiltered, (v) => v.total);
  const totalActivoSinIVA = sum(filtered, (v) => v.subtotal);
  const totalCobrado = sum(filtered, (v) => v.cobrado);
  const tasaCobro = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0;

  // Row 2 metrics (always-current — pending state)
  const totalPendiente = sum(activas, (v) => v.pendiente);
  const vencidasVentas = activas.filter((v) => v.estado === 'Vencido');
  const pendienteVencido = sum(vencidasVentas, (v) => v.pendiente);
  const countVencido = vencidasVentas.length;
  const noVencidasVentas = activas.filter((v) => v.estado === 'Pendiente');
  const pendienteNoVencido = sum(noVencidasVentas, (v) => v.pendiente);
  const countNoVencido = noVencidasVentas.length;
  const anuladasVentas = data.ventas.filter((v) => v.estado === 'Anulado');
  const totalAnulado = sum(anuladasVentas, (v) => v.total);
  const countAnulado = anuladasVentas.length;

  // DSO from kpis (all-time)
  const kpis = computeOverviewKpis(data);
  const dso = kpis.diasCobroMedio;

  const deltaFacturado = pctDelta(totalFacturado, prevTotalFacturado);

  // Charts data
  const stackedMonthly = ventasStackedForRange(activas, dateRange);
  const estadoDist = estadoDistributionVentas(filtered.length > 0 ? filtered : activas);
  const clientes = topClientes(filtered.length > 0 ? filtered : activas, 8);
  const aging = agingAnalysis(activas);

  const columns: DataTableColumn<Venta>[] = [
    { key: 'fecha', header: 'Fecha', accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'cliente', header: 'Cliente', accessor: (r) => r.cliente },
    { key: 'descripcion', header: 'Descripción', accessor: (r) => r.descripcion },
    { key: 'proyecto', header: 'Proyecto', accessor: (r) => r.proyecto },
    {
      key: 'total',
      header: 'Total',
      accessor: (r) => r.total,
      align: 'right',
      render: (r) => formatCurrency(r.total),
    },
    {
      key: 'cobrado',
      header: 'Cobrado',
      accessor: (r) => r.cobrado,
      align: 'right',
      render: (r) => formatCurrency(r.cobrado),
    },
    {
      key: 'pendiente',
      header: 'Pendiente',
      accessor: (r) => r.pendiente,
      align: 'right',
      render: (r) => formatCurrency(r.pendiente),
    },
    {
      key: 'estado',
      header: 'Estado',
      accessor: (r) => r.estado,
      render: (r) => (
        <StatusBadge estado={r.estado} vencimiento={r.vencimiento} pendiente={r.pendiente} />
      ),
    },
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      accessor: (r) => r.vencimiento,
      render: (r) => formatDate(r.vencimiento),
    },
  ];

  return (
    <div className="space-y-6">
      <EntityFilters filters={filters} options={options} onChange={setFilters} />

      {/* Row 1 KPIs — period-filtered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Facturado"
          value={formatCurrency(totalFacturado)}
          subtitle={label}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          emphasis
          comparison={{
            prevValue: formatCurrency(prevTotalFacturado),
            delta: fmtDelta(deltaFacturado),
            direction: deltaDir(deltaFacturado),
          }}
        />
        <KpiCard
          title="Neto Facturable"
          value={formatCurrency(totalFacturado)}
          subtitle={`Sin IVA: ${formatCurrency(totalActivoSinIVA)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
        <KpiCard
          title="Tasa de Cobro"
          value={`${tasaCobro.toFixed(1)}%`}
          subtitle={`Cobrado: ${formatCurrency(totalCobrado)}`}
          icon={<Percent className="w-5 h-5" />}
          color="blue"
          trend={tasaCobro >= 80 ? 'Buen ratio de cobro' : 'Revisar cobros pendientes'}
          trendDirection={tasaCobro >= 80 ? 'up' : 'neutral'}
        />
        <KpiCard
          title="DSO"
          value={`${dso} días`}
          subtitle="Días de cobro medio"
          icon={<Clock className="w-5 h-5" />}
          color="default"
        />
      </div>

      {/* Row 2 KPIs — current state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pendiente Total"
          value={formatCurrency(totalPendiente)}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Vencido sin Cobrar"
          value={formatCurrency(pendienteVencido)}
          subtitle={`${countVencido} facturas`}
          icon={<AlertOctagon className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Pendiente No Vencido"
          value={formatCurrency(pendienteNoVencido)}
          subtitle={`${countNoVencido} facturas`}
          color="amber"
        />
        <KpiCard
          title="Facturas Anuladas"
          value={formatCurrency(totalAnulado)}
          subtitle={`${countAnulado} facturas`}
          icon={<XCircle className="w-5 h-5" />}
          color="default"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Facturación mensual" subtitle={`Cobrado · Pendiente · Vencido · ${label}`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stackedMonthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
              <Bar dataKey="cobrado" name="Cobrado" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pendiente" name="Pendiente" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="vencido" name="Vencido" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por estado" subtitle={`Valor de facturas por estado · ${label}`}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={estadoDist}
                dataKey="value"
                nameKey="estado"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {estadoDist.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _name: string, props: { payload?: { count?: number } }) =>
                  [`${formatCurrency(v)} (${props.payload?.count ?? 0} fact.)`, props.payload?.count !== undefined ? '' : '']
                }
                contentStyle={{ borderRadius: 8, border: '1px solid #eee' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={`Top 8 Clientes · ${label}`} subtitle="Por importe facturado (período)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={clientes}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                type="number"
                fontSize={11}
                stroke="#777"
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <YAxis
                type="category"
                dataKey="name"
                fontSize={11}
                stroke="#777"
                width={140}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name="Facturado" fill="#e4032d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aging de cobros vencidos" subtitle="Cuentas por cobrar vencidas por antigüedad">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={aging}
                dataKey="value"
                nameKey="range"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {aging.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      <div>
        <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-1">
          Listado de facturas · {label}
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length} factura(s) en el periodo · {data.ventas.length} en total
        </p>
        <DataTable
          columns={columns}
          data={filtered}
          exportFileName={`ventas_${label.replace(/\s/g, '_')}.csv`}
          emptyMessage="No hay facturas de venta en el periodo seleccionado"
        />
      </div>
    </div>
  );
}

function VentasSkeleton() {
  return (
    <div className="space-y-6">
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
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
