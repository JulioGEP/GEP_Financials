import type { Gasto, Venta } from '../../types/financial';

interface FilterState {
  proveedor: string;
  cliente: string;
  tags: string;
  cuenta: string;
  proyecto: string;
  estadoIngreso: string;
  estadoGasto: string;
}

interface EntityFiltersProps {
  filters: FilterState;
  options: {
    proveedores: string[];
    clientes: string[];
    tags: string[];
    cuentas: string[];
    proyectos: string[];
    estadosIngreso: string[];
    estadosGasto: string[];
  };
  onChange: (next: FilterState) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-gep-red/40 focus:ring-2 focus:ring-gep-red/15"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EntityFilters({ filters, options, onChange }: EntityFiltersProps) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  const setField = (key: keyof FilterState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onChange({
      proveedor: '',
      cliente: '',
      tags: '',
      cuenta: '',
      proyecto: '',
      estadoIngreso: '',
      estadoGasto: '',
    });
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gep-dark">Filtros avanzados</h2>
          <p className="text-xs text-gray-500">Afectan métricas, gráficos y tablas de esta página.</p>
        </div>
        <button
          type="button"
          onClick={clearAll}
          disabled={activeCount === 0}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpiar filtros {activeCount > 0 ? `(${activeCount})` : ''}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SelectField label="Proveedor" value={filters.proveedor} options={options.proveedores} onChange={(v) => setField('proveedor', v)} />
        <SelectField label="Cliente" value={filters.cliente} options={options.clientes} onChange={(v) => setField('cliente', v)} />
        <SelectField label="Tags" value={filters.tags} options={options.tags} onChange={(v) => setField('tags', v)} />
        <SelectField label="Cuenta" value={filters.cuenta} options={options.cuentas} onChange={(v) => setField('cuenta', v)} />
        <SelectField label="Proyecto" value={filters.proyecto} options={options.proyectos} onChange={(v) => setField('proyecto', v)} />
        <SelectField label="Estado ingreso" value={filters.estadoIngreso} options={options.estadosIngreso} onChange={(v) => setField('estadoIngreso', v)} />
        <SelectField label="Estado gasto" value={filters.estadoGasto} options={options.estadosGasto} onChange={(v) => setField('estadoGasto', v)} />
      </div>
    </section>
  );
}

export type { FilterState };

export function getFilterOptions(ventas: Venta[], gastos: Gasto[]) {
  const uniq = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));

  return {
    proveedores: uniq(gastos.map((g) => g.proveedor)),
    clientes: uniq(ventas.map((v) => v.cliente)),
    tags: uniq([...ventas.flatMap((v) => v.tags || []), ...gastos.flatMap((g) => g.tags || [])]),
    cuentas: uniq([...ventas.map((v) => v.cuenta), ...gastos.map((g) => g.cuenta)]),
    proyectos: uniq([...ventas.map((v) => v.proyecto), ...gastos.map((g) => g.proyecto)]),
    estadosIngreso: uniq(ventas.map((v) => v.estado)),
    estadosGasto: uniq(gastos.map((g) => g.estado)),
  };
}

export function applyVentaFilters(rows: Venta[], filters: FilterState) {
  return rows.filter((v) => {
    if (filters.cliente && v.cliente !== filters.cliente) return false;
    if (filters.tags && !(v.tags || []).includes(filters.tags)) return false;
    if (filters.cuenta && v.cuenta !== filters.cuenta) return false;
    if (filters.proyecto && v.proyecto !== filters.proyecto) return false;
    if (filters.estadoIngreso && v.estado !== filters.estadoIngreso) return false;
    return true;
  });
}

export function applyGastoFilters(rows: Gasto[], filters: FilterState) {
  return rows.filter((g) => {
    if (filters.proveedor && g.proveedor !== filters.proveedor) return false;
    if (filters.tags && !(g.tags || []).includes(filters.tags)) return false;
    if (filters.cuenta && g.cuenta !== filters.cuenta) return false;
    if (filters.proyecto && g.proyecto !== filters.proyecto) return false;
    if (filters.estadoGasto && g.estado !== filters.estadoGasto) return false;
    return true;
  });
}
