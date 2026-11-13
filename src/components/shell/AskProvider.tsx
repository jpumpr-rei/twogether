"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import AIChatSheet from "@/components/ai/AIChatSheet";

type AskContextValue = { open: () => void };

const AskContext = createContext<AskContextValue | null>(null);

/** Lets any screen (and the centre button of the nav) open the assistant. */
export function AskProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <AskContext.Provider value={value}>
      {children}
      {isOpen ? <AIChatSheet onClose={() => setIsOpen(false)} /> : null}
    </AskContext.Provider>
  );
}

export function useAsk(): AskContextValue {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error("useAsk must be used inside <AskProvider>");
  return ctx;
}
