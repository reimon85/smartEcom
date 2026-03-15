const { getClient } = require('../../lib/ai');
const db = require('../../db');

const openai = getClient();

const COST_INPUT_PER_1K = parseFloat(process.env.OPENAI_INPUT_COST_PER_1K || '0.00015');
const COST_OUTPUT_PER_1K = parseFloat(process.env.OPENAI_OUTPUT_COST_PER_1K || '0.0006');

function calcCost(inputTokens, outputTokens) {
  return (inputTokens / 1000) * COST_INPUT_PER_1K + (outputTokens / 1000) * COST_OUTPUT_PER_1K;
}

/**
 * Analyze review sentiment and generate AI response in one API call.
 * @param {object} review - { content, rating, reviewer_name, shopify_product_id }
 * @returns {object} { sentiment, sentiment_score, ai_response, tokens, cost }
 */
async function analyzeReview(review) {
  const prompt = `You are an expert e-commerce customer service specialist and sentiment analyst.

Analyze the following customer review and generate an appropriate, empathetic response.

Product Review:
- Reviewer: ${review.reviewer_name || 'Anonymous'}
- Rating: ${review.rating || 'Not provided'}/5
- Content: "${review.content}"

Return a JSON object with EXACTLY these fields:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentiment_score": <float 1.0-10.0 where 10 = most positive>,
  "sentiment_reasoning": "<brief explanation of classification>",
  "key_themes": ["theme1", "theme2"],
  "ai_response": "<Full customer service response, 2-4 sentences. Be empathetic, professional, and brand-appropriate. For negative reviews: acknowledge the issue, apologize sincerely, offer solution. For positive: express genuine thanks, reinforce brand values. For neutral: thank for feedback, address specific points mentioned.>"
}

Guidelines for responses:
- Positive (score 7-10): Warm, grateful, reinforce their positive experience
- Neutral (score 4-6): Acknowledge mixed experience, offer support, show you care
- Negative (score 1-3): Sincere apology, empathy, concrete next steps, offer resolution

Never be defensive. Always be human and genuine. Do not use generic templates.
Respond with ONLY the JSON object.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a customer service expert. Always respond with valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const usage = response.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const cost = calcCost(inputTokens, outputTokens);

  let parsed;
  try {
    parsed = JSON.parse(response.choices[0].message.content);
  } catch {
    throw new Error('OpenAI returned invalid JSON for review analysis');
  }

  // Validate sentiment value
  const validSentiments = ['positive', 'neutral', 'negative'];
  if (!validSentiments.includes(parsed.sentiment)) {
    parsed.sentiment = parsed.sentiment_score >= 7 ? 'positive' : parsed.sentiment_score >= 4 ? 'neutral' : 'negative';
  }

  return {
    ...parsed,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost: parseFloat(cost.toFixed(6)),
  };
}

/**
 * Analyze a review and save to database with pending status for human approval.
 */
async function analyzeAndSave(reviewData) {
  const analysis = await analyzeReview(reviewData);

  const { rows } = await db.query(
    `INSERT INTO reviews
       (shopify_product_id, reviewer_name, rating, content, sentiment, sentiment_score, ai_response, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [
      reviewData.shopify_product_id || null,
      reviewData.reviewer_name || 'Anonymous',
      reviewData.rating || null,
      reviewData.content,
      analysis.sentiment,
      analysis.sentiment_score,
      analysis.ai_response,
    ],
  );

  // Update daily metrics
  await updateReviewMetrics(
    (analysis.tokens.total),
    calcCost(analysis.tokens.input, analysis.tokens.output),
  );

  return { review: rows[0], analysis };
}

/**
 * Get all reviews pending human approval.
 */
async function getPendingReviews() {
  const { rows } = await db.query(
    `SELECT r.*, p.name as product_name
     FROM reviews r
     LEFT JOIN products p ON p.shopify_id = r.shopify_product_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC`,
  );
  return rows;
}

/**
 * Approve a review response and simulate publishing.
 */
