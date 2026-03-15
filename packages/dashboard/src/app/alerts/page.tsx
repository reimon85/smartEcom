'use client';

import { useEffect, useState, useCallback } from 'react';
import { alertsApi, type StockAlert } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';

export default function AlertsPage() {
  const [active, setActive] = useState<StockAlert[]>([]);
  const [history, setHistory] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'history' | 'check'>('active');

  // Manual check form
  const [checkForm, setCheckForm] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ triggered: number; checked: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, histRes] = await Promise.all([
        alertsApi.getActive(),
        alertsApi.getHistory(50),
      ]);
      if (activeRes.success) setActive(activeRes.data);
      if (histRes.success) setHistory(histRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleResolve = async (id: number) => {
    setResolving(id);
    try {
      const res = await alertsApi.resolve(id);
      if (res.success) {
        setActive((a) => a.filter((al) => al.id !== id));
        fetchData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setResolving(null);
    }
  };

  const handleManualCheck = async () => {
    if (!checkForm.trim()) return;
    setChecking(true);
    setError(null);
    setCheckResult(null);
    try {
      // Parse the JSON input
      const products = JSON.parse(checkForm);
      const res = await alertsApi.check(Array.isArray(products) ? products : [products]);
      if (res.success) {
        setCheckResult({ triggered: res.data.triggered, checked: res.data.checked });
        if (res.data.triggered > 0) {
          fetchData();
          setTab('active');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check failed — ensure input is valid JSON');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alertas de Stock</h1>
        <p className="text-sm text-slate-500 mt-1">
          Copy de urgencia generado por IA para productos con bajo stock
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{active.filter((a) => a.alert_type === 'critical_low').length}</p>
          <p className="text-xs text-slate-500 mt-1">Stock Crítico</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{active.filter((a) => a.alert_type === 'low_stock').length}</p>
          <p className="text-xs text-slate-500 mt-1">Stock Bajo</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{active.filter((a) => a.alert_type === 'out_of_stock').length}</p>
          <p className="text-xs text-slate-500 mt-1">Sin Stock</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['active', 'history', 'check'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'active' ? `Alertas Activas (${active.length})` : t === 'history' ? 'Historial' : 'Revisión Manual'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Active Alerts */}
      {tab === 'active' && (
        <div className="space-y-4">
          {loading && [...Array(2)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse h-48" />
          ))}
          {!loading && active.length === 0 && (
            <div className="card p-12 text-center">
              <div className="text-3xl mb-3">✓</div>
              <p className="font-medium text-slate-700">No hay alertas de stock activas</p>
              <p className="text-sm text-slate-400 mt-1">Todos los productos están por encima del umbral.</p>
            </div>
          )}
          {active.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
              resolving={resolving === alert.id}
            />
          ))}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card p-8 text-center text-slate-400 text-sm">Sin historial de alertas aún.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Stock</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((alert) => (
                    <tr key={alert.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700 max-w-xs truncate">{alert.product_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={alert.alert_type} /></td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className={alert.current_stock === 0 ? 'text-red-600 font-bold' : alert.current_stock <= 3 ? 'text-red-500 font-semibold' : 'text-amber-600'}>
                          {alert.current_stock}
                        </span>
                        <span className="text-slate-400"> / {alert.threshold}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={alert.is_active ? 'active' : 'completed'} label={alert.is_active ? 'Activa' : 'Resuelta'} />
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Check */}
      {tab === 'check' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-slate-800">Revisión Manual de Stock</h2>
          <p className="text-sm text-slate-500">
            Pega un array JSON de productos a revisar. Los que estén por debajo del umbral generarán alertas automáticamente.
          </p>

          <div>
            <label className="label">Productos JSON *</label>
            <textarea
              className="input font-mono text-xs min-h-[180px] resize-none"
              placeholder={`[
  {
    "name": "Teclado Inalámbrico",
    "shopify_product_id": "shopify_8001",
    "current_stock": 3,
    "threshold": 10,
    "category": "Electronics"
  }
]`}
              value={checkForm}
              onChange={(e) => setCheckForm(e.target.value)}
            />
          </div>

          {checkResult && (
            <div className={`p-3 rounded-lg border text-sm ${checkResult.triggered > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              Revisados {checkResult.checked} productos. {checkResult.triggered} alerta(s) generada(s).
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleManualCheck}
            disabled={checking || !checkForm.trim()}
          >
            {checking ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Revisando...
              </>
            ) : 'Ejecutar Revisión'}
          </button>
        </div>
      )}
    </div>
  );
}

interface AlertCardProps {
  alert: StockAlert;
  onResolve: (id: number) => void;
  resolving: boolean;
}

function AlertCard({ alert, onResolve, resolving }: AlertCardProps) {
  const [copyTab, setCopyTab] = useState<'email' | 'sms' | 'push' | 'internal'>('email');
  const copy = alert.ai_copy;

  const stockPct = Math.min(100, (alert.current_stock / alert.threshold) * 100);

  return (
    <div className="card overflow-hidden border-l-4 border-l-red-400">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={alert.alert_type} size="md" />
              <span className="text-xs text-slate-400">#{alert.id}</span>
            </div>
            <h3 className="font-semibold text-slate-800 truncate">{alert.product_name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {alert.shopify_product_id && `ID: ${alert.shopify_product_id} · `}
              Activada {new Date(alert.created_at).toLocaleString()}
            </p>
          </div>
          <button
            className="btn-secondary text-xs py-1.5 px-3 ml-4 flex-shrink-0"
            onClick={() => onResolve(alert.id)}
            disabled={resolving}
          >
            {resolving ? '...' : 'Marcar Resuelto'}
          </button>
        </div>

        {/* Stock bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Stock Actual</span>
            <span className="font-semibold text-red-600">
              {alert.current_stock} / {alert.threshold} (umbral)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${stockPct}%` }}
            />
          </div>
        </div>

        {/* Copy tabs */}
        {copy && (
          <div>
            <div className="flex gap-1 mb-3 border-b border-slate-100">
              {(['email', 'sms', 'push', 'internal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCopyTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                    copyTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                  }`}
                >
                  {t === 'internal' ? 'Internal' : t.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              {copyTab === 'email' && (
                <>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Asunto:</span>
                    <p className="text-slate-700 font-medium mt-0.5">{copy.email_subject}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Preencabezado:</span>
                    <p className="text-slate-600 mt-0.5">{copy.email_preheader || copy.email_body?.slice(0, 90) || '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">Cuerpo:</span>
                    <p className="text-slate-700 mt-0.5 leading-relaxed">{copy.email_body}</p>
                  </div>
                </>
              )}
              {copyTab === 'sms' && (
                <p className="text-slate-700">{copy.sms}</p>
              )}
              {copyTab === 'push' && (
                <p className="text-slate-700">{copy.push_notification}</p>
              )}
              {copyTab === 'internal' && (
                <>
                  <p className="text-slate-700">{copy.internal_alert}</p>
                  {copy.recommended_action && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2">
                      <span className="text-xs font-semibold text-blue-600">Acción Recomendada: </span>
                      <span className="text-xs text-blue-700">{copy.recommended_action}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
