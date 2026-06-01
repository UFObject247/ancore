import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAccountOverview } from '../useAccountOverview';

describe('useAccountOverview', () => {
  const mockPublicKey = 'GBVFLP5J7XLTQBJX5QZW6LNRUZPGZRG7GMKQMVYOMKCFQG4N7VJ7RCV';

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches account data successfully', async () => {
    const mockAccountData = {
      id: 'GBVFLP5J7XLTQBJX5QZW6LNRUZPGZRG7GMKQMVYOMKCFQG4N7VJ7RCV',
      account_id: 'GBVFLP5J7XLTQBJX5QZW6LNRUZPGZRG7GMKQMVYOMKCFQG4N7VJ7RCV',
      sequence: '123456789',
      subentry_count: 0,
      last_modified_ledger: 50000,
      last_modified_time: '2024-01-01T00:00:00Z',
      balances: [
        {
          balance: '100.0000000',
          asset_type: 'native',
        },
      ],
    };

    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(mockAccountData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toEqual({
      balance: 100,
      nonce: 123456789,
      status: 'active',
    });
    expect(result.current.error).toBeNull();
  });

  it('handles empty public key', async () => {
    const { result } = renderHook(() => useAccountOverview(''));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles Horizon API error', async () => {
    (global.fetch as any).mockResolvedValue(
      new Response('Account not found', {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Account not found');
  });

  it('allows refetch', async () => {
    const mockAccountData = {
      id: mockPublicKey,
      account_id: mockPublicKey,
      sequence: '100',
      subentry_count: 0,
      last_modified_ledger: 50000,
      last_modified_time: '2024-01-01T00:00:00Z',
      balances: [
        {
          balance: '50.0000000',
          asset_type: 'native',
        },
      ],
    };

    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify(mockAccountData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAccountOverview(mockPublicKey));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.balance).toBe(50);

    await result.current.refetch();

    expect(result.current.data?.balance).toBe(50);
  });
});