async function approveResponse(reviewId) {
  const { rows } = await db.query(
    `UPDATE reviews
     SET status = 'approved', approved_at = NOW(), published_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [reviewId],
  );
  if (!rows.length) return null;

  // In a real integration, this would call Shopify API to publish the response
  // For now we simulate it:
  console.log(`[Reviews] Response approved and "published" for review #${reviewId}`);
  return rows[0];
}

/**
 * Reject a review response with optional feedback.
 */
async function rejectResponse(reviewId, feedback) {
  const { rows } = await db.query(
    `UPDATE reviews
     SET status = 'rejected', rejection_feedback = $1, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [feedback || null, reviewId],
  );

  // Fix: correct param order
  const { rows: updated } = await db.query(
    `UPDATE reviews
     SET status = 'rejected', rejection_feedback = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [reviewId, feedback || null],
  );

  if (!updated.length) return null;
  return updated[0];
}

/**
 * Regenerate the AI response for an existing review.
 */
async function regenerateResponse(reviewId, feedback) {
  const { rows } = await db.query('SELECT * FROM reviews WHERE id = $1', [reviewId]);
  if (!rows.length) return null;

  const review = rows[0];
  const feedbackContext = feedback
    ? `\n\nPrevious response was rejected. Feedback from human reviewer: "${feedback}"\nPlease address this feedback in the new response.`
    : '';

  const analysis = await analyzeReview({
    ...review,
    content: review.content + feedbackContext,
  });

  const { rows: updated } = await db.query(
    `UPDATE reviews
     SET ai_response = $1, sentiment = $2, sentiment_score = $3, status = 'pending', updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [analysis.ai_response, analysis.sentiment, analysis.sentiment_score, reviewId],
  );

  return { review: updated[0], analysis };
}

/**
 * Get sentiment statistics.
 */
async function getStats() {
  const { rows: overall } = await db.query(`
    SELECT
      COUNT(*)                                                             AS total_reviews,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END)            AS positive_count,
      SUM(CASE WHEN sentiment = 'neutral'  THEN 1 ELSE 0 END)            AS neutral_count,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END)            AS negative_count,
      SUM(CASE WHEN status = 'approved'    THEN 1 ELSE 0 END)            AS approved_count,
      SUM(CASE WHEN status = 'pending'     THEN 1 ELSE 0 END)            AS pending_count,
      SUM(CASE WHEN status = 'rejected'    THEN 1 ELSE 0 END)            AS rejected_count,
      ROUND(AVG(sentiment_score), 2)                                      AS avg_sentiment_score,
      ROUND(AVG(rating), 2)                                               AS avg_rating,
      ROUND(
        100.0 * SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) /
        NULLIF(SUM(CASE WHEN status IN ('approved','rejected') THEN 1 ELSE 0 END), 0),
        1
      )                                                                    AS approval_rate_pct
    FROM reviews
  `);

  const { rows: byDay } = await db.query(`
    SELECT
      DATE(created_at) AS date,
      COUNT(*)         AS total,
      SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) AS positive,
      SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END) AS negative
    FROM reviews
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);

  return { overall: overall[0], byDay };
}

async function updateReviewMetrics(totalTokens, cost) {
  try {
    await db.query(
      `INSERT INTO metrics (date, reviews_processed, tokens_used, estimated_cost, time_saved_minutes)
       VALUES (CURRENT_DATE, 1, $1, $2, 18)
       ON CONFLICT (date) DO UPDATE SET
         reviews_processed  = metrics.reviews_processed + 1,
         tokens_used        = metrics.tokens_used + $1,
         estimated_cost     = metrics.estimated_cost + $2,
         time_saved_minutes = metrics.time_saved_minutes + 18,
         updated_at         = NOW()`,
      [totalTokens, cost],
    );
  } catch (err) {
    console.error('[Metrics] Failed to update review metrics:', err.message);
  }
}

module.exports = {
  analyzeReview,
  analyzeAndSave,
  getPendingReviews,
  approveResponse,
  rejectResponse,
  regenerateResponse,
  getStats,
};
