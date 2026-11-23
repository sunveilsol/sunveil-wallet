import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallAppButtonProps {
  lang?: "de" | "en";
  compact?: boolean;
}

export function InstallAppButton({
  lang = "de",
  compact = false,
}: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!showGuide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGuide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showGuide]);

  if (isStandalone) return null;

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  }

  const label = lang === "de" ? "App installieren" : "Install App";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? "h-9 px-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#ff5500]/45 text-zinc-300 hover:text-[#ff8533] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
            : "inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-[#111116] hover:bg-[#17171f] border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-200 text-sm font-semibold transition cursor-pointer"
        }
        title={label}
      >
        {compact ? (
          <Smartphone className="w-4 h-4 shrink-0" />
        ) : (
          <Download className="w-4 h-4 text-[#ff7a1a] shrink-0" />
        )}
        <span className={compact ? "hidden md:inline" : ""}>{label}</span>
      </button>

      {showGuide &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="ember-card w-full max-w-md rounded-3xl p-6 space-y-5 shadow-[0_32px_90px_rgba(0,0,0,0.9)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/icon-192.png"
                    alt="SUNVEIL App Icon"
                    className="w-11 h-11 rounded-2xl border border-[#ff5500]/45 shadow-[0_0_24px_rgba(255,85,0,0.3)] shrink-0"
                  />
                  <div>
                    <h3 className="font-display font-bold text-white text-lg leading-tight">
                      {lang === "de" ? "SUNVEIL als App installieren" : "Install SUNVEIL App"}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      iOS · Android · Desktop PWA (0 € · kein App Store)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-300">
                <div className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-1">
                  <div className="font-semibold text-[#ff8a3d]">iPhone / iPad (Safari)</div>
                  <p className="text-zinc-400 leading-relaxed">
                    {lang === "de"
                      ? "Tippe unten auf das Teilen-Symbol (↑) und wähle „Zum Home-Bildschirm hinzufügen“."
                      : "Tap the Share icon (↑) in Safari, then choose 'Add to Home Screen'."}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#09090d] border border-zinc-800/90 space-y-1">
                  <div className="font-semibold text-[#ff8a3d]">
                    Android &amp; Desktop (Chrome / Brave)
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    {lang === "de"
                      ? "Tippe oben rechts auf das Browser-Menü (⋮) oder das Install-Symbol in der Adressleiste → „App installieren“."
                      : "Open the browser menu (⋮) or click the Install icon in the address bar → 'Install App'."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-3 rounded-2xl ember-btn-primary text-white text-sm font-semibold cursor-pointer"
              >
                {lang === "de" ? "Alles klar" : "Got it"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
