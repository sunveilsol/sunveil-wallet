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
import type { ActivityItem } from "../types";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function lamportsToSolNumber(l: bigint): number {
  return Number(l) / LAMPORTS_PER_SOL;
}

export function isValidSolanaAddress(value: string): boolean {
  return isAddress(value.trim());
}

export class DevnetSprSession {
  readonly client: SprClient;
  readonly wallet: Wallet;
  readonly keys: LocalKeys;
  readonly keypair: ShieldedKeypair;
  readonly ownerAddress: Address;

  private constructor(
    client: SprClient,
    wallet: Wallet,
    keys: LocalKeys,
    keypair: ShieldedKeypair,
  ) {
    this.client = client;
    this.wallet = wallet;
    this.keys = keys;
    this.keypair = keypair;
    this.ownerAddress = keypair.shieldedAddress().solanaAddress();
  }

  static async connect(apiKey: string, keypair: ShieldedKeypair): Promise<DevnetSprSession> {
    const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey.trim())}`;
    const client = await createSprClient({
      solanaRpcUrl: rpcUrl,
      proverTee: SignedTeePolicy.forNetwork("devnet"),
    });
    const wallet = new Wallet({ identity: keypair.shieldedAddress() });
    const keys = LocalKeys.fromKeypair(keypair, client.proofService);
    return new DevnetSprSession(client, wallet, keys, keypair);
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
    const sig = await this.client.solanaRpc
      .requestAirdrop(this.ownerAddress, lamports(solToLamports(solAmount)))
      .send();
    await this.client.confirmTransaction(sig);
    return String(sig);
  }

  async fetchState(requireSlot?: bigint): Promise<{
    publicSol: number;
    privateSol: number;
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
    const privateSol = solBalance ? lamportsToSolNumber(solBalance.amount) : 0;
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
      utxoCount,
      history,
    };
  }

  async shieldSol(amountSol: number): Promise<{ signature: string; slot: bigint }> {
    await this.ensureRegistered();
    const tx = await buildDepositTransaction({
      client: this.client,
      feePayer: this.ownerAddress,
      recipient: this.keypair.shieldedAddress(),
      asset: SOL_MINT,
      amount: solToLamports(amountSol),
    });
    return this.signAndSend(tx);
  }

  async sendPrivateSol(
    recipientSolanaAddress: string,
    amountSol: number,
  ): Promise<{ signature: string; slot: bigint }> {
    const recipient = address(recipientSolanaAddress.trim());
    const tx = await buildTransferTransaction({
      client: this.client,
      wallet: this.wallet,
      keys: this.keys,
      feePayer: this.ownerAddress,
      recipient,
      asset: SOL_MINT,
      amount: solToLamports(amountSol),
    });
    return this.signAndSend(tx);
  }

  async unshieldSol(
    recipientSolanaAddress: string,
    amountSol: number,
  ): Promise<{ signature: string; slot: bigint }> {
    const recipient = address(recipientSolanaAddress.trim());
    const tx = await buildWithdrawalTransaction({
      client: this.client,
      wallet: this.wallet,
      keys: this.keys,
      feePayer: this.ownerAddress,
      recipient,
      asset: SOL_MINT,
      amount: solToLamports(amountSol),
    });
    return this.signAndSend(tx);
  }
}
