
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { ItemKey } from '../types';

interface UseApiReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useApi = <T,>(itemType: ItemKey): UseApiReturn<T> => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.getItems<T>(itemType);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [itemType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
