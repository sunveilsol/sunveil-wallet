# Security Policy & Threat Model — SUNVEIL

SUNVEIL is a **100% non-custodial, client-side open-source web interface** built independently on Helius Solana Privacy Rings (`@heliuslabs/spr`).

## Security Architecture

1. **Zero Server-Side Custody**
   - SUNVEIL has no backend database and never transmits private keys, seed phrases, or vault passwords over the network.
   - Ed25519 signing keys, nullifier keys, and X25519 viewing keys are derived strictly inside the user's browser via `@heliuslabs/spr`.
2. **Client-Side Vault Encryption (`src/lib/vault.ts`)**
   - Local vault encryption uses native Web Crypto API: **PBKDF2-SHA256** (210,000 iterations, random 128-bit salt per save) deriving a non-extractable **AES-256-GCM** key with a random 96-bit IV.
   - The decrypted vault automatically locks after **15 minutes of inactivity**.
3. **External Wallet Isolation (`src/lib/externalWallet.ts`)**
   - Phantom, Solflare, Backpack, and Brave Wallet connections use standard browser provider / Wallet Standard `connect()` only.
   - SUNVEIL never asks for external wallet seed phrases or private keys.
4. **Transport & Browser Hardening (`vercel.json`)**
   - Enforces **HSTS** (`preload`), **`X-Frame-Options: DENY`** + **`frame-ancestors 'none'`** (anti-clickjacking), **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy: no-referrer`** (prevents `?pay=` URL parameters from leaking), and a strict **Content-Security-Policy (CSP)** restricting network connections to explicit Solana/Helius endpoints.
5. **Untrusted Pay-Link Sanitization (`src/components/MainWalletApp.tsx`)**
   - Incoming `?pay=`, `&amount=`, and `&handle=` URL parameters are strictly validated (Solana Base58 address validation, numeric bounds, character allowlist) and require explicit user confirmation before any transaction is built or signed.

## Known Limitations (Honest Threat Model)

- **Browser Environment Risk:** As with any browser-based hot wallet, a compromised device, malicious browser extension, or XSS vulnerability can compromise keys while unlocked. SUNVEIL is currently designed for **Sandbox & Solana Devnet** testing and small pocket balances — not cold storage of large mainnet funds.
- **No Formal Third-Party Audit Yet:** This project is early-stage open-source software and has not yet undergone a paid third-party cryptographic audit.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** disclose it publicly first. Contact `@SunVeilSol` via X DM or open a private GitHub Security Advisory on `sunveilsol/sunveil-wallet`.
