'use client';

import { useState, useRef } from 'react';
import { categorizationApi, type CategorizationResult, type BatchJob } from '@/lib/api';
import BatchJobProgress from '@/components/ui/BatchJobProgress';
import StatusBadge from '@/components/ui/StatusBadge';

interface ResultItem {
  name: string;
  result: CategorizationResult;
}

const CATEGORIES = [
  'Electronics', 'Clothing', 'Home & Garden', 'Beauty',
  'Sports', 'Food & Beverage', 'Books', 'Toys', 'Automotive', 'Other',
];

export default function CategorizationPage() {
  const [form, setForm] = useState({ name: '', description: '', attributes: '' });
  const [categorizing, setCategorizing] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [completedJob, setCompletedJob] = useState<BatchJob | null>(null);
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCategorize = async () => {
    if (!form.name.trim()) return;
    setCategorizing(true);
    setError(null);
    try {
      let attrs: Record<string, string> | undefined;
      if (form.attributes.trim()) {
        try {
          attrs = JSON.parse(form.attributes);
        } catch {
          attrs = {};
          form.attributes.split(',').forEach((pair) => {
            const [k, ...v] = pair.split(':');
            if (k && v.length) attrs![k.trim()] = v.join(':').trim();
          });
        }
      }

      const res = await categorizationApi.categorize({
        name: form.name,
        description: form.description || undefined,
        attributes: attrs,
      });

      if (res.success) {
        setResults((prev) => [{ name: form.name, result: res.data }, ...prev]);
        setForm({ name: '', description: '', attributes: '' });
      } else {
        setError(res.error || 'Categorization failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCategorizing(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await categorizationApi.uploadCSV(file);
      if (res.success && res.data.jobId) {
        setActiveJobId(res.data.jobId);
        setTab('batch');
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-emerald-600';
    if (confidence >= 0.7) return 'text-amber-600';
    return 'text-red-500';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Categorización de Productos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Categorización con IA y puntuación de confianza — procesa cientos de productos en minutos
        </p>
      </div>

      {/* Category overview */}
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.slice(0, 5).map((cat) => (
          <div key={cat} className="card p-3 text-center">
            <p className="text-xs font-medium text-slate-600">{cat}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['single', 'batch'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'single' ? 'Producto Individual' : 'Carga Masiva / CSV'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {tab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Categorizar un Producto</h2>

            <div>
              <label className="label">Nombre del Producto *</label>
              <input
                className="input"
                placeholder="ej. Auriculares Bluetooth con Cancelación de Ruido"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleCategorize()}
              />
            </div>

            <div>
              <label className="label">Descripción (opcional)</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Descripción opcional del producto para mejorar la precisión"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Atributos (opcional)</label>
              <input
                className="input"
                placeholder="color: Negro, material: Plástico, inalámbrico: true"
                value={form.attributes}
                onChange={(e) => setForm((f) => ({ ...f, attributes: e.target.value }))}
              />
            </div>

            <button
              className="btn-primary w-full justify-center"
              onClick={handleCategorize}
              disabled={categorizing || !form.name.trim()}
            >
              {categorizing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Categorizando...
                </>
              ) : 'Categorizar Producto'}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {results.length === 0 ? (
              <div className="card p-8 text-center text-slate-400 text-sm">
                Los resultados aparecerán aquí tras la categorización.
              </div>
            ) : (
              results.map((item, idx) => (
                <div key={idx} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.result.tokens.total} tokens · ${item.result.cost.toFixed(5)}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${confidenceColor(item.result.confidence)}`}>
                      {(item.result.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {item.result.category}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                      {item.result.subcategory}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {item.result.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {item.result.reasoning && (
                    <p className="text-xs text-slate-500 italic">{item.result.reasoning}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload dropzone */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Carga Masiva por CSV</h2>
            <p className="text-sm text-slate-500">
              Columna requerida: <code className="bg-slate-100 px-1 rounded">name</code>
              <br />
              Opcional: <code className="bg-slate-100 px-1 rounded">description</code> y cualquier columna de atributos
            </p>

            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-4xl mb-3">📊</div>
              <p className="text-sm font-medium text-slate-600">Arrastra un CSV aquí o haz clic para explorar</p>
              <p className="text-xs text-slate-400 mt-1">Hasta 1.000 productos, máx. 10MB</p>
              <input
                type="file"
                accept=".csv,text/csv"
                ref={fileRef}
                className="hidden"
                onChange={handleCSVUpload}
              />
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Ejemplo de Formato CSV</p>
              <pre className="text-xs text-slate-500 font-mono">
{`name,description,brand,material
Yoga Pants,High-waist leggings,Lululemon,Spandex
Coffee Maker,12-cup drip,Cuisinart,Stainless`}
              </pre>
            </div>

            {activeJobId && (
              <BatchJobProgress
                jobId={activeJobId}
                pollFn={categorizationApi.getBatchStatus}
                label="Lote de Categorización"
                onComplete={(job) => setCompletedJob(job)}
              />
            )}

            {completedJob && (
              <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                Lote completado: {completedJob.processed} productos categorizados, {completedJob.errors} errores.
              </div>
            )}
          </div>

          {/* Speed info */}
          <div className="space-y-4">
            <div className="card p-6 space-y-4">
              <h3 className="font-semibold text-slate-800">Rendimiento</h3>
              <div className="space-y-3">
                {[
                  { count: 10, time: '~8s', manual: '30min' },
                  { count: 50, time: '~30s', manual: '2.5h' },
                  { count: 100, time: '~60s', manual: '5h' },
                  { count: 500, time: '~5min', manual: '25h' },
                ].map(({ count, time, manual }) => (
                  <div key={count} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{count} productos</span>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-600 font-semibold">{time} AI</span>
                      <span className="text-slate-400">vs</span>
                      <span className="text-slate-500">{manual} manual</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6 space-y-3">
              <h3 className="font-semibold text-slate-800">Categorías Disponibles</h3>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                    {cat}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
