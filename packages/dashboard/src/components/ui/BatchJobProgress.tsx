'use client';

import { useEffect, useState, useCallback } from 'react';
import type { BatchJob } from '@/lib/api';
import StatusBadge from './StatusBadge';

interface BatchJobProgressProps {
  jobId: number;
  pollFn: (jobId: number) => Promise<{ success: boolean; data: BatchJob }>;
  onComplete?: (job: BatchJob) => void;
  label?: string;
}

export default function BatchJobProgress({
  jobId,
  pollFn,
  onComplete,
  label = 'Batch Job',
}: BatchJobProgressProps) {
  const [job, setJob] = useState<BatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await pollFn(jobId);
      if (res.success) {
        setJob(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed' || res.data.status === 'partial') {
          onComplete?.(res.data);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Polling error');
    }
  }, [jobId, pollFn, onComplete]);

  useEffect(() => {
    poll();
    const interval = setInterval(() => {
      if (job?.status === 'completed' || job?.status === 'failed') {
        clearInterval(interval);
        return;
      }
      poll();
    }, 2000);
    return () => clearInterval(interval);
  }, [job?.status, poll]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
        Error polling job status: {error}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
        <div className="h-2 w-full bg-slate-200 dark:bg-slate-600 rounded" />
      </div>
    );
  }

  const pct = job.progress || 0;

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label} #{job.id}</span>
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            {job.processed} / {job.total} processed
          </span>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            job.status === 'failed'
              ? 'bg-red-500'
              : job.status === 'partial'
              ? 'bg-amber-500'
              : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{pct}% complete</span>
        <div className="flex gap-3">
          {job.errors > 0 && (
            <span className="text-red-600 font-medium">{job.errors} errors</span>
          )}
          {job.estimatedRemainingSeconds != null && job.status === 'running' && (
            <span>~{job.estimatedRemainingSeconds}s remaining</span>
          )}
          {job.status === 'completed' && (
            <span className="text-emerald-600 font-medium">Complete!</span>
          )}
        </div>
      </div>

      {job.error_log && job.error_log.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-red-600 font-medium">
            {job.error_log.length} error(s) — click to expand
          </summary>
          <ul className="mt-2 space-y-1 pl-2">
            {job.error_log.slice(0, 10).map((e, i) => (
              <li key={i} className="text-red-700">
                <span className="font-medium">{e.product}:</span> {e.error}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
