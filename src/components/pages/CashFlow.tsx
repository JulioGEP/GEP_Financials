import {
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
import { Wallet, CalendarClock, Calendar, CalendarRange } from 'lucide-react';
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Caja Actual"
          value={formatCurrency(kpis.posicionCaja)}
          subtitle="Cobrado - Pagado"
          icon={<Wallet className="w-5 h-5" />}
          color={kpis.posicionCaja >= 0 ? 'blue' : 'red'}
          emphasis
        />
        <KpiCard
          title="Próximos 30 días"
          value={formatCurrency(net30)}
          subtitle="Saldo neto previsto"
          icon={<CalendarClock className="w-5 h-5" />}
          color={net30 >= 0 ? 'green' : 'red'}
          trendDirection={net30 >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          title="Próximos 60 días"
          value={formatCurrency(net60)}
          subtitle="Saldo neto previsto"
          icon={<Calendar className="w-5 h-5" />}
          color={net60 >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Próximos 90 días"
          value={formatCurrency(projected90)}
          subtitle="Saldo proyectado acumulado"
          icon={<CalendarRange className="w-5 h-5" />}
          color={projected90 >= 0 ? 'green' : 'red'}
        />
      </div>

      <ChartCard title="Proyección de tesorería" subtitle="Cobros - Pagos por mes y saldo acumulado">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={projection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" fontSize={11} stroke="#777" />
            <YAxis
              fontSize={11}
              stroke="#777"
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="receivables" name="Cobros previstos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="payables" name="Pagos previstos" fill="#e4032d" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="cumulative"
              name="Saldo acumulado"
              stroke="#333333"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#333333' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Cobros previstos (90 días)
          </h2>
          <DataTable
            columns={receivablesCols}
            data={receivables}
            pageSize={20}
            exportFileName="cobros_previstos.csv"
            emptyMessage="No hay cobros previstos en los próximos 90 días"
          />
        </div>
        <div>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Pagos previstos (90 días)
          </h2>
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

