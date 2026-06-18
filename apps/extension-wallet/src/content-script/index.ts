/**
 * Content script — dApp ↔ extension bridge (stub).
 *
 * Freighter reference:
 *   extension/src/contentScript/redirectMessagesToBackground.ts
 *
 * Forwards validated ANCORE_WALLET_REQUEST messages to the background worker.
 * Full approval flow + allowlist: docs/wallets/FREIGHTER_COMPARISON.md
 */

import {
  ANCORE_WALLET_RESPONSE,
  CONTENT_SCRIPT_SOURCE,
  isExternalRequest,
} from '@ancore/wallet-shared';

const logPrefix = '[ancore/content-script]';

type ChromeRuntime = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
  };
};

declare const chrome: ChromeRuntime;

function respond(requestId: string, ok: boolean, result?: unknown, error?: string): void {
  window.postMessage(
    {
      type: ANCORE_WALLET_RESPONSE,
      source: CONTENT_SCRIPT_SOURCE,
      requestId,
      ok,
      result,
      error,
    },
    window.location.origin
  );
}

window.addEventListener('message', (event) => {
  // Only accept messages from the same page (not iframes / other origins).
  if (event.source !== window) return;
  if (!isExternalRequest(event.data)) return;

  const { requestId, method, params } = event.data;

  if (import.meta.env.DEV) {
    console.debug(`${logPrefix} ← ${method}`, { requestId, params });
  }

  // Forward to background — external handler registry not wired yet.
  chrome.runtime
    .sendMessage({
      type: 'EXTERNAL_API_REQUEST',
      requestId,
      method,
      params: params ?? {},
      origin: window.location.origin,
    })
    .then((backgroundResult: unknown) => {
      const payload = backgroundResult as { ok?: boolean; result?: unknown; error?: string };
      if (payload && typeof payload.ok === 'boolean') {
        respond(requestId, payload.ok, payload.result, payload.error);
        return;
      }
      respond(
        requestId,
        false,
        undefined,
        'External API not implemented. Track progress: github.com/ancore-org/ancore/issues'
      );
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      respond(requestId, false, undefined, message);
    });
});

if (import.meta.env.DEV) {
  console.info(`${logPrefix} loaded on`, window.location.origin);
}
