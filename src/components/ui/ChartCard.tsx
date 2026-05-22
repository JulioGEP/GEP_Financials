import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, action, className = '' }: ChartCardProps) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-base text-gep-dark truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs font-light text-gray-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ChartCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton h-4 w-40 mb-2" />
      <div className="skeleton h-3 w-24 mb-4" />
      <div className="skeleton h-56 w-full" />
    </div>
  );
}
