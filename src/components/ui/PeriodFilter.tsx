import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { usePeriod } from '../../context/PeriodContext';
import type { PeriodPreset } from '../../lib/periodUtils';

interface PresetOption {
  preset: PeriodPreset;
  label: string;
}

export function PeriodFilter() {
  const { preset: active, label, setPreset } = usePeriod();
  const [open, setOpen] = useState(false);
  const [fromStr, setFromStr] = useState('');
  const [toStr, setToStr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const q = Math.floor(month / 3) + 1;
  const prevQ = q === 1 ? 4 : q - 1;
  const prevQYear = q === 1 ? year - 1 : year;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function select(p: PeriodPreset) {
    setPreset(p);
    setOpen(false);
  }

  function applyCustom() {
    if (!fromStr || !toStr) return;
    const start = new Date(fromStr + 'T00:00:00');
    const end = new Date(toStr + 'T23:59:59');
    if (start <= end) {
      setPreset('custom', start, end);
      setOpen(false);
    }
  }

  const yearOptions: PresetOption[] = [
    { preset: 'year_current', label: `Año ${year}` },
    { preset: 'year_prev', label: `Año ${year - 1}` },
  ];

  const quarterOptions: PresetOption[] = [
    { preset: 'q_current', label: `T${q} actual (T${q} ${year})` },
    { preset: 'q_prev', label: `T${prevQ} anterior (T${prevQ} ${prevQYear})` },
    { preset: 'q1', label: `T1 ${year} (Ene–Mar)` },
    { preset: 'q2', label: `T2 ${year} (Abr–Jun)` },
    { preset: 'q3', label: `T3 ${year} (Jul–Sep)` },
    { preset: 'q4', label: `T4 ${year} (Oct–Dic)` },
  ];

  const monthOptions: PresetOption[] = [
    { preset: 'month_current', label: 'Mes actual' },
    { preset: 'month_prev', label: 'Mes anterior' },
  ];

  const weekOptions: PresetOption[] = [
    { preset: 'week_current', label: 'Semana actual' },
    { preset: 'week_prev', label: 'Semana anterior' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gep-dark hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
      >
        <Calendar className="w-3.5 h-3.5 text-gep-red" />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-68 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-3 space-y-3 min-w-[260px]">
          <FilterSection label="Año" options={yearOptions} active={active} onSelect={select} />
          <div className="border-t border-gray-100" />
          <FilterSection label="Trimestre" options={quarterOptions} active={active} onSelect={select} />
          <div className="border-t border-gray-100" />
          <FilterSection label="Mes" options={monthOptions} active={active} onSelect={select} />
          <div className="border-t border-gray-100" />
          <FilterSection label="Semana" options={weekOptions} active={active} onSelect={select} />
          <div className="border-t border-gray-100" />

          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-2">
              Rango personalizado
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Desde</label>
                  <input
                    type="date"
                    value={fromStr}
                    onChange={(e) => setFromStr(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gep-red focus:border-gep-red"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-500 mb-0.5 block">Hasta</label>
                  <input
                    type="date"
                    value={toStr}
                    onChange={(e) => setToStr(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gep-red focus:border-gep-red"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!fromStr || !toStr}
                className="w-full text-xs bg-gep-red text-white rounded-md py-1.5 font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aplicar rango personalizado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  label: string;
  options: PresetOption[];
  active: PeriodPreset;
  onSelect: (p: PeriodPreset) => void;
}

function FilterSection({ label, options, active, onSelect }: FilterSectionProps) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-1.5">
        {label}
      </div>
      <div className="space-y-0.5">
        {options.map(({ preset, label: optLabel }) => (
          <button
            key={preset}
            type="button"
            onClick={() => onSelect(preset)}
            className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between gap-2 ${
              active === preset
                ? 'bg-gep-red text-white font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="truncate">{optLabel}</span>
            {active === preset && <Check className="w-3 h-3 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}
