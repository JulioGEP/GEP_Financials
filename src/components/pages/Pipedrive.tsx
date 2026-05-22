import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Target, TrendingUp, Hourglass, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ChartCard } from '../ui/ChartCard';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { config } from '../../config';
import { formatCurrency, parseSpanishNumber } from '../../lib/parseData';

interface PipedriveProps {
  loading: boolean;
}

interface PipedriveMonthValue {
  period: string;
  value: number;
  count: number;
}

interface PipedriveApiResponse {
  year: number;
  prior: number;
  current: PipedriveMonthValue[];
  priorYear: PipedriveMonthValue[];
  error?: string;
}

// Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ssZ" safely without relying on
// local timezone (new Date("YYYY-MM-DD") is UTC but getMonth() is local).
function parsePeriodStart(period: string): { year: number; month: number } | null {
  const m = period?.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1 };
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MESES_LOWER = MONTH_LABELS.map((m) => m.toLowerCase());

function getField(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === key.toLowerCase().trim(),
    );
    if (found) return (row[found] || '').trim();
  }
  return '';
}

function parseObjetivosTotalsByYear(csv: string): Record<number, number[]> {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (parsed.data.length === 0) return {};

  const firstRow = parsed.data[0];
  const mesKey = Object.keys(firstRow).find((k) =>
    MESES_LOWER.includes((firstRow[k] || '').toLowerCase().trim()),
  ) ?? 'Mes';

  const headerYear = /^\d{4}$/.test(mesKey.trim()) ? parseInt(mesKey.trim(), 10) : null;
  let currentYear = headerYear ?? new Date().getFullYear();
  const result: Record<number, number[]> = {};

  for (const row of parsed.data) {
    const mesValue = (row[mesKey] || '').trim();
    if (/^\d{4}$/.test(mesValue)) {
      currentYear = parseInt(mesValue, 10);
      continue;
    }
    const idx = MESES_LOWER.indexOf(mesValue.toLowerCase());
    if (idx < 0) continue;
    const total = parseSpanishNumber(getField(row, ['Total', 'TOTAL']));
    if (!result[currentYear]) result[currentYear] = new Array(12).fill(0);
    result[currentYear][idx] = total;
  }

  return result;
}

async function fetchObjetivosTotals(): Promise<Record<number, number[]>> {
  const res = await fetch(`${config.apiBase}/sheets?sheet=objetivos`, {
    headers: { Accept: 'application/json' },
  });
  const json = (await res.json()) as { data?: string; error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Error del servidor: ${res.status}`);
  }
  return parseObjetivosTotalsByYear(json.data ?? '');
}

async function fetchPipedrive(year: number): Promise<PipedriveApiResponse> {
  const res = await fetch(`${config.apiBase}/pipedrive-won-deals?year=${year}`, {
    headers: { Accept: 'application/json' },
  });
  const json = (await res.json()) as PipedriveApiResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Error del servidor: ${res.status}`);
  }
  // Log to console to aid debugging — visible in browser DevTools
  console.log('[Pipedrive] API response:', JSON.stringify(json, null, 2));
  return json;
}

function monthsToArray(items: PipedriveMonthValue[], targetYear: number): number[] {
  const arr = new Array(12).fill(0);
  for (const item of items) {
    const parsed = parsePeriodStart(item.period);
    if (!parsed) continue;
    if (parsed.year === targetYear) {
      arr[parsed.month] = item.value || 0;
    }
  }
  return arr;
}

