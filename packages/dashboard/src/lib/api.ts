const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  count?: number;
}

export interface DashboardMetrics {
  today: {
    descriptions_generated: number;
    reviews_processed: number;
    alerts_sent: number;
    categories_processed: number;
    tokens_used: number;
    estimated_cost: string;
    cost_saved: number;
    time_saved_minutes: number;
  };
  week: {
    descriptions_generated: number;
    reviews_processed: number;
    alerts_sent: number;
    categories_processed: number;
    tokens_used: number;
    estimated_cost: string;
    cost_saved: number;
    time_saved_minutes: number;
  };
  live: {
    pending_reviews: number;
    active_alerts: number;
    running_jobs: number;
  };
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  type: 'description' | 'review' | 'alert';
  action: string;
  timestamp: string;
  detail: string;
}

export interface ROIData {
  summary: {
    total_time_saved_hours: string;
    total_time_saved_minutes: number;
    labor_cost_saved: number;
    ai_cost: number;
    net_savings: number;
    roi_percentage: string;
    total_tokens: number;
  };
  breakdown: {
    descriptions: { count: number; manual_min_each: number; ai_min_each: number; saved_min: number };
    reviews: { count: number; manual_min_each: number; ai_min_each: number; saved_min: number };
    categorizations: { count: number; manual_min_each: number; ai_min_each: number; saved_min: number };
  };
  assumptions: {
    labor_rate_per_hour: number;
    ai_model: string;
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  };
}

export interface Review {
  id: number;
  shopify_product_id: string | null;
  reviewer_name: string;
  rating: number;
  content: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  ai_response: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
}

export interface ReviewStats {
  overall: {
    total_reviews: number;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
    avg_sentiment_score: string;
    avg_rating: string;
    approval_rate_pct: string;
  };
  byDay: Array<{ date: string; total: number; positive: number; negative: number }>;
}

export interface StockAlert {
  id: number;
  shopify_product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  alert_type: 'low_stock' | 'critical_low' | 'out_of_stock';
  ai_copy: {
    email_subject: string;
    email_body: string;
    email_preheader: string;
    sms: string;
    push_notification: string;
    internal_alert: string;
    recommended_action: string;
  };
  is_active: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface BatchJob {
  id: number;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  total: number;
  processed: number;
  errors: number;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  error_log: Array<{ product: string; error: string }>;
  progress: number;
  estimatedRemainingSeconds?: number | null;
}

export interface ProductDescription {
  title: string;
  meta_description: string;
  full_description: string;
  bullet_points: string[];
  keywords: string[];
  tokens: { input: number; output: number; total: number };
  cost: number;
}

export interface CategorizationResult {
  category: string;
  subcategory: string;
  tags: string[];
  confidence: number;
  reasoning: string;
  tokens: { input: number; output: number; total: number };
  cost: number;
}

export interface HistoryMetric {
  date: string;
  descriptions_generated: number;
  reviews_processed: number;
  alerts_sent: number;
  categories_processed: number;
  tokens_used: number;
  estimated_cost: string;
  time_saved_minutes: number;
  cost_saved: string;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });

  const json = await res.json();
  if (!res.ok && !json.success) {
    throw new Error(json.error || `API error: ${res.status}`);
  }
  return json;
}

// ── Metrics API ───────────────────────────────────────────────────────────────

export const metricsApi = {
  getDashboard: () => apiFetch<DashboardMetrics>('/api/metrics/dashboard'),
  getROI: () => apiFetch<ROIData>('/api/metrics/roi'),
  getHistory: (days = 30) => apiFetch<HistoryMetric[]>(`/api/metrics/history?days=${days}`),
};

// ── Descriptions API ──────────────────────────────────────────────────────────

export const descriptionsApi = {
  generate: (product: { name: string; category?: string; attributes?: Record<string, unknown> }) =>
    apiFetch<ProductDescription>('/api/descriptions/generate', {
      method: 'POST',
      body: JSON.stringify(product),
    }),

  startBatch: (products: Array<{ name: string; category?: string; attributes?: Record<string, unknown> }>) =>
    apiFetch<{ jobId: number; message: string; statusUrl: string; estimatedTime: string }>(
      '/api/descriptions/batch',
      { method: 'POST', body: JSON.stringify({ products }) },
    ),

  getBatchStatus: (jobId: number) => apiFetch<BatchJob>(`/api/descriptions/batch/${jobId}`),

  uploadCSV: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/api/descriptions/upload`, { method: 'POST', body: form }).then(
      (r) => r.json() as Promise<ApiResponse<{ jobId: number; validProducts: number }>>,
    );
  },
};

// ── Reviews API ───────────────────────────────────────────────────────────────

export const reviewsApi = {
  analyze: (review: {
    content: string;
    rating?: number;
    reviewer_name?: string;
    shopify_product_id?: string;
  }) =>
    apiFetch<{ review: Review; analysis: { sentiment: string; sentiment_score: number } }>(
      '/api/reviews/analyze',
      { method: 'POST', body: JSON.stringify(review) },
    ),

  getPending: () => apiFetch<Review[]>('/api/reviews/pending'),

  getAll: (params?: { status?: string; sentiment?: string; limit?: number }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiFetch<Review[]>(`/api/reviews${qs ? `?${qs}` : ''}`);
  },

  approve: (id: number) =>
    apiFetch<Review>(`/api/reviews/${id}/approve`, { method: 'POST' }),

  reject: (id: number, feedback?: string) =>
    apiFetch<Review>(`/api/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  regenerate: (id: number, feedback?: string) =>
    apiFetch<{ review: Review; analysis: Record<string, unknown> }>(
      `/api/reviews/${id}/regenerate`,
      { method: 'POST', body: JSON.stringify({ feedback }) },
    ),

  getStats: () => apiFetch<ReviewStats>('/api/reviews/stats'),
};

// ── Alerts API ────────────────────────────────────────────────────────────────

export const alertsApi = {
  check: (
    products: Array<{
      name: string;
      shopify_product_id?: string;
      current_stock: number;
      threshold?: number;
    }>,
  ) =>
    apiFetch<{ alerts: StockAlert[]; checked: number; triggered: number }>(
      '/api/alerts/check',
      { method: 'POST', body: JSON.stringify({ products }) },
    ),

  getActive: () => apiFetch<StockAlert[]>('/api/alerts/active'),
  getHistory: (limit = 50) => apiFetch<StockAlert[]>(`/api/alerts/history?limit=${limit}`),
  resolve: (id: number) =>
    apiFetch<StockAlert>(`/api/alerts/${id}/resolve`, { method: 'POST' }),
};

// ── Categorization API ────────────────────────────────────────────────────────

export const categorizationApi = {
  categorize: (product: { name: string; description?: string; attributes?: Record<string, unknown> }) =>
    apiFetch<CategorizationResult>('/api/categorization/categorize', {
      method: 'POST',
      body: JSON.stringify(product),
    }),

  startBatch: (
    products: Array<{ name: string; description?: string; attributes?: Record<string, unknown> }>,
  ) =>
    apiFetch<{ jobId: number; message: string; statusUrl: string }>(
      '/api/categorization/batch',
      { method: 'POST', body: JSON.stringify({ products }) },
    ),

  getBatchStatus: (jobId: number) => apiFetch<BatchJob>(`/api/categorization/batch/${jobId}`),

  uploadCSV: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE}/api/categorization/upload`, { method: 'POST', body: form }).then(
      (r) => r.json() as Promise<ApiResponse<{ jobId: number; validProducts: number }>>,
    );
  },
};
