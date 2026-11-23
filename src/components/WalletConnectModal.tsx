import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import {
  detectSolanaWallets,
  fetchWalletBalances,
  type ConnectedExternalWallet,
  type DetectedWallet,
} from "../lib/externalWallet";
import { formatSol, shortAddr } from "../lib/vault";
import { QrCode } from "./QrCode";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  connected: ConnectedExternalWallet | null;
  onConnected: (wallet: ConnectedExternalWallet) => void;
  onDisconnected: () => void;
  sunveilVaultAddress: string;
  heliusApiKey?: string;
}

export function WalletConnectModal({
  open,
  onClose,
  connected,
  onConnected,
  onDisconnected,
  sunveilVaultAddress,
  heliusApiKey,
}: WalletConnectModalProps) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedVault, setCopiedVault] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setWallets(detectSolanaWallets());
    const t = window.setTimeout(() => setWallets(detectSolanaWallets()), 350);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleConnect(wallet: DetectedWallet) {
    if (!wallet.installed) {
      window.open(wallet.installUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setError(null);
    setBusyId(wallet.id);
    try {
      const address = await wallet.connect();
      const balances = await fetchWalletBalances(address, heliusApiKey);
      onConnected({
        id: wallet.id,
        name: wallet.name,
        address,
        devnetSol: balances.devnetSol,
        mainnetSol: balances.mainnetSol,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Verbindung wurde abgebrochen.";
      setError(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisconnect() {
    const match = wallets.find((w) => w.id === connected?.id);
    if (match) {
      await match.disconnect();
    }
    onDisconnected();
  }

  async function handleRefreshBalances() {
    if (!connected) return;
    setRefreshing(true);
    try {
      const balances = await fetchWalletBalances(connected.address, heliusApiKey);
      onConnected({
        ...connected,
        devnetSol: balances.devnetSol,
        mainnetSol: balances.mainnetSol,
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopyVault() {
    try {
      await navigator.clipboard.writeText(sunveilVaultAddress);
      setCopiedVault(true);
      window.setTimeout(() => setCopiedVault(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="ember-card w-full max-w-md rounded-3xl p-6 space-y-5 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff5500]/15 border border-[#ff5500]/35 flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-[#ff7a1a]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {connected ? `${connected.name} verbunden` : "Solana Wallet verbinden"}
              </h2>
              <p className="text-xs text-zinc-400">
                100 % Non-Custodial · Nur Public-Key-Verbindung
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected View */}
        {connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#09090d] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  {connected.name} aktiv
                </span>
                <button
                  type="button"
                  onClick={handleRefreshBalances}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                  Sync
                </button>
              </div>
              <div className="font-mono text-xs text-zinc-200 break-all bg-zinc-950/80 px-3 py-2 rounded-xl border border-zinc-800/80">
                {connected.address}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Devnet SOL
                  </div>
                  <div className="font-display text-base font-bold text-[#ff8a3d] mt-0.5">
                    {connected.devnetSol !== null
                      ? `${formatSol(connected.devnetSol)} SOL`
                      : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Mainnet SOL
                  </div>
                  <div className="font-display text-base font-bold text-white mt-0.5">
                    {connected.mainnetSol !== null
                      ? `${formatSol(connected.mainnetSol)} SOL`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Fund SUNVEIL Privacy Vault */}
            <div className="p-4 rounded-2xl bg-[#110d0a] border border-[#ff5500]/30 space-y-3">
              <div className="text-xs font-semibold text-[#ff944d]">
                SUNVEIL Privacy-Tresor aufladen (Devnet)
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Sende Devnet-SOL aus <strong className="text-zinc-200">{connected.name}</strong> an
                deine SUNVEIL-Adresse und klicke danach im Tresor auf{" "}
                <strong className="text-white">„Shield“</strong>, um sie per Groth16 ZK-Proof zu
                verschlüsseln.
              </p>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#09090d] border border-[#ff5500]/25 shrink-0">
                  <QrCode value={`solana:${sunveilVaultAddress}`} size={86} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="font-mono text-[11px] text-zinc-300 break-all">
                    {shortAddr(sunveilVaultAddress, 10, 8)}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyVault}
                    className="w-full py-2 px-3 rounded-xl ember-btn-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedVault ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Adresse kopiert!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Tresor-Adresse kopieren
                      </>
                    )}
                  </button>
                  <a
                    href="https://faucet.solana.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#ff8533] hover:underline"
                  >
                    Kostenlose Devnet-SOL holen
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {connected.name} trennen
            </button>
          </div>
        ) : (
          /* Wallet Selector List */
          <div className="space-y-3">
            {wallets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleConnect(w)}
                disabled={busyId !== null}
                className="w-full p-3.5 rounded-2xl bg-[#0c0c10] hover:bg-[#14141b] border border-zinc-800/90 hover:border-[#ff5500]/45 transition flex items-center justify-between gap-3 text-left cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold text-sm text-white border border-white/10"
                    style={{ backgroundColor: `${w.accent}26`, color: w.accent }}
                  >
                    {w.name.slice(0, 1)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white">{w.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {w.installed
                        ? "Im Browser erkannt · 1-Klick Connect"
                        : "Nicht installiert · Download öffnen"}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    w.installed
                      ? "bg-[#ff5500]/15 text-[#ff8a3d] border border-[#ff5500]/30"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                  }`}
                >
                  {busyId === w.id
                    ? "Verbindet…"
                    : w.installed
                      ? "Verbinden"
                      : "Installieren"}
                </span>
              </button>
            ))}

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/35 text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 flex items-start gap-2.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-zinc-200">Zero-Custody Garantie:</strong> SUNVEIL fragt
                niemals nach deiner Phantom- oder Solflare-Seed-Phrase. Deine Keys bleiben jederzeit
                in deiner Wallet.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
