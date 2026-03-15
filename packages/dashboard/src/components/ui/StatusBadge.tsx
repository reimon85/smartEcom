import clsx from 'clsx';

type Status =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'low_stock'
  | 'critical_low'
  | 'out_of_stock'
  | 'active'
  | string;

interface StatusBadgeProps {
  status: Status;
  label?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { classes: string; dot: string; defaultLabel: string }> = {
  positive: {
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Positive',
  },
  neutral: {
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Neutral',
  },
  negative: {
    classes: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    defaultLabel: 'Negative',
  },
  pending: {
    classes: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500',
    defaultLabel: 'Pending',
  },
  approved: {
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Approved',
  },
  rejected: {
    classes: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    defaultLabel: 'Rejected',
  },
  running: {
    classes: 'bg-blue-50 text-blue-700 border border-blue-200',
    dot: 'bg-blue-500 animate-pulse',
    defaultLabel: 'Running',
  },
  completed: {
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Completed',
  },
  partial: {
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Partial',
  },
  failed: {
    classes: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    defaultLabel: 'Failed',
  },
  low_stock: {
    classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
    defaultLabel: 'Low Stock',
  },
  critical_low: {
    classes: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500 animate-pulse',
    defaultLabel: 'Critical Low',
  },
  out_of_stock: {
    classes: 'bg-red-100 text-red-800 border border-red-300',
    dot: 'bg-red-600',
    defaultLabel: 'Out of Stock',
  },
  active: {
    classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dot: 'bg-emerald-500',
    defaultLabel: 'Active',
  },
};

const fallback = {
  classes: 'bg-slate-100 text-slate-600 border border-slate-200',
  dot: 'bg-slate-400',
  defaultLabel: 'Unknown',
};

export default function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || fallback;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.classes,
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
    >
      <span className={clsx('rounded-full flex-shrink-0', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {displayLabel}
    </span>
  );
}
