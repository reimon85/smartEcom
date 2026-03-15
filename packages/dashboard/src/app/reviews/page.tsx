'use client';

import { useEffect, useState, useCallback } from 'react';
import { reviewsApi, type Review, type ReviewStats } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ReviewsPage() {
  const [pending, setPending] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'analyze'>('queue');

  // New review form
  const [form, setForm] = useState({
    content: '',
    rating: '5',
    reviewer_name: '',
    shopify_product_id: '',
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<Review | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        reviewsApi.getPending(),
        reviewsApi.getStats(),
      ]);
      if (pendingRes.success) setPending(pendingRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleApprove = async (id: number) => {
    setActionLoading((p) => ({ ...p, [id]: 'approving' }));
    try {
      const res = await reviewsApi.approve(id);
      if (res.success) {
        setPending((p) => p.filter((r) => r.id !== id));
        fetchData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleReject = async (id: number, feedback?: string) => {
    setActionLoading((p) => ({ ...p, [id]: 'rejecting' }));
    try {
      const res = await reviewsApi.reject(id, feedback);
      if (res.success) {
        setPending((p) => p.filter((r) => r.id !== id));
        fetchData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleRegenerate = async (id: number) => {
    setActionLoading((p) => ({ ...p, [id]: 'regenerating' }));
    try {
      const res = await reviewsApi.regenerate(id);
      if (res.success) {
        setPending((p) => p.map((r) => (r.id === id ? res.data.review : r)));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Regenerate failed');
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const handleAnalyze = async () => {
    if (!form.content.trim()) return;
    setAnalyzing(true);
    setError(null);
    setAnalyzeResult(null);
    try {
      const res = await reviewsApi.analyze({
        content: form.content,
        rating: parseInt(form.rating),
        reviewer_name: form.reviewer_name || undefined,
        shopify_product_id: form.shopify_product_id || undefined,
      });
      if (res.success) {
        setAnalyzeResult(res.data.review);
        setPending((p) => [res.data.review, ...p]);
        setForm({ content: '', rating: '5', reviewer_name: '', shopify_product_id: '' });
        setActiveTab('queue');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const overall = stats?.overall;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Sentiment & Moderation</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI-generated responses with human-in-the-loop approval
        </p>
      </div>

      {/* Stats row */}
      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Reviews', value: overall.total_reviews, color: 'text-slate-800' },
            { label: 'Positive', value: overall.positive_count, color: 'text-emerald-600' },
            { label: 'Neutral', value: overall.neutral_count, color: 'text-amber-600' },
            { label: 'Negative', value: overall.negative_count, color: 'text-red-600' },
            { label: 'Approval Rate', value: `${overall.approval_rate_pct || 0}%`, color: 'text-blue-600' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['queue', 'analyze'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'queue' ? (
              <>Approval Queue {pending.length > 0 && <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}</>
            ) : 'Analyze New Review'}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="h-4 w-48 bg-slate-200 rounded mb-3" />
                  <div className="h-16 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          )}
          {!loading && pending.length === 0 && (
            <div className="card p-12 text-center">
              <div className="text-3xl mb-3">✓</div>
              <p className="font-medium text-slate-700">All caught up!</p>
              <p className="text-sm text-slate-400 mt-1">No reviews pending approval.</p>
            </div>
          )}
          {pending.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              actionLoading={actionLoading[review.id]}
              onApprove={handleApprove}
              onReject={handleReject}
              onRegenerate={handleRegenerate}
            />
          ))}
        </div>
      )}

      {/* Analyze tab */}
      {activeTab === 'analyze' && (
        <div className="card p-6 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-slate-800">Analyze a Review</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Reviewer Name</label>
              <input
                className="input"
                placeholder="Jane D."
                value={form.reviewer_name}
                onChange={(e) => setForm((f) => ({ ...f, reviewer_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Rating</label>
              <select
                className="input"
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>{r} Star{r !== 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Review Content *</label>
            <textarea
              className="input min-h-[120px] resize-none"
              placeholder="The product arrived quickly and works exactly as described..."
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Shopify Product ID (optional)</label>
            <input
              className="input"
              placeholder="shopify_8001"
              value={form.shopify_product_id}
              onChange={(e) => setForm((f) => ({ ...f, shopify_product_id: e.target.value }))}
            />
          </div>

          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={analyzing || !form.content.trim()}
          >
            {analyzing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyzing...
              </>
            ) : 'Analyze & Generate Response'}
          </button>

          {analyzeResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-emerald-800 mb-1">
                Analysis complete — added to approval queue
              </p>
              <p className="text-emerald-700">
                Sentiment: <StatusBadge status={analyzeResult.sentiment} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ReviewCardProps {
  review: Review;
  actionLoading?: string;
  onApprove: (id: number) => void;
  onReject: (id: number, feedback?: string) => void;
  onRegenerate: (id: number) => void;
}

function ReviewCard({ review, actionLoading, onApprove, onReject, onRegenerate }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
              {review.reviewer_name?.[0] || '?'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{review.reviewer_name || 'Anonymous'}</p>
              <p className="text-xs text-amber-500">{stars}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={review.sentiment} />
            <span className="text-xs text-slate-400">
              Score: {review.sentiment_score?.toFixed(1)}/10
            </span>
          </div>
        </div>

        <blockquote className="text-sm text-slate-600 italic bg-slate-50 p-3 rounded-lg border-l-2 border-slate-300">
          "{review.content}"
        </blockquote>

        {expanded && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
              AI Response Draft
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{review.ai_response}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
        <button
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Hide' : 'Show'} AI response
        </button>

        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs py-1.5 px-3"
            onClick={() => onRegenerate(review.id)}
            disabled={!!actionLoading}
          >
            {actionLoading === 'regenerating' ? '...' : '↻ Regenerate'}
          </button>
          <button
            className="btn-danger text-xs py-1.5 px-3"
            onClick={() => setShowRejectModal(true)}
            disabled={!!actionLoading}
          >
            {actionLoading === 'rejecting' ? '...' : '✕ Reject'}
          </button>
          <button
            className="btn-success text-xs py-1.5 px-3"
            onClick={() => onApprove(review.id)}
            disabled={!!actionLoading}
          >
            {actionLoading === 'approving' ? '...' : '✓ Approve & Publish'}
          </button>
        </div>
      </div>

      {showRejectModal && (
        <div className="border-t border-slate-100 p-4 bg-red-50 space-y-3">
          <p className="text-sm font-medium text-red-700">Reject this response</p>
          <textarea
            className="input text-sm min-h-[60px] resize-none"
            placeholder="Optional feedback for the AI to improve the next attempt..."
            value={rejectFeedback}
            onChange={(e) => setRejectFeedback(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-danger text-xs py-1.5 px-3"
              onClick={() => {
                onReject(review.id, rejectFeedback);
                setShowRejectModal(false);
              }}
            >
              Confirm Reject
            </button>
            <button
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={() => setShowRejectModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
