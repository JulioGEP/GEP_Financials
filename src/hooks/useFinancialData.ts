// React hook providing financial data with loading/error states and refresh.
import { useCallback, useEffect, useState } from 'react';
import type { FinancialData } from '../types/financial';
import { fetchFinancialData } from '../lib/api';
import { useAutoRefresh } from './useAutoRefresh';

interface UseFinancialData {
  data: FinancialData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function useFinancialData(): UseFinancialData {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setIsRefreshing(true);
      const fresh = await fetchFinancialData();
      setData(fresh);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useAutoRefresh(() => {
    void load(false);
  }, !loading);

  return {
    data,
    loading,
    error,
    refresh: () => load(false),
    isRefreshing,
  };
}
