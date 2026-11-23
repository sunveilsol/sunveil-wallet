/**
 * 100% Non-Custodial External Solana Wallet Connector.
 *
 * Supports Phantom, Solflare, Backpack, Brave Wallet, and any Wallet Standard
 * compatible Solana extension. Never requests or handles seed phrases or private keys —
 * only delegates connect/disconnect to the user's own wallet extension and performs
 * read-only JSON-RPC balance queries.
 */

export type ExternalWalletId =
  | "phantom"
  | "solflare"
  | "backpack"
  | "brave"
  | string;

export interface DetectedWallet {
  id: ExternalWalletId;
  name: string;
  installed: boolean;
  installUrl: string;
  accent: string;
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
}

export interface ConnectedExternalWallet {
  id: ExternalWalletId;
  name: string;
  address: string;
  devnetSol: number | null;
  mainnetSol: number | null;
}

interface LegacySolanaProvider {
  isPhantom?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  isBraveWallet?: boolean;
  publicKey?: { toBase58?: () => string; toString: () => string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey?: { toBase58?: () => string; toString: () => string };
  } | void>;
  disconnect?: () => Promise<void>;
}

interface StandardWalletAccount {
  address: string;
  chains?: readonly string[];
}

interface StandardWallet {
  name: string;
  chains?: readonly string[];
  accounts: readonly StandardWalletAccount[];
  features: Record<
    string,
    {
      connect?: () => Promise<{ accounts: readonly StandardWalletAccount[] }>;
      disconnect?: () => Promise<void>;
    }
  >;
}

interface ExtendedWindow extends Window {
  phantom?: { solana?: LegacySolanaProvider };
  solflare?: LegacySolanaProvider;
  backpack?: { solana?: LegacySolanaProvider };
  xnft?: { solana?: LegacySolanaProvider };
  braveSolana?: LegacySolanaProvider;
  solana?: LegacySolanaProvider;
}

const standardWallets = new Map<string, StandardWallet>();
let standardListenerAttached = false;

function ensureWalletStandardListener(): void {
  if (typeof window === "undefined" || standardListenerAttached) return;
  standardListenerAttached = true;

  const registerApi = {
    register(wallet: StandardWallet) {
      const isSolana =
        wallet.chains?.some((c) => c.startsWith("solana:")) ||
        "solana:signTransaction" in (wallet.features ?? {}) ||
        "solana:signMessage" in (wallet.features ?? {});
      if (isSolana && wallet.features?.["standard:connect"]?.connect) {
        standardWallets.set(wallet.name.toLowerCase(), wallet);
      }
      return () => {
        standardWallets.delete(wallet.name.toLowerCase());
      };
    },
  };

  window.addEventListener("wallet-standard:register-wallet", (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (typeof detail === "function") {
      try {
        detail(registerApi);
      } catch {
        // Ignore malformed third-party wallet registrations
      }
    }
  });

  try {
    window.dispatchEvent(
      new CustomEvent("wallet-standard:app-ready", { detail: registerApi }),
    );
  } catch {
    // Ignore in restricted environments
  }
}

function extractAddress(
  provider: LegacySolanaProvider,
  res?: { publicKey?: { toBase58?: () => string; toString: () => string } } | void,
): string {
  const pk = (res && "publicKey" in res ? res.publicKey : null) ?? provider.publicKey;
  if (!pk) throw new Error("Wallet hat keine Public-Key-Adresse zurückgegeben.");
  return typeof pk.toBase58 === "function" ? pk.toBase58() : pk.toString();
}

function makeLegacyConnector(provider: LegacySolanaProvider) {
  return {
    connect: async () => {
      const res = await provider.connect();
      return extractAddress(provider, res);
    },
    disconnect: async () => {
      try {
        await provider.disconnect?.();
      } catch {
        // Some extensions throw on disconnect if already locked
      }
    },
  };
}

function makeStandardConnector(wallet: StandardWallet) {
  return {
    connect: async () => {
      const connectFeat = wallet.features["standard:connect"];
      if (!connectFeat?.connect) {
        throw new Error(`${wallet.name} unterstützt standard:connect nicht.`);
      }
      const result = await connectFeat.connect();
      const account = result.accounts?.[0] ?? wallet.accounts?.[0];
      if (!account?.address) {
        throw new Error(`${wallet.name} hat keinen Account freigegeben.`);
      }
      return account.address;
    },
    disconnect: async () => {
      try {
        await wallet.features["standard:disconnect"]?.disconnect?.();
      } catch {
        // Ignore
      }
    },
  };
}

