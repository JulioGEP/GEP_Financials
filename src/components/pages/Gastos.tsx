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
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  monthlyRevenueVsExpenses,
  topCuentasGastos,
  topProveedores,
  gastosActivos,
  estadoDistributionGastos,
  monthlyCuentaGastos,
  sum,
  daysBetween,
} from '../../lib/calculations';

interface GastosProps {
  data: FinancialData | null;
  loading: boolean;
}

const CUENTA_COLORS = ['#e4032d', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6'];

export function Gastos({ data, loading }: GastosProps) {
  if (loading || !data) return <GastosSkeleton />;

  const activos = gastosActivos(data.gastos);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Row 1 metrics
  const totalGastos = sum(activos, (g) => g.total);
  const totalPagado = sum(activos, (g) => g.pagado);
  const totalIVA = sum(activos, (g) => g.iva);
  const tasaPago = totalGastos > 0 ? (totalPagado / totalGastos) * 100 : 0;

  // Row 2 metrics
  const totalPendiente = sum(activos, (g) => g.pendiente);

  const vencidosGastos = activos.filter(
    (g) => g.estado === 'Vencido' || (g.pendiente > 0 && g.vencimiento && g.vencimiento.getTime() < today.getTime())
  );
  const pendienteVencidoPago = sum(vencidosGastos, (g) => g.pendiente);
  const countVencidoPago = vencidosGastos.length;

  const noVencidosGastos = activos.filter((g) => g.estado === 'Pendiente');
  const pendienteNoVencidoPago = sum(noVencidosGastos, (g) => g.pendiente);
  const countNoVencidoPago = noVencidosGastos.length;

  // DPO
  const pagadas = activos.filter((g) => g.fechaEmision && g.fechaPago);
  const dpo = pagadas.length
    ? Math.round(
        pagadas.reduce((acc, g) => acc + daysBetween(g.fechaEmision!, g.fechaPago!), 0) /
          pagadas.length
      )
    : 0;

  // Charts data
  const monthly = monthlyRevenueVsExpenses(data, 12);
  const estadoDist = estadoDistributionGastos(data.gastos);
  const cuentas = topCuentasGastos(activos, 8);
  const proveedores = topProveedores(activos, 8);
  const { data: cuentaData, cuentas: topCuentas } = monthlyCuentaGastos(data.gastos, 6, 5);

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

      {/* Row 1 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Gastos"
          value={formatCurrency(totalGastos)}
          subtitle="IVA incluido"
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
          icon={<Receipt className="w-5 h-5" />}
          color="default"
        />
      </div>

      {/* Row 2 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pendiente Pagar"
          value={formatCurrency(totalPendiente)}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Vencidos sin Pagar"
          value={formatCurrency(pendienteVencidoPago)}
          subtitle={`${countVencidoPago} facturas`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Pendiente No Vencido"
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

        <ChartCard title="Distribución por estado pagos" subtitle="Estado global de los gastos">
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
        <ChartCard title="Top 8 Proveedores" subtitle="Por importe total (activos)">
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

        <ChartCard title="Gastos por categoría (Top 8 Cuentas)" subtitle="Por importe total">
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
      </div>

      {/* Charts Row 3 - Full width stacked evolution */}
      <ChartCard
        title="Evolución de gasto por categoría (Top 5)"
        subtitle="Últimos 6 meses · Por cuenta contable"
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

      {/* Table */}
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
      <ChartCardSkeleton />
    </div>
  );
}
