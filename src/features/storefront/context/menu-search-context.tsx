"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

interface MenuSearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launcherRef: RefObject<HTMLButtonElement | null>;
}

const MenuSearchContext = createContext<MenuSearchContextValue | null>(null);

/** Shares the catalog search overlay state between the header launcher and the catalog view. */
export function MenuSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const value = useMemo(() => ({ open, setOpen, launcherRef }), [open]);
  return <MenuSearchContext.Provider value={value}>{children}</MenuSearchContext.Provider>;
}

export function useMenuSearchOptional(): MenuSearchContextValue | null {
  return useContext(MenuSearchContext);
}
