import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface Ctx {
  editing: boolean;
  setEditing: (v: boolean) => void;
}

const LayoutEditCtx = createContext<Ctx>({ editing: false, setEditing: () => undefined });

export function LayoutEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const value = useMemo(() => ({ editing, setEditing }), [editing]);
  return <LayoutEditCtx.Provider value={value}>{children}</LayoutEditCtx.Provider>;
}

export const useLayoutEdit = (): Ctx => useContext(LayoutEditCtx);
