import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ScoringWeights } from '../types';

const STORAGE_KEY = 'wso.defaultWeights';
const DEFAULT: ScoringWeights = { w1: 0.5, w2: 0.35, w3: 0.15, decayLambda: 0.03, useAbcXyz: true };

interface WeightsContextValue {
  weights: ScoringWeights;
  setWeights: (w: ScoringWeights) => void;
}

const WeightsContext = createContext<WeightsContextValue | null>(null);

function load(): ScoringWeights {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT;
}

/**
 * Active scoring weights shared by Scoring / Recommendations / Tuning, persisted
 * to localStorage. Auto-tuning writes the best weights here so every screen
 * immediately uses them ("apply everywhere").
 */
export function WeightsProvider({ children }: { children: ReactNode }) {
  const [weights, setWeightsState] = useState<ScoringWeights>(load);

  const setWeights = useCallback((w: ScoringWeights) => {
    setWeightsState(w);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ weights, setWeights }), [weights, setWeights]);
  return <WeightsContext.Provider value={value}>{children}</WeightsContext.Provider>;
}

export function useWeights(): WeightsContextValue {
  const ctx = useContext(WeightsContext);
  if (!ctx) throw new Error('useWeights must be used within WeightsProvider');
  return ctx;
}
