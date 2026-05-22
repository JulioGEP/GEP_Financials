import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { CreditCard, TrendingDown, Banknote, Scale, Building2, AlertTriangle } from 'lucide-react';
import type { BankAccount, FinancialData } from '../../types/financial';
import { KpiCard, KpiCardSkeleton } from '../ui/KpiCard';
import { ChartCard, ChartCardSkeleton } from '../ui/ChartCard';
import { formatCurrency } from '../../lib/parseData';
import { computeOverviewKpis } from '../../lib/calculations';

interface DeudaProps {
  data: FinancialData | null;
  loading: boolean;
}

// Simple heuristic to classify debt account type
function classifyDebt(name: string): 'prestamo' | 'tarjeta' | 'credito' | 'otro' {
  const n = name.toLowerCase();
  if (n.includes('préstamo') || n.includes('prestamo') || n.includes('micro bank')) return 'prestamo';
  if (n.includes('visa') || n.includes('tarjeta') || n.includes('tj.') || n.includes('tj ') || n.includes('debito') || n.includes('débito')) return 'tarjeta';
  if (n.includes('póliza') || n.includes('poliza') || n.includes('crédito') || n.includes('credito')) return 'credito';
  return 'otro';
}

const DEBT_TYPE_LABELS: Record<string, string> = {
  prestamo: 'Préstamos',
  tarjeta: 'Tarjetas',
  credito: 'Líneas de crédito',
  otro: 'Otros',
};

const DEBT_TYPE_COLORS: Record<string, string> = {
  prestamo: '#e4032d',
  tarjeta: '#f59e0b',
  credito: '#8b5cf6',
  otro: '#6b7280',
};

function DebtRow({ account }: { account: BankAccount }) {
  const type = classifyDebt(account.name);
  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-sm text-gep-dark">{account.name}</div>
        {account.number && (
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{account.number}</div>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ background: DEBT_TYPE_COLORS[type] + '20', color: DEBT_TYPE_COLORS[type] }}
        >
          {DEBT_TYPE_LABELS[type]}
        </span>
      </td>
      <td className="py-3 px-4 text-right font-bold tabular-nums text-gep-red text-sm">
        {formatCurrency(account.balance)}
      </td>
    </tr>
  );
}

export function Deuda({ data, loading }: DeudaProps) {
  if (loading || !data) return <DeudaSkeleton />;

  const kpis = computeOverviewKpis(data);
  const accounts = data.bankAccounts ?? [];
  const debtAccounts = accounts.filter((a) => a.balance < 0).sort((a, b) => a.balance - b.balance);
  const activeAccounts = accounts.filter((a) => a.balance > 0);

  if (!kpis.hasBankData) {
    return (
      <div className="card p-10 text-center space-y-3">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto" />
        <h3 className="font-semibold text-lg text-gep-dark">Sin datos bancarios</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          La conexión con Holded no ha devuelto cuentas bancarias. Verifica que la variable{' '}
          <code className="bg-gray-100 px-1 rounded">API_HOLDED_KEY</code> está configurada en Netlify.
        </p>
      </div>
    );
  }

  // Group debt by type for chart
  const debtByType = Object.entries(
    debtAccounts.reduce<Record<string, number>>((acc, a) => {
      const t = classifyDebt(a.name);
      acc[t] = (acc[t] ?? 0) + Math.abs(a.balance);
      return acc;
    }, {})
  ).map(([type, value]) => ({
    name: DEBT_TYPE_LABELS[type],
    value,
    color: DEBT_TYPE_COLORS[type],
  }));

  // Individual debt bars (sorted descending by absolute value)
  const debtBars = debtAccounts
    .map((a) => ({ name: a.name.length > 28 ? a.name.slice(0, 25) + '…' : a.name, value: Math.abs(a.balance) }))
    .sort((a, b) => b.value - a.value);

  const totalDeuda = kpis.deudaFinanciera ?? 0;
  const saldoDisponible = kpis.saldoDisponible ?? 0;
  const posicionNeta = kpis.posicionNetaBancaria ?? 0;
  const ratioCobertura = totalDeuda !== 0 ? saldoDisponible / Math.abs(totalDeuda) : null;

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Deuda Financiera Total"
          value={formatCurrency(totalDeuda)}
          subtitle="Suma de préstamos, créditos y tarjetas"
          icon={<TrendingDown className="w-5 h-5" />}
          color="red"
          emphasis
        />
        <KpiCard
          title="Saldo Disponible"
          value={formatCurrency(saldoDisponible)}
          subtitle="Suma de cuentas con saldo positivo"
          icon={<Banknote className="w-5 h-5" />}
          color={saldoDisponible >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Posición Neta"
          value={formatCurrency(posicionNeta)}
          subtitle="Saldo disponible + deuda"
          icon={<Scale className="w-5 h-5" />}
          color={posicionNeta >= 0 ? 'blue' : 'red'}
        />
        <KpiCard
          title="Ratio de Cobertura"
          value={ratioCobertura !== null ? `${(ratioCobertura * 100).toFixed(0)}%` : '—'}
          subtitle="Disponible / deuda total"
          icon={<CreditCard className="w-5 h-5" />}
          color={ratioCobertura !== null && ratioCobertura >= 0.3 ? 'green' : 'red'}
        />
      </div>

      {/* Warning if coverage is low */}
      {ratioCobertura !== null && ratioCobertura < 0.2 && (
        <div className="card p-4 border-l-4 border-l-red-500 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-900 text-sm">Ratio de cobertura bajo</div>
            <div className="text-xs text-red-700 mt-1">
              El saldo disponible solo cubre el {(ratioCobertura * 100).toFixed(0)}% de la deuda financiera. Considera renegociar plazos o ampliar líneas de crédito.
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Pie by type */}
        <ChartCard title="Deuda por tipo" subtitle="Distribución de la deuda financiera">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={debtByType}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {debtByType.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bar by account */}
        <ChartCard title="Deuda por cuenta" subtitle="Importe de cada cuenta con saldo negativo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={debtBars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis
                type="number"
                fontSize={11}
                stroke="#777"
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <YAxis type="category" dataKey="name" fontSize={10} stroke="#777" width={160} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="value" name="Deuda" fill="#e4032d" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Debt accounts table */}
      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-4">
          Detalle de cuentas con saldo negativo
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="pb-2 px-4">Cuenta</th>
              <th className="pb-2 px-4">Tipo</th>
              <th className="pb-2 px-4 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {debtAccounts.map((a) => <DebtRow key={a.id} account={a} />)}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="pt-3 px-4 font-semibold text-gray-700" colSpan={2}>Total deuda financiera</td>
              <td className="pt-3 px-4 text-right font-bold text-gep-red tabular-nums text-base">
                {formatCurrency(totalDeuda)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Active accounts summary */}
      {activeAccounts.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gray-500 mb-4">
            Cuentas con saldo positivo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {activeAccounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-green-100 bg-green-50 px-4 py-3">
                <div className="text-sm font-medium text-gep-dark truncate">{a.name}</div>
                {a.number && <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{a.number}</div>}
                <div className="text-base font-bold text-green-800 tabular-nums mt-1">
                  {formatCurrency(a.balance)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-500">{activeAccounts.length} cuenta{activeAccounts.length !== 1 ? 's' : ''}</span>
            <span className="text-base font-bold text-green-800 tabular-nums">
              Total: {formatCurrency(saldoDisponible)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function DeudaSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <KpiCardSkeleton key={i} />)}
      </div>
      <ChartCardSkeleton />
    </div>
  );
}
