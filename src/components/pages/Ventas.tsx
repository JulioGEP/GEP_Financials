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
  monthlyVentasStacked,
  estadoDistributionVentas,
  computeOverviewKpis,
  sum,
} from '../../lib/calculations';
import type { Venta } from '../../types/financial';

interface VentasProps {
  data: FinancialData | null;
  loading: boolean;
}

export function Ventas({ data, loading }: VentasProps) {
  if (loading || !data) return <VentasSkeleton />;

  const activas = ventasActivas(data.ventas);

  // Row 1 metrics
  const totalFacturado = sum(data.ventas, (v) => v.total);
  const totalActiveFacturado = sum(activas, (v) => v.total);
  const totalActivoSinIVA = sum(activas, (v) => v.subtotal);
  const totalCobrado = sum(activas, (v) => v.cobrado);
  const tasaCobro = totalActiveFacturado > 0 ? (totalCobrado / totalActiveFacturado) * 100 : 0;

  // Row 2 metrics
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

  // DSO from kpis
  const kpis = computeOverviewKpis(data);
  const dso = kpis.diasCobroMedio;

  // Charts data
  const stackedMonthly = monthlyVentasStacked(data.ventas, 12);
  const estadoDist = estadoDistributionVentas(data.ventas);
  const clientes = topClientes(activas, 8);
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

      {/* Row 1 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Facturado"
          value={formatCurrency(totalFacturado)}
          subtitle="Todas las facturas"
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          emphasis
        />
        <KpiCard
          title="Neto Facturable"
          value={formatCurrency(totalActiveFacturado)}
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

      {/* Row 2 KPIs */}
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
        <ChartCard title="Facturación mensual" subtitle="Cobrado · Pendiente · Vencido (últimos 12 meses)">
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

        <ChartCard title="Distribución por estado" subtitle="Valor de facturas por estado">
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
        <ChartCard title="Top 8 Clientes" subtitle="Por importe facturado (activas)">
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
        <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
          Listado de facturas
        </h2>
        <DataTable
          columns={columns}
          data={data.ventas}
          exportFileName="ventas.csv"
          emptyMessage="No hay facturas de venta"
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
