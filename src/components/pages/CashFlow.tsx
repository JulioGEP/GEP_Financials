import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Wallet, CalendarClock, Calendar, CalendarRange, AlertTriangle } from 'lucide-react';
import type { FinancialData, Gasto, Venta } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/parseData';
import {
  computeOverviewKpis,
  netNextNDays,
  projectedCashFlow,
  upcomingPayables,
  upcomingReceivables,
  overdueReceivables,
  overduePayables,
} from '../../lib/calculations';

interface CashFlowProps {
  data: FinancialData | null;
  loading: boolean;
}

export function CashFlow({ data, loading }: CashFlowProps) {
  if (loading || !data) return <CashFlowSkeleton />;

  const kpis = computeOverviewKpis(data);
  const net30 = netNextNDays(data, 30);
  const net60 = netNextNDays(data, 60);
  const projection = projectedCashFlow(data, 6);
  const projected90 = projection[2]?.cumulative ?? kpis.posicionCaja;

  const receivables = upcomingReceivables(data, 90);
  const payables = upcomingPayables(data, 90);
  const overdueRecv = overdueReceivables(data);
  const overduePay = overduePayables(data);

  const receivablesCols: DataTableColumn<Venta>[] = [
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      accessor: (r) => r.vencimiento,
      render: (r) => formatDate(r.vencimiento),
    },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'cliente', header: 'Cliente', accessor: (r) => r.cliente },
    { key: 'proyecto', header: 'Proyecto', accessor: (r) => r.proyecto },
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
  ];

  const payablesCols: DataTableColumn<Gasto>[] = [
    {
      key: 'vencimiento',
      header: 'Vencimiento',
      accessor: (r) => r.vencimiento,
      render: (r) => formatDate(r.vencimiento),
    },
    { key: 'num', header: 'Num', accessor: (r) => r.num },
    { key: 'proveedor', header: 'Proveedor', accessor: (r) => r.proveedor },
    { key: 'cuenta', header: 'Cuenta', accessor: (r) => r.cuenta },
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
  ];

  return (
    <div className="space-y-6">

      {/* Row 1 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Caja Actual"
          value={formatCurrency(kpis.posicionCaja)}
          subtitle="Dinero efectivamente cobrado - pagado"
          icon={<Wallet className="w-5 h-5" />}
          color={kpis.posicionCaja >= 0 ? 'blue' : 'red'}
          emphasis
        />
        <KpiCard
          title="Flujo Neto 30 días"
          value={formatCurrency(net30)}
          subtitle="Saldo neto previsto"
          icon={<CalendarClock className="w-5 h-5" />}
          color={net30 >= 0 ? 'green' : 'red'}
          trendDirection={net30 >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          title="Flujo Neto 60 días"
          value={formatCurrency(net60)}
          subtitle="Saldo neto previsto"
          icon={<Calendar className="w-5 h-5" />}
          color={net60 >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Caja Proyectada 90d"
          value={formatCurrency(projected90)}
          subtitle="Saldo proyectado acumulado"
          icon={<CalendarRange className="w-5 h-5" />}
          color={projected90 >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Warning banner for negative projection */}
      {projection.some((p) => p.cumulative < 0) && (
        <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900 text-sm">Alerta de tesorería</div>
            <div className="text-xs text-amber-700 mt-1">
              La proyección muestra saldo negativo en los próximos 6 meses. Acción recomendada: acelerar cobros pendientes o revisar calendario de pagos.
            </div>
          </div>
        </div>
      )}

      {/* Chart - Projection */}
      <ChartCard
        title="Proyección de tesorería"
        subtitle="Cobros - Pagos por mes y saldo acumulado proyectado"
      >
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={projection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            <Bar dataKey="receivables" name="Cobros previstos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="payables" name="Pagos previstos" fill="#e4032d" radius={[4, 4, 0, 0]} />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Saldo acumulado (área)"
              fill="#3b82f620"
              stroke="transparent"
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              name="Saldo acumulado"
              stroke="#333333"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#333333' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Two-column grid: overdue + upcoming */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500">
              Cobros vencidos
            </h2>
            {overdueRecv.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
                {overdueRecv.length}
              </span>
            )}
          </div>
          <DataTable
            columns={receivablesCols}
            data={overdueRecv}
            pageSize={10}
            exportFileName="cobros_vencidos.csv"
            emptyMessage="No hay cobros vencidos"
          />

          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500">
              Cobros previstos (90 días)
            </h2>
          </div>
          <DataTable
            columns={receivablesCols}
            data={receivables}
            pageSize={20}
            exportFileName="cobros_previstos.csv"
            emptyMessage="No hay cobros previstos en los próximos 90 días"
          />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500">
              Pagos vencidos
            </h2>
            {overduePay.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
                {overduePay.length}
              </span>
            )}
          </div>
          <DataTable
            columns={payablesCols}
            data={overduePay}
            pageSize={10}
            exportFileName="pagos_vencidos.csv"
            emptyMessage="No hay pagos vencidos"
          />

          <div className="flex items-center gap-2 pt-2">
            <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500">
              Pagos previstos (90 días)
            </h2>
          </div>
          <DataTable
            columns={payablesCols}
            data={payables}
            pageSize={20}
            exportFileName="pagos_previstos.csv"
            emptyMessage="No hay pagos previstos en los próximos 90 días"
          />
        </div>
      </div>
    </div>
  );
}

function CashFlowSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton />
    </div>
  );
}
