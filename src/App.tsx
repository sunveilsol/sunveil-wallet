import { useState } from "react";
import { loadEncryptedVault, type UnlockedWallet } from "./lib/vault";
import { LandingPage } from "./components/LandingPage";
import { VaultOnboarding } from "./components/VaultOnboarding";
import { MainWalletApp } from "./components/MainWalletApp";

function shouldOpenAppDirectly(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("pay") || window.location.hash === "#app";
}

export function App() {
  const [storedVault, setStoredVault] = useState(() => loadEncryptedVault());
  const [unlocked, setUnlocked] = useState<UnlockedWallet | null>(null);
  const [view, setView] = useState<"landing" | "app">(() =>
    shouldOpenAppDirectly() ? "app" : "landing",
  );

  if (view === "landing" && !unlocked) {
    return (
      <LandingPage
        hasExistingVault={storedVault !== null}
        onLaunchApp={() => {
          window.history.replaceState(null, "", "#app");
          setView("app");
        }}
      />
    );
  }

  if (!unlocked) {
    return (
      <VaultOnboarding
        existingVault={storedVault}
        onBackToLanding={() => {
          window.history.replaceState(null, "", window.location.pathname);
          setView("landing");
        }}
        onUnlocked={(w) => {
          setStoredVault(loadEncryptedVault());
          setUnlocked(w);
        }}
        onVaultCleared={() => {
          setStoredVault(null);
        }}
      />
    );
  }

  return (
    <MainWalletApp
      unlocked={unlocked}
      onBackToLanding={() => {
        unlocked.keypair.destroy();
        setUnlocked(null);
        setStoredVault(loadEncryptedVault());
        window.history.replaceState(null, "", window.location.pathname);
        setView("landing");
      }}
      onLock={() => {
        unlocked.keypair.destroy();
        setUnlocked(null);
        setStoredVault(loadEncryptedVault());
      }}
      onResetVault={() => {
        unlocked.keypair.destroy();
        setUnlocked(null);
        setStoredVault(null);
      }}
    />
  );
}
export default App;
