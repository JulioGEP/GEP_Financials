import { ShieldAlert, ShieldCheck, ShieldX, Shield } from 'lucide-react';
import type { FinancialData, RiskLevel } from '../../types/financial';
import { AlertCard } from '../ui/AlertCard';
import { ChartCardSkeleton } from '../ui/ChartCard';
import { computeRiskScore, generateAlerts } from '../../lib/alerts';

interface AlertasProps {
  data: FinancialData | null;
  loading: boolean;
}

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; label: string; icon: any }> = {
  Low: { bg: 'bg-green-500', text: 'text-white', label: 'Bajo', icon: ShieldCheck },
  Medium: { bg: 'bg-amber-500', text: 'text-white', label: 'Medio', icon: Shield },
  High: { bg: 'bg-orange-500', text: 'text-white', label: 'Alto', icon: ShieldAlert },
  Critical: { bg: 'bg-gep-red', text: 'text-white', label: 'Crítico', icon: ShieldX },
};

export function Alertas({ data, loading }: AlertasProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    );
  }

  const alerts = generateAlerts(data);
  const risk = computeRiskScore(alerts);
  const riskStyle = RISK_STYLES[risk];
  const RiskIcon = riskStyle.icon;

  const criticals = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');
  const infos = alerts.filter((a) => a.severity === 'info');

  return (
    <div className="space-y-6">
      <div className="card p-6 flex items-center gap-5 border-l-4 border-l-gep-red">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${riskStyle.bg} ${riskStyle.text}`}
        >
          <RiskIcon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500">
            Nivel de riesgo financiero
          </div>
          <div className="mt-1 font-bold text-2xl text-gep-dark">{riskStyle.label}</div>
          <div className="mt-1 text-sm font-light text-gray-500">
            {criticals.length} crítico{criticals.length !== 1 ? 's' : ''} ·{' '}
            {warnings.length} advertencia{warnings.length !== 1 ? 's' : ''} ·{' '}
            {infos.length} informativo{infos.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="hidden md:grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gep-red">{criticals.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Críticos</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-500">{warnings.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Advertencias</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-500">{infos.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Información</div>
          </div>
        </div>
      </div>

      {alerts.length === 0 && (
        <div className="card p-8 text-center">
          <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lg text-gep-dark">No se han detectado riesgos</h3>
          <p className="mt-1 text-sm font-light text-gray-500">
            La situación financiera actual no presenta alertas activas.
          </p>
        </div>
      )}

      {criticals.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-gep-red mb-3">
            Alertas críticas ({criticals.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {criticals.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      )}

      {warnings.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-amber-600 mb-3">
            Advertencias ({warnings.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {warnings.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      )}

      {infos.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider font-semibold text-blue-600 mb-3">
            Información y predicciones ({infos.length})
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {infos.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
