import type { ActivityItem } from '@/lib/api';

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

const typeConfig: Record<string, { bg: string; text: string; icon: string }> = {
  description: { bg: 'bg-blue-100', text: 'text-blue-600', icon: '✦' },
  review: { bg: 'bg-purple-100', text: 'text-purple-600', icon: '✉' },
  alert: { bg: 'bg-amber-100', text: 'text-amber-600', icon: '⚡' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ items, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const config = typeConfig[item.type] || typeConfig.description;
        return (
          <div key={i} className="flex gap-3 group">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${config.bg} ${config.text}`}
            >
              {config.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 font-medium">{item.action}</p>
              <p className="text-xs text-slate-500 truncate">{item.detail}</p>
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {timeAgo(item.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
