import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Target, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '../ui/ChartCard';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { config } from '../../config';
import Papa from 'papaparse';
import { formatCurrency, parseSpanishNumber } from '../../lib/parseData';

interface ObjetivoMensual {
  mes: string;
  formacionAbierta: number;
  formacionEmpresas: number;
  material: number;
  gepServices: number;
  pci: number;
  total: number;
}

interface ObjetivosProps {
  loading: boolean;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function getField(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find((k) => k.toLowerCase().trim() === key.toLowerCase().trim());
    if (found) return (row[found] || '').trim();
  }
  return '';
}

function parseObjetivosCSV(csv: string): ObjetivoMensual[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  // Detect which column holds month names: header may be "Mes", a year like "2026", etc.
  const mesKey = (() => {
    if (parsed.data.length === 0) return 'Mes';
    const firstRow = parsed.data[0];
    return (
      Object.keys(firstRow).find((k) =>
        MESES.includes((firstRow[k] || '').toLowerCase().trim())
      ) ?? 'Mes'
    );
  })();

  return parsed.data
    .map((row) => ({
      mes: (row[mesKey] || '').trim(),
      formacionAbierta: parseSpanishNumber(getField(row, ['Formación abierta', 'Formacion abierta', 'Formación Abierta', 'Formacion Abierta'])),
      formacionEmpresas: parseSpanishNumber(getField(row, ['Formación empresas', 'Formacion empresas', 'Formación Empresas', 'Formacion Empresas'])),
      material: parseSpanishNumber(getField(row, ['Material'])),
      gepServices: parseSpanishNumber(getField(row, ['Gep services', 'GEP services', 'Gep Services', 'GEP Services'])),
      pci: parseSpanishNumber(getField(row, ['PCI', 'Pci'])),
      total: parseSpanishNumber(getField(row, ['Total', 'TOTAL'])),
    }))
    .filter((row) => MESES.includes(row.mes.toLowerCase()));
}

async function fetchObjetivos(): Promise<{ rows: ObjetivoMensual[]; rawPreview: string }> {
  const res = await fetch(`${config.apiBase}/sheets?sheet=objetivos`, {
    headers: { Accept: 'application/json' },
  });

  const json = await res.json() as { data?: string; error?: string };

  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Error del servidor: ${res.status}`);
  }

  const csv = json.data ?? '';
  const rawPreview = csv.slice(0, 300);
  const rows = parseObjetivosCSV(csv);
  return { rows, rawPreview };
}

export function Objetivos({ loading }: ObjetivosProps) {
  const [objetivos, setObjetivos] = useState<ObjetivoMensual[]>([]);
  const [loadingObjetivos, setLoadingObjetivos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawPreview, setRawPreview] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    setError(null);
    void fetchObjetivos()
      .then(({ rows, rawPreview: preview }) => {
        if (!mounted) return;
        setObjetivos(rows);
        if (rows.length === 0) {
          setRawPreview(preview);
          setError('No se encontraron filas de objetivos. La hoja puede no ser pública, el GID puede ser incorrecto, o las columnas no coinciden.');
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        console.warn('[GEP] No se pudieron cargar objetivos:', msg);
        setError(msg);
      })
      .finally(() => {
        if (mounted) setLoadingObjetivos(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return objetivos.reduce(
      (acc, row) => ({
        formacionAbierta: acc.formacionAbierta + row.formacionAbierta,
        formacionEmpresas: acc.formacionEmpresas + row.formacionEmpresas,
        material: acc.material + row.material,
        gepServices: acc.gepServices + row.gepServices,
        pci: acc.pci + row.pci,
        total: acc.total + row.total,
      }),
      { formacionAbierta: 0, formacionEmpresas: 0, material: 0, gepServices: 0, pci: 0, total: 0 },
    );
  }, [objetivos]);

  if (loading || loadingObjetivos) {
    return <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><KpiCardSkeleton /><KpiCardSkeleton /><KpiCardSkeleton /></div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 mb-1">No se pudieron cargar los datos de objetivos</p>
            <p className="text-amber-700">{error}</p>
            {rawPreview && (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-600 text-xs font-medium">Ver datos recibidos</summary>
                <pre className="mt-1 text-xs bg-amber-100 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{rawPreview}</pre>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Objetivo anual total" value={formatCurrency(totals.total)} icon={<Target className="w-4 h-4" />} color="blue" />
        <KpiCard title="Media mensual" value={formatCurrency(objetivos.length ? totals.total / objetivos.length : 0)} icon={<TrendingUp className="w-4 h-4" />} color="green" />
        <KpiCard title="Línea líder" value="Gep Services" subtitle={formatCurrency(totals.gepServices)} color="default" />
      </div>

      <ChartCard title="Objetivos mensuales" subtitle="Totales por mes y línea de negocio">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={objetivos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="mes" stroke="#6b7280" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k€`} stroke="#6b7280" />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="total" fill="#BE1522" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Objetivos 2026" subtitle="Totales mensuales y por línea de negocio">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-[11px] uppercase tracking-wider font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">Mes</th>
                <th className="text-right text-[11px] uppercase tracking-wider font-semibold text-gray-400 pb-2 pl-4 whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              {objetivos.map((row) => (
                <tr key={row.mes} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gep-dark capitalize">{row.mes}</td>
                  <td className="py-2 pl-4 text-right whitespace-nowrap font-semibold text-gep-dark">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-3">Totales anuales por línea de negocio</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Formación Abierta', value: totals.formacionAbierta },
              { label: 'Formación Empresas', value: totals.formacionEmpresas },
              { label: 'Material', value: totals.material },
              { label: 'Gep Services', value: totals.gepServices },
              { label: 'PCI', value: totals.pci },
              { label: 'Total', value: totals.total },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500 truncate">{item.label}</p>
                <p className="text-sm font-semibold text-gep-dark whitespace-nowrap">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
