import { useEffect, useMemo, useState } from 'react';
import { Target, TrendingUp } from 'lucide-react';
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

function parseObjetivosCSV(csv: string): ObjetivoMensual[] {
  const parsed = Papa.parse<string[]>(csv, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .slice(1)
    .filter((row) => row.length >= 8 && MESES.includes((row[1] || '').trim().toLowerCase()))
    .map((row) => ({
      mes: (row[1] || '').trim(),
      formacionAbierta: parseSpanishNumber(row[2]),
      formacionEmpresas: parseSpanishNumber(row[3]),
      material: parseSpanishNumber(row[4]),
      gepServices: parseSpanishNumber(row[5]),
      pci: parseSpanishNumber(row[6]),
      total: parseSpanishNumber(row[7]),
    }));
}

async function fetchObjetivos(): Promise<ObjetivoMensual[]> {
  const res = await fetch(`${config.apiBase}/sheets?sheet=objetivos`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Objetivos fetch failed: ${res.status}`);
  const json = await res.json();
  return parseObjetivosCSV(json.data as string);
}

export function Objetivos({ loading }: ObjetivosProps) {
  const [objetivos, setObjetivos] = useState<ObjetivoMensual[]>([]);
  const [loadingObjetivos, setLoadingObjetivos] = useState(true);

  useEffect(() => {
    let mounted = true;
    void fetchObjetivos()
      .then((rows) => {
        if (mounted) setObjetivos(rows);
      })
      .catch((error) => {
        console.warn('[GEP] No se pudieron cargar objetivos:', error);
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

      <ChartCard title="Detalle por línea" subtitle="Exportado desde hoja Datos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Mes', 'Formación Abierta', 'Formación Empresas', 'Material', 'Gep Services', 'PCI', 'Total'].map((h) => (
                  <th key={h} className="text-left text-[11px] uppercase tracking-wider font-semibold text-gray-400 pb-2 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objetivos.map((row) => (
                <tr key={row.mes} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gep-dark capitalize">{row.mes}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatCurrency(row.formacionAbierta)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatCurrency(row.formacionEmpresas)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatCurrency(row.material)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatCurrency(row.gepServices)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatCurrency(row.pci)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap font-semibold text-gep-dark">{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
