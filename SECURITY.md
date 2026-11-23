# Security Policy & Threat Model — SUNVEIL

SUNVEIL is a **100% non-custodial, client-side open-source web interface** built independently on Helius Solana Privacy Rings (`@heliuslabs/spr`).

## Security Architecture

1. **Zero Server-Side Custody**
   - SUNVEIL has no backend database and never transmits private keys, seed phrases, or vault passwords over the network.
   - Ed25519 signing keys, nullifier keys, and X25519 viewing keys are derived strictly inside the user's browser via `@heliuslabs/spr`.
2. **Hardened Client-Side Vault Encryption (`src/lib/vault.ts`)**
   - Local vault encryption uses the native Web Crypto API: **PBKDF2-SHA256** (**600,000 iterations** per OWASP 2023+ guidance, random 128-bit salt per save) deriving a non-extractable **AES-256-GCM** key with a random 96-bit IV and authenticated metadata binding (**AAD** covering version & Solana address).
   - **No plaintext secret key in React state:** The raw Ed25519 seed is never stored in component state. Exporting/viewing the secret seed requires explicit password re-authentication, auto-hides after **30 seconds** (or on tab change), and auto-clears the clipboard after 30 seconds.
   - **Ephemeral 1-Click Sandbox:** Sandbox mode runs strictly in memory with zero hardcoded-password vaults written to `localStorage`.
   - **Sleep-Safe Auto-Lock:** Tracks real wall-clock activity timestamps and immediately locks after **15 minutes** of inactivity (including after device sleep or iOS PWA backgrounding).
   - **Two-Step Wipe Protection:** Deleting or resetting the local vault requires explicit confirmation to prevent accidental key loss.
3. **Exact BigInt Lamport Arithmetic & Error Redaction (`src/lib/sprService.ts`)**
   - All SOL amounts are parsed strictly via string-to-`BigInt` lamport conversion (up to 9 decimal places, zero IEEE-754 floating-point drift).
   - RPC error messages automatically redact any `api-key=` query parameters before rendering in UI toasts or status banners.
4. **External Wallet Isolation (`src/lib/externalWallet.ts`)**
   - Phantom, Solflare, Backpack, and Brave Wallet connections use standard browser provider / Wallet Standard `connect()` only and validate every returned address against Solana Base58 rules.
   - SUNVEIL never asks for external wallet seed phrases or private keys.
5. **Transport, PWA & Browser Hardening (`vercel.json`, `public/sw.js`)**
   - Enforces **HSTS** (`preload`), **`X-Frame-Options: DENY`** + **`frame-ancestors 'none'`** (anti-clickjacking), **`Cross-Origin-Opener-Policy: same-origin-allow-popups`**, **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy: no-referrer`**, and a strict **Content-Security-Policy (CSP)** restricting connections to explicit Solana/Helius endpoints.
   - The PWA Service Worker (`public/sw.js`) never caches cross-origin RPC responses or URLs containing query parameters (`?pay=...`).
6. **Untrusted Pay-Link Sanitization (`src/components/MainWalletApp.tsx`)**
   - Incoming `?pay=`, `&amount=`, and `&handle=` URL parameters are strictly validated, stripped from the address bar once loaded, and displayed with an explicit external Pay-Link warning banner requiring manual user review before signing.

## Known Limitations (Honest Threat Model)

- **Browser Environment Risk:** As with any browser-based hot wallet, a compromised device, malicious browser extension, or XSS vulnerability can compromise keys while unlocked. SUNVEIL is currently designed for **Sandbox & Solana Devnet** testing and small pocket balances — not cold storage of large mainnet funds.
- **Transitive Dependency Note:** `@heliuslabs/spr` transitively depends on `@phala/dcap-qvl` → `elliptic` (low-severity npm advisory GHSA-848j-6mx2-7j84). SUNVEIL does not use `elliptic` ECDSA for key custody or transaction signing.
- **No Formal Third-Party Audit Yet:** This project is early-stage open-source software and has not yet undergone a paid third-party cryptographic audit.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** disclose it publicly first. Contact `@SunVeilSol` via X DM or open a private GitHub Security Advisory on `sunveilsol/sunveil-wallet`.
