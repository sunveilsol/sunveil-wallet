import { useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  KeyRound,
  Link2,
  Lock,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { InstallAppButton } from "./InstallAppButton";
import { LegalModal } from "./LegalModal";

interface LandingPageProps {
  onLaunchApp: () => void;
  hasExistingVault: boolean;
}

const X_URL = "https://x.com/SunVeilSol";

const COPY = {
  de: {
    navFeatures: "Features",
    navPrivacy: "Privatsphäre",
    navRoadmap: "Roadmap",
    launchBtn: "Wallet öffnen",
    unlockBtn: "Tresor entsperren",
    badge: "Gebaut auf Helius Solana Privacy Rings · Devnet & Sandbox Live",
    heroTitle1: "Private Solana.",
    heroTitle2: "Zero Custody.",
    heroSub:
      "Die Obsidian & Neon-Orange Pocket-Wallet für vertrauliche Solana-Zahlungen, verschlüsselte Guthaben und private X Pay-Links. 100 % lokal — kein Server sieht jemals deine Keys.",
    ctaPrimary: "Web-App starten (Sandbox & Devnet)",
    ctaSecondary: "Folge @SunVeilSol auf X",
    stat1Val: "192 Bytes",
    stat1Lbl: "Groth16 ZK-Proof onchain",
    stat2Val: "0 Keys",
    stat2Lbl: "Auf unseren Servern gespeichert",
    stat3Val: "~140k CU",
    stat3Lbl: "Native Solana-Transaktion",
    featuresTitle: "Warum SUNVEIL?",
    featuresSub:
      "Entwickelt für alle, die Privatsphäre auf Solana ohne hässliche 2021-Browser-Extensions wollen.",
    f1Title: "100 % Non-Custodial Tresor",
    f1Body:
      "Signing-, Nullifier- und Viewing-Key werden per @heliuslabs/spr direkt in deinem Browser erzeugt und lokal mit AES-256-GCM verschlüsselt.",
    f2Title: "Verschlüsselte Transfers (Groth16)",
    f2Body:
      "Schütze Public SOL in verschlüsselte UTXOs. Bei privaten Transfers bleiben Beträge & Asset-Typen onchain verborgen.",
    f3Title: "Private X Pay-Links & QR-Cards",
    f3Body:
      "Pack deinen persönlichen Pay-Link in deine X-Bio. Erhalte Freelance-Zahlungen, Bounties & Tips, ohne dein Einkommen auf Solscan zu zeigen.",
    compareTitle: "Public Solana vs. SUNVEIL",
    compareSub: "Klare Fakten statt leerer Versprechen — so arbeitet der Default Privacy Ring:",
    colMetric: "Eigenschaft",
    colPublic: "Normales Solana",
    colSunveil: "SUNVEIL (Privacy Ring)",
    rows: [
      ["Transfer-Betrag", "Öffentlich auf Solscan", "Onchain verschlüsselt (Groth16)"],
      ["Asset-Typ (SOL / SPL)", "Öffentlich sichtbar", "Onchain verschlüsselt"],
      ["Kontostand (Shielded)", "Für jeden einsehbar", "Nur mit Viewing Key lesbar"],
      ["Steuer / Audit-Nachweis", "Alles oder nichts", "Read-Only Viewing Key exportierbar"],
      ["Key-Hoheit", "Self-Custodial", "100 % Lokal im Browser (AES-256)"],
    ],
    roadmapTitle: "Öffentliche Roadmap",
    roadmapSub: "Produkt zuerst. Schritt für Schritt im öffentlichen Build auf @SunVeilSol.",
    phases: [
      {
        tag: "LIVE · PHASE 1",
        title: "Obsidian Pocket-Wallet & Sandbox",
        items: [
          "Lokaler AES-256-GCM Tresor (@heliuslabs/spr)",
          "Shield, vertrauliches Senden & Unshield auf Devnet",
          "Private X Pay-Links mit Neon-Orange QR-Card",
          "1-Klick Privacy Blur & Viewing Key Export",
        ],
        active: true,
      },
      {
        tag: "IN ARBEIT · PHASE 2",
        title: "Mainnet & Wallet-Top-Up",
        items: [
          "1-Klick Aufladen direkt aus Phantom & Solflare",
          "Solana Mainnet-Beta Freischaltung",
          "Kurze Wunsch-Handles (sunveil.pay/@name)",
          "Mobile PWA-App für iOS & Android",
        ],
        active: false,
      },
      {
        tag: "GEPLANT · PHASE 3",
        title: "Private USDC & Team-Payroll",
        items: [
          "Vertrauliche USDC & SPL / Token-2022 Balances",
          "Confidential CSV-Multisend für Teams & DAOs",
          "Exportierbare Steuer- & Buchhaltungsbelege",
          "Custom Policy Rings für Business-Nutzer",
        ],
        active: false,
      },
    ],
    bottomCtaTitle: "Bereit für privates Solana?",
    bottomCtaSub:
      "Teste SUNVEIL sofort kostenlos im Sandbox-Modus oder mit deinem eigenen Helius Devnet API-Key.",
    footerDisclaimer:
      "Unabhängige Community-Web-App gebaut auf dem offenen Helius Solana Privacy Rings Protokoll. Nicht offiziell mit Helius Labs verbunden.",
  },
  en: {
    navFeatures: "Features",
    navPrivacy: "Privacy",
    navRoadmap: "Roadmap",
    launchBtn: "Launch App",
    unlockBtn: "Unlock Vault",
    badge: "Built on Helius Solana Privacy Rings · Devnet & Sandbox Live",
    heroTitle1: "Private Solana.",
    heroTitle2: "Zero Custody.",
    heroSub:
      "The obsidian & neon-orange pocket wallet for confidential Solana payments, encrypted balances, and private X pay links. 100% client-side — zero keys ever touch a server.",
    ctaPrimary: "Launch Web App (Sandbox & Devnet)",
    ctaSecondary: "Follow @SunVeilSol on X",
    stat1Val: "192 Bytes",
    stat1Lbl: "Groth16 ZK proof onchain",
    stat2Val: "0 Keys",
    stat2Lbl: "Stored on any backend",
    stat3Val: "~140k CU",
    stat3Lbl: "Native Solana settlement",
    featuresTitle: "Why SUNVEIL?",
    featuresSub:
      "Crafted for people who want native Solana privacy without clunky 2021 browser extensions.",
    f1Title: "100% Non-Custodial Vault",
    f1Body:
      "Signing, nullifier, and viewing keys are derived strictly inside your browser via @heliuslabs/spr and encrypted locally with AES-256-GCM.",
    f2Title: "Confidential Transfers (Groth16)",
    f2Body:
      "Shield public SOL into encrypted UTXOs. Private transfer amounts and asset types remain encrypted onchain.",
    f3Title: "Private X Pay Links & QR Cards",
    f3Body:
      "Put your personal pay link in your X bio. Receive freelance payments, bounties, and tips without broadcasting amounts on Solscan.",
    compareTitle: "Public Solana vs. SUNVEIL",
    compareSub: "Clear facts, zero hype — how the Default Privacy Ring works:",
    colMetric: "Property",
    colPublic: "Standard Solana",
    colSunveil: "SUNVEIL (Privacy Ring)",
    rows: [
      ["Transfer Amount", "Public on Solscan", "Encrypted onchain (Groth16)"],
      ["Asset Type (SOL / SPL)", "Publicly visible", "Encrypted onchain"],
      ["Shielded Balance", "Visible to everyone", "Decryptable only with Viewing Key"],
      ["Tax / Audit Proof", "All or nothing", "Read-only Viewing Key export"],
      ["Key Custody", "Self-custodial", "100% Local in-browser (AES-256)"],
    ],
    roadmapTitle: "Public Roadmap",
    roadmapSub: "Product first. Building transparently in public on @SunVeilSol.",
    phases: [
      {
        tag: "LIVE · PHASE 1",
        title: "Obsidian Pocket Wallet & Sandbox",
        items: [
          "Local AES-256-GCM browser vault (@heliuslabs/spr)",
          "Shield, confidential send & unshield on Devnet",
          "Private X Pay Links with neon-orange QR cards",
          "One-click Privacy Blur & Viewing Key export",
        ],
        active: true,
      },
      {
        tag: "NEXT · PHASE 2",
        title: "Mainnet & Wallet Top-Up",
        items: [
          "1-click top-up directly from Phantom & Solflare",
          "Solana Mainnet-Beta activation",
          "Short vanity handles (sunveil.pay/@you)",
          "Installable Mobile PWA for iOS & Android",
        ],
        active: false,
      },
      {
        tag: "PLANNED · PHASE 3",
        title: "Private USDC & Team Payroll",
        items: [
          "Confidential USDC & SPL / Token-2022 balances",
          "Private CSV batch payouts for teams & DAOs",
          "Exportable Viewing-Key receipts for accounting",
          "Custom Policy Rings for business workflows",
        ],
        active: false,
      },
    ],
    bottomCtaTitle: "Ready to encrypt your Solana?",
    bottomCtaSub:
      "Try SUNVEIL instantly in zero-risk Sandbox mode or connect your own free Helius Devnet API key.",
    footerDisclaimer:
      "Independent community web app built on the open Helius Solana Privacy Rings protocol. Not affiliated with Helius Labs.",
  },
} as const;

export function LandingPage({ onLaunchApp, hasExistingVault }: LandingPageProps) {
  const [lang, setLang] = useState<"de" | "en">(() =>
    typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("de")
      ? "de"
      : "en",
  );
  const [legalOpen, setLegalOpen] = useState(false);
  const t = COPY[lang];

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Ambient top glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[520px] rounded-full bg-[#ff5500]/14 blur-[140px]" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#070709]/80 border-b border-[#ff5500]/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6a00] to-[#c93700] ember-ring-glow flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-[#09090d] ring-2 ring-white/90" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">
              SUNVEIL
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition">
              {t.navFeatures}
            </a>
            <a href="#privacy" className="hover:text-white transition">
              {t.navPrivacy}
            </a>
            <a href="#roadmap" className="hover:text-white transition">
              {t.navRoadmap}
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#ff8533] hover:text-[#ffaa66] transition"
            >
              @SunVeilSol
              <ExternalLink className="w-3 h-3" />
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {/* DE / EN Toggle */}
            <div className="inline-flex p-0.5 rounded-lg bg-[#0d0d12] border border-zinc-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLang("de")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  lang === "de" ? "bg-[#ff5500]/20 text-[#ff8533]" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                DE
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  lang === "en" ? "bg-[#ff5500]/20 text-[#ff8533]" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onLaunchApp}
              className="px-4 py-2 rounded-xl ember-btn-primary text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {hasExistingVault ? t.unlockBtn : t.launchBtn}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ff5500]/12 border border-[#ff5500]/35 text-[#ff944d] text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t.badge}</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-white leading-[1.05]">
              {t.heroTitle1}{" "}
              <span className="bg-gradient-to-r from-[#ff6a00] via-[#ff8c33] to-[#ff4800] bg-clip-text text-transparent">
                {t.heroTitle2}
              </span>
            </h1>

            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-xl">
              {t.heroSub}
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={onLaunchApp}
                className="px-6 py-3.5 rounded-2xl ember-btn-primary text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                {t.ctaPrimary}
                <ArrowRight className="w-4 h-4" />
              </button>

              <InstallAppButton lang={lang} />

              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3.5 rounded-2xl bg-[#111117] hover:bg-[#171720] border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-200 text-sm font-semibold flex items-center gap-2 transition"
              >
                <span>{t.ctaSecondary}</span>
                <ExternalLink className="w-4 h-4 text-[#ff7a29]" />
              </a>
            </div>

            {/* Key Technical Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-zinc-800/70 max-w-lg">
              <div>
                <div className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t.stat1Val}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{t.stat1Lbl}</div>
              </div>
              <div>
                <div className="font-display text-xl sm:text-2xl font-bold text-[#ff7a29]">
                  {t.stat2Val}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{t.stat2Lbl}</div>
              </div>
              <div>
                <div className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t.stat3Val}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{t.stat3Lbl}</div>
              </div>
            </div>
          </div>

          {/* Right Hero Showcase Card */}
          <div className="lg:col-span-5">
            <div className="ember-hero-card rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#ff5500]/25 bg-[#070709]">
                <img
                  src="/og-card.png"
                  alt="SUNVEIL Obsidian Privacy Wallet"
                  className="w-full h-auto block"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-[#09090d]/90 border border-zinc-800/90 p-3.5">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    AES-256-GCM
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Client-Side Vault
                  </div>
                </div>
                <div className="rounded-2xl bg-[#09090d]/90 border border-zinc-800/90 p-3.5">
                  <div className="flex items-center gap-1.5 text-[#ff8533] font-semibold mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    Groth16 Native
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Single Solana Tx
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            {t.featuresTitle}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mt-2.5">{t.featuresSub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: KeyRound, title: t.f1Title, body: t.f1Body },
            { icon: Lock, title: t.f2Title, body: t.f2Body },
            { icon: Link2, title: t.f3Title, body: t.f3Body },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="ember-card rounded-3xl p-6 space-y-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#ff5500]/14 border border-[#ff5500]/35 flex items-center justify-center text-[#ff8533]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  {feat.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{feat.body}</p>
              </div>
            );
          })}
        </div>

        {/* Visual Banners Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="ember-card rounded-3xl p-4 overflow-hidden">
            <img
              src="/privacy-rings.png"
              alt="Zero-Knowledge Privacy Ring Architecture"
              className="w-full h-56 object-cover rounded-2xl border border-zinc-800/80"
            />
          </div>
          <div className="ember-card rounded-3xl p-4 overflow-hidden">
            <img
              src="/paylinks.png"
              alt="SUNVEIL Private X Pay Links"
              className="w-full h-56 object-cover rounded-2xl border border-zinc-800/80"
            />
          </div>
        </div>
      </section>

      {/* Privacy Comparison Table */}
      <section id="privacy" className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-14">
        <div className="ember-card rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Eye className="w-5 h-5 text-[#ff7a29]" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {t.compareTitle}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mb-6">{t.compareSub}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-3 pr-4 font-semibold">{t.colMetric}</th>
                  <th className="py-3 px-4 font-semibold">{t.colPublic}</th>
                  <th className="py-3 pl-4 font-semibold text-[#ff8533]">{t.colSunveil}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {t.rows.map(([metric, pub, sun]) => (
                  <tr key={metric}>
                    <td className="py-3.5 pr-4 font-medium text-zinc-200">{metric}</td>
                    <td className="py-3.5 px-4 text-zinc-500">{pub}</td>
                    <td className="py-3.5 pl-4 text-emerald-300 font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#ff6a00] shrink-0" />
                      <span>{sun}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="roadmap" className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            {t.roadmapTitle}
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mt-2.5">{t.roadmapSub}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.phases.map((phase) => (
            <div
              key={phase.tag}
              className={`rounded-3xl p-6 space-y-4 ${
                phase.active ? "ember-hero-card" : "ember-card"
              }`}
            >
              <div
                className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  phase.active
                    ? "bg-[#ff5500]/20 text-[#ff944d] border border-[#ff5500]/45"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                }`}
              >
                {phase.tag}
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                {phase.title}
              </h3>
              <ul className="space-y-2.5 text-xs text-zinc-300">
                {phase.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        phase.active ? "text-[#ff6a00]" : "text-zinc-600"
                      }`}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-20">
        <div className="ember-hero-card rounded-3xl p-8 sm:p-10 text-center space-y-5">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            {t.bottomCtaTitle}
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            {t.bottomCtaSub}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onLaunchApp}
              className="px-7 py-3.5 rounded-2xl ember-btn-primary text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              {t.ctaPrimary}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-zinc-300">SUNVEIL</span>
            <span>·</span>
            <span>{t.footerDisclaimer}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setLegalOpen(true)}
              className="text-zinc-400 hover:text-white font-medium transition-colors cursor-pointer"
            >
              {lang === "de" ? "Terms & Datenschutz" : "Terms & Privacy"}
            </button>
            <span className="text-zinc-700">·</span>
            <a
              href="https://github.com/sunveilsol/sunveil-wallet"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-white font-medium transition-colors"
            >
              GitHub (Open Source)
            </a>
            <span className="text-zinc-700">·</span>
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[#ff8533] hover:text-[#ffaa66] font-medium"
            >
              x.com/SunVeilSol
            </a>
          </div>
        </div>
      </footer>

      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} lang={lang} />
    </div>
  );
}
