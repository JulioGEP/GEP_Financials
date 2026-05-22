import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PeriodPreset, DateRange } from '../lib/periodUtils';
import { getPeriodDateRange, getPrevYearDateRange, getPeriodLabel } from '../lib/periodUtils';

interface PeriodState {
  preset: PeriodPreset;
  customStart?: Date;
  customEnd?: Date;
  dateRange: DateRange;
  prevDateRange: DateRange;
  label: string;
  setPreset: (preset: PeriodPreset, customStart?: Date, customEnd?: Date) => void;
}

const PeriodContext = createContext<PeriodState | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<PeriodPreset>('year_current');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const now = new Date();
  const dateRange = getPeriodDateRange(preset, customStart, customEnd, now);
  const prevDateRange = getPrevYearDateRange(dateRange);
  const label = getPeriodLabel(preset, customStart, customEnd, now);

  function setPreset(newPreset: PeriodPreset, newStart?: Date, newEnd?: Date) {
    setPresetState(newPreset);
    setCustomStart(newStart);
    setCustomEnd(newEnd);
  }

  return (
    <PeriodContext.Provider value={{ preset, customStart, customEnd, dateRange, prevDateRange, label, setPreset }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodState {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider');
  return ctx;
}
