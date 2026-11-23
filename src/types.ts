export type NetworkMode = "demo" | "devnet";

export type ActiveTab = "vault" | "transact" | "paylinks" | "security";

export type TxActionKind = "shield" | "privateSend" | "unshield";

export interface ActivityItem {
  id: string;
  kind: "deposit" | "privateTransfer" | "publicWithdrawal" | "airdrop" | "register";
  direction: "inbound" | "outbound" | "self";
  amountSol: number;
  counterparty?: string;
  signature: string;
  timestamp: number;
  encryptedAmount: boolean;
  proofTimeMs?: number;
  memo?: string;
}

export interface EncryptedVaultRecord {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  solanaAddress: string;
  createdAt: number;
}

export interface WalletProfile {
  solanaAddress: string;
  shieldedAddressHex: string;
  viewingPublicKeyHex: string;
  ownerHashHex: string;
  secretKeyHex: string;
}
