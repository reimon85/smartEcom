const db = require('../../db');

const LABOR_COST_PER_MINUTE = 25 / 60;

async function getDashboardMetrics() {
  const { rows: todayRows } = await db.query(`
    SELECT
      COALESCE(descriptions_generated, 0) AS descriptions_generated,
      COALESCE(reviews_processed, 0)      AS reviews_processed,
      COALESCE(alerts_sent, 0)            AS alerts_sent,
      COALESCE(categories_processed, 0)   AS categories_processed,
      COALESCE(tokens_used, 0)            AS tokens_used,
      COALESCE(estimated_cost, 0)         AS estimated_cost,
      COALESCE(time_saved_minutes, 0)     AS time_saved_minutes
    FROM metrics
    WHERE date = date('now')
  `);

  const { rows: weekRows } = await db.query(`
    SELECT
      COALESCE(SUM(descriptions_generated), 0) AS descriptions_generated,
      COALESCE(SUM(reviews_processed), 0)      AS reviews_processed,
      COALESCE(SUM(alerts_sent), 0)            AS alerts_sent,
      COALESCE(SUM(categories_processed), 0)   AS categories_processed,
      COALESCE(SUM(tokens_used), 0)            AS tokens_used,
      COALESCE(SUM(estimated_cost), 0)         AS estimated_cost,
      COALESCE(SUM(time_saved_minutes), 0)     AS time_saved_minutes
    FROM metrics
    WHERE date >= date('now', '-7 days')
  `);

  const { rows: pendingRows } = await db.query(
    `SELECT COUNT(*) AS count FROM reviews WHERE status = 'pending'`,
  );

  const { rows: activeAlertRows } = await db.query(
    `SELECT COUNT(*) AS count FROM stock_alerts WHERE is_active = 1`,
  );

  const { rows: runningJobRows } = await db.query(
    `SELECT COUNT(*) AS count FROM batch_jobs WHERE status = 'running'`,
  );

  const { rows: recentActivity } = await db.query(`
    SELECT 'description' AS type,
           'Descripción de producto generada' AS action,
           description_generated_at AS timestamp,
           name AS detail
    FROM products
    WHERE description_generated_at IS NOT NULL
    UNION ALL
    SELECT 'review' AS type,
           CASE status
             WHEN 'approved' THEN 'Respuesta a reseña aprobada'
             WHEN 'rejected' THEN 'Respuesta a reseña rechazada'
             ELSE 'Reseña analizada'
           END AS action,
           updated_at AS timestamp,
           (reviewer_name || ' (' || COALESCE(sentiment, 'sin analizar') || ')') AS detail
    FROM reviews
    UNION ALL
    SELECT 'alert' AS type,
           'Alerta de stock activada' AS action,
           created_at AS timestamp,
           (product_name || ' — ' || current_stock || ' uds') AS detail
    FROM stock_alerts
    ORDER BY timestamp DESC
    LIMIT 15
  `);

  const today = todayRows[0] || {
    descriptions_generated: 0, reviews_processed: 0, alerts_sent: 0,
    categories_processed: 0, tokens_used: 0, estimated_cost: 0, time_saved_minutes: 0,
  };
  const week = weekRows[0] || today;

  const costSavedToday = parseFloat((today.time_saved_minutes * LABOR_COST_PER_MINUTE).toFixed(2));
  const costSavedWeek = parseFloat((week.time_saved_minutes * LABOR_COST_PER_MINUTE).toFixed(2));

  return {
    today: { ...today, estimated_cost: parseFloat(today.estimated_cost).toFixed(4), cost_saved: costSavedToday },
    week: { ...week, estimated_cost: parseFloat(week.estimated_cost).toFixed(4), cost_saved: costSavedWeek },
    live: {
      pending_reviews: pendingRows[0].count,
      active_alerts: activeAlertRows[0].count,
      running_jobs: runningJobRows[0].count,
    },
    recentActivity,
  };
}

