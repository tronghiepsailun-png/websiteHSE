"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ContainerContext = createContext<HTMLDivElement | null>(null);
const SetContainerContext = createContext<(el: HTMLDivElement | null) => void>(() => {});

/** Wraps the whole app shell so a deeply-nested page (e.g. the Incidents 5-tab bar) can render
 *  content into a fixed slot in the persistent top header, instead of inline in the scrollable
 *  page body — the slot's DOM node survives client-side navigation between pages that share
 *  this layout, so content placed there doesn't shift/reset when switching tabs. */
export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <SetContainerContext.Provider value={setContainer}>
      <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>
    </SetContainerContext.Provider>
  );
}

/** Renders the actual slot element inside the header markup. */
export function HeaderSlotOutlet({ className }: { className?: string }) {
  const setContainer = useContext(SetContainerContext);
  return <div ref={setContainer} className={className} />;
}

/** Portals `children` into the header slot. Renders nothing until the outlet has mounted. */
export function HeaderSlotContent({ children }: { children: ReactNode }) {
  const container = useContext(ContainerContext);
  if (!container) return null;
  return createPortal(children, container);
}
