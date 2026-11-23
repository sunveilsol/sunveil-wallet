import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
  lang?: "de" | "en";
}

export function LegalModal({ open, onClose, lang = "de" }: LegalModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isDe = lang === "de";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="ember-card w-full max-w-xl rounded-3xl p-6 space-y-5 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#ff7a1a]" />
            <h2 className="font-display text-lg font-bold text-white">
              {isDe
                ? "Nutzungsbedingungen & Zero-Data Datenschutz"
                : "Terms of Use & Zero-Data Privacy Notice"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-zinc-300 leading-relaxed">
          <section className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-2">
            <h3 className="font-semibold text-white">
              {isDe ? "1. 100 % Non-Custodial Open-Source Interface" : "1. 100% Non-Custodial Open-Source Interface"}
            </h3>
            <p className="text-zinc-400">
              {isDe
                ? "SUNVEIL ist eine rein clientseitige Open-Source-Weboberfläche. Wir verwahren niemals Kundengelder, haben keinen Zugriff auf Private Keys, Seed-Phrasen oder Passwörter und können Transaktionen weder ausführen noch rückgängig machen. Alle Schlüssel werden lokal in deinem Browser erzeugt und mit AES-256-GCM verschlüsselt."
                : "SUNVEIL is a strictly client-side open-source web interface. We never hold user funds, never have access to private keys, seed phrases, or passwords, and cannot initiate or reverse transactions. All keys are generated locally in your browser and encrypted with AES-256-GCM."}
            </p>
          </section>

          <section className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-2">
            <h3 className="font-semibold text-white">
              {isDe ? "2. Beta-Hinweis (Nutzung auf eigene Verantwortung)" : "2. Beta Software (Use at Your Own Risk)"}
            </h3>
            <p className="text-zinc-400">
              {isDe
                ? "SUNVEIL befindet sich in der frühen öffentlichen Entwicklung (Sandbox, Solana Devnet & Mainnet-Beta) und wird ohne Gewährleistung („as-is“) bereitgestellt. Bewahre dein Backup sicher offline auf. Keine Anlage-, Steuer- oder Rechtsberatung."
                : "SUNVEIL is early-stage public software (Sandbox, Solana Devnet & Mainnet-Beta) provided 'as-is' without warranties of any kind. Always keep your own backups safely offline. Nothing in this app constitutes financial, tax, or legal advice."}
            </p>
          </section>

          <section className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-2">
            <h3 className="font-semibold text-white">
              {isDe ? "3. Privacy-First Datenschutz" : "3. Privacy-First Data Policy"}
            </h3>
            <p className="text-zinc-400">
              {isDe
                ? "SUNVEIL setzt keine Werbe-Cookies, kein Cross-Site-Tracking und speichert niemals Private Keys, Wallet-Adressen oder Transaktionsdaten auf eigenen Servern. Für rein aggregierte, anonyme Seitenaufruf-Statistiken nutzt die Website cookiefreie Vercel Web Analytics (ohne personenbezogene Profile). Lokale Einstellungen (verschlüsselter Tresor, Handle, optionaler Helius API-Key) liegen ausschließlich im LocalStorage deines Geräts. Bei Devnet-/Mainnet-Nutzung kommuniziert dein Browser direkt mit Solana- bzw. Helius-RPC-Endpunkten."
                : "SUNVEIL uses zero advertising cookies, zero cross-site tracking, and never stores private keys, wallet addresses, or transaction data on our servers. The site uses cookieless, privacy-friendly Vercel Web Analytics solely for aggregated anonymous page-view counts (no personal profiles). Local preferences (encrypted vault, handle, optional Helius API key) reside exclusively in your browser's LocalStorage. When using Devnet or Mainnet-Beta, your browser communicates directly with Solana or Helius RPC endpoints."}
            </p>
          </section>

          <section className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-2">
            <h3 className="font-semibold text-white">
              {isDe ? "4. Unabhängiges Community-Projekt" : "4. Independent Community Project"}
            </h3>
            <p className="text-zinc-400">
              {isDe
                ? "SUNVEIL wird unabhängig auf Basis des offenen Helius Solana Privacy Rings Protokolls entwickelt und ist kein offizielles Produkt von Helius Labs, Phantom, Solflare oder Solana Labs."
                : "SUNVEIL is built independently on the public Helius Solana Privacy Rings protocol and is not officially affiliated with Helius Labs, Phantom, Solflare, or Solana Labs."}
            </p>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl ember-btn-primary text-white text-xs font-semibold cursor-pointer"
        >
          {isDe ? "Verstanden" : "Got it"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
