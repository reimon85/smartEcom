'use client';

import { useState, useRef } from 'react';
import { descriptionsApi, type ProductDescription, type BatchJob } from '@/lib/api';
import BatchJobProgress from '@/components/ui/BatchJobProgress';

interface GeneratedItem {
  name: string;
  result: ProductDescription;
  timestamp: Date;
}

export default function ProductsPage() {
  const [form, setForm] = useState({ name: '', category: '', attributes: '' });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [completedJob, setCompletedJob] = useState<BatchJob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!form.name.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      let attrs: Record<string, string> = {};
      if (form.attributes.trim()) {
        // Parse "key: value, key2: value2" format or raw JSON
        try {
          attrs = JSON.parse(form.attributes);
        } catch {
          form.attributes.split(',').forEach((pair) => {
            const [k, ...v] = pair.split(':');
            if (k && v.length) attrs[k.trim()] = v.join(':').trim();
          });
        }
      }
      const res = await descriptionsApi.generate({
        name: form.name,
        category: form.category || undefined,
        attributes: Object.keys(attrs).length ? attrs : undefined,
      });
      if (res.success) {
        setGenerated((prev) => [{ name: form.name, result: res.data, timestamp: new Date() }, ...prev]);
        setForm({ name: '', category: '', attributes: '' });
      } else {
        setError(res.error || 'Generation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const res = await descriptionsApi.uploadCSV(file);
      if (res.success && res.data.jobId) {
        setActiveJobId(res.data.jobId);
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Descriptions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate SEO-optimized product descriptions — 100 products in ~2 minutes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Single generation form */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Generate Single Description</h2>

          <div>
            <label className="label">Product Name *</label>
            <input
              className="input"
              placeholder="e.g. Ultra-Slim Wireless Keyboard"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Select category...</option>
              {['Electronics', 'Clothing', 'Home & Garden', 'Beauty', 'Sports', 'Food & Beverage', 'Books', 'Toys', 'Automotive', 'Other'].map(
                (c) => <option key={c} value={c}>{c}</option>,
              )}
            </select>
          </div>

          <div>
            <label className="label">Attributes (optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder={'color: Blue, material: Aluminum, weight: 500g\nor paste JSON: {"color":"Blue"}'}
              value={form.attributes}
              onChange={(e) => setForm((f) => ({ ...f, attributes: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">
              Comma-separated key: value pairs, or JSON object
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <button
            className="btn-primary w-full justify-center"
            onClick={handleGenerate}
            disabled={generating || !form.name.trim()}
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Description'
            )}
          </button>
        </div>

        {/* Batch CSV upload */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Batch CSV Upload</h2>
          <p className="text-sm text-slate-500">
            Upload a CSV file with columns: <code className="bg-slate-100 px-1 rounded">name</code>,{' '}
            <code className="bg-slate-100 px-1 rounded">category</code>, and any attribute columns.
          </p>

          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-medium text-slate-600">Click to upload CSV</p>
            <p className="text-xs text-slate-400 mt-1">Up to 500 products, 10MB max</p>
            <input
              type="file"
              accept=".csv,text/csv"
              ref={fileRef}
              className="hidden"
              onChange={handleCSVUpload}
            />
          </div>

          {activeJobId && (
            <BatchJobProgress
              jobId={activeJobId}
              pollFn={descriptionsApi.getBatchStatus}
              label="Description Batch"
              onComplete={(job) => setCompletedJob(job)}
            />
          )}

          {completedJob && (
            <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              Batch complete: {completedJob.processed} descriptions generated, {completedJob.errors} errors.
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Speed Benchmark</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• 10 products: ~12 seconds</li>
              <li>• 100 products: ~2 minutes</li>
              <li>• Parallel batches of 10 for max throughput</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Generated descriptions list */}
      {generated.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800">Generated This Session ({generated.length})</h2>
          {generated.map((item, idx) => (
            <DescriptionCard key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionCard({ item }: { item: GeneratedItem }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div>
          <p className="font-medium text-slate-800">{item.result.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {item.timestamp.toLocaleTimeString()} •{' '}
            <span className="text-blue-600">{item.result.tokens.total} tokens</span> •{' '}
            <span className="text-slate-500">${item.result.cost.toFixed(5)}</span>
          </p>
        </div>
        <span className="text-slate-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Meta Description
            </p>
            <p className="text-sm text-slate-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
              {item.result.meta_description}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {item.result.meta_description.length} chars (max 160)
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Full Description
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {item.result.full_description}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Bullet Points
            </p>
            <ul className="space-y-1">
              {item.result.bullet_points.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Keywords
            </p>
            <div className="flex flex-wrap gap-2">
              {item.result.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
