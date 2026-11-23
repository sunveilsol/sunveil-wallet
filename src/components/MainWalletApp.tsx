import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  ImageDown,
  KeyRound,
  Link2,
  Lock,
  Radio,
  RefreshCw,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import type {
  ActiveTab,
  ActivityItem,
  NetworkMode,
  TxActionKind,
} from "../types";
import {
  clearStoredVault,
  decryptVault,
  formatSol,
  loadEncryptedVault,
  loadSavedApiKey,
  loadSavedHandle,
  sanitizeErrorMessage,
  sanitizeHandle,
  saveApiKey,
  saveHandle,
  shortAddr,
  type UnlockedWallet,
} from "../lib/vault";
import {
  SprSession,
  isValidSolanaAddress,
  lamportsToSolNumber,
  parseSolToLamports,
} from "../lib/sprService";
import { downloadPrivatePayCardPng } from "../lib/payCard";
import type { ConnectedExternalWallet } from "../lib/externalWallet";
import { QrCode } from "./QrCode";
import { WalletConnectModal } from "./WalletConnectModal";
import { InstallAppButton } from "./InstallAppButton";
import { LegalModal } from "./LegalModal";

interface MainWalletAppProps {
  unlocked: UnlockedWallet;
  onLock: () => void;
  onResetVault: () => void;
  onBackToLanding?: () => void;
}

const DEMO_INITIAL_HISTORY: ActivityItem[] = [
  {
    id: "demo-1",
    kind: "deposit",
    direction: "self",
    amountSol: 3.5,
    signature: "5xSunveilShield9kP2vLq8RtN4wYz1mBc7dFg3HjK6n",
    timestamp: Date.now() - 1000 * 60 * 42,
    encryptedAmount: false,
    memo: "Initialer Shield-Deposit",
  },
  {
    id: "demo-2",
    kind: "privateTransfer",
    direction: "inbound",
    amountSol: 0.85,
    counterparty: "7vKp9…3xQm",
    signature: "3zZkGroth16Proof8mN5bVc2xLq9wRt4yHj7kMn1pRsT",
    timestamp: Date.now() - 1000 * 60 * 14,
    encryptedAmount: true,
    proofTimeMs: 412,
    memo: "X Pay-Link Tip (@SunVeilSol)",
  },
];

function randomMockSig(): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  const arr = crypto.getRandomValues(new Uint8Array(44));
  for (const b of arr) s += alphabet[b % alphabet.length];
  return s;
}

