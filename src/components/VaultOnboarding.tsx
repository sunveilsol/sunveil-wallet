import { useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
} from "lucide-react";
import type { EncryptedVaultRecord } from "../types";
import {
  clearStoredVault,
  createKeypairFromSecretHex,
  decryptVault,
  encryptAndSaveVault,
  shortAddr,
  type UnlockedWallet,
} from "../lib/vault";

interface VaultOnboardingProps {
  existingVault: EncryptedVaultRecord | null;
  onUnlocked: (wallet: UnlockedWallet) => void;
  onVaultCleared: () => void;
  onBackToLanding?: () => void;
}

export function VaultOnboarding({
  existingVault,
  onUnlocked,
  onVaultCleared,
  onBackToLanding,
}: VaultOnboardingProps) {
  const [mode, setMode] = useState<"create" | "import">("create");
  const [password, setPassword] = useState("");
  const [importHex, setImportHex] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!existingVault) return;
    setError(null);
    setBusy(true);
    try {
      const secretHex = await decryptVault(existingVault, password);
      const unlocked = await createKeypairFromSecretHex(secretHex);
      onUnlocked(unlocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entsperren fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOrImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 4) {
      setError("Bitte wähle mindestens 4 Zeichen für dein lokales Tresor-Passwort.");
      return;
    }
    setBusy(true);
    try {
      const unlocked = await createKeypairFromSecretHex(
        mode === "import" ? importHex : undefined,
      );
      await encryptAndSaveVault(
        unlocked.profile.secretKeyHex,
        unlocked.profile.solanaAddress,
        password,
      );
      onUnlocked(unlocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickStart() {
    setError(null);
    setBusy(true);
    try {
      const unlocked = await createKeypairFromSecretHex();
      await encryptAndSaveVault(
        unlocked.profile.secretKeyHex,
        unlocked.profile.solanaAddress,
        "sunveil-devnet",
      );
      onUnlocked(unlocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Subtle decorative glow rings */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-[#ff5500]/12 blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#ff8533] transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Zurück zur Startseite
          </button>
        )}
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff6a00] to-[#c93700] ember-ring-glow mb-5 relative">
            <div className="w-8 h-8 rounded-full bg-[#09090d] ring-2 ring-white/90 shadow-[0_0_16px_rgba(255,255,255,0.6)]" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff5500]/10 border border-[#ff5500]/30 text-[#ff8533] text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Helius Solana Privacy Rings
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">
            SUNVEIL
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-sm mx-auto">
            Deine private Solana Pocket-Wallet im Obsidian-Look. Verschlüsselte Guthaben &amp; X Pay-Links – 100 % Non-Custodial.
          </p>
        </div>

        {/* Main Card */}
        <div className="ember-card rounded-3xl p-6 sm:p-7">
          {existingVault ? (
            <form onSubmit={handleUnlock} className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Tresor entsperren</h2>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {shortAddr(existingVault.solanaAddress, 6, 6)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#ff5500]/12 border border-[#ff5500]/30 flex items-center justify-center text-[#ff7a29]">
                  <Lock className="w-5 h-5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Lokales Tresor-Passwort
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Passwort eingeben…"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white placeholder:text-zinc-600 text-sm transition"
                />
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 rounded-xl ember-btn-primary text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                {busy ? "Entschlüssele lokal…" : "Wallet entsperren"}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearStoredVault();
                  onVaultCleared();
                }}
                className="w-full py-2.5 rounded-xl text-xs text-zinc-500 hover:text-red-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Lokalen Tresor zurücksetzen &amp; neue Wallet erstellen
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Toggle */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-[#09090d] border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setMode("create");
                    setError(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    mode === "create"
                      ? "bg-[#ff5500]/18 text-[#ff8533] border border-[#ff5500]/35"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Neue Wallet erstellen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("import");
                    setError(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    mode === "import"
                      ? "bg-[#ff5500]/18 text-[#ff8533] border border-[#ff5500]/35"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Seed importieren
                </button>
              </div>

              <form onSubmit={handleCreateOrImport} className="space-y-4">
                {mode === "import" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Ed25519 Secret Seed (64 Hex-Zeichen)
                    </label>
                    <input
                      type="password"
                      value={importHex}
                      onChange={(e) => setImportHex(e.target.value)}
                      placeholder="64-stelliger Hex-Seed…"
                      className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white placeholder:text-zinc-600 text-xs font-mono transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">
                    Tresor-Passwort festlegen (AES-256-GCM lokal)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mind. 4 Zeichen…"
                    className="w-full px-4 py-3 rounded-xl bg-[#09090d] border border-zinc-800 focus:border-[#ff5500] focus:outline-none text-white placeholder:text-zinc-600 text-sm transition"
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3.5 py-2.5">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 rounded-xl ember-btn-primary text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {busy
                    ? "Generiere Shielded Keypair…"
                    : mode === "create"
                      ? "Private Wallet lokal erzeugen"
                      : "Wallet importieren & verschlüsseln"}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-800/80" />
                <span className="mx-3 text-[11px] uppercase tracking-wider text-zinc-500">
                  oder sofort testen
                </span>
                <div className="flex-grow border-t border-zinc-800/80" />
              </div>

              <button
                type="button"
                onClick={handleQuickStart}
                disabled={busy}
                className="w-full py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                1-Klick Sandbox starten (Demo-Passwort: <span className="font-mono text-[#ff8533]">sunveil-devnet</span>)
              </button>
            </div>
          )}

          {/* Non-Custodial Guarantee Footer */}
          <div className="mt-6 pt-5 border-t border-zinc-800/70 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-medium">100 % Non-Custodial:</span>{" "}
              Dein Signing-, Nullifier- und Viewing-Key werden per{" "}
              <span className="font-mono text-[#ff8533]">@heliuslabs/spr</span> direkt in deinem
              Browser erzeugt und lokal mit AES-256-GCM verschlüsselt. Kein Server sieht jemals deine Keys.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
