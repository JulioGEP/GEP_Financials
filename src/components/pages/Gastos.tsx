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
  TrendingDown,
  CheckCircle2,
  Hourglass,
  Receipt,
  AlertTriangle,
  CalendarCheck,
  Percent,
} from 'lucide-react';
import type { FinancialData, Gasto } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { MetricModal } from '../ui/MetricModal';
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  topCuentasGastos,
  topProveedores,
  gastosActivos,
  estadoDistributionGastos,
  cuentaGastosForRange,
  filterByDateRange,
  sum,
  daysBetween,
} from '../../lib/calculations';
import { usePeriod } from '../../context/PeriodContext';
import { EntityFilters, applyGastoFilters, getFilterOptions, type FilterState } from '../ui/EntityFilters';

interface GastosProps {
  data: FinancialData | null;
  loading: boolean;
}

const CUENTA_COLORS = ['#e4032d', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6'];

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

type ModalKey = 'principal' | 'pendiente' | 'vencido' | 'novencido';

export function Gastos({ data, loading }: GastosProps) {
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
  const [openModal, setOpenModal] = useState<ModalKey | null>(null);
  const options = useMemo(
    () => getFilterOptions(data?.ventas ?? [], data?.gastos ?? []),
    [data?.ventas, data?.gastos],
  );

  if (loading || !data) return <GastosSkeleton />;

  const activos = gastosActivos(data.gastos);
  const filtered = applyGastoFilters(filterByDateRange(activos, dateRange, 'fechaEmision'), filters);
  const prevFiltered = applyGastoFilters(filterByDateRange(activos, prevDateRange, 'fechaEmision'), filters);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Row 1 metrics sin IVA (base imponible)
  const totalGastos = sum(filtered, (g) => g.subtotal);
  const prevTotalGastos = sum(prevFiltered, (g) => g.subtotal);
  const totalPagado = sum(filtered, (g) => g.total > 0 ? g.pagado * g.subtotal / g.total : g.pagado);
  const totalIVA = sum(filtered, (g) => g.iva);
  const tasaPago = totalGastos > 0 ? (totalPagado / totalGastos) * 100 : 0;

  // Row 2 metrics sin IVA (always-current — pending state)
  const filteredActivos = applyGastoFilters(activos, filters);
  const totalPendiente = sum(filteredActivos, (g) => g.total > 0 ? g.pendiente * g.subtotal / g.total : g.pendiente);
  const vencidosGastos = filteredActivos.filter(
    (g) => g.estado === 'Vencido' || (g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
  );
  const pendienteVencidoPago = sum(vencidosGastos, (g) => g.total > 0 ? g.pendiente * g.subtotal / g.total : g.pendiente);
  const countVencidoPago = vencidosGastos.length;
  const noVencidosGastos = filteredActivos.filter((g) => g.estado === 'Pendiente');
  const pendienteNoVencidoPago = sum(noVencidosGastos, (g) => g.total > 0 ? g.pendiente * g.subtotal / g.total : g.pendiente);
  const countNoVencidoPago = noVencidosGastos.length;

  // DPO (all-time)
  const pagadas = filteredActivos.filter((g) => g.fechaEmision && g.fechaPago);
  const dpo = pagadas.length
    ? Math.round(
        pagadas.reduce((acc, g) => acc + daysBetween(g.fechaEmision!, g.fechaPago!), 0) /
          pagadas.length
      )
    : 0;

  const deltaGastos = pctDelta(totalGastos, prevTotalGastos);

  // Charts data
  const estadoDist = estadoDistributionGastos(filtered.length > 0 ? filtered : filteredActivos);
  const cuentas = topCuentasGastos(filtered.length > 0 ? filtered : filteredActivos, 8);
  const proveedores = topProveedores(filtered.length > 0 ? filtered : filteredActivos, 8);
  const { data: cuentaData, cuentas: topCuentas } = cuentaGastosForRange(filteredActivos, dateRange, 5);


  const modalRows = openModal === 'vencido' ? vencidosGastos : openModal === 'novencido' ? noVencidosGastos : openModal === 'pendiente' ? filteredActivos.filter((g) => g.pendiente > 0) : filtered;

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      accessor: (r) => r.fechaEmision,
      render: (r) => formatDate(r.fechaEmision),
    },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'proveedor', header: 'Proveedor', accessor: (r) => r.proveedor },
    { key: 'descripcion', header: 'Descripción', accessor: (r) => r.descripcion },
    { key: 'cuenta', header: 'Cuenta', accessor: (r) => r.cuenta },
    { key: 'proyecto', header: 'Proyecto', accessor: (r) => r.proyecto },
    {
      key: 'tags',
      header: 'Tags',
      accessor: (r) => (r.tags || []).join(', '),
      render: (r) => (
        <span className="text-xs text-gray-500">{(r.tags || []).join(', ')}</span>
      ),
    },
    {
      key: 'total',
      header: 'Total s/IVA',
      accessor: (r) => r.subtotal,
      align: 'right',
      render: (r) => formatCurrency(r.subtotal),
    },
    {
      key: 'pagado',
      header: 'Pagado s/IVA',
      accessor: (r) => r.total > 0 ? r.pagado * r.subtotal / r.total : r.pagado,
      align: 'right',
      render: (r) => formatCurrency(r.total > 0 ? r.pagado * r.subtotal / r.total : r.pagado),
    },
    {
      key: 'pendiente',
      header: 'Pendiente s/IVA',
      accessor: (r) => r.total > 0 ? r.pendiente * r.subtotal / r.total : r.pendiente,
      align: 'right',
      render: (r) => formatCurrency(r.total > 0 ? r.pendiente * r.subtotal / r.total : r.pendiente),
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
      {openModal && (
        <MetricModal open onClose={() => setOpenModal(null)} title="Detalle de métrica" subtitle={label}>
          <DataTable columns={columns} data={modalRows} />
        </MetricModal>
      )}
      <EntityFilters filters={filters} options={options} onChange={setFilters} />

      {/* Row 1 KPIs — period-filtered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Gastos"
          onClick={() => setOpenModal('principal')}
          value={formatCurrency(totalGastos)}
          subtitle={`Sin IVA · ${label}`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          emphasis
          comparison={{
            prevValue: formatCurrency(prevTotalGastos),
            delta: fmtDelta(deltaGastos),
            direction: deltaDir(deltaGastos),
          }}
        />
        <KpiCard
          title="Total Pagado"
          value={formatCurrency(totalPagado)}
          subtitle={`Sin IVA · ${label}`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
        <KpiCard
          title="Tasa de Pago"
          value={`${tasaPago.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5" />}
          color="blue"
          trend={tasaPago >= 80 ? 'Buen ratio de pago' : 'Revisar pagos pendientes'}
          trendDirection={tasaPago >= 80 ? 'up' : 'neutral'}
        />
        <KpiCard
          title="IVA Soportado"
          value={formatCurrency(totalIVA)}
          subtitle={label}
          icon={<Receipt className="w-5 h-5" />}
          color="default"
        />
      </div>

      {/* Row 2 KPIs — current state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pendiente Pagar"
          onClick={() => setOpenModal('pendiente')}
          value={formatCurrency(totalPendiente)}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Vencidos sin Pagar"
          onClick={() => setOpenModal('vencido')}
          value={formatCurrency(pendienteVencidoPago)}
          subtitle={`${countVencidoPago} facturas`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Pendiente No Vencido"
          onClick={() => setOpenModal('novencido')}
          value={formatCurrency(pendienteNoVencidoPago)}
          subtitle={`${countNoVencidoPago} facturas`}
          color="amber"
        />
        <KpiCard
          title="DPO"
          value={`${dpo} días`}
          subtitle="Días de pago medio"
          icon={<CalendarCheck className="w-5 h-5" />}
          color="default"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Gastos por categoría (Top 8)" subtitle={`Por importe total · ${label}`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={cuentas}
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
              <YAxis type="category" dataKey="name" fontSize={11} stroke="#777" width={140} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name="Gastos" fill="#333333" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribución por estado pagos" subtitle={`Estado de los gastos · ${label}`}>
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
                  [`${formatCurrency(v)} (${props.payload?.count ?? 0} fact.)`, '']
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
        <ChartCard title={`Top 8 Proveedores · ${label}`} subtitle="Por importe total (período)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={proveedores}
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
              <YAxis type="category" dataKey="name" fontSize={11} stroke="#777" width={140} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name="Gastos" fill="#e4032d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Stacked evolution chart */}
        <ChartCard
          title="Evolución por categoría (Top 5)"
          subtitle={`Por cuenta contable · ${label}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cuentaData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
              {topCuentas.map((cuenta, i) => (
                <Bar
                  key={cuenta}
                  dataKey={cuenta}
                  name={cuenta}
                  stackId="a"
                  fill={CUENTA_COLORS[i % CUENTA_COLORS.length]}
                  radius={i === topCuentas.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Table */}
      <div>
        <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-1">
          Listado de gastos · {label}
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length} gasto(s) en el periodo · {data.gastos.length} en total
        </p>
        <DataTable
          columns={columns}
          data={filtered}
          exportFileName={`gastos_${label.replace(/\s/g, '_')}.csv`}
          emptyMessage="No hay gastos registrados en el periodo seleccionado"
        />
      </div>
    </div>
  );
}

function GastosSkeleton() {
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
