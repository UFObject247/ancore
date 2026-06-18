# @ancore/wallet-shared

Shared constants and dApp ↔ extension protocol types for Ancore wallets.

Used by:

- `@ancore/wallet-api` (dApp npm SDK)
- `apps/extension-wallet` content script + background
- Future mobile WalletConnect handlers

## Exports

- **protocol** — `ANCOR_WALLET_REQUEST`, `ExternalApiMethod`, envelope validators
- **networks** — passphrases, Horizon/Soroban RPC defaults, allowlist storage keys
- **session** — unlock session TTL constants for MV3 service worker

## Related

- [Wallet extension architecture](../../docs/architecture/WALLET_EXTENSION.md)
- [Freighter comparison](../../docs/wallets/FREIGHTER_COMPARISON.md)
