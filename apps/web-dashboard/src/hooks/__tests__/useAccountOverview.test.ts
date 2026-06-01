import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  AccountNotFoundError,
  HorizonUnavailableError,
  useAccountOverview,
} from '../useAccountOverview';

describe('useAccountOverview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches account data successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        balance: 1250.75,
        nonce: 42,
        status: 'active',
      }),
    } as Response);

    const { result } = renderHook(() => useAccountOverview('GB...'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    expect(result.current.data).toEqual({
      balance: 1250.75,
      nonce: 42,
      status: 'active',
    });
    expect(result.current.error).toBeNull();
  });

  it('handles empty public key', () => {
    const { result } = renderHook(() => useAccountOverview(''));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('maps 404 responses to account-not-found errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(AccountNotFoundError));
  });

  it('maps 500 responses to horizon-unavailable errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(HorizonUnavailableError));
  });

  it('recovers successfully after retry', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance: 9,
          nonce: 7,
          status: 'inactive',
        }),
      } as Response);

    const { result } = renderHook(() => useAccountOverview('GB...'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(HorizonUnavailableError));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data).toEqual({
      balance: 9,
      nonce: 7,
      status: 'inactive',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
