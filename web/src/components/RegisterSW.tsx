"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable as a PWA
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app works fine without the service worker
      });
    }
  }, []);
  return null;
}
