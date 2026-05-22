import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

interface KpiCardComparison {
  prevValue: string;
  delta: string;
  direction: 'up' | 'down' | 'neutral';
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  color?: 'default' | 'red' | 'green' | 'amber' | 'blue';
  emphasis?: boolean;
  comparison?: KpiCardComparison;
  onClick?: () => void;
}

const COLOR_BORDERS: Record<NonNullable<KpiCardProps['color']>, string> = {
  default: 'border-l-gep-dark',
  red: 'border-l-gep-red',
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  blue: 'border-l-blue-500',
};

const ICON_BG: Record<NonNullable<KpiCardProps['color']>, string> = {
  default: 'bg-gray-100 text-gep-dark',
  red: 'bg-red-50 text-gep-red',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendDirection = 'neutral',
  icon,
  color = 'default',
  emphasis = false,
  comparison,
  onClick,
}: KpiCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`card card-hover p-4 border-l-4 ${
        emphasis ? 'border-l-gep-red' : COLOR_BORDERS[color]
      } flex items-start justify-between gap-2 ${
        onClick ? 'cursor-pointer select-none' : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 leading-tight">
          {title}
        </div>
        <div className="mt-1.5 font-bold text-lg text-gep-dark leading-tight break-words">
          {value}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-xs font-light text-gray-500 leading-snug">{subtitle}</div>
        )}
        {trend && (
          <div
            className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
              trendDirection === 'up'
                ? 'text-green-600'
                : trendDirection === 'down'
                ? 'text-gep-red'
                : 'text-gray-500'
            }`}
          >
            {trendDirection === 'up' && <ArrowUp className="w-3 h-3" />}
            {trendDirection === 'down' && <ArrowDown className="w-3 h-3" />}
            {trendDirection === 'neutral' && <ArrowRight className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
        {comparison && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 flex-wrap">
            <span>vs. año ant.:</span>
            <span className="font-medium text-gray-500">{comparison.prevValue}</span>
            <span
              className={`font-semibold ${
                comparison.direction === 'up'
                  ? 'text-green-600'
                  : comparison.direction === 'down'
                  ? 'text-gep-red'
                  : 'text-gray-400'
              }`}
            >
              {comparison.direction === 'up' && '▲'}
              {comparison.direction === 'down' && '▼'}
              {' '}{comparison.delta}
            </span>
          </div>
        )}
      </div>
      {icon && (
        <div className={`shrink-0 rounded-lg p-2 ${ICON_BG[color]}`}>{icon}</div>
      )}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="card p-5 border-l-4 border-l-gray-200">
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-8 w-32 mb-2" />
      <div className="skeleton h-3 w-20" />
    </div>
  );
}