export function detectSolanaWallets(): DetectedWallet[] {
  ensureWalletStandardListener();
  const win = typeof window !== "undefined" ? (window as ExtendedWindow) : ({} as ExtendedWindow);

  const phantomProvider =
    win.phantom?.solana ?? (win.solana?.isPhantom ? win.solana : undefined);
  const solflareProvider =
    win.solflare?.isSolflare
      ? win.solflare
      : win.solana?.isSolflare
        ? win.solana
        : undefined;
  const backpackProvider =
    win.backpack?.solana ??
    win.xnft?.solana ??
    (win.solana?.isBackpack ? win.solana : undefined);
  const braveProvider =
    win.braveSolana ?? (win.solana?.isBraveWallet ? win.solana : undefined);

  const phantomStd = standardWallets.get("phantom");
  const solflareStd = standardWallets.get("solflare");
  const backpackStd = standardWallets.get("backpack");
  const braveStd = standardWallets.get("brave wallet");

  const core: DetectedWallet[] = [
    {
      id: "phantom",
      name: "Phantom",
      installed: Boolean(phantomProvider || phantomStd),
      installUrl: "https://phantom.app/download",
      accent: "#ab9ff2",
      ...(phantomProvider
        ? makeLegacyConnector(phantomProvider)
        : phantomStd
          ? makeStandardConnector(phantomStd)
          : {
              connect: async () => {
                throw new Error("Phantom ist in diesem Browser nicht installiert.");
              },
              disconnect: async () => {},
            }),
    },
    {
      id: "solflare",
      name: "Solflare",
      installed: Boolean(solflareProvider || solflareStd),
      installUrl: "https://solflare.com/download",
      accent: "#fc7227",
      ...(solflareProvider
        ? makeLegacyConnector(solflareProvider)
        : solflareStd
          ? makeStandardConnector(solflareStd)
          : {
              connect: async () => {
                throw new Error("Solflare ist in diesem Browser nicht installiert.");
              },
              disconnect: async () => {},
            }),
    },
    {
      id: "backpack",
      name: "Backpack",
      installed: Boolean(backpackProvider || backpackStd),
      installUrl: "https://backpack.app/downloads",
      accent: "#e33e3f",
      ...(backpackProvider
        ? makeLegacyConnector(backpackProvider)
        : backpackStd
          ? makeStandardConnector(backpackStd)
          : {
              connect: async () => {
                throw new Error("Backpack ist in diesem Browser nicht installiert.");
              },
              disconnect: async () => {},
            }),
    },
  ];

  // Add Brave Wallet if detected (great for Brave browser users!)
  if (braveProvider || braveStd) {
    core.push({
      id: "brave",
      name: "Brave Wallet",
      installed: true,
      installUrl: "https://brave.com/wallet/",
      accent: "#ff5500",
      ...(braveProvider
        ? makeLegacyConnector(braveProvider)
        : makeStandardConnector(braveStd!)),
    });
  }

  // Add any other Wallet Standard Solana extensions (e.g. OKX, Glow, Coinbase)
  const knownNames = new Set(["phantom", "solflare", "backpack", "brave wallet"]);
  for (const [key, wallet] of standardWallets.entries()) {
    if (!knownNames.has(key)) {
      core.push({
        id: key,
        name: wallet.name,
        installed: true,
        installUrl: "https://solana.com/solana-wallets",
        accent: "#ff7a1a",
        ...makeStandardConnector(wallet),
      });
    }
  }

  return core;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

export async function fetchPublicSolBalance(
  address: string,
  rpcUrl: string,
): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: { value?: number } };
    const lamports = json.result?.value;
    if (typeof lamports !== "number") return null;
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

export async function fetchWalletBalances(
  address: string,
  heliusDevnetKey?: string,
): Promise<{ devnetSol: number | null; mainnetSol: number | null }> {
  const devnetRpc = heliusDevnetKey?.trim()
    ? `https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(heliusDevnetKey.trim())}`
    : "https://api.devnet.solana.com";

  const [devnetSol, mainnetSol] = await Promise.all([
    fetchPublicSolBalance(address, devnetRpc),
    fetchPublicSolBalance(address, "https://api.mainnet-beta.solana.com"),
  ]);

  return { devnetSol, mainnetSol };
}
