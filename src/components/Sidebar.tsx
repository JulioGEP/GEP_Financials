import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import gepGroupLogo from './ui/GEP-Group_Logotipo_horizontal.png';

const NAV_ITEMS = [
  { to: '/', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { to: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { to: '/gastos', label: 'Gastos', icon: TrendingDown },
  { to: '/cashflow', label: 'Flujo de Caja', icon: Wallet },
  { to: '/deuda', label: 'Deuda', icon: CreditCard },
  { to: '/alertas', label: 'Alertas', icon: AlertTriangle },
];

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-gep-dark text-white flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="h-12 flex items-center">
          <img
            src={gepGroupLogo}
            alt="GEP Group"
            className="max-h-10 w-full object-contain object-left"
          />
        </div>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.exact}
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
  );
}
