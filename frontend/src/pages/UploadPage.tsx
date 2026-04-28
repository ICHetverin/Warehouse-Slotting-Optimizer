import { useState, useEffect } from 'react';
import { DropZone } from '../components/Upload/DropZone';
import { api } from '../api/client';
import type { Warehouse } from '../types';

type Step = 'warehouse' | 'layout' | 'skus' | 'orders' | 'done';

interface StepResult {
  label: string;
  count: number;
}

export function UploadPage() {
  const [step, setStep]               = useState<Step>('warehouse');
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([]);
  const [selectedWh, setSelectedWh]   = useState<number | null>(null);
  const [newWhName, setNewWhName]     = useState('');
  const [results, setResults]         = useState<StepResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    api.listWarehouses().then(r => setWarehouses(r.data)).catch(() => {});
  }, []);

  const err = (msg: string) => { setError(msg); setLoading(false); };
  const ok  = (label: string, count: number) => {
    setResults(prev => [...prev, { label, count }]);
    setError(null);
    setLoading(false);
  };

  // ── Step 1: select or create warehouse ─────────────────────────────────────
  const handleWarehouse = async () => {
    if (selectedWh) { setStep('layout'); return; }
    if (!newWhName.trim()) { setError('Enter a warehouse name'); return; }
    setLoading(true);
    try {
      const res = await api.createWarehouse({
        name: newWhName.trim(),
        rows: 25, columns: 20,
        dockX: 0, dockY: 0,
        aisleWidthM: 1.5,
      });
      setSelectedWh(res.data.id);
      setWarehouses(prev => [...prev, res.data]);
      setStep('layout');
    } catch { err('Failed to create warehouse'); }
  };

  // ── Step 2–4: upload files ─────────────────────────────────────────────────
  const upload = async (
    file: File,
    fn: (wid: number, f: File) => ReturnType<typeof api.uploadLayout>,
    label: string,
    next: Step,
  ) => {
    if (!selectedWh) return;
    setLoading(true);
    try {
      const res = await fn(selectedWh, file);
      ok(label, res.data.imported);
      setStep(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      err(msg);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Import Data</h1>
      <p className="text-sm text-gray-500 mb-8">
        Upload your warehouse layout, SKU catalog, and order history to start scoring.
      </p>

      {/* Progress bar */}
      <StepBar current={step} />

      {/* Results so far */}
      {results.length > 0 && (
        <div className="mb-6 space-y-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-green-700">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" />
              </svg>
              <span>{r.label}: <strong>{r.count.toLocaleString()}</strong> records imported</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step panels */}
      {step === 'warehouse' && (
        <Panel title="1. Select or create warehouse">
          {warehouses.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Existing warehouses</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={selectedWh ?? ''}
                onChange={e => setSelectedWh(Number(e.target.value) || null)}
              >
                <option value="">— create new —</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          {!selectedWh && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New warehouse name</label>
              <input
                type="text"
                placeholder="e.g. Main Warehouse — Kiev"
                value={newWhName}
                onChange={e => setNewWhName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWarehouse()}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <button
            onClick={handleWarehouse}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Creating…' : selectedWh ? 'Continue →' : 'Create & continue →'}
          </button>
        </Panel>
      )}

      {step === 'layout' && (
        <Panel title="2. Upload warehouse layout">
          <p className="text-sm text-gray-500 mb-4">
            CSV format: <code>slot_label, row, col, level, zone, capacity_kg</code>
          </p>
          <DropZone
            label="Drop layout.csv here"
            hint="slot_label,row,col,level,zone,capacity_kg"
            disabled={loading}
            onFile={f => upload(f, api.uploadLayout.bind(api), 'Layout', 'skus')}
          />
        </Panel>
      )}

      {step === 'skus' && (
        <Panel title="3. Upload SKU catalog">
          <p className="text-sm text-gray-500 mb-4">
            CSV format: <code>code, name, weight_kg, volume_m3, category</code>
          </p>
          <DropZone
            label="Drop skus.csv here"
            hint="code,name,weight_kg,volume_m3,category"
            disabled={loading}
            onFile={f => upload(f, api.uploadSkus.bind(api), 'SKUs', 'orders')}
          />
        </Panel>
      )}

      {step === 'orders' && (
        <Panel title="4. Upload order history">
          <p className="text-sm text-gray-500 mb-4">
            CSV format: <code>order_id, sku_code, quantity, timestamp</code>
          </p>
          <DropZone
            label="Drop orders.csv here"
            hint="order_id,sku_code,quantity,timestamp"
            disabled={loading}
            onFile={f => upload(f, api.uploadOrders.bind(api), 'Orders', 'done')}
          />
        </Panel>
      )}

      {step === 'done' && (
        <Panel title="All done!">
          <p className="text-sm text-gray-600 mb-4">
            Your data is loaded. Go to <strong>Scoring</strong> to generate placement recommendations.
          </p>
          <a href="/scoring" className="btn-primary block text-center w-full">
            Run Scoring →
          </a>
        </Panel>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'layout',    label: 'Layout'    },
  { id: 'skus',      label: 'SKUs'      },
  { id: 'orders',    label: 'Orders'    },
  { id: 'done',      label: 'Done'      },
];

const STEP_ORDER: Step[] = STEPS.map(s => s.id);

function StepBar({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <div className={[
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
            i < idx  ? 'bg-green-500 text-white'
            : i === idx ? 'bg-brand-600 text-white'
            : 'bg-gray-200 text-gray-500',
          ].join(' ')}>
            {i < idx ? '✓' : i + 1}
          </div>
          <span className={[
            'ml-1 text-xs hidden sm:block',
            i === idx ? 'text-brand-700 font-semibold' : 'text-gray-400',
          ].join(' ')}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className={[
              'flex-1 h-0.5 mx-2',
              i < idx ? 'bg-green-400' : 'bg-gray-200',
            ].join(' ')} />
          )}
        </div>
      ))}
    </div>
  );
}
