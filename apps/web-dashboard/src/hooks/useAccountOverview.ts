import { useState, useEffect, useCallback } from 'react';

export type AccountStatus = 'active' | 'inactive' | 'locked';

export interface AccountOverview {
  balance: number;
  nonce: number;
  status: AccountStatus;
}

export class AccountOverviewError extends Error {
  code: 'ACCOUNT_NOT_FOUND' | 'HORIZON_UNAVAILABLE' | 'FETCH_FAILED';

  constructor(
    message: string,
    code: 'ACCOUNT_NOT_FOUND' | 'HORIZON_UNAVAILABLE' | 'FETCH_FAILED',
  ) {
    super(message);
    this.name = 'AccountOverviewError';
    this.code = code;
  }
}

export class AccountNotFoundError extends AccountOverviewError {
  constructor() {
    super('Account not found on network', 'ACCOUNT_NOT_FOUND');
    this.name = 'AccountNotFoundError';
  }
}

export class HorizonUnavailableError extends AccountOverviewError {
  constructor() {
    super('Horizon is temporarily unavailable', 'HORIZON_UNAVAILABLE');
    this.name = 'HorizonUnavailableError';
  }
}

export interface UseAccountOverviewReturn {
  data: AccountOverview | null;
  isLoading: boolean;
  error: AccountOverviewError | null;
  refetch: () => Promise<void>;
}

const MOCK_ACCOUNT_OVERVIEW: AccountOverview = {
  balance: 1250.75,
  nonce: 42,
  status: 'active',
};

function classifyAccountOverviewError(status?: number): AccountOverviewError {
  if (status === 404) {
    return new AccountNotFoundError();
  }

  if (status && status >= 500) {
    return new HorizonUnavailableError();
  }

  return new AccountOverviewError('Failed to fetch account data', 'FETCH_FAILED');
}

/**
 * Hook to fetch account overview metrics (balance, nonce, status).
 * In production, this would use @ancore/core-sdk to query the Stellar network.
 */
export function useAccountOverview(publicKey: string): UseAccountOverviewReturn {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AccountOverviewError | null>(null);

  const fetchData = useCallback(async () => {
    if (!publicKey) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/account-overview?publicKey=${encodeURIComponent(publicKey)}`);

      if (!response.ok) {
        throw classifyAccountOverviewError(response.status);
      }

      const payload = (await response.json()) as Partial<AccountOverview>;

      setData({
        balance: payload.balance ?? MOCK_ACCOUNT_OVERVIEW.balance,
        nonce: payload.nonce ?? MOCK_ACCOUNT_OVERVIEW.nonce,
        status: payload.status ?? MOCK_ACCOUNT_OVERVIEW.status,
      });
    } catch (err) {
      setData(null);
      if (err instanceof AccountOverviewError) {
        setError(err);
      } else {
        setError(new AccountOverviewError('Failed to fetch account data', 'FETCH_FAILED'));
      }
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
