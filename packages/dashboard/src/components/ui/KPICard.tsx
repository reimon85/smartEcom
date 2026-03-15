'use client';

import clsx from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    label: string;
    positive?: boolean;
  };
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  loading?: boolean;
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  red: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  purple: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="w-10 h-10 bg-slate-200 rounded-lg" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center border',
              colorMap[color],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={clsx(
              'text-xs font-semibold',
              trend.positive !== false ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {trend.positive !== false ? '↑' : '↓'} {trend.value}
          </span>
          <span className="text-xs text-slate-400">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
