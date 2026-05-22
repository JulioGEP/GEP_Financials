import type { Alert } from '../../types/financial';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface AlertCardProps {
  alert: Alert;
  compact?: boolean;
}

const SEVERITY_STYLES = {
  critical: {
    border: 'border-l-gep-red',
    bg: 'bg-red-50/40',
    badge: 'bg-gep-red text-white',
    iconColor: 'text-gep-red',
    label: 'Crítico',
  },
  warning: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-50/40',
    badge: 'bg-amber-500 text-white',
    iconColor: 'text-amber-500',
    label: 'Advertencia',
  },
  info: {
    border: 'border-l-blue-500',
    bg: 'bg-blue-50/40',
    badge: 'bg-blue-500 text-white',
    iconColor: 'text-blue-500',
    label: 'Información',
  },
};

export function AlertCard({ alert, compact = false }: AlertCardProps) {
  const styles = SEVERITY_STYLES[alert.severity];
  const Icon =
    alert.severity === 'critical' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info;

  return (
    <div
      className={`card border-l-4 ${styles.border} ${styles.bg} ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`shrink-0 ${styles.iconColor} mt-0.5`}>
          <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`badge ${styles.badge} uppercase text-[10px] tracking-wider`}
            >
              {styles.label}
            </span>
            {alert.metric && (
              <span className="text-sm font-bold text-gep-dark">{alert.metric}</span>
            )}
          </div>
          <h3
            className={`mt-2 font-semibold text-gep-dark ${
              compact ? 'text-sm' : 'text-base'
            }`}
          >
            {alert.title}
          </h3>
          {!compact && (
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              {alert.description}
            </p>
          )}
          {!compact && alert.action && (
            <div className="mt-3 p-2.5 bg-white/70 rounded-md border border-gray-100 text-xs text-gray-700">
              <span className="font-semibold text-gep-dark">Acción recomendada: </span>
              {alert.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
