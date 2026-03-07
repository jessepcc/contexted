import { createContext, useContext } from 'react';
import type { BootstrapResponse } from './types.js';

export type AppState = {
  serverNow: string;
  match: BootstrapResponse['match'];
  drop: BootstrapResponse['drop'];
};

export type AppContextValue = {
  appState: AppState | null;
  setAppState: (state: AppState) => void;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppContext.Provider');
  if (!ctx.appState) throw new Error('appState not yet initialized');
  return ctx.appState;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContext.Provider');
  return ctx;
}
