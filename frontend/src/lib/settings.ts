const STORAGE_KEY = 'wso-settings';

export interface AppSettings {
  w1: number;
  w2: number;
  w3: number;
  velocityDays: number;
  cartCapacityKg: number;
}

const DEFAULTS: AppSettings = {
  w1: 0.5,
  w2: 0.35,
  w3: 0.15,
  velocityDays: 90,
  cartCapacityKg: 50,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function defaultWeights(): Pick<AppSettings, 'w1' | 'w2' | 'w3'> {
  const { w1, w2, w3 } = loadSettings();
  return { w1, w2, w3 };
}
