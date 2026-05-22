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
import type { FinancialData } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { AlertCard } from '../ui/AlertCard';
import { formatCurrency } from '../../lib/parseData';
import {
  computeOverviewKpis,
  monthlyDataForRange,
  cashFlowDataForRange,
} from '../../lib/calculations';
import { generateAlerts } from '../../lib/alerts';
import { usePeriod } from '../../context/PeriodContext';

interface OverviewProps {
  data: FinancialData | null;
  loading: boolean;
}

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

export function Overview({ data, loading }: OverviewProps) {
  const { dateRange, prevDateRange, label } = usePeriod();

  if (loading || !data) {
    return <OverviewSkeleton />;
  }

  const kpis = computeOverviewKpis(data, dateRange);
  const prevKpis = computeOverviewKpis(data, prevDateRange);
  const monthly = monthlyDataForRange(data, dateRange);
  const cashFlow = cashFlowDataForRange(data, dateRange);
  const alerts = generateAlerts(data).slice(0, 4);

  // Deltas for comparison
  const deltaIngresos = pctDelta(kpis.ingresosYTD, prevKpis.ingresosYTD);
  const deltaGastos = pctDelta(kpis.gastosYTD, prevKpis.gastosYTD);
  const deltaResultado = pctDelta(kpis.resultadoNeto, prevKpis.resultadoNeto);
  const deltaIvaRep = pctDelta(kpis.ivaRepercutido, prevKpis.ivaRepercutido);
  const deltaIvaSop = pctDelta(kpis.ivaSoportado, prevKpis.ivaSoportado);

  return (
    <div className="space-y-6">

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
        />
        <KpiCard
          title="Capital de Trabajo"
          value={formatCurrency(kpis.workingCapital)}
          subtitle="Cobros - Pagos pendientes"
          icon={<Scale className="w-5 h-5" />}
          color={kpis.workingCapital >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Pendiente Cobrar"
          value={formatCurrency(kpis.pendienteCobrar)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendienteCobrarVencido)}`}
          icon={<Hourglass className="w-5 h-5" />}
          color="amber"
        />
        <KpiCard
          title="Pendiente Pagar"
          value={formatCurrency(kpis.pendientePagar)}
          subtitle={`Del que vencido: ${formatCurrency(kpis.pendientePagarVencido)}`}
          icon={<ReceiptText className="w-5 h-5" />}
          color="amber"
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
        />
        <KpiCard
          title="Pagos Vencidos"
          value={formatCurrency(kpis.pendientePagarVencido)}
          subtitle={`${kpis.facturasVencidasPago} factura(s) sin pagar`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <KpiCard
          title="Días Cobro Medio"
          value={`${kpis.diasCobroMedio} días`}
          subtitle="DSO · Plazo medio de cobro"
          icon={<Clock className="w-5 h-5" />}
          color="default"
          trend={`Tasa cobro: ${kpis.tasaCobro.toFixed(1)}%`}
          trendDirection={kpis.tasaCobro >= 80 ? 'up' : 'neutral'}
        />
        <KpiCard
          title="Días Pago Medio"
          value={`${kpis.dpo} días`}
          subtitle="DPO · Plazo medio de pago"
          icon={<CalendarCheck className="w-5 h-5" />}
          color="default"
          trend={`Tasa pago: ${kpis.tasaPago.toFixed(1)}%`}
          trendDirection={kpis.tasaPago >= 80 ? 'up' : 'neutral'}
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
