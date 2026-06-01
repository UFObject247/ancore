import { useState, useEffect, useCallback } from 'react';
import { fetchAccountBalance, fetchAccountData } from '../lib/horizon';

export type AccountStatus = 'active' | 'inactive' | 'locked';

export interface AccountOverview {
  balance: number;
  nonce: number;
  status: AccountStatus;
}

export interface UseAccountOverviewReturn {
  data: AccountOverview | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch account overview metrics (balance, nonce, status).
 * Uses Horizon API to fetch real Stellar account data.
 */
export function useAccountOverview(publicKey: string): UseAccountOverviewReturn {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!publicKey) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accountData = await fetchAccountData(publicKey);
      const balance = await fetchAccountBalance(publicKey);

      setData({
        balance,
        nonce: Number(accountData.sequence),
        status: 'active',
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch account data'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