function formatSigned(value: number): string {
  if (Math.abs(value) < 0.005) return formatCurrency(0);
  const formatted = formatCurrency(Math.abs(value));
  return value < 0 ? `- ${formatted}` : formatted;
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2).replace('.', ',')}%`;
}

function devCellClass(value: number, isFuture: boolean): string {
  if (isFuture) return 'bg-gray-50 text-gray-400';
  if (value > 0) return 'bg-green-100 text-green-800';
  if (value < 0) return 'bg-red-100 text-red-800';
  return '';
}

export function Pipedrive({ loading }: PipedriveProps) {
  const year = new Date().getFullYear();
  const priorYear = year - 1;
  const currentMonthIdx = new Date().getMonth();

  const [pipedrive, setPipedrive] = useState<PipedriveApiResponse | null>(null);
  const [objetivosByYear, setObjetivosByYear] = useState<Record<number, number[]>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noDataWarning, setNoDataWarning] = useState(false);

  useEffect(() => {
    let mounted = true;
    setError(null);
    Promise.all([fetchPipedrive(year), fetchObjetivosTotals()])
      .then(([pd, objs]) => {
        if (!mounted) return;
        setPipedrive(pd);
        setObjetivosByYear(objs);
        const totalWon = (pd.current || []).reduce((s, m) => s + (m.value || 0), 0);
        setNoDataWarning(totalWon === 0);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      })
      .finally(() => {
        if (mounted) setLoadingData(false);
      });
    return () => {
      mounted = false;
    };
  }, [year]);

  const rows = useMemo(() => {
    const realized = pipedrive ? monthsToArray(pipedrive.current, year) : new Array(12).fill(0);
    const prior = pipedrive ? monthsToArray(pipedrive.priorYear, priorYear) : new Array(12).fill(0);
    const objetivos = objetivosByYear[year] ?? new Array(12).fill(0);

    const objAnual = objetivos.reduce((a, b) => a + b, 0);
    const realizadoTotal = realized.reduce((a, b) => a + b, 0);

    // Acumulado de "realizado" se detiene cuando se acaban los meses con valor (>0).
    // Tras el último mes con dato, el acumulado se mantiene constante (como en el Excel:
    // "ACUMULADO" muestra el objetivo anual completo).
    let lastRealizedIdx = -1;
    for (let i = 11; i >= 0; i--) {
      if (realized[i] > 0) {
        lastRealizedIdx = i;
        break;
      }
    }

    let acumRealizado = 0;
    let acumPrior = 0;
    let acumObjetivo = 0;

    return MONTH_LABELS.map((mes, i) => {
      const isFuture = i > lastRealizedIdx;
      const realizadoMes = realized[i];
      const priorMes = prior[i];
      const objetivoMes = objetivos[i];

      acumRealizado += realizadoMes;
      acumPrior += priorMes;
      acumObjetivo += objetivoMes;

      // En el Excel, la columna "ACUMULADO" muestra el objetivo anual cuando ya no
      // hay más realizado. Antes del último mes con dato, muestra el acumulado real.
      const acumColumna = isFuture ? objAnual : acumRealizado;

      const desvMes = realizadoMes - objetivoMes;
      const desvMesAcum = acumRealizado - acumObjetivo;

      const desv2025 = realizadoMes - priorMes;
      const desv2025Acum = acumRealizado - acumPrior;

      const desvAcumPct = acumPrior > 0 ? (acumRealizado / acumPrior - 1) * 100 : null;
      const desvMesPct = priorMes > 0
        ? (realizadoMes / priorMes - 1) * 100
        : (isFuture ? -100 : null);

      return {
        mes,
        realizado: isFuture ? null : realizadoMes,
        objetivo: objetivoMes,
        acumulado: acumColumna,
        desvMes: isFuture ? -objetivoMes : desvMes,
        desvMesAcum: isFuture ? acumRealizado - acumObjetivo : desvMesAcum,
        desv2025: isFuture ? -priorMes : desv2025,
        desv2025Acum: isFuture ? acumRealizado - acumPrior : desv2025Acum,
        desvAcumPct,
        desvMesPct,
        isFuture,
      };
    }).map((row, i, all) => ({
      ...row,
      _objAnual: objAnual,
      _realizadoTotal: realizadoTotal,
      _isCurrentMonth: i === currentMonthIdx && !all[i].isFuture,
    }));
  }, [pipedrive, objetivosByYear, year, priorYear, currentMonthIdx]);

  const summary = useMemo(() => {
    const objAnual = rows[0]?._objAnual ?? 0;
    const realizadoTotal = rows[0]?._realizadoTotal ?? 0;
    const lastFilledIdx = rows.findIndex((r) => r.isFuture) - 1;
    const acumActual = lastFilledIdx >= 0 ? rows[lastFilledIdx].acumulado : 0;
    const cumplimiento = objAnual > 0 ? (realizadoTotal / objAnual) * 100 : 0;
    const gap = realizadoTotal - objAnual;
    return { objAnual, realizadoTotal, acumActual, cumplimiento, gap };
  }, [rows]);

  const desvVsPriorAcum = useMemo(() => {
    if (!pipedrive) return 0;
    const prior = monthsToArray(pipedrive.priorYear, priorYear);
    const realized = monthsToArray(pipedrive.current, year);
    let lastIdx = -1;
    for (let i = 11; i >= 0; i--) {
      if (realized[i] > 0) { lastIdx = i; break; }
    }
    let acumPrior = 0;
    let acumReal = 0;
    for (let i = 0; i <= lastIdx; i++) {
      acumPrior += prior[i];
      acumReal += realized[i];
    }
    return acumReal - acumPrior;
  }, [pipedrive, year, priorYear]);

  if (loading || loadingData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 mb-1">No se pudieron cargar los datos</p>
            <p className="text-amber-700">{error}</p>
          </div>
        </div>
      )}

      {noDataWarning && !error && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-800 mb-1">
              Pipedrive no devolvió ventas ganadas para {year}
            </p>
            <p className="text-blue-700">
              La API respondió correctamente pero todos los valores son 0. Posibles causas:
            </p>
            <ul className="text-blue-700 list-disc ml-4 mt-1 space-y-0.5">
              <li>El token de API pertenece a una cuenta/pipeline diferente</li>
              <li>Los negocios ganados no tienen el campo <code className="bg-blue-100 px-1 rounded">won_time</code> establecido (algunos usan <code className="bg-blue-100 px-1 rounded">close_time</code>)</li>
              <li>La variable <code className="bg-blue-100 px-1 rounded">PIPEDRIVE_API_TOKEN</code> en Netlify no está disponible para deploys de preview</li>
            </ul>
            <p className="text-blue-600 mt-1 text-[11px]">
              Abre la consola del navegador (F12 → Console) para ver la respuesta cruda de la API.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          title="Objetivo anual"
          value={formatCurrency(summary.objAnual)}
          icon={<Target className="w-4 h-4" />}
          color="blue"
        />
        <KpiCard
          title="Acumulado actual"
          value={formatCurrency(summary.acumActual)}
          icon={<TrendingUp className="w-4 h-4" />}
          color="green"
        />
        <KpiCard
          title="% de cumplimiento"
          value={formatPct(summary.cumplimiento)}
          icon={<Hourglass className="w-4 h-4" />}
          color="default"
        />
        <KpiCard
          title="Gap pendiente"
          value={formatSigned(summary.gap)}
          icon={<AlertCircle className="w-4 h-4" />}
          color={summary.gap < 0 ? 'red' : 'green'}
        />
      </div>

      <ChartCard
        title={`PIPEDRIVE ${year}`}
        subtitle={`Comparativa de ventas vs Objetivo ${year} y vs ${priorYear}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left font-semibold uppercase tracking-wider py-2 pr-3 whitespace-nowrap">Ventas</th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap">Realizado</th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap">Objetivo</th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap">Acumulado</th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap" colSpan={2}>
                  Obj {year}
                </th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap" colSpan={2}>
                  vs {priorYear}
                </th>
                <th className="text-right font-semibold uppercase tracking-wider py-2 px-3 whitespace-nowrap" colSpan={2}>
                  vs {priorYear}
                </th>
              </tr>
              <tr className="border-b border-gray-200 text-gray-500">
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desviación</th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desv. Acum.</th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desviación</th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desv. Acum.</th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desv % acum</th>
                <th className="text-right font-medium py-2 px-3 whitespace-nowrap">Desv % mes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mes} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium text-gep-dark capitalize whitespace-nowrap">{row.mes}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {row.realizado === null ? '' : formatCurrency(row.realizado)}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap text-gray-600">
                    {formatCurrency(row.objetivo)}
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap font-semibold bg-gray-50">
                    {formatCurrency(row.acumulado)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${devCellClass(row.desvMes, row.isFuture)}`}>
                    {formatSigned(row.desvMes)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${devCellClass(row.desvMesAcum, false)}`}>
                    {formatSigned(row.desvMesAcum)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${devCellClass(row.desv2025, row.isFuture)}`}>
                    {formatSigned(row.desv2025)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${devCellClass(row.desv2025Acum, false)}`}>
                    {formatSigned(row.desv2025Acum)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${
                    row.desvAcumPct === null ? '' : devCellClass(row.desvAcumPct, false)
                  }`}>
                    {formatPct(row.desvAcumPct)}
                  </td>
                  <td className={`py-2 px-3 text-right whitespace-nowrap ${
                    row.desvMesPct === null ? '' : devCellClass(row.desvMesPct, row.isFuture && row.desvMesPct === -100)
                  }`}>
                    {formatPct(row.desvMesPct)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 font-semibold text-gep-dark">
                <td className="py-2 pr-3 whitespace-nowrap">{formatPct(summary.cumplimiento)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(summary.realizadoTotal)}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{formatCurrency(summary.objAnual)}</td>
                <td></td>
                <td className="py-2 px-3 text-right whitespace-nowrap bg-red-50 text-red-800">
                  {formatSigned(summary.gap)}
                </td>
                <td></td>
                <td></td>
                <td className="py-2 px-3 text-right whitespace-nowrap bg-red-50 text-red-800">
                  {formatSigned(desvVsPriorAcum)}
                </td>
                <td></td>
                <td></td>
              </tr>
              <tr className="text-gray-500 text-[11px]">
                <td className="py-2 pr-3 whitespace-nowrap">Promedio ventas/mes</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  {(() => {
                    const filled = rows.filter((r) => !r.isFuture).length;
                    return formatCurrency(filled > 0 ? summary.realizadoTotal / filled : 0);
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
