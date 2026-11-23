import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import { App } from "./App";

// Prevent pinch-to-zoom & double-tap zoom on mobile / iOS PWA for native app feel
const preventZoom = (e: Event) => e.preventDefault();
document.addEventListener("gesturestart", preventZoom, { passive: false });
document.addEventListener("gesturechange", preventZoom, { passive: false });
document.addEventListener("gestureend", preventZoom, { passive: false });
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  },
  { passive: false },
);

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration is optional; fail silently
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
