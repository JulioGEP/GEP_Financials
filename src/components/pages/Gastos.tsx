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
import { TrendingDown, CheckCircle2, Hourglass, Receipt } from 'lucide-react';
import type { FinancialData, Gasto } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  monthlyRevenueVsExpenses,
  topCuentasGastos,
  topProveedores,
} from '../../lib/calculations';

interface GastosProps {
  data: FinancialData | null;
  loading: boolean;
}

export function Gastos({ data, loading }: GastosProps) {
  if (loading || !data) return <GastosSkeleton />;

  const totalGastos = data.gastos.reduce((acc, g) => acc + g.total, 0);
  const totalPagado = data.gastos.reduce((acc, g) => acc + g.pagado, 0);
  const totalPendiente = data.gastos.reduce((acc, g) => acc + g.pendiente, 0);
  const totalIVA = data.gastos.reduce((acc, g) => acc + g.iva, 0);

  const monthly = monthlyRevenueVsExpenses(data, 12);
  const cuentas = topCuentasGastos(data.gastos, 8);
  const proveedores = topProveedores(data.gastos, 8);

  const pagadoVsPendiente = [
    { name: 'Pagado', value: totalPagado, color: '#22c55e' },
    { name: 'Pendiente', value: totalPendiente, color: '#f59e0b' },
  ];

  const columns: DataTableColumn<Gasto>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      accessor: (r) => r.fechaEmision,
      render: (r) => formatDate(r.fechaEmision),
    },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'proveedor', header: 'Proveedor', accessor: (r) => r.proveedor },
    { key: 'cuenta', header: 'Cuenta', accessor: (r) => r.cuenta },
    { key: 'proyecto', header: 'Proyecto', accessor: (r) => r.proyecto },
    {
      key: 'total',
      header: 'Total',
      accessor: (r) => r.total,
      align: 'right',
      render: (r) => formatCurrency(r.total),
    },
    {
      key: 'pagado',
      header: 'Pagado',
      accessor: (r) => r.pagado,
      align: 'right',
      render: (r) => formatCurrency(r.pagado),
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
          title="Total Gastos"
          value={formatCurrency(totalGastos)}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          emphasis
        />
        <KpiCard
          title="Total Pagado"
          value={formatCurrency(totalPagado)}
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
          title="IVA Acumulado"
          value={formatCurrency(totalIVA)}
          icon={<Receipt className="w-5 h-5" />}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Gastos por mes" subtitle="Últimos 12 meses">
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
              <Bar dataKey="gastos" name="Gastos" fill="#e4032d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pagado vs Pendiente" subtitle="Estado global de los gastos">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pagadoVsPendiente}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
              >
                {pagadoVsPendiente.map((b, i) => (
                  <Cell key={i} fill={b.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 8 Cuentas" subtitle="Categorías con mayor gasto">
          <ResponsiveContainer width="100%" height={300}>
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

        <ChartCard title="Top 8 Proveedores" subtitle="Por importe total">
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
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
          Listado de gastos
        </h2>
        <DataTable
          columns={columns}
          data={data.gastos}
          exportFileName="gastos.csv"
          emptyMessage="No hay gastos registrados"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}
