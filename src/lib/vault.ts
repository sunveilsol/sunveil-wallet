import {
  ShieldedKeypair,
  SigningKey,
  initializePoseidon,
} from "@heliuslabs/spr";
import { bytes32 } from "@heliuslabs/spr/keypair";
import type { EncryptedVaultRecord, WalletProfile } from "../types";

const STORAGE_VAULT_KEY = "sunveil.vault.v1";
const STORAGE_API_KEY = "sunveil.helius.devnet.apikey";
const STORAGE_HANDLE_KEY = "sunveil.x.handle";

const LEGACY_PBKDF2_ITERATIONS = 210_000;
const CURRENT_PBKDF2_ITERATIONS = 600_000;

export const MIN_VAULT_PASSWORD_LENGTH = 8;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (clean.length === 0 || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
    throw new Error("Ungültiger Hex-Schlüssel.");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function shortAddr(addr: string, start = 5, end = 4): string {
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

export function formatSol(sol: number): string {
  return sol.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function sanitizeHandle(handle: string): string {
  return handle.replace(/^@+/, "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 32);
}

/**
 * Redacts Helius / RPC api-key query parameters from error messages so secrets
 * can never leak into toasts, status banners, or user screenshots.
 */
export function sanitizeErrorMessage(err: unknown, fallback = "Unbekannter Fehler."): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : fallback;
  return raw
    .replace(/([?&]api-key=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key["'\s:=]+)[a-zA-Z0-9-]{8,}/gi, "$1[REDACTED]");
}

let poseidonReady: Promise<void> | null = null;
export function ensurePoseidon(): Promise<void> {
  if (!poseidonReady) {
    poseidonReady = initializePoseidon();
  }
  return poseidonReady;
}

export interface UnlockedWallet {
  keypair: ShieldedKeypair;
  profile: WalletProfile;
  isEphemeral: boolean;
}

export interface CreatedWalletWithSecret {
  unlocked: UnlockedWallet;
  secretKeyHex: string;
}

export async function createKeypairFromSecretHex(
  secretHex?: string,
  options?: { isEphemeral?: boolean },
): Promise<CreatedWalletWithSecret> {
  await ensurePoseidon();
  let signing: SigningKey;
  if (secretHex !== undefined) {
    const raw = hexToBytes(secretHex);
    try {
      if (raw.length !== 32) {
        throw new Error("Ein Ed25519-Seed muss exakt 32 Bytes (64 Hex-Zeichen) lang sein.");
      }
      signing = SigningKey.fromEd25519Bytes(bytes32(raw));
    } finally {
      raw.fill(0);
    }
  } else {
    signing = SigningKey.generate();
  }

  const secretBytes = signing.secretBytes();
  const secretKeyHex = bytesToHex(secretBytes);
  const keypair = ShieldedKeypair.fromKeypair(signing);
  const shieldedAddr = keypair.shieldedAddress();

  const profile: WalletProfile = {
    solanaAddress: shieldedAddr.solanaAddress(),
    shieldedAddressHex: bytesToHex(shieldedAddr.toBytes()),
    viewingPublicKeyHex: bytesToHex(keypair.viewingPublicKey().toBytes()),
    ownerHashHex: bytesToHex(keypair.ownerHash()),
  };

  return {
    unlocked: {
      keypair,
      profile,
      isEphemeral: Boolean(options?.isEphemeral),
    },
    secretKeyHex,
  };
}

function buildVaultAad(version: number, solanaAddress: string): Uint8Array {
  return new TextEncoder().encode(`sunveil:vault:v${version}:${solanaAddress}`);
}

async function deriveAesKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  try {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBytes,
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    passwordBytes.fill(0);
  }
}

export async function encryptAndSaveVault(
  secretKeyHex: string,
  solanaAddress: string,
  password: string,
): Promise<EncryptedVaultRecord> {
  if (password.length < MIN_VAULT_PASSWORD_LENGTH) {
    throw new Error(
      `Das Tresor-Passwort muss mindestens ${MIN_VAULT_PASSWORD_LENGTH} Zeichen lang sein.`,
    );
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = CURRENT_PBKDF2_ITERATIONS;
  const aesKey = await deriveAesKey(password, salt, iterations);
  const plain = new TextEncoder().encode(secretKeyHex);
  const aad = buildVaultAad(2, solanaAddress);
  try {
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
      aesKey,
      plain,
    );
    const record: EncryptedVaultRecord = {
      version: 2,
      iterations,
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(new Uint8Array(cipherBuf)),
      solanaAddress,
      createdAt: Date.now(),
    };
    localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(record));
    return record;
  } finally {
    plain.fill(0);
  }
}

export function loadEncryptedVault(): EncryptedVaultRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EncryptedVaultRecord>;
    if (
      (parsed?.version === 1 || parsed?.version === 2) &&
      typeof parsed.ciphertext === "string" &&
      typeof parsed.salt === "string" &&
      typeof parsed.iv === "string" &&
      typeof parsed.solanaAddress === "string"
    ) {
      return parsed as EncryptedVaultRecord;
    }
    return null;
  } catch {
    return null;
  }
}

export async function decryptVault(
  record: EncryptedVaultRecord,
  password: string,
): Promise<string> {
  const salt = hexToBytes(record.salt);
  const iv = hexToBytes(record.iv);
  const ciphertext = hexToBytes(record.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
    throw new Error("Beschädigter lokaler Tresor-Datensatz.");
  }

  const iterations =
    record.version === 2
      ? Math.max(LEGACY_PBKDF2_ITERATIONS, record.iterations ?? CURRENT_PBKDF2_ITERATIONS)
      : LEGACY_PBKDF2_ITERATIONS;

  const aesKey = await deriveAesKey(password, salt, iterations);
  const algorithm: AesGcmParams =
    record.version === 2
      ? {
          name: "AES-GCM",
          iv: iv as BufferSource,
          additionalData: buildVaultAad(2, record.solanaAddress) as BufferSource,
        }
      : { name: "AES-GCM", iv: iv as BufferSource };

  try {
    const plainBuf = await crypto.subtle.decrypt(
      algorithm,
      aesKey,
      ciphertext as BufferSource,
    );
    const plainBytes = new Uint8Array(plainBuf);
    try {
      return new TextDecoder().decode(plainBytes);
    } finally {
      plainBytes.fill(0);
    }
  } catch {
    throw new Error("Falsches Tresor-Passwort. Entschlüsselung fehlgeschlagen.");
  }
}

export function clearStoredVault(): void {
  localStorage.removeItem(STORAGE_VAULT_KEY);
}

export function loadSavedApiKey(): string {
  return localStorage.getItem(STORAGE_API_KEY) ?? "";
}

export function saveApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) {
      throw new Error("Ungültiges Helius API-Key-Format (nur Buchstaben, Zahlen und Bindestriche).");
    }
    localStorage.setItem(STORAGE_API_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

export function loadSavedHandle(): string {
  const saved = localStorage.getItem(STORAGE_HANDLE_KEY);
  return saved ? sanitizeHandle(saved) || "SunVeilSol" : "SunVeilSol";
}

export function saveHandle(handle: string): void {
  localStorage.setItem(STORAGE_HANDLE_KEY, sanitizeHandle(handle));
}
