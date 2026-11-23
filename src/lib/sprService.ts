import {
  LocalKeys,
  SOL_MINT,
  ShieldedKeypair,
  Wallet,
  buildDepositTransaction,
  buildRegistrationTransaction,
  buildTransferTransaction,
  buildWithdrawalTransaction,
  createSprClient,
  getPrivateTokenBalances,
  getPrivateTransactions,
  syncWallet,
} from "@heliuslabs/spr";
import { SignedTeePolicy, type SprClient } from "@heliuslabs/spr/client";
import {
  address,
  getBase64EncodedWireTransaction,
  isAddress,
  lamports,
  type Address,
  type Transaction,
} from "@solana/kit";
import type { ActivityItem, LiveSprCluster } from "../types";

const LAMPORTS_PER_SOL_NUM = 1_000_000_000;
const LAMPORTS_PER_SOL_BIGINT = 1_000_000_000n;
const MAX_SOL_AMOUNT = 1_000_000n * LAMPORTS_PER_SOL_BIGINT;

/**
 * Exact, string-based SOL -> lamports parser using BigInt arithmetic.
 * Eliminates IEEE-754 floating-point drift and rejects malformed strings like "1.5abc".
 */
export function parseSolToLamports(input: string): bigint | null {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,9})?$/.test(normalized)) {
    return null;
  }
  const [wholePart, fracPart = ""] = normalized.split(".");
  const paddedFrac = fracPart.padEnd(9, "0");
  const total = BigInt(wholePart) * LAMPORTS_PER_SOL_BIGINT + BigInt(paddedFrac);
  if (total <= 0n || total > MAX_SOL_AMOUNT) {
    return null;
  }
  return total;
}

export function solToLamports(sol: number): bigint {
  if (!Number.isFinite(sol) || sol <= 0) {
    throw new Error("Ungültiger SOL-Betrag.");
  }
  const parsed = parseSolToLamports(sol.toFixed(9));
  if (parsed === null) {
    throw new Error("SOL-Betrag außerhalb des gültigen Bereichs.");
  }
  return parsed;
}

export function lamportsToSolNumber(l: bigint): number {
  return Number(l) / LAMPORTS_PER_SOL_NUM;
}

export function isValidSolanaAddress(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 32 && trimmed.length <= 44 && isAddress(trimmed);
}

export class SprSession {
  readonly client: SprClient;
  readonly wallet: Wallet;
  readonly keys: LocalKeys;
  readonly keypair: ShieldedKeypair;
  readonly ownerAddress: Address;
  readonly cluster: LiveSprCluster;

  private constructor(
    client: SprClient,
    wallet: Wallet,
    keys: LocalKeys,
    keypair: ShieldedKeypair,
    cluster: LiveSprCluster,
  ) {
    this.client = client;
    this.wallet = wallet;
    this.keys = keys;
    this.keypair = keypair;
    this.ownerAddress = keypair.shieldedAddress().solanaAddress();
    this.cluster = cluster;
  }

