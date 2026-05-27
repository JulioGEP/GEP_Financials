import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  CreditCard,
  Target,
  GitCompareArrows,
  Filter,
} from 'lucide-react';
import gepGroupLogo from './ui/GEP_Logo_Icono_BLANCO.png';

const NAV_ITEMS = [
  { to: '/', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { to: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { to: '/gastos', label: 'Gastos', icon: TrendingDown },
  { to: '/cashflow', label: 'Flujo de Caja', icon: Wallet },
  { to: '/deuda', label: 'Deuda', icon: CreditCard },
  { to: '/objetivos', label: 'Objetivos', icon: Target },
  { to: '/pipedrive', label: 'Pipedrive', icon: Filter },
  { to: '/comparativas', label: 'Comparativas', icon: GitCompareArrows },
  { to: '/alertas', label: 'Alertas', icon: AlertTriangle },
];

interface SidebarProps {
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export function Sidebar({ isMobileMenuOpen, onCloseMobileMenu }: SidebarProps) {
  return (
    <>
      {isMobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onCloseMobileMenu}
          aria-label="Cerrar menú"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-gep-dark text-white flex flex-col min-h-screen transform transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:min-h-screen lg:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <div className="h-12 flex items-center gap-3">
            <img
              src={gepGroupLogo}
              alt="GEP Group"
              className="h-11 w-auto object-contain object-left"
            />
            <span className="text-xl font-semibold tracking-wide text-white">Financials</span>
          </div>
        </div>
        <nav className="flex-1 py-4">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  onClick={onCloseMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors border-l-4 ${
                      isActive
                        ? 'border-l-gep-red text-white bg-white/5 font-semibold'
                        : 'border-l-transparent text-white/70 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <item.icon
                    className={`w-4 h-4 shrink-0 ${
                      item.label === 'Alertas' ? 'group-[.active]:text-gep-red' : ''
                    }`}
                  />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-[11px] text-white/50 font-light">
          <div>© {new Date().getFullYear()} GEP Group</div>
          <div className="mt-0.5">v1.0.0</div>
        </div>
      </aside>
    </>
  );
}
