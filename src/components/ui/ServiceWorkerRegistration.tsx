"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // updateViaCache: "none" makes the browser always revalidate sw.js itself.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(console.error);
    }
  }, []);

  return null;
}
