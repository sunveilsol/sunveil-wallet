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

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean)) {
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
}

export async function createKeypairFromSecretHex(secretHex?: string): Promise<UnlockedWallet> {
  await ensurePoseidon();
  let signing: SigningKey;
  if (secretHex) {
    const raw = hexToBytes(secretHex);
    if (raw.length !== 32) {
      throw new Error("Ein Ed25519-Seed muss exakt 32 Bytes (64 Hex-Zeichen) lang sein.");
    }
    signing = SigningKey.fromEd25519Bytes(bytes32(raw));
  } else {
    signing = SigningKey.generate();
  }

  const secretKeyHex = bytesToHex(signing.secretBytes());
  const keypair = ShieldedKeypair.fromKeypair(signing);
  const shieldedAddr = keypair.shieldedAddress();

  const profile: WalletProfile = {
    solanaAddress: shieldedAddr.solanaAddress(),
    shieldedAddressHex: bytesToHex(shieldedAddr.toBytes()),
    viewingPublicKeyHex: bytesToHex(keypair.viewingPublicKey().toBytes()),
    ownerHashHex: bytesToHex(keypair.ownerHash()),
    secretKeyHex,
  };

  return { keypair, profile };
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 210_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptAndSaveVault(
  secretKeyHex: string,
  solanaAddress: string,
  password: string,
): Promise<EncryptedVaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(password, salt);
  const plain = new TextEncoder().encode(secretKeyHex);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    aesKey,
    plain,
  );
  const record: EncryptedVaultRecord = {
    version: 1,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(cipherBuf)),
    solanaAddress,
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(record));
  return record;
}

export function loadEncryptedVault(): EncryptedVaultRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptedVaultRecord;
    if (parsed?.version === 1 && parsed.ciphertext && parsed.salt && parsed.iv) {
      return parsed;
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
  const aesKey = await deriveAesKey(password, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      aesKey,
      ciphertext as BufferSource,
    );
    return new TextDecoder().decode(plainBuf);
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
    localStorage.setItem(STORAGE_API_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_API_KEY);
  }
}

export function loadSavedHandle(): string {
  return localStorage.getItem(STORAGE_HANDLE_KEY) ?? "SunVeilSol";
}

export function saveHandle(handle: string): void {
  localStorage.setItem(STORAGE_HANDLE_KEY, handle.replace(/^@+/, "").trim());
}
