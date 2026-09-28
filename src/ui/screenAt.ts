import { createContext, useContext, type ReactNode } from 'react';
import type { Origin } from './nav';

/* Renders any screen at a given origin, for the copy that shows under the finger during
   an edge swipe back. The app shell provides it from its own route table, so a pushed
   screen can show whichever screen it really came from without importing every screen. */
export const ScreenAtContext = createContext<((o: Origin) => ReactNode) | null>(
  null,
);

export const useScreenAt = () => useContext(ScreenAtContext);
