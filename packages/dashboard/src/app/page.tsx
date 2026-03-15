'use client';

import { useEffect, useState, useCallback } from 'react';
import { metricsApi, type DashboardMetrics, type ROIData, type HistoryMetric } from '@/lib/api';
import KPICard from '@/components/ui/KPICard';
import ActivityFeed from '@/components/ui/ActivityFeed';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const POLL_INTERVAL = 30_000; // 30 seconds

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [history, setHistory] = useState<HistoryMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [metricsRes, roiRes, historyRes] = await Promise.all([
        metricsApi.getDashboard(),
        metricsApi.getROI(),
        metricsApi.getHistory(14),
      ]);
      if (metricsRes.success) setMetrics(metricsRes.data);
      if (roiRes.success) setRoi(roiRes.data);
      if (historyRes.success) setHistory(historyRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const today = metrics?.today;
  const week = metrics?.week;
  const live = metrics?.live;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline de Automatización IA</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Métricas en tiempo real de tu e-commerce automatizado
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block" />
            Auto-refresh every 30s
          </div>
          {lastUpdated && (
            <div className="text-xs text-slate-400 mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Live status strip */}
      {live && (
        <div className="flex gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{live.pending_reviews}</span>
            <span className="text-blue-600 dark:text-blue-400">reseñas esperando aprobación</span>
          </div>
          <div className="w-px bg-blue-200" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{live.active_alerts}</span>
            <span className="text-blue-600 dark:text-blue-400">alertas de stock activas</span>
          </div>
          <div className="w-px bg-blue-200" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{live.running_jobs}</span>
            <span className="text-blue-600 dark:text-blue-400">trabajos en lote en curso</span>
          </div>
        </div>
      )}

      {/* Today's KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
          Hoy
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Descripciones Generadas"
            value={today?.descriptions_generated ?? 0}
            subtitle="Texto SEO optimizado"
            color="blue"
            loading={loading}
            icon={<span className="text-sm">✦</span>}
            trend={{ value: `${(today?.descriptions_generated ?? 0) * 14.5}m`, label: 'ahorrados vs manual' }}
          />
          <KPICard
            title="Reseñas Procesadas"
            value={today?.reviews_processed ?? 0}
            subtitle="Sentimiento + respuesta IA"
            color="purple"
            loading={loading}
            icon={<span className="text-sm">✉</span>}
            trend={{ value: `${(today?.reviews_processed ?? 0) * 18}m`, label: 'ahorrados vs manual' }}
          />
          <KPICard
            title="Alertas de Stock"
            value={today?.alerts_sent ?? 0}
            subtitle="Copy multicanal generado"
            color="amber"
            loading={loading}
            icon={<span className="text-sm">⚡</span>}
          />
          <KPICard
            title="Productos Categorizados"
            value={today?.categories_processed ?? 0}
            subtitle="Con puntuación de confianza"
            color="emerald"
            loading={loading}
            icon={<span className="text-sm">◉</span>}
          />
        </div>
      </div>

      {/* Cost + Time Savings row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KPICard
          title="Coste IA Hoy"
          value={today ? `$${today.estimated_cost}` : '$0.0000'}
          subtitle="Tokens GPT-4o-mini"
          color="blue"
          loading={loading}
        />
        <KPICard
          title="Ahorro en Mano de Obra Hoy"
          value={today ? `$${today.cost_saved.toFixed(2)}` : '$0.00'}
          subtitle="vs proceso manual @ $25/h"
          color="emerald"
          loading={loading}
          trend={
            today?.cost_saved
              ? {
                  value: `${today.time_saved_minutes}m`,
                  label: 'ahorrados hoy',
                  positive: true,
                }
              : undefined
          }
        />
        <KPICard
          title="Ahorro Últimos 7 Días"
          value={week ? `$${week.cost_saved.toFixed(2)}` : '$0.00'}
          subtitle={`vs $${week?.estimated_cost || '0'} en costes IA`}
          color="emerald"
          loading={loading}
          trend={
            week
              ? {
                  value: `${(week.time_saved_minutes / 60).toFixed(1)}h`,
                  label: 'ahorradas esta semana',
                  positive: true,
                }
              : undefined
          }
        />
      </div>

      {/* ROI + Activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ROI Widget */}
        <div className="card p-6 space-y-4 col-span-1">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Calculadora de ROI</h3>
          {roi ? (
            <>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Tiempo Total Ahorrado</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {roi.summary.total_time_saved_hours}h
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Ahorro en Mano de Obra</span>
                  <span className="text-sm font-semibold text-emerald-700">
                    ${roi.summary.labor_cost_saved.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Coste IA</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    ${roi.summary.ai_cost.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ahorro Neto</span>
                  <span className="text-sm font-bold text-emerald-600">
                    ${roi.summary.net_savings.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                {parseFloat(roi.summary.roi_percentage) > 9999 ? (
                  <>
                    <div className="text-2xl font-bold text-emerald-700">+9.999%</div>
                    <div className="text-xs text-emerald-600">ROI sobre inversión en IA</div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-emerald-700">{roi.summary.roi_percentage}%</div>
                    <div className="text-xs text-emerald-600">ROI sobre inversión en IA</div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="animate-pulse space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="card p-6 col-span-2">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Actividad Reciente</h3>
          <ActivityFeed
            items={metrics?.recentActivity || []}
            loading={loading}
          />
        </div>
      </div>

      {/* History Chart */}
      {history.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-6">Actividad — Últimos 14 Días</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => new Date(v).toLocaleDateString('es', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelFormatter={(v) => new Date(v).toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="descriptions_generated"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Descripciones"
              />
              <Line
                type="monotone"
                dataKey="reviews_processed"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Reseñas"
              />
              <Line
                type="monotone"
                dataKey="alerts_sent"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Alertas"
              />
              <Line
                type="monotone"
                dataKey="categories_processed"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Categorizados"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
