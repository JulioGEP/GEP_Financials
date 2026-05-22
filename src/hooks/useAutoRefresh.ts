// Auto-refresh hook constrained to Madrid working hours (07:00–22:00).
import { useEffect, useRef } from 'react';
import { config } from '../config';

function getMadridHour(now = new Date()): number {
  // Use Intl to compute the hour in Europe/Madrid regardless of host TZ.
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: config.refreshWindow.timezone,
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.format(now);
  const h = parseInt(parts, 10);
  return Number.isFinite(h) ? h : new Date().getHours();
}

export function isInRefreshWindow(now = new Date()): boolean {
  const h = getMadridHour(now);
  return h >= config.refreshWindow.startHour && h < config.refreshWindow.endHour;
}

export function useAutoRefresh(callback: () => void, enabled: boolean = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      if (isInRefreshWindow()) {
        cbRef.current();
      }
    }, config.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [enabled]);
}