export function MainWalletApp({
  unlocked,
  onLock,
  onResetVault,
  onBackToLanding,
}: MainWalletAppProps) {
  const [tab, setTab] = useState<ActiveTab>("vault");
  const [privacyBlur, setPrivacyBlur] = useState(false);

  // Network & Helius Live Session (Devnet / Mainnet-Beta)
  const [apiKeyInput, setApiKeyInput] = useState(() => loadSavedApiKey());
  const [networkMode, setNetworkMode] = useState<NetworkMode>(() =>
    loadSavedApiKey() ? "devnet" : "demo",
  );
  const [confirmMainnetModal, setConfirmMainnetModal] = useState(false);
  const [payCardBusy, setPayCardBusy] = useState(false);
  const sessionRef = useRef<SprSession | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  // Balances & History (exact BigInt lamports alongside display SOL)
  const [publicLamports, setPublicLamports] = useState<bigint>(1_750_000_000n);
  const [privateLamports, setPrivateLamports] = useState<bigint>(4_350_000_000n);
  const publicSol = lamportsToSolNumber(publicLamports);
  const privateSol = lamportsToSolNumber(privateLamports);
  const [utxoCount, setUtxoCount] = useState<number>(2);
  const [history, setHistory] = useState<ActivityItem[]>(DEMO_INITIAL_HISTORY);

  // Transaction Form
  const [txAction, setTxAction] = useState<TxActionKind>("privateSend");
  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("0.25");
  const [memoInput, setMemoInput] = useState("");
  const [payLinkNotice, setPayLinkNotice] = useState<{
    address: string;
    handle?: string;
  } | null>(null);
  const [txBusy, setTxBusy] = useState(false);
  const [txStep, setTxStep] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Pay Links
  const [xHandle, setXHandle] = useState(() => loadSavedHandle());
  const [payLinkPresetAmount, setPayLinkPresetAmount] = useState("0.5");

  // Security UI & External Wallet
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null);
  const [seedPasswordInput, setSeedPasswordInput] = useState("");
  const [seedRevealPromptOpen, setSeedRevealPromptOpen] = useState(false);
  const [seedRevealBusy, setSeedRevealBusy] = useState(false);
  const [seedRevealError, setSeedRevealError] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<ConnectedExternalWallet | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);

  const showToast = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 5200);
  }, []);

  // Auto-hide revealed secret seed after 30s or immediately when leaving Security tab
  useEffect(() => {
    if (tab !== "security") {
      setRevealedSeed(null);
      setSeedRevealPromptOpen(false);
      setSeedPasswordInput("");
      setSeedRevealError(null);
      setConfirmWipe(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!revealedSeed) return;
    const t = window.setTimeout(() => {
      setRevealedSeed(null);
      showToast("ok", "Geheimer Seed aus Sicherheitsgründen automatisch ausgeblendet.");
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [revealedSeed, showToast]);

  // Read, strictly validate & strip incoming Pay-Link query params (?pay=<address>&amount=<sol>&handle=<name>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payAddr = params.get("pay")?.trim();
    const payAmtRaw = params.get("amount")?.trim();
    const payHandleRaw = params.get("handle")?.trim();
    if (!payAddr) return;

    // Strip untrusted query parameters from the URL bar once consumed
    window.history.replaceState(null, "", `${window.location.pathname}#app`);

    if (isValidSolanaAddress(payAddr)) {
      setRecipientInput(payAddr);
      if (payAmtRaw) {
        const lam = parseSolToLamports(payAmtRaw);
        if (lam !== null && lam <= 10_000_000_000_000n) {
          setAmountInput(payAmtRaw.replace(",", "."));
        }
      }
      const safeHandle = payHandleRaw ? sanitizeHandle(payHandleRaw) : "";
      if (safeHandle) {
        setMemoInput(`Private Pay-Link an @${safeHandle}`);
      }
      setPayLinkNotice({ address: payAddr, handle: safeHandle || undefined });
      setTxAction("privateSend");
      setTab("transact");
      showToast(
        "ok",
        "Pay-Link geladen — bitte Empfänger-Adresse & Betrag vor dem Senden genau prüfen!",
      );
    } else {
      showToast("err", "Ungültige Solana-Adresse im Pay-Link ignoriert.");
    }
  }, [showToast]);

  // Sleep-safe automatic vault lock after 15 minutes of wall-clock inactivity
  useEffect(() => {
    const IDLE_LOCK_MS = 15 * 60 * 1000;
    let lastActivityAt = Date.now();

    const checkLock = () => {
      if (Date.now() - lastActivityAt >= IDLE_LOCK_MS) {
        setRevealedSeed(null);
        onLock();
      }
    };
    const markActive = () => {
      lastActivityAt = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkLock();
      }
    };

    const interval = window.setInterval(checkLock, 30_000);
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));
    window.addEventListener("focus", checkLock);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      window.removeEventListener("focus", checkLock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [onLock]);

  // Connect to Helius Devnet or Mainnet-Beta when in live mode
  const refreshLiveNetwork = useCallback(
    async (requireSlot?: bigint) => {
      if (networkMode === "demo") return;
      const cluster = networkMode;
      const clusterLabel = cluster === "mainnet" ? "Mainnet-Beta" : "Devnet";
      const key = apiKeyInput.trim();
      if (!key) {
        setLiveReady(false);
        setLiveStatus(`Helius API-Key fehlt — wechsle in Sicherheit & Helius.`);
        return;
      }
      setSyncing(true);
      setLiveStatus(`Verbinde mit Helius ${clusterLabel} & Photon Indexer…`);
      try {
        if (!sessionRef.current || sessionRef.current.cluster !== cluster) {
          sessionRef.current = await SprSession.connect(key, unlocked.keypair, cluster);
        }
        const state = await sessionRef.current.fetchState(requireSlot);
        setPublicLamports(state.publicLamports);
        setPrivateLamports(state.privateLamports);
        setUtxoCount(state.utxoCount);
        setHistory(state.history);
        setLiveReady(true);
        setLiveStatus(`Verbunden · Helius ${clusterLabel} + TEE Prover aktiv`);
      } catch (err) {
        setLiveReady(false);
        setLiveStatus(sanitizeErrorMessage(err, `${clusterLabel}-Sync fehlgeschlagen.`));
      } finally {
        setSyncing(false);
      }
    },
    [apiKeyInput, networkMode, unlocked.keypair],
  );

  useEffect(() => {
    if (networkMode !== "demo") {
      sessionRef.current = null;
      setLiveReady(false);
      void refreshLiveNetwork();
    } else {
      sessionRef.current = null;
      setLiveReady(false);
      setLiveStatus(null);
      setPublicLamports(1_750_000_000n);
      setPrivateLamports(4_350_000_000n);
      setUtxoCount(2);
      setHistory(DEMO_INITIAL_HISTORY);
    }
  }, [networkMode, refreshLiveNetwork]);

  function requestMainnetSwitch() {
    if (unlocked.isEphemeral) {
      showToast(
        "err",
        "Mainnet-Beta erfordert einen passwortgeschützten Tresor mit Seed-Backup (nicht die temporäre Sandbox).",
      );
      return;
    }
    if (!apiKeyInput.trim()) {
      setTab("security");
      showToast("ok", "Gib zuerst deinen Helius API-Key ein, um Mainnet-Beta zu aktivieren.");
      return;
    }
    try {
      saveApiKey(apiKeyInput);
    } catch (err) {
      showToast("err", sanitizeErrorMessage(err, "Ungültiger Helius API-Key."));
      return;
    }
    setConfirmMainnetModal(true);
  }

  async function handleDownloadPayCard() {
    setPayCardBusy(true);
    try {
      const file = await downloadPrivatePayCardPng({
        handle: xHandle,
        solanaAddress: unlocked.profile.solanaAddress,
        payLinkUrl,
        presetAmount: payLinkPresetAmount,
      });
      showToast("ok", `Private Pay-Card heruntergeladen (${file}) — bereit zum Posten auf X!`);
    } catch (err) {
      showToast("err", sanitizeErrorMessage(err, "Pay-Card Export fehlgeschlagen."));
    } finally {
      setPayCardBusy(false);
    }
  }

  async function handleCopy(
    id: string,
    value: string,
    label: string,
    options?: { clearAfterMs?: number },
  ) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      showToast(
        "ok",
        options?.clearAfterMs
          ? `${label} kopiert (Zwischenablage wird nach 30 Sek. automatisch geleert).`
          : `${label} kopiert.`,
      );
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
      if (options?.clearAfterMs) {
        window.setTimeout(() => {
          void navigator.clipboard.writeText("").catch(() => {});
        }, options.clearAfterMs);
      }
    } catch {
      showToast("err", "Zwischenablage konnte nicht beschrieben werden.");
    }
  }

  async function handleRevealSeedSubmit(e: React.FormEvent) {
    e.preventDefault();
    const record = loadEncryptedVault();
    if (!record) {
      setSeedRevealError("Kein lokal gespeicherter Tresor vorhanden.");
      return;
    }
    setSeedRevealError(null);
    setSeedRevealBusy(true);
    try {
      const secretHex = await decryptVault(record, seedPasswordInput);
      setRevealedSeed(secretHex);
      setSeedPasswordInput("");
      setSeedRevealPromptOpen(false);
    } catch (err) {
      setSeedRevealError(
        err instanceof Error ? err.message : "Passwort falsch — Seed bleibt gesperrt.",
      );
    } finally {
      setSeedRevealBusy(false);
    }
  }

  async function handleFaucet() {
    if (networkMode === "demo") {
      setPublicLamports((v) => v + 2_000_000_000n);
      setHistory((prev) => [
        {
          id: `airdrop-${Date.now()}`,
          kind: "airdrop",
          direction: "inbound",
          amountSol: 2,
          signature: randomMockSig(),
          timestamp: Date.now(),
          encryptedAmount: false,
          memo: "Sandbox Faucet (+2 SOL)",
        },
        ...prev,
      ]);
      showToast("ok", "+2,00 SOL Testguthaben in der Sandbox gutgeschrieben.");
      return;
    }

    if (networkMode === "mainnet") {
      await handleCopy("mainnet-deposit", unlocked.profile.solanaAddress, "Mainnet-Einzahladresse");
      return;
    }

    if (!sessionRef.current) {
      showToast("err", "Bitte erst mit Helius Devnet verbinden.");
      return;
    }
    setSyncing(true);
    try {
      const sig = await sessionRef.current.requestAirdrop(1);
      await refreshLiveNetwork();
      showToast("ok", `Devnet Airdrop (+1 SOL) bestätigt: ${shortAddr(sig)}`);
    } catch (err) {
      showToast(
        "err",
        `Airdrop-Limit erreicht? Nutze faucet.solana.com (${sanitizeErrorMessage(
          err,
          "Devnet Airdrop fehlgeschlagen.",
        )})`,
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleExecuteTx(e: React.FormEvent) {
    e.preventDefault();
    const amountLamports = parseSolToLamports(amountInput);
    if (amountLamports === null) {
      showToast("err", "Bitte einen gültigen SOL-Betrag > 0 eingeben (max. 9 Nachkommastellen).");
      return;
    }
    const amount = lamportsToSolNumber(amountLamports);

    if (txAction === "shield" && amountLamports > publicLamports) {
      showToast("err", "Nicht genügend Public SOL für diesen Shield-Deposit.");
      return;
    }
    if ((txAction === "privateSend" || txAction === "unshield") && amountLamports > privateLamports) {
      showToast("err", "Nicht genügend Shielded (Private) SOL verfügbar.");
      return;
    }

    const targetAddr =
      txAction === "unshield" && !recipientInput.trim()
        ? unlocked.profile.solanaAddress
        : recipientInput.trim();

    if (txAction === "privateSend" && !targetAddr) {
      showToast("err", "Bitte eine Solana-Empfängeradresse eingeben.");
      return;
    }

    if (txAction !== "shield" && !isValidSolanaAddress(targetAddr)) {
      showToast("err", "Ungültige Solana-Adresse (Base58).");
      return;
    }

    setTxBusy(true);
    try {
      if (networkMode === "demo") {
        // Realistic staged ZK flow in Sandbox mode
        if (txAction === "shield") {
          setTxStep("Erzeuge verschlüsselten Output-UTXO & signiere lokal (Ed25519)…");
          await new Promise((r) => setTimeout(r, 650));
          setPublicLamports((v) => v - amountLamports);
          setPrivateLamports((v) => v + amountLamports);
          setUtxoCount((c) => c + 1);
          setHistory((prev) => [
            {
              id: `tx-${Date.now()}`,
              kind: "deposit",
              direction: "self",
              amountSol: amount,
              signature: randomMockSig(),
              timestamp: Date.now(),
              encryptedAmount: false,
              memo: memoInput || "Shield in Privacy Ring",
            },
            ...prev,
          ]);
          showToast("ok", `${formatSol(amount)} SOL erfolgreich in den Privacy Ring geschützt.`);
        } else if (txAction === "privateSend") {
          setTxStep("Wähle UTXOs & berechne Poseidon Nullifier…");
          await new Promise((r) => setTimeout(r, 450));
          setTxStep("Erzeuge 192-Byte Groth16 Zero-Knowledge-Proof…");
          const t0 = performance.now();
          await new Promise((r) => setTimeout(r, 750));
          const proofMs = Math.round(performance.now() - t0);
          setPrivateLamports((v) => v - amountLamports);
          setHistory((prev) => [
            {
              id: `tx-${Date.now()}`,
              kind: "privateTransfer",
              direction: "outbound",
              amountSol: amount,
              counterparty: shortAddr(targetAddr, 5, 4),
              signature: randomMockSig(),
              timestamp: Date.now(),
              encryptedAmount: true,
              proofTimeMs: proofMs,
              memo: memoInput || "Vertraulicher Transfer",
            },
            ...prev,
          ]);
          showToast("ok", `Vertraulicher Transfer gesendet — Betrag onchain verschlüsselt!`);
        } else {
          setTxStep("Erzeuge Groth16 Withdrawal-Proof…");
          await new Promise((r) => setTimeout(r, 850));
          setPrivateLamports((v) => v - amountLamports);
          if (targetAddr === unlocked.profile.solanaAddress) {
            setPublicLamports((v) => v + amountLamports);
          }
          setHistory((prev) => [
            {
              id: `tx-${Date.now()}`,
              kind: "publicWithdrawal",
              direction: targetAddr === unlocked.profile.solanaAddress ? "self" : "outbound",
              amountSol: amount,
              counterparty: shortAddr(targetAddr, 5, 4),
              signature: randomMockSig(),
              timestamp: Date.now(),
              encryptedAmount: false,
              memo: memoInput || "Unshield auf Public Solana",
            },
            ...prev,
          ]);
          showToast("ok", `${formatSol(amount)} SOL erfolgreich ent-shieldet (Unshield).`);
        }
        setMemoInput("");
        setPayLinkNotice(null);
        setTab("vault");
        return;
      }

      // LIVE HELIUS MODE (DEVNET OR MAINNET-BETA)
      if (!sessionRef.current) {
        throw new Error(
          `Keine aktive Helius ${networkMode === "mainnet" ? "Mainnet-Beta" : "Devnet"}-Verbindung.`,
        );
      }

      if (txAction === "shield") {
        setTxStep("Prüfe Registry & sende Deposit an Solana Privacy Program…");
        const { signature, slot } = await sessionRef.current.shieldLamports(amountLamports);
        setTxStep("Synchronisiere Photon Indexer…");
        await refreshLiveNetwork(slot);
        showToast("ok", `Shield bestätigt! Tx: ${shortAddr(signature)}`);
      } else if (txAction === "privateSend") {
        setTxStep("Erzeuge Groth16 Proof via Helius TEE Prover & signiere lokal…");
        const { signature, slot } = await sessionRef.current.sendPrivateLamports(
          targetAddr,
          amountLamports,
        );
        setTxStep("Synchronisiere verschlüsselte UTXOs…");
        await refreshLiveNetwork(slot);
        showToast("ok", `Privater Transfer bestätigt! Tx: ${shortAddr(signature)}`);
      } else {
        setTxStep("Erzeuge Groth16 Withdrawal-Proof & zahle öffentlich aus…");
        const { signature, slot } = await sessionRef.current.unshieldLamports(
          targetAddr,
          amountLamports,
        );
        setTxStep("Synchronisiere Balances…");
        await refreshLiveNetwork(slot);
        showToast("ok", `Unshield bestätigt! Tx: ${shortAddr(signature)}`);
      }
      setPayLinkNotice(null);
      setTab("vault");
    } catch (err) {
      showToast("err", sanitizeErrorMessage(err, "Transaktion fehlgeschlagen."));
    } finally {
      setTxBusy(false);
      setTxStep(null);
    }
  }

  const totalSol = publicSol + privateSol;
  const shieldedRatio = totalSol > 0 ? Math.round((privateSol / totalSol) * 100) : 0;

  const payLinkUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const q = new URLSearchParams({
      pay: unlocked.profile.solanaAddress,
      handle: sanitizeHandle(xHandle) || "sunveil",
    });
    const normalizedAmt = payLinkPresetAmount.trim().replace(",", ".");
    if (normalizedAmt && parseSolToLamports(normalizedAmt) !== null) {
      q.set("amount", normalizedAmt);
    }
    return `${base}?${q.toString()}`;
  }, [unlocked.profile.solanaAddress, xHandle, payLinkPresetAmount]);

  const xBioSnippet = `🔒 Pay me privately on Solana (Helius Privacy Rings): ${payLinkUrl}`;

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden w-full">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#070709]/85 border-b border-[#ff5500]/15 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={onBackToLanding}
            className="flex items-center gap-3 text-left group cursor-pointer"
            title="Zur SUNVEIL Startseite"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6a00] to-[#c93700] ember-ring-glow flex items-center justify-center group-hover:scale-105 transition">
              <div className="w-4 h-4 rounded-full bg-[#09090d] ring-2 ring-white/90" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg tracking-tight text-white">
                  SUNVEIL
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#ff5500]/15 text-[#ff8533] border border-[#ff5500]/30">
                  Privacy Rings
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Non-Custodial Private Pocket Wallet
              </p>
            </div>
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* External Solana Wallet Connect (Phantom / Solflare / Backpack) */}
            <button
              type="button"
              onClick={() => setWalletModalOpen(true)}
              className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-medium border inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
                connectedWallet
                  ? "bg-emerald-500/12 border-emerald-500/35 text-emerald-300"
                  : "bg-zinc-900/90 border-zinc-800 hover:border-[#ff5500]/45 text-zinc-200 hover:text-[#ff8a3d]"
              }`}
              title="Phantom, Solflare oder Backpack verbinden (100 % Non-Custodial)"
            >
              <WalletIcon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">
                {connectedWallet
                  ? `${connectedWallet.name} · ${shortAddr(connectedWallet.address, 4, 4)}`
                  : "Wallet verbinden"}
              </span>
            </button>

            {/* Network Switch Pill */}
            <button
              type="button"
              onClick={() => {
                setTab("security");
                if (networkMode === "demo" && !apiKeyInput.trim()) {
                  showToast(
                    "ok",
                    "Gib deinen kostenlosen Helius API-Key ein, um Devnet oder Mainnet-Beta zu aktivieren.",
                  );
                }
              }}
              className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-medium border inline-flex items-center justify-center gap-2 transition cursor-pointer ${
                networkMode === "mainnet"
                  ? "bg-rose-500/15 border-rose-500/45 text-rose-200"
                  : networkMode === "devnet"
                    ? "bg-emerald-500/12 border-emerald-500/35 text-emerald-300"
                    : "bg-[#ff5500]/12 border-[#ff5500]/35 text-[#ff944d]"
              }`}
              title="Netzwerk wechseln (Sandbox, Helius Devnet oder Mainnet-Beta)"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  networkMode === "mainnet"
                    ? liveReady
                      ? "bg-rose-400 shadow-[0_0_8px_#fb7185]"
                      : "bg-amber-400 animate-pulse"
                    : networkMode === "devnet"
                      ? liveReady
                        ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                        : "bg-amber-400 animate-pulse"
                      : "bg-[#ff6a00] shadow-[0_0_8px_#ff6a00]"
                }`}
              />
              <span className="hidden md:inline">
                {networkMode === "mainnet"
                  ? "Mainnet-Beta"
                  : networkMode === "devnet"
                    ? "Helius Devnet"
                    : "Sandbox Demo"}
              </span>
            </button>

            {/* PWA Install Button */}
            <InstallAppButton lang="de" compact />

            {/* Privacy Blur Toggle */}
            <button
              type="button"
              onClick={() => setPrivacyBlur((b) => !b)}
              className="h-9 w-9 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-300 hover:text-[#ff8533] inline-flex items-center justify-center transition cursor-pointer"
              title={privacyBlur ? "Beträge einblenden" : "Beträge verschleiern"}
            >
              {privacyBlur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Lock Vault */}
            <button
              type="button"
              onClick={onLock}
              className="h-9 w-9 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-300 hover:text-[#ff8533] inline-flex items-center justify-center transition cursor-pointer"
              title="Tresor sperren"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 sm:max-w-sm">
          <div
            className={`px-4 py-3 rounded-2xl text-xs font-medium shadow-2xl border backdrop-blur-xl flex items-center gap-2.5 ${
              toast.kind === "ok"
                ? "bg-[#121014]/95 border-[#ff5500]/45 text-zinc-100"
                : "bg-red-950/95 border-red-500/45 text-red-200"
            }`}
          >
            {toast.kind === "ok" ? (
              <Sparkles className="w-4 h-4 text-[#ff6a00] shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7">
        {/* Non-Custodial Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 sm:mb-6 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-[#0e0e13]/90 border border-zinc-800/80 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            {unlocked.isEphemeral ? (
              <span>
                <strong className="text-[#ff944d]">Temporäre Sandbox-Session:</strong> Key existiert
                nur im Arbeitsspeicher — nicht dauerhaft gespeichert.
              </span>
            ) : (
              <span>
                <strong className="text-white">Self-Custody aktiv:</strong> Keys liegen
                ausschließlich AES-256-GCM-verschlüsselt in deinem Browser.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              handleCopy("header-addr", unlocked.profile.solanaAddress, "Solana-Adresse")
            }
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#ff8533] hover:text-[#ffaa66] cursor-pointer"
          >
            {shortAddr(unlocked.profile.solanaAddress, 6, 5)}
            {copiedId === "header-addr" ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="grid grid-cols-4 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#0d0d12] border border-zinc-800/90 mb-6 sm:mb-7">
          {[
            { id: "vault" as const, label: "Tresor", shortLabel: "Tresor", icon: WalletIcon },
            { id: "transact" as const, label: "Senden & Shield", shortLabel: "Senden", icon: Send },
            { id: "paylinks" as const, label: "X Pay-Links", shortLabel: "Pay-Links", icon: Link2 },
            { id: "security" as const, label: "Sicherheit & Helius", shortLabel: "Sicherheit", icon: KeyRound },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition cursor-pointer ${
                  active
                    ? "bg-gradient-to-r from-[#ff6a00]/22 to-[#ff4500]/16 text-[#ff8533] border border-[#ff5500]/40 shadow-[0_0_20px_rgba(255,85,0,0.16)]"
                    : "text-zinc-400 hover:text-zinc-100 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="sm:hidden leading-tight">{item.shortLabel}</span>
                <span className="hidden sm:inline truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ================= TAB 1: VAULT ================= */}
        {tab === "vault" && (
          <div className="space-y-6">
            {/* Hero Balance Card */}
            <section className="ember-hero-card rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-[#ff944d] mb-2">
                    <Shield className="w-4 h-4" />
                    Shielded Privacy Balance (Verschlüsselte UTXOs)
                  </div>
                  <div
                    className={`font-display text-4xl sm:text-5xl font-bold tracking-tight text-white flex items-baseline gap-2.5 ${
                      privacyBlur ? "privacy-blur" : ""
                    }`}
                  >
                    <span>{formatSol(privateSol)}</span>
                    <span className="text-xl sm:text-2xl text-[#ff6a00] font-semibold">SOL</span>
                  </div>

                  {/* Privacy Ratio Bar */}
                  <div className="mt-5 max-w-md">
                    <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-400 mb-1.5">
                      <span>Privatsphäre-Anteil ({utxoCount} verschlüsselte UTXOs)</span>
                      <span className="font-mono text-[#ff8533] whitespace-nowrap shrink-0">
                        {shieldedRatio} % geschützt
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ff4500] to-[#ff8c2b] transition-all duration-500"
                        style={{ width: `${shieldedRatio}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Secondary Public Balance Box */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[230px]">
                  <div className="rounded-2xl bg-[#09090d]/85 border border-zinc-800/90 px-4 py-3.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                      <span>Public Solana Balance</span>
                      <span className="text-zinc-500">Sichtbar</span>
                    </div>
                    <div
                      className={`font-mono text-xl font-semibold text-zinc-100 ${
                        privacyBlur ? "privacy-blur" : ""
                      }`}
                    >
                      {formatSol(publicSol)}{" "}
                      <span className="text-xs text-zinc-400">SOL</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFaucet}
                      disabled={syncing}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff5500]/14 hover:bg-[#ff5500]/22 border border-[#ff5500]/35 text-[#ff944d] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {networkMode === "mainnet"
                        ? "Einzahladresse kopieren"
                        : networkMode === "devnet"
                          ? "+1 SOL Devnet"
                          : "+2 SOL Faucet"}
                    </button>
                    {networkMode !== "demo" && (
                      <button
                        type="button"
                        onClick={() => void refreshLiveNetwork()}
                        disabled={syncing}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-300 cursor-pointer"
                        title="Wallet synchronisieren"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {networkMode === "mainnet" && (
                <div className="mt-5 px-3.5 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>Mainnet-Beta aktiv:</strong> Echte SOL über Helius Privacy Rings. Starte
                    mit kleinen Beträgen &amp; bewahre dein Seed-Backup offline auf.
                  </span>
                </div>
              )}

              {liveStatus && networkMode !== "demo" && (
                <div className="mt-5 pt-4 border-t border-zinc-800/70 text-xs text-zinc-400 flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-[#ff6a00]" />
                  <span>{liveStatus}</span>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => {
                    setTxAction("shield");
                    setTab("transact");
                  }}
                  className="py-3.5 px-4 rounded-2xl ember-btn-primary text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>
                    Shield <span className="hidden sm:inline">(Einzahlen)</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxAction("privateSend");
                    setTab("transact");
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-[#16141a] hover:bg-[#1e1a22] border border-[#ff5500]/35 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Send className="w-4 h-4 text-[#ff7a29]" />
                  Privat senden
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxAction("unshield");
                    setTab("transact");
                  }}
                  className="py-3.5 px-4 rounded-2xl bg-[#111117] hover:bg-[#171720] border border-zinc-800 hover:border-[#ff5500]/30 text-zinc-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                  Unshield
                </button>
                <button
                  type="button"
                  onClick={() => setTab("paylinks")}
                  className="py-3.5 px-4 rounded-2xl bg-[#111117] hover:bg-[#171720] border border-zinc-800 hover:border-[#ff5500]/30 text-zinc-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-[#ff7a29]" />
                  X Pay-Link
                </button>
              </div>
            </section>

            {/* Activity Feed */}
            <section className="ember-card rounded-3xl p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Aktivität &amp; ZK-Protokoll
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Lokal mit deinem Viewing Key entschlüsselt
                  </p>
                </div>
                <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap shrink-0">
                  {history.length} Einträge
                </span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10 text-sm text-zinc-500">
                  Noch keine Privacy-Rings-Transaktionen. Starte mit einem{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setTxAction("shield");
                      setTab("transact");
                    }}
                    className="text-[#ff7a29] underline cursor-pointer"
                  >
                    Shield-Deposit
                  </button>
                  .
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/70">
                  {history.map((item) => {
                    const isInbound = item.direction === "inbound";
                    const isPrivate = item.encryptedAmount;
                    return (
                      <div
                        key={item.id}
                        className="py-3.5 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isPrivate
                                ? "bg-[#ff5500]/14 border-[#ff5500]/35 text-[#ff8533]"
                                : "bg-zinc-900 border-zinc-800 text-zinc-300"
                            }`}
                          >
                            {item.kind === "deposit" ? (
                              <Shield className="w-4 h-4" />
                            ) : isInbound ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">
                                {item.kind === "deposit"
                                  ? "Shield Deposit"
                                  : item.kind === "privateTransfer"
                                    ? isInbound
                                      ? "Privater Eingang"
                                      : "Privater Transfer"
                                    : item.kind === "publicWithdrawal"
                                      ? "Unshield Auszahlung"
                                      : "Faucet Airdrop"}
                              </span>
                              {isPrivate && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ff5500]/15 text-[#ff8533] border border-[#ff5500]/30">
                                  Groth16 verschlüsselt
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 truncate">
                              {item.memo && <span className="truncate">{item.memo}</span>}
                              {item.counterparty && (
                                <span className="font-mono text-zinc-400">
                                  · {item.counterparty}
                                </span>
                              )}
                              {item.proofTimeMs && (
                                <span className="font-mono text-zinc-600">
                                  · Proof {item.proofTimeMs}ms
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono text-sm font-semibold ${
                              isInbound
                                ? "text-emerald-400"
                                : item.kind === "deposit"
                                  ? "text-[#ff8533]"
                                  : "text-zinc-100"
                            } ${privacyBlur ? "privacy-blur" : ""}`}
                          >
                            {isInbound ? "+" : item.kind === "deposit" ? "⇄ " : "−"}
                            {formatSol(item.amountSol)} SOL
                          </div>
                          {networkMode !== "demo" ? (
                            <a
                              href={
                                networkMode === "mainnet"
                                  ? `https://solscan.io/tx/${encodeURIComponent(item.signature)}`
                                  : `https://solscan.io/tx/${encodeURIComponent(item.signature)}?cluster=devnet`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-[#ff8533] mt-0.5"
                            >
                              {shortAddr(item.signature, 4, 4)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <div className="text-[11px] font-mono text-zinc-600 mt-0.5">
                              {shortAddr(item.signature, 4, 4)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= TAB 2: TRANSACT ================= */}
        {tab === "transact" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <form
              onSubmit={handleExecuteTx}
              className="lg:col-span-3 ember-card rounded-3xl p-6 space-y-5"
            >
              {/* Action Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#09090d] border border-zinc-800">
                {[
                  { id: "shield" as const, label: "Shield" },
                  { id: "privateSend" as const, label: "Privat senden" },
                  { id: "unshield" as const, label: "Unshield" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTxAction(opt.id)}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      txAction === opt.id
                        ? "bg-[#ff5500] text-white shadow-[0_4px_18px_rgba(255,85,0,0.45)]"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {payLinkNotice && txAction === "privateSend" && (
                <div className="p-3.5 rounded-2xl bg-[#ff5500]/12 border border-[#ff5500]/45 text-xs text-zinc-200 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-[#ff8533] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-semibold text-[#ff944d]">
                      Externer Pay-Link vorausgefüllt
                      {payLinkNotice.handle ? ` (@${payLinkNotice.handle})` : ""}
                    </div>
                    <p className="text-zinc-400 mt-0.5 leading-relaxed">
                      Prüfe Empfänger-Adresse und Betrag sorgfältig, bevor du auf Senden klickst.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold text-white">
                  {txAction === "shield"
                    ? "Public SOL in den Privacy Ring einzahlen"
                    : txAction === "privateSend"
                      ? "Vertraulicher Transfer (Betrag verschlüsselt)"
                      : "Private SOL zurück auf öffentliche Adresse"}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {txAction === "shield"
                    ? "Wandelt öffentliches SOL in ein verschlüsseltes UTXO-Guthaben um."
                    : txAction === "privateSend"
                      ? "Sendet per Groth16 Zero-Knowledge-Proof — niemand auf Solscan sieht den Betrag."
                      : "Löst verschlüsselte UTXOs wieder in reguläres Solana-Guthaben auf."}
                </p>
              </div>

              {txAction !== "shield" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Empfänger-Adresse (Solana Base58)
                    {txAction === "unshield" && (
                      <span className="text-zinc-500"> — leer lassen für eigene Public-Adresse</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    placeholder={
                      txAction === "unshield"
                        ? unlocked.profile.solanaAddress
                        : "z. B. 7vKp9… (registrierte Solana-Adresse)"
                    }
                    className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white placeholder:text-zinc-600 text-xs font-mono transition"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-zinc-400">Betrag (SOL)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAmountInput(
                        String(
                          Math.max(
                            0,
                            +((txAction === "shield" ? publicSol : privateSol) - 0.01).toFixed(4),
                          ),
                        ),
                      )
                    }
                    className="text-[11px] font-mono text-[#ff8533] hover:underline cursor-pointer"
                  >
                    Verfügbar:{" "}
                    {formatSol(txAction === "shield" ? publicSol : privateSol)} SOL (Max)
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full px-4 py-3.5 pr-16 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white font-mono text-xl font-semibold transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#ff6a00]">
                    SOL
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Lokale Notiz (optional, nicht öffentlich)
                </label>
                <input
                  type="text"
                  value={memoInput}
                  onChange={(e) => setMemoInput(e.target.value)}
                  placeholder="z. B. X Bounty, Freelance-Rechnung…"
                  className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white placeholder:text-zinc-600 text-sm transition"
                />
              </div>

              {txStep && (
                <div className="px-4 py-3 rounded-xl bg-[#ff5500]/12 border border-[#ff5500]/35 text-xs text-[#ff9d5c] flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{txStep}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={txBusy}
                className="w-full py-3.5 rounded-xl ember-btn-primary text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                {txBusy
                  ? "Verarbeite Zero-Knowledge-Transaktion…"
                  : txAction === "shield"
                    ? "Jetzt in Privacy Ring einzahlen"
                    : txAction === "privateSend"
                      ? "Vertraulich mit Groth16 senden"
                      : "Jetzt auf Public Solana auszahlen"}
              </button>
            </form>

            {/* Right Column: Live Transparency / Privacy Matrix */}
            <aside className="lg:col-span-2 space-y-4">
              <div className="ember-card rounded-3xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#ff7a29]" />
                  Was sieht die Öffentlichkeit auf Solscan?
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Betrag (SOL / Token)</span>
                    {txAction === "privateSend" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                        Verschlüsselt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        Öffentlich sichtbar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Asset-Typ</span>
                    {txAction === "privateSend" ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                        Verschlüsselt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        Öffentlich sichtbar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/70">
                    <span className="text-zinc-400">Wallet-Adressen (Default Ring)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-300 border border-amber-500/25">
                      Sichtbar (Wallet-Sync)
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-zinc-400">Signatur-Hoheit</span>
                    <span className="text-[#ff8533] font-medium">Lokal im Browser</span>
                  </div>
                </div>
              </div>

              <div className="ember-card rounded-3xl p-5 text-xs text-zinc-400 leading-relaxed space-y-1.5">
                <div className="text-zinc-200 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  100 % Client-Side Groth16 Verifikation
                </div>
                <p>
                  SUNVEIL signiert jede Transaktion ausschließlich lokal in deinem Browser. Weder
                  Betrag noch dein privater Seed werden jemals an SUNVEIL-Server übertragen.
                </p>
              </div>
            </aside>
          </div>
        )}

        {/* ================= TAB 3: X PAY LINKS ================= */}
        {tab === "paylinks" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 ember-card rounded-3xl p-6 space-y-5">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff8533] mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Wachstums-Feature für X (Twitter)
                </div>
                <h2 className="text-xl font-semibold text-white">
                  Dein persönlicher Private Pay-Link
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Teile diesen Link in deiner X-Bio oder unter Posts. Wer ihn öffnet, kann dir
                  vertraulich SOL über Helius Privacy Rings senden — ohne dass Zuschauer auf Solscan
                  den Betrag sehen.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Dein X-Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      value={xHandle}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/^@+/, "");
                        setXHandle(clean);
                        saveHandle(clean);
                      }}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Vorgeschlagener Betrag (SOL)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={payLinkPresetAmount}
                    onChange={(e) => setPayLinkPresetAmount(e.target.value)}
                    placeholder="0.5"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Fertiger Private Pay-Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={payLinkUrl}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#09090d] border border-zinc-800 text-zinc-300 font-mono text-xs truncate"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy("paylink", payLinkUrl, "Pay-Link")}
                    className="px-4 py-2.5 rounded-xl ember-btn-primary text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedId === "paylink" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Kopieren
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-[#09090d] border border-zinc-800/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">
                    X-Bio Text zum Kopieren
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy("xbio", xBioSnippet, "X-Bio Text")}
                    className="text-xs text-[#ff8533] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Kopieren
                  </button>
                </div>
                <p className="text-xs text-zinc-400 font-mono break-all leading-relaxed">
                  {xBioSnippet}
                </p>
              </div>
            </div>

            {/* QR Preview Card */}
            <div className="lg:col-span-2 ember-hero-card rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#ff8533] mb-1">
                Private Receive Card
              </div>
              <div className="font-display text-xl font-bold text-white mb-5">
                @{xHandle || "sunveil"}
              </div>
              <QrCode value={payLinkUrl} size={190} />
              <div className="mt-5 text-xs text-zinc-400 max-w-[240px]">
                Scannen oder Link öffnen, um{" "}
                <span className="text-white font-semibold">
                  {payLinkPresetAmount || "beliebige"} SOL
                </span>{" "}
                vertraulich über Helius Privacy Rings zu senden.
              </div>
              <div className="mt-4 px-3 py-1 rounded-full bg-black/50 border border-[#ff5500]/30 font-mono text-[11px] text-[#ff944d]">
                {shortAddr(unlocked.profile.solanaAddress, 6, 6)}
              </div>

              <div className="mt-5 w-full flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadPayCard()}
                  disabled={payCardBusy}
                  className="w-full py-2.5 px-4 rounded-xl ember-btn-primary text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ImageDown className="w-4 h-4 shrink-0" />
                  {payCardBusy ? "Erstelle PNG-Karte…" : "Pay-Card als PNG herunterladen"}
                </button>
                <a
                  href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                    `Pay me privately on Solana — amount encrypted via @Helius Privacy Rings 🌘\n\n${payLinkUrl}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#ff8533]" />
                  Direkt auf X teilen
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: SECURITY & HELIUS ================= */}
        {tab === "security" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Helius Live Connection (Devnet & Mainnet-Beta) */}
            <div className="ember-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ff5500]/15 border border-[#ff5500]/35 flex items-center justify-center text-[#ff7a29]">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Helius Netzwerk (Devnet &amp; Mainnet-Beta)
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Unified RPC + Photon Indexer + TEE Groth16 Prover
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                Hol dir kostenlos einen API-Key unter{" "}
                <a
                  href="https://dashboard.helius.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#ff8533] hover:underline inline-flex items-center gap-0.5"
                >
                  dashboard.helius.dev
                  <ExternalLink className="w-3 h-3" />
                </a>
                . Der Key wird nur lokal in deinem Browser gespeichert und aktiviert echte
                Solana-Privacy-Rings-Transaktionen auf Devnet oder Mainnet-Beta.
              </p>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Helius API-Key (Devnet &amp; Mainnet)
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNetworkMode("demo");
                    showToast("ok", "Sandbox Demo-Modus aktiv.");
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    networkMode === "demo"
                      ? "bg-[#ff5500]/18 border-[#ff5500]/50 text-[#ff944d]"
                      : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                  }`}
                >
                  Sandbox Demo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      saveApiKey(apiKeyInput);
                      if (apiKeyInput.trim()) {
                        sessionRef.current = null;
                        setNetworkMode("devnet");
                        showToast("ok", "Helius API-Key gespeichert — verbinde mit Devnet…");
                      } else {
                        setNetworkMode("demo");
                        showToast("ok", "API-Key entfernt — zurück im Sandbox Demo-Modus.");
                      }
                    } catch (err) {
                      showToast("err", sanitizeErrorMessage(err, "Ungültiger API-Key."));
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    networkMode === "devnet"
                      ? "bg-emerald-500/18 border-emerald-500/50 text-emerald-300"
                      : "ember-btn-primary text-white border-transparent"
                  }`}
                >
                  Helius Devnet
                </button>
                <button
                  type="button"
                  onClick={requestMainnetSwitch}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    networkMode === "mainnet"
                      ? "bg-rose-500/20 border-rose-500/55 text-rose-200"
                      : "bg-rose-950/35 hover:bg-rose-950/60 border-rose-500/35 text-rose-200"
                  }`}
                >
                  Mainnet-Beta ⚡
                </button>
              </div>
            </div>

            {/* Non-Custodial Keys & Selective Disclosure */}
            <div className="ember-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/12 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Non-Custodial Keys &amp; Viewing Key
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Nur auf deinem Gerät · Selective Disclosure fähig
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#09090d] border border-zinc-800/90">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span>Öffentliche Solana-Adresse</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy("sec-sol", unlocked.profile.solanaAddress, "Solana-Adresse")
                      }
                      className="text-[#ff8533] hover:underline cursor-pointer"
                    >
                      Kopieren
                    </button>
                  </div>
                  <div className="font-mono text-zinc-200 break-all">
                    {unlocked.profile.solanaAddress}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#09090d] border border-zinc-800/90">
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span>Viewing Public Key (Read-Only · z. B. Steuer/Audit)</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy("sec-vk", unlocked.profile.viewingPublicKeyHex, "Viewing Key")
                      }
                      className="text-[#ff8533] hover:underline cursor-pointer"
                    >
                      Kopieren
                    </button>
                  </div>
                  <div className="font-mono text-zinc-300 break-all text-[11px]">
                    {unlocked.profile.viewingPublicKeyHex}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/25 overflow-hidden space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-red-300">
                    <span className="font-semibold">Privater Ed25519 Seed (Geheim!)</span>
                    {!unlocked.isEphemeral && (
                      <button
                        type="button"
                        onClick={() => {
                          if (revealedSeed) {
                            setRevealedSeed(null);
                          } else {
                            setSeedRevealError(null);
                            setSeedRevealPromptOpen((v) => !v);
                          }
                        }}
                        className="text-xs text-red-300 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {revealedSeed ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        {revealedSeed ? "Verbergen" : "Anzeigen"}
                      </button>
                    )}
                  </div>

                  {unlocked.isEphemeral ? (
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Du bist in einer temporären Sandbox-Session ohne gespeicherten Tresor.
                      Erstelle eine Passwort-geschützte Wallet, bevor du echte Devnet-SOL nutzt.
                    </p>
                  ) : revealedSeed ? (
                    <>
                      <div className="font-mono text-[11px] text-red-200/90 break-all [overflow-wrap:anywhere]">
                        {revealedSeed}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy("sec-seed", revealedSeed, "Geheimer Seed", {
                            clearAfterMs: 30_000,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-[11px] text-red-300 hover:text-white cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Seed für Backup kopieren (auto-clear nach 30 Sek.)
                      </button>
                    </>
                  ) : seedRevealPromptOpen ? (
                    <form onSubmit={handleRevealSeedSubmit} className="space-y-2">
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={seedPasswordInput}
                        onChange={(e) => setSeedPasswordInput(e.target.value)}
                        placeholder="Tresor-Passwort zur Bestätigung…"
                        className="w-full px-3 py-2 rounded-lg bg-[#09090d] border border-red-500/35 focus:border-red-400 focus:outline-none text-white text-xs"
                      />
                      {seedRevealError && (
                        <div className="text-[11px] text-red-300">{seedRevealError}</div>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={seedRevealBusy || !seedPasswordInput}
                          className="flex-1 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {seedRevealBusy ? "Prüfe…" : "Für 30 Sek. entsperren"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSeedRevealPromptOpen(false);
                            setSeedPasswordInput("");
                            setSeedRevealError(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs cursor-pointer"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="font-mono text-[11px] text-red-200/90 tracking-widest break-words select-none opacity-80">
                      •••• •••• •••• •••• •••• •••• •••• ••••
                    </div>
                  )}
                </div>
              </div>

              {!confirmWipe ? (
                <button
                  type="button"
                  onClick={() => setConfirmWipe(true)}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {unlocked.isEphemeral ? "Sandbox beenden & neue Wallet erstellen" : "Lokale Wallet löschen"}
                </button>
              ) : (
                <div className="p-3.5 rounded-2xl bg-red-950/35 border border-red-500/40 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2 text-red-200">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Wirklich löschen?</strong> Dein lokaler Tresor wird dauerhaft entfernt.
                      Ohne Seed-Backup ist kein Zugriff mehr möglich!
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedSeed(null);
                        clearStoredVault();
                        onResetVault();
                      }}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer"
                    >
                      Ja, unwiderruflich löschen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>SUNVEIL · 100 % Non-Custodial Open-Source Interface</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLegalOpen(true)}
            className="hover:text-zinc-200 transition cursor-pointer"
          >
            Terms &amp; Zero-Data Privacy
          </button>
          <span>·</span>
          <a
            href="https://github.com/sunveilsol/sunveil-wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-200 transition"
          >
            GitHub
          </a>
        </div>
      </footer>

      <WalletConnectModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        connected={connectedWallet}
        onConnected={(w) => {
          setConnectedWallet(w);
          showToast("ok", `${w.name} verbunden (${shortAddr(w.address, 4, 4)}).`);
        }}
        onDisconnected={() => {
          setConnectedWallet(null);
          showToast("ok", "Externe Wallet getrennt.");
        }}
        sunveilVaultAddress={unlocked.profile.solanaAddress}
        heliusApiKey={apiKeyInput}
      />

      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} lang="de" />

      {confirmMainnetModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setConfirmMainnetModal(false)}
          >
            <div
              className="ember-card w-full max-w-md rounded-3xl p-6 space-y-5 relative border border-rose-500/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">
                      Mainnet-Beta aktivieren?
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Echtes Solana Mainnet · Helius Privacy Rings
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmMainnetModal(false)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                  aria-label="Schließen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                <p>
                  Auf <strong className="text-white">Mainnet-Beta</strong> werden{" "}
                  <strong className="text-rose-300">echte SOL</strong> über Helius Solana Privacy
                  Rings bewegt. Bitte stelle sicher:
                </p>
                <ul className="space-y-1.5 text-zinc-400 list-disc pl-4">
                  <li>Du hast deinen geheimen Ed25519-Seed sicher offline gesichert.</li>
                  <li>
                    Das Protokoll befindet sich in der frühen Mainnet-Beta — teste zuerst mit
                    kleinen Beträgen (z. B. 0,05 SOL).
                  </li>
                  <li>Alle Signaturen erfolgen 100 % lokal in deinem Browser (Self-Custody).</li>
                </ul>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmMainnetModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Auf Devnet bleiben
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sessionRef.current = null;
                    setConfirmMainnetModal(false);
                    setNetworkMode("mainnet");
                    setTab("vault");
                    showToast("ok", "Mainnet-Beta aktiviert — verbinde mit Helius Mainnet…");
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer shadow-[0_0_24px_rgba(225,29,72,0.35)]"
                >
                  Mainnet-Beta starten
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
