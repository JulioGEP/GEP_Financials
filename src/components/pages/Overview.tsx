import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  Clock,
  AlertOctagon,
  Hourglass,
  ReceiptText,
} from 'lucide-react';
import type { FinancialData } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { AlertCard } from '../ui/AlertCard';
import { formatCurrency } from '../../lib/parseData';
import {
  computeOverviewKpis,
  monthlyRevenueVsExpenses,
  cashPositionTrend,
} from '../../lib/calculations';
import { generateAlerts } from '../../lib/alerts';

interface OverviewProps {
  data: FinancialData | null;
  loading: boolean;
}

export function Overview({ data, loading }: OverviewProps) {
  if (loading || !data) {
    return <OverviewSkeleton />;
  }

  const kpis = computeOverviewKpis(data);
  const monthly = monthlyRevenueVsExpenses(data, 12);
  const cashTrend = cashPositionTrend(data, 12);
  const alerts = generateAlerts(data).slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos YTD"
          value={formatCurrency(kpis.ingresosYTD)}
          subtitle={`Año ${new Date().getFullYear()}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
          emphasis
        />
        <KpiCard
          title="Gastos YTD"
          value={formatCurrency(kpis.gastosYTD)}
          subtitle={`Año ${new Date().getFullYear()}`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Resultado Neto"
          value={formatCurrency(kpis.resultadoNeto)}
          subtitle="Ingresos - Gastos"
          icon={<Activity className="w-5 h-5" />}
          color={kpis.resultadoNeto >= 0 ? 'green' : 'red'}
          trend={
            kpis.ingresosYTD > 0
              ? `${((kpis.resultadoNeto / kpis.ingresosYTD) * 100).toFixed(1)}% margen`
              : undefined
          }
          trendDirection={kpis.resultadoNeto >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          title="Posición de Caja"
          value={formatCurrency(kpis.posicionCaja)}
          subtitle="Cobrado - Pagado"
          icon={<Wallet className="w-5 h-5" />}
          color={kpis.posicionCaja >= 0 ? 'blue' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pendiente Cobrar"
          value={formatCurrency(kpis.pendienteCobrar)}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Pendiente Pagar"
          value={formatCurrency(kpis.pendientePagar)}
          icon={<ReceiptText className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Facturas Vencidas"
          value={String(kpis.facturasVencidas)}
          subtitle="Sin cobrar tras vencimiento"
          icon={<AlertOctagon className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Días Cobro Medio"
          value={`${kpis.diasCobroMedio} días`}
          subtitle="DSO (Days Sales Outstanding)"
          icon={<Clock className="w-5 h-5" />}
          color="default"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Ingresos vs Gastos"
          subtitle="Últimos 12 meses"
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
          title="Evolución de tesorería"
          subtitle="Posición de caja acumulada"
        >
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
              <Line
                type="monotone"
                dataKey="cash"
                name="Caja"
                stroke="#e4032d"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#e4032d' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Alertas principales
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
