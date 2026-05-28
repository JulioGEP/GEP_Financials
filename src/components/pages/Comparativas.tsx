import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart2, ArrowUpDown, Info } from 'lucide-react';
import type { FinancialData } from '../../types/financial';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { formatCurrency } from '../../lib/parseData';
import {
  ventasActivas,
  gastosActivos,
  excluirProyectosGastos,
} from '../../lib/calculations';

interface ComparativasProps {
  data: FinancialData | null;
  loading: boolean;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTH_SHORT_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

interface MonthData {
  monthNum: number;
  monthName: string;
  currentValue: number;
  priorValue: number;
  currentCumulative: number;
  priorCumulative: number;
  monthlyDev: number;
  monthlyDevPct: number | null;
  cumulativeDev: number;
  cumulativeDevPct: number | null;
  isCurrentFuture: boolean;
}

function getMonthlyByYear<T>(
  items: T[],
  year: number,
  getDate: (item: T) => Date | null,
  getValue: (item: T) => number,
): number[] {
  const totals = new Array(12).fill(0);
  for (const item of items) {
    const d = getDate(item);
    if (!d || d.getFullYear() !== year) continue;
    totals[d.getMonth()] += getValue(item);
  }
  return totals;
}

function buildMonthData(
  currentMonthly: number[],
  priorMonthly: number[],
  yearA: number,
): MonthData[] {
  const now = new Date();
  const todayMonth = yearA === now.getFullYear() ? now.getMonth() : 11;

  const lastWithData = currentMonthly.reduce(
    (last, v, i) => (v > 0 ? i : last),
    -1,
  );

  let currentCum = 0;
  let priorCum = 0;

  return MONTH_NAMES_ES.map((monthName, i) => {
    currentCum += currentMonthly[i];
    priorCum += priorMonthly[i];

    const monthlyDev = currentMonthly[i] - priorMonthly[i];
    const monthlyDevPct =
      priorMonthly[i] !== 0
        ? (monthlyDev / Math.abs(priorMonthly[i])) * 100
        : null;
    const cumulativeDev = currentCum - priorCum;
    const cumulativeDevPct =
      priorCum !== 0 ? (cumulativeDev / Math.abs(priorCum)) * 100 : null;

    const isCurrentFuture =
      currentMonthly[i] === 0 && i > Math.max(lastWithData, todayMonth);

    return {
      monthNum: i,
      monthName,
      currentValue: currentMonthly[i],
      priorValue: priorMonthly[i],
      currentCumulative: currentCum,
      priorCumulative: priorCum,
      monthlyDev,
      monthlyDevPct,
      cumulativeDev,
      cumulativeDevPct,
      isCurrentFuture,
    };
  });
}

function fmtPct(n: number, decimals = 2): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals).replace('.', ',')}%`;
}

function fmtDevAmount(dev: number, basePrior: number): string {
  if (basePrior === 0) return '—';
  const sign = dev >= 0 ? '+ ' : '- ';
  return sign + formatCurrency(Math.abs(dev));
}

function devClass(value: number, invert = false): string {
  if (value > 0) return invert ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700';
  if (value < 0) return invert ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  return 'text-gray-400';
}

function devTextClass(value: number, invert = false): string {
  if (value > 0) return invert ? 'text-red-600' : 'text-green-700';
  if (value < 0) return invert ? 'text-green-700' : 'text-red-600';
  return 'text-gray-400';
}

// ─── Comparison Table ────────────────────────────────────────────────────────

interface ComparisonTableProps {
  title: string;
  subtitle?: string;
  note?: string;
  data: MonthData[];
  yearA: number;
  yearB: number;
  invertColors?: boolean;
}

function ComparisonTable({
  title,
  subtitle,
  note,
  data,
  yearA,
  yearB,
  invertColors = false,
}: ComparisonTableProps) {
  const monthsWithCurrentData = data.filter(
    (d) => !d.isCurrentFuture && d.currentValue !== 0,
  ).length;

  const totalCurrent = data.reduce((s, r) => s + r.currentValue, 0);
  const totalPrior = data.reduce((s, r) => s + r.priorValue, 0);
  const totalDev = totalCurrent - totalPrior;
  const totalDevPct = totalPrior !== 0 ? (totalDev / Math.abs(totalPrior)) * 100 : null;

  const lastRow = data[data.length - 1];
  const finalCumCurrent = lastRow.currentCumulative;
  const finalCumPrior = lastRow.priorCumulative;
  const finalCumDev = finalCumCurrent - finalCumPrior;
  const finalCumDevPct =
    finalCumPrior !== 0 ? (finalCumDev / Math.abs(finalCumPrior)) * 100 : null;

  const avgMonthly =
    monthsWithCurrentData > 0 ? totalCurrent / monthsWithCurrentData : 0;

  const achievementPct =
    totalPrior > 0 ? (totalCurrent / totalPrior) * 100 : null;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gep-dark">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {achievementPct !== null && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gep-gray-light text-gep-dark-light">
            {achievementPct.toFixed(1).replace('.', ',')}% vs {yearB}
          </span>
        )}
      </div>
      {note && (
        <div className="mx-5 my-3 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{note}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* Level 1 headers */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-36" />
              <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {yearA}
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200">
                Acumulado
              </th>
              <th
                colSpan={2}
                className="text-center px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200"
              >
                mes
              </th>
              <th
                colSpan={2}
                className="text-center px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-200"
              >
                acumulada
              </th>
            </tr>
            {/* Level 2 sub-headers */}
            <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] text-gray-400 font-medium">
              <th className="text-left px-4 py-1.5 uppercase tracking-wide">Mes</th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide">Importe</th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide border-l border-gray-100">
                Acum. {yearA}
              </th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide border-l border-gray-100">
                vs {yearB} (€)
              </th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide">%</th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide border-l border-gray-100">
                vs {yearB} (€)
              </th>
              <th className="text-right px-4 py-1.5 uppercase tracking-wide">%</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50">
            {data.map((row) => (
              <tr
                key={row.monthNum}
                className="hover:bg-gray-50/50 transition-colors"
              >
                {/* Month name */}
                <td className="px-4 py-2.5 text-sm text-gray-700 font-medium whitespace-nowrap">
                  {row.monthName}
                </td>

                {/* Monthly current year value */}
                <td className="px-4 py-2.5 text-sm text-right text-gray-900 tabular-nums whitespace-nowrap">
                  {row.isCurrentFuture ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    formatCurrency(row.currentValue)
                  )}
                </td>

                {/* Cumulative current year */}
                <td className="px-4 py-2.5 text-sm text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap border-l border-gray-100">
                  {formatCurrency(row.currentCumulative)}
                </td>

                {/* Monthly deviation € */}
                <td
                  className={`px-4 py-2.5 text-sm text-right tabular-nums font-medium whitespace-nowrap border-l border-gray-100 ${
                    row.priorValue !== 0
                      ? devClass(row.monthlyDev, invertColors)
                      : 'text-gray-300'
                  }`}
                >
                  {row.priorValue !== 0
                    ? fmtDevAmount(row.monthlyDev, row.priorValue)
                    : '—'}
                </td>

                {/* Monthly deviation % */}
                <td
                  className={`px-4 py-2.5 text-sm text-right tabular-nums whitespace-nowrap ${
                    row.monthlyDevPct !== null
                      ? devTextClass(row.monthlyDev, invertColors)
                      : 'text-gray-300'
                  }`}
                >
                  {row.monthlyDevPct !== null
                    ? fmtPct(row.monthlyDevPct)
                    : '—'}
                </td>

                {/* Cumulative deviation € */}
                <td
                  className={`px-4 py-2.5 text-sm text-right tabular-nums font-medium whitespace-nowrap border-l border-gray-100 ${
                    row.priorCumulative !== 0
                      ? devClass(row.cumulativeDev, invertColors)
                      : 'text-gray-300'
                  }`}
                >
                  {row.priorCumulative !== 0
                    ? fmtDevAmount(row.cumulativeDev, row.priorCumulative)
                    : '—'}
                </td>

                {/* Cumulative deviation % */}
                <td
                  className={`px-4 py-2.5 text-sm text-right tabular-nums whitespace-nowrap ${
                    row.cumulativeDevPct !== null
                      ? devTextClass(row.cumulativeDev, invertColors)
                      : 'text-gray-300'
                  }`}
                >
                  {row.cumulativeDevPct !== null
                    ? fmtPct(row.cumulativeDevPct)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="border-t-2 border-gray-300">
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-2.5 text-xs text-gray-600 uppercase tracking-wide">
                Total
              </td>
              <td className="px-4 py-2.5 text-sm text-right text-gray-900 tabular-nums">
                {formatCurrency(totalCurrent)}
              </td>
              <td className="px-4 py-2.5 text-sm text-right text-gray-900 tabular-nums border-l border-gray-100">
                {formatCurrency(finalCumCurrent)}
              </td>
              <td
                className={`px-4 py-2.5 text-sm text-right tabular-nums border-l border-gray-100 ${
                  totalPrior !== 0
                    ? devTextClass(totalDev, invertColors)
                    : 'text-gray-400'
                }`}
              >
                {totalPrior !== 0
                  ? fmtDevAmount(totalDev, totalPrior)
                  : '—'}
              </td>
              <td
                className={`px-4 py-2.5 text-sm text-right tabular-nums ${
                  totalDevPct !== null
                    ? devTextClass(totalDev, invertColors)
                    : 'text-gray-400'
                }`}
              >
                {totalDevPct !== null ? fmtPct(totalDevPct) : '—'}
              </td>
              <td
                className={`px-4 py-2.5 text-sm text-right tabular-nums border-l border-gray-100 ${
                  finalCumPrior !== 0
                    ? devTextClass(finalCumDev, invertColors)
                    : 'text-gray-400'
                }`}
              >
                {finalCumPrior !== 0
                  ? fmtDevAmount(finalCumDev, finalCumPrior)
                  : '—'}
              </td>
              <td
                className={`px-4 py-2.5 text-sm text-right tabular-nums ${
                  finalCumDevPct !== null
                    ? devTextClass(finalCumDev, invertColors)
                    : 'text-gray-400'
                }`}
              >
                {finalCumDevPct !== null ? fmtPct(finalCumDevPct) : '—'}
              </td>
            </tr>

            <tr className="bg-gray-50/50 border-t border-gray-100">
              <td className="px-4 py-2 text-xs text-gray-500">
                Promedio / mes
              </td>
              <td className="px-4 py-2 text-xs text-right text-gray-600 tabular-nums">
                {formatCurrency(avgMonthly)}
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── YoY Bar Chart ────────────────────────────────────────────────────────────

interface YoyChartProps {
  dataA: number[];
  dataB: number[];
  yearA: number;
  yearB: number;
  title: string;
  subtitle?: string;
}

function YoyBarChart({ dataA, dataB, yearA, yearB, title, subtitle }: YoyChartProps) {
  const chartData = MONTH_SHORT_ES.map((label, i) => ({
    label,
    [yearA]: Math.round(dataA[i]),
    [yearB]: Math.round(dataB[i]),
  }));

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name,
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey={yearA} fill="#e4032d" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey={yearB} fill="#9ca3af" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── YoY Summary Bar (horizontal progress) ───────────────────────────────────

interface SummaryKpiProps {
  label: string;
  currentValue: number;
  priorValue: number;
  yearA: number;
  yearB: number;
  invertColors?: boolean;
  icon: React.ReactNode;
  accentColor: string;
}

function SummaryKpi({
  label,
  currentValue,
  priorValue,
  yearA,
  yearB,
  invertColors = false,
  icon,
  accentColor,
}: SummaryKpiProps) {
  const dev = currentValue - priorValue;
  const devPct = priorValue !== 0 ? (dev / Math.abs(priorValue)) * 100 : null;
  const isPositive = dev >= 0;
  const isGood = invertColors ? !isPositive : isPositive;

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: accentColor }}
        >
          {icon}
        </span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-gep-dark tabular-nums leading-tight">
            {formatCurrency(currentValue, { compact: true })}
          </p>
          <p className="text-[11px] text-gray-400 tabular-nums mt-0.5">
            {yearB}: {formatCurrency(priorValue, { compact: true })}
          </p>
        </div>

        {devPct !== null && (
          <div
            className={`flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full ${
              isGood
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{Math.abs(devPct).toFixed(1).replace('.', ',')}%</span>
          </div>
        )}
      </div>

      {/* Mini progress bar */}
      {priorValue > 0 && (
        <div className="mt-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (currentValue / priorValue) * 100)}%`,
                backgroundColor: isGood ? '#22c55e' : '#ef4444',
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">
            {yearA} alcanza el{' '}
            {((currentValue / priorValue) * 100).toFixed(1).replace('.', ',')}%
            del total {yearB}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Waterfall Resultado Row (month-by-month result) ─────────────────────────

interface ResultadoRowProps {
  cobrosData: MonthData[];
  gastosData: MonthData[];
  yearA: number;
  yearB: number;
}

function ResultadoTable({ cobrosData, gastosData, yearA, yearB }: ResultadoRowProps) {
  const data: MonthData[] = cobrosData.map((c, i) => {
    const g = gastosData[i];
    const currentValue = c.currentValue - g.currentValue;
    const priorValue = c.priorValue - g.priorValue;
    return {
      monthNum: i,
      monthName: c.monthName,
      currentValue,
      priorValue,
      currentCumulative: c.currentCumulative - g.currentCumulative,
      priorCumulative: c.priorCumulative - g.priorCumulative,
      monthlyDev: currentValue - priorValue,
      monthlyDevPct:
        priorValue !== 0 ? ((currentValue - priorValue) / Math.abs(priorValue)) * 100 : null,
      cumulativeDev:
        c.currentCumulative - g.currentCumulative - (c.priorCumulative - g.priorCumulative),
      cumulativeDevPct: null,
      isCurrentFuture: c.isCurrentFuture && g.isCurrentFuture,
    };
  });

  // Recalculate cumulativeDevPct
  for (const row of data) {
    row.cumulativeDevPct =
      row.priorCumulative !== 0
        ? (row.cumulativeDev / Math.abs(row.priorCumulative)) * 100
        : null;
  }

  return (
    <ComparisonTable
      title={`Resultado Neto (Cobros − Gastos Pagados)`}
      subtitle="Flujo real de caja: ingresos cobrados menos pagos realizados"
      data={data}
      yearA={yearA}
      yearB={yearB}
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ComparativasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4 h-28 bg-gray-50" />
        ))}
      </div>
      <ChartCardSkeleton />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card h-96 bg-gray-50" />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Comparativas({ data, loading }: ComparativasProps) {
  const currentYear = new Date().getFullYear();
  const [yearA, setYearA] = useState(currentYear);
  const [yearB, setYearB] = useState(currentYear - 1);

  const availableYears = useMemo(() => {
    if (!data) return [currentYear, currentYear - 1];
    const years = new Set<number>();
    for (const v of data.ventas) {
      if (v.fecha) years.add(v.fecha.getFullYear());
      if (v.fechaCobro) years.add(v.fechaCobro.getFullYear());
    }
    for (const g of data.gastos) {
      if (g.fechaEmision) years.add(g.fechaEmision.getFullYear());
      if (g.fechaPago) years.add(g.fechaPago.getFullYear());
    }
    years.add(currentYear);
    years.add(currentYear - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [data, currentYear]);

  const { cobrosA, cobrosB, gastosA, gastosB, facturacionA, facturacionB } =
    useMemo(() => {
      if (!data)
        return {
          cobrosA: new Array(12).fill(0),
          cobrosB: new Array(12).fill(0),
          gastosA: new Array(12).fill(0),
          gastosB: new Array(12).fill(0),
          facturacionA: new Array(12).fill(0),
          facturacionB: new Array(12).fill(0),
        };

      const activas = ventasActivas(data.ventas);
      const activosGastos = excluirProyectosGastos(gastosActivos(data.gastos));

      return {
        // Cobros: actual received (fechaCobro + cobrado)
        cobrosA: getMonthlyByYear(activas, yearA, (v) => v.fechaCobro, (v) => v.cobrado),
        cobrosB: getMonthlyByYear(activas, yearB, (v) => v.fechaCobro, (v) => v.cobrado),

        // Gastos pagados: actual paid (fechaPago + pagado)
        gastosA: getMonthlyByYear(activosGastos, yearA, (g) => g.fechaPago, (g) => g.pagado),
        gastosB: getMonthlyByYear(activosGastos, yearB, (g) => g.fechaPago, (g) => g.pagado),

        // Facturación (referencia): fecha + subtotal (sin IVA)
        facturacionA: getMonthlyByYear(activas, yearA, (v) => v.fecha, (v) => v.subtotal),
        facturacionB: getMonthlyByYear(activas, yearB, (v) => v.fecha, (v) => v.subtotal),
      };
    }, [data, yearA, yearB]);

  const cobrosMonthData = useMemo(
    () => buildMonthData(cobrosA, cobrosB, yearA),
    [cobrosA, cobrosB, yearA],
  );
  const gastosMonthData = useMemo(
    () => buildMonthData(gastosA, gastosB, yearA),
    [gastosA, gastosB, yearA],
  );
  const facturacionMonthData = useMemo(
    () => buildMonthData(facturacionA, facturacionB, yearA),
    [facturacionA, facturacionB, yearA],
  );

  // Totals for KPI cards
  const totalCobrosA = cobrosA.reduce((s, v) => s + v, 0);
  const totalCobrosB = cobrosB.reduce((s, v) => s + v, 0);
  const totalGastosA = gastosA.reduce((s, v) => s + v, 0);
  const totalGastosB = gastosB.reduce((s, v) => s + v, 0);
  const resultadoA = totalCobrosA - totalGastosA;
  const resultadoB = totalCobrosB - totalGastosB;
  const totalFacturacionA = facturacionA.reduce((s, v) => s + v, 0);
  const totalFacturacionB = facturacionB.reduce((s, v) => s + v, 0);

  if (loading || !data) return <ComparativasSkeleton />;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <ArrowUpDown className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-600 font-medium">Comparando</span>
        <select
          value={yearA}
          onChange={(e) => setYearA(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gep-dark font-semibold focus:outline-none focus:ring-2 focus:ring-gep-red/30"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">vs.</span>
        <select
          value={yearB}
          onChange={(e) => setYearB(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gep-dark font-semibold focus:outline-none focus:ring-2 focus:ring-gep-red/30"
        >
          {availableYears
            .filter((y) => y !== yearA)
            .map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
        </select>
        <span className="text-xs text-gray-400 ml-1">
          Valores reales ingresados/pagados · excluye TKEF
        </span>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryKpi
          label="Cobros"
          currentValue={totalCobrosA}
          priorValue={totalCobrosB}
          yearA={yearA}
          yearB={yearB}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          accentColor="#22c55e"
        />
        <SummaryKpi
          label="Gastos Pagados"
          currentValue={totalGastosA}
          priorValue={totalGastosB}
          yearA={yearA}
          yearB={yearB}
          invertColors
          icon={<TrendingDown className="w-3.5 h-3.5" />}
          accentColor="#ef4444"
        />
        <SummaryKpi
          label="Resultado Neto"
          currentValue={resultadoA}
          priorValue={resultadoB}
          yearA={yearA}
          yearB={yearB}
          icon={<Minus className="w-3.5 h-3.5" />}
          accentColor="#3b82f6"
        />
        <SummaryKpi
          label="Facturación (ref.)"
          currentValue={totalFacturacionA}
          priorValue={totalFacturacionB}
          yearA={yearA}
          yearB={yearB}
          icon={<BarChart2 className="w-3.5 h-3.5" />}
          accentColor="#e4032d"
        />
      </div>

      {/* YoY Bar Chart: Cobros */}
      <YoyBarChart
        dataA={cobrosA}
        dataB={cobrosB}
        yearA={yearA}
        yearB={yearB}
        title={`Cobros mensuales: ${yearA} vs ${yearB}`}
        subtitle="Ingresos efectivamente cobrados mes a mes (valor ingresado real)"
      />

      {/* Table 1: Cobros — MAIN (valor ingresado) */}
      <ComparisonTable
        title={`Cobros ${yearA} — Ingresos ingresados`}
        subtitle="Dinero efectivamente recibido (fechaCobro). Métrica principal de caja."
        data={cobrosMonthData}
        yearA={yearA}
        yearB={yearB}
      />

      {/* Table 2: Gastos Pagados */}
      <ComparisonTable
        title={`Gastos Pagados ${yearA}`}
        subtitle="Pagos efectivamente realizados (fechaPago). Salidas reales de caja."
        data={gastosMonthData}
        yearA={yearA}
        yearB={yearB}
        invertColors
      />

      {/* Table 3: Resultado Neto */}
      <ResultadoTable
        cobrosData={cobrosMonthData}
        gastosData={gastosMonthData}
        yearA={yearA}
        yearB={yearB}
      />

      {/* Table 4: Facturación (referencia) */}
      <ComparisonTable
        title={`Facturación ${yearA} — Referencia`}
        subtitle="Importe facturado por fecha de emisión de factura."
        note={`Esta tabla muestra el importe total facturado en cada mes (fecha de la factura), independientemente de si ha sido cobrado. Es útil para ver el pipeline comercial y comparar volumen facturado, pero NO refleja el dinero real en caja. La métrica de tesorería real son los Cobros (tabla superior), que registran únicamente los importes efectivamente ingresados.`}
        data={facturacionMonthData}
        yearA={yearA}
        yearB={yearB}
      />
    </div>
  );
}