async function getROICalculation() {
  const { rows: allTime } = await db.query(`
    SELECT
      COALESCE(SUM(descriptions_generated), 0) AS total_descriptions,
      COALESCE(SUM(reviews_processed), 0)      AS total_reviews,
      COALESCE(SUM(alerts_sent), 0)            AS total_alerts,
      COALESCE(SUM(categories_processed), 0)   AS total_categories,
      COALESCE(SUM(tokens_used), 0)            AS total_tokens,
      COALESCE(SUM(estimated_cost), 0)         AS total_ai_cost,
      COALESCE(SUM(time_saved_minutes), 0)     AS total_time_saved_minutes
    FROM metrics
  `);

  const data = allTime[0];
  const timeSavings = {
    descriptions: { count: data.total_descriptions, manual_min_each: 15, ai_min_each: 0.5, saved_min: data.total_descriptions * 14.5 },
    reviews:      { count: data.total_reviews,      manual_min_each: 20, ai_min_each: 2,   saved_min: data.total_reviews * 18 },
    categorizations: { count: data.total_categories, manual_min_each: 3, ai_min_each: 0.07, saved_min: data.total_categories * 2.93 },
  };

  const totalTimeSavedMinutes = timeSavings.descriptions.saved_min + timeSavings.reviews.saved_min + timeSavings.categorizations.saved_min;
  const laborCostSaved = totalTimeSavedMinutes * LABOR_COST_PER_MINUTE;
  const aiCost = parseFloat(data.total_ai_cost);
  const netSavings = laborCostSaved - aiCost;
  const roi = aiCost > 0 ? ((netSavings / aiCost) * 100).toFixed(1) : 'N/A';

  return {
    summary: {
      total_time_saved_hours: (totalTimeSavedMinutes / 60).toFixed(1),
      total_time_saved_minutes: Math.round(totalTimeSavedMinutes),
      labor_cost_saved: parseFloat(laborCostSaved.toFixed(2)),
      ai_cost: parseFloat(aiCost.toFixed(4)),
      net_savings: parseFloat(netSavings.toFixed(2)),
      roi_percentage: roi,
      total_tokens: data.total_tokens,
    },
    breakdown: timeSavings,
    assumptions: { labor_rate_per_hour: 25, ai_model: 'gpt-4o-mini', input_cost_per_1k: 0.00015, output_cost_per_1k: 0.0006 },
  };
}

async function getMetricsHistory(days = 30) {
  const daysInt = parseInt(days, 10);
  const { rows } = await db.query(
    `SELECT date, descriptions_generated, reviews_processed, alerts_sent,
            categories_processed, tokens_used, estimated_cost, time_saved_minutes,
            ROUND(time_saved_minutes * ? / 60.0, 2) AS cost_saved
     FROM metrics
     WHERE date >= date('now', '-' || ? || ' days')
     ORDER BY date ASC`,
    [LABOR_COST_PER_MINUTE * 60, daysInt],
  );
  return rows;
}

async function updateDailyMetrics(data) {
  const { descriptions = 0, reviews = 0, alerts = 0, categories = 0, tokens = 0, cost = 0, time_saved = 0 } = data;
  await db.query(
    `INSERT INTO metrics (date, descriptions_generated, reviews_processed, alerts_sent,
       categories_processed, tokens_used, estimated_cost, time_saved_minutes)
     VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET
       descriptions_generated = metrics.descriptions_generated + ?,
       reviews_processed      = metrics.reviews_processed + ?,
       alerts_sent            = metrics.alerts_sent + ?,
       categories_processed   = metrics.categories_processed + ?,
       tokens_used            = metrics.tokens_used + ?,
       estimated_cost         = metrics.estimated_cost + ?,
       time_saved_minutes     = metrics.time_saved_minutes + ?,
       updated_at             = datetime('now')`,
    [descriptions, reviews, alerts, categories, tokens, cost, time_saved,
     descriptions, reviews, alerts, categories, tokens, cost, time_saved],
  );
}

async function snapshotDailyMetrics() {
  await db.query(`INSERT INTO metrics (date) VALUES (date('now')) ON CONFLICT (date) DO NOTHING`);
  console.log('[Metrics] Daily snapshot complete for', new Date().toISOString().split('T')[0]);
}

module.exports = { getDashboardMetrics, getROICalculation, getMetricsHistory, updateDailyMetrics, snapshotDailyMetrics };
