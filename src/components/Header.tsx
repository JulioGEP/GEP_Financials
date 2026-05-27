import { RefreshCw, Database, CloudOff, Menu } from 'lucide-react';
import { formatDateTime } from '../lib/parseData';
import { PeriodFilter, PeriodInfo } from './ui/PeriodFilter';

interface HeaderProps {
  title: string;
  subtitle?: string;
  lastUpdated?: Date | null;
  source?: 'api' | 'mock';
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu: () => void;
}

export function Header({
  title,
  subtitle,
  lastUpdated,
  source,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 md:px-8 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="btn-secondary lg:hidden mb-2"
        >
          <Menu className="w-4 h-4" /> Menú
        </button>
        <h1 className="font-bold text-xl text-gep-dark truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm font-light text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <PeriodInfo />
        <PeriodFilter />
        {source && (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              source === 'api' ? 'text-green-600' : 'text-amber-600'
            }`}
            title={source === 'api' ? 'Datos en directo desde Google Sheets' : 'Datos de demostración'}
          >
            {source === 'api' ? (
              <Database className="w-3.5 h-3.5" />
            ) : (
              <CloudOff className="w-3.5 h-3.5" />
            )}
            {source === 'api' ? 'En vivo' : 'Demo'}
          </span>
        )}
        {lastUpdated && (
          <span className="text-xs font-light text-gray-500 hidden md:inline">
            Última actualización: {formatDateTime(lastUpdated)}
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="btn-primary text-xs"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </header>
  );
}