  static async connect(
    apiKey: string,
    keypair: ShieldedKeypair,
    cluster: LiveSprCluster = "devnet",
  ): Promise<SprSession> {
    const cleanKey = apiKey.trim();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(cleanKey)) {
      throw new Error("Ungültiger Helius API-Key.");
    }
    const host =
      cluster === "mainnet" ? "mainnet.helius-rpc.com" : "devnet.helius-rpc.com";
    const rpcUrl = `https://${host}/?api-key=${encodeURIComponent(cleanKey)}`;
    const client = await createSprClient({
      solanaRpcUrl: rpcUrl,
      proverTee: SignedTeePolicy.forNetwork(cluster),
    });
    const wallet = new Wallet({ identity: keypair.shieldedAddress() });
    const keys = LocalKeys.fromKeypair(keypair, client.proofService);
    return new SprSession(client, wallet, keys, keypair, cluster);
  }

  private async signAndSend(tx: Transaction): Promise<{ signature: string; slot: bigint }> {
    const signer = this.keypair.toSolanaSigner();
    const [sigDict] = await signer.signTransactions([
      tx as Parameters<typeof signer.signTransactions>[0][number],
    ]);
    const signedTx = {
      ...tx,
      signatures: {
        ...tx.signatures,
        ...sigDict,
      },
    } as Transaction;

    const wire = getBase64EncodedWireTransaction(signedTx);
    const sig = await this.client.solanaRpc
      .sendTransaction(wire, { encoding: "base64", skipPreflight: false })
      .send();
    const slot = await this.client.confirmTransaction(sig);
    return { signature: String(sig), slot };
  }

  async ensureRegistered(): Promise<{ registeredNow: boolean; signature?: string }> {
    const regTx = await buildRegistrationTransaction({
      client: this.client,
      owner: this.ownerAddress,
      address: this.keypair.shieldedAddress(),
    });
    if (!regTx) {
      return { registeredNow: false };
    }
    const { signature } = await this.signAndSend(regTx);
    return { registeredNow: true, signature };
  }

  async requestAirdrop(solAmount = 1): Promise<string> {
    if (this.cluster !== "devnet") {
      throw new Error("Airdrops sind nur auf Solana Devnet verfügbar.");
    }
    const sig = await this.client.solanaRpc
      .requestAirdrop(this.ownerAddress, lamports(solToLamports(solAmount)))
      .send();
    await this.client.confirmTransaction(sig);
    return String(sig);
  }

  async fetchState(requireSlot?: bigint): Promise<{
    publicSol: number;
    privateSol: number;
    publicLamports: bigint;
    privateLamports: bigint;
    utxoCount: number;
    history: ActivityItem[];
  }> {
    const publicLamports = await this.client.getBalance(this.ownerAddress);
    await syncWallet({
      client: this.client,
      wallet: this.wallet,
      keys: this.keys,
      config: requireSlot !== undefined ? { requireSlot } : undefined,
    });

    const balances = getPrivateTokenBalances(this.wallet);
    const solBalance = balances.find((b) => b.mint === SOL_MINT);
    const privateLamports = solBalance ? solBalance.amount : 0n;
    const privateSol = lamportsToSolNumber(privateLamports);
    const utxoCount = solBalance ? solBalance.utxos.length : 0;

    const rawTxs = getPrivateTransactions(this.wallet);
    const history: ActivityItem[] = rawTxs.map((tx) => ({
      id: `${tx.id.signature}-${tx.id.index.toString()}`,
      kind:
        tx.kind === "deposit"
          ? "deposit"
          : tx.kind === "publicWithdrawal"
            ? "publicWithdrawal"
            : "privateTransfer",
      direction:
        tx.direction === "inbound"
          ? "inbound"
          : tx.direction === "outbound"
            ? "outbound"
            : "self",
      amountSol: lamportsToSolNumber(tx.amount),
      signature: String(tx.id.signature),
      timestamp: Date.now(),
      encryptedAmount: tx.kind === "privateTransfer",
    }));

    return {
      publicSol: lamportsToSolNumber(publicLamports),
      privateSol,
      publicLamports,
      privateLamports,
      utxoCount,
      history,
    };
  }

  async shieldLamports(amountLamports: bigint): Promise<{ signature: string; slot: bigint }> {
    if (amountLamports <= 0n) {
      throw new Error("Betrag muss größer als 0 sein.");
    }
    await this.ensureRegistered();
    const tx = await buildDepositTransaction({
      client: this.client,
      feePayer: this.ownerAddress,
      recipient: this.keypair.shieldedAddress(),
      asset: SOL_MINT,
      amount: amountLamports,
    });
    return this.signAndSend(tx);
  }

  async sendPrivateLamports(
    recipientSolanaAddress: string,
    amountLamports: bigint,
  ): Promise<{ signature: string; slot: bigint }> {
    if (amountLamports <= 0n) {
      throw new Error("Betrag muss größer als 0 sein.");
    }
    if (!isValidSolanaAddress(recipientSolanaAddress)) {
      throw new Error("Ungültige Solana-Empfängeradresse.");
    }
    const recipient = address(recipientSolanaAddress.trim());
    const tx = await buildTransferTransaction({
      client: this.client,
      wallet: this.wallet,
      keys: this.keys,
      feePayer: this.ownerAddress,
      recipient,
      asset: SOL_MINT,
      amount: amountLamports,
    });
    return this.signAndSend(tx);
  }

  async unshieldLamports(
    recipientSolanaAddress: string,
    amountLamports: bigint,
  ): Promise<{ signature: string; slot: bigint }> {
    if (amountLamports <= 0n) {
      throw new Error("Betrag muss größer als 0 sein.");
    }
    if (!isValidSolanaAddress(recipientSolanaAddress)) {
      throw new Error("Ungültige Solana-Empfängeradresse.");
    }
    const recipient = address(recipientSolanaAddress.trim());
    const tx = await buildWithdrawalTransaction({
      client: this.client,
      wallet: this.wallet,
      keys: this.keys,
      feePayer: this.ownerAddress,
      recipient,
      asset: SOL_MINT,
      amount: amountLamports,
    });
    return this.signAndSend(tx);
  }
}
