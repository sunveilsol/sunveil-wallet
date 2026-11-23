import { useEffect, useState } from "react";
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
            ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-300 hover:text-[#ff8533] text-xs font-medium transition cursor-pointer"
            : "inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-[#111116] hover:bg-[#17171f] border border-zinc-800 hover:border-[#ff5500]/40 text-zinc-200 text-sm font-semibold transition cursor-pointer"
        }
        title={label}
      >
        {compact ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-4 h-4 text-[#ff7a1a]" />}
        <span className={compact ? "hidden md:inline" : ""}>{label}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="ember-card w-full max-w-sm rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icon-192.png"
                  alt="SUNVEIL App Icon"
                  className="w-10 h-10 rounded-xl border border-[#ff5500]/40"
                />
                <div>
                  <h3 className="font-display font-bold text-white text-base">
                    {lang === "de" ? "SUNVEIL als App installieren" : "Install SUNVEIL App"}
                  </h3>
                  <p className="text-[11px] text-zinc-400">iOS · Android · Desktop PWA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-[#09090d] border border-zinc-800/90">
                <div className="font-semibold text-[#ff8a3d] mb-1">iPhone / iPad (Safari)</div>
                <p className="text-zinc-400">
                  {lang === "de"
                    ? "Tippe unten auf das Teilen-Symbol (↑) und dann auf „Zum Home-Bildschirm“."
                    : "Tap the Share icon (↑) in Safari, then tap 'Add to Home Screen'."}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#09090d] border border-zinc-800/90">
                <div className="font-semibold text-[#ff8a3d] mb-1">Android / Desktop (Chrome & Brave)</div>
                <p className="text-zinc-400">
                  {lang === "de"
                    ? "Klicke im Browser-Menü (⋮) oder in der Adressleiste auf „App installieren“."
                    : "Open the browser menu (⋮) or address bar icon and choose 'Install App'."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl ember-btn-primary text-white text-xs font-semibold cursor-pointer"
            >
              {lang === "de" ? "Alles klar" : "Got it"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
