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
  CheckCircle2,
  Hourglass,
  Percent,
} from 'lucide-react';
import type { FinancialData } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  agingAnalysis,
  monthlyRevenueVsExpenses,
  topClientes,
  topProyectos,
} from '../../lib/calculations';
import type { Venta } from '../../types/financial';

interface VentasProps {
  data: FinancialData | null;
  loading: boolean;
}

export function Ventas({ data, loading }: VentasProps) {
  if (loading || !data) return <VentasSkeleton />;

  const totalFacturado = data.ventas.reduce((acc, v) => acc + v.total, 0);
  const totalCobrado = data.ventas.reduce((acc, v) => acc + v.cobrado, 0);
  const totalPendiente = data.ventas.reduce((acc, v) => acc + v.pendiente, 0);
  const pctCobrado = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0;

  const monthly = monthlyRevenueVsExpenses(data, 12);
  const clientes = topClientes(data.ventas, 8);
  const proyectos = topProyectos(data.ventas, 8);
  const aging = agingAnalysis(data.ventas);

  const columns: DataTableColumn<Venta>[] = [
    { key: 'fecha', header: 'Fecha', accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'cliente', header: 'Cliente', accessor: (r) => r.cliente },
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Facturado"
          value={formatCurrency(totalFacturado)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          emphasis
        />
        <KpiCard
          title="Total Cobrado"
          value={formatCurrency(totalCobrado)}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
        />
        <KpiCard
          title="Total Pendiente"
          value={formatCurrency(totalPendiente)}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="% Cobrado"
          value={`${pctCobrado.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5" />}
          color="blue"
          trend={pctCobrado >= 80 ? 'Buen ratio' : 'Hay margen de mejora'}
          trendDirection={pctCobrado >= 80 ? 'up' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Ingresos por mes" subtitle="Últimos 12 meses">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="label" fontSize={11} stroke="#777" />
              <YAxis
                fontSize={11}
                stroke="#777"
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#e4032d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Aging de cobros" subtitle="Cuentas por cobrar vencidas">
          <ResponsiveContainer width="100%" height={280}>
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

        <ChartCard title="Top 8 Clientes" subtitle="Por importe facturado">
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

        <ChartCard title="Top 8 Proyectos" subtitle="Por importe facturado">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={proyectos}
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
              <YAxis type="category" dataKey="name" fontSize={11} stroke="#777" width={100} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="value" name="Facturado" fill="#333333" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
