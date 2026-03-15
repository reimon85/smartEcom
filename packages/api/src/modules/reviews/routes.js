const express = require('express');
const service = require('./service');

const router = express.Router();

/**
 * POST /api/reviews/analyze
 * Analyze a review and generate an AI response (saves as pending).
 * Body: { content, rating, reviewer_name, shopify_product_id }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { content, rating, reviewer_name, shopify_product_id } = req.body;
    if (!content || content.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'Review content is required (min 5 characters)' });
    }
    const result = await service.analyzeAndSave({ content, rating, reviewer_name, shopify_product_id });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('[Reviews] analyze error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reviews/pending
 * List all reviews awaiting human approval.
 */
router.get('/pending', async (req, res) => {
  try {
    const reviews = await service.getPendingReviews();
    return res.json({ success: true, data: reviews, count: reviews.length });
  } catch (err) {
    console.error('[Reviews] pending error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reviews/stats
 * Sentiment breakdown and approval stats.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await service.getStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[Reviews] stats error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reviews
 * Get all reviews with optional filters.
 */
router.get('/', async (req, res) => {
  try {
    const db = require('../../db');
    const { status, sentiment, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND r.status = $${params.length}`;
    }
    if (sentiment) {
      params.push(sentiment);
      whereClause += ` AND r.sentiment = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));
    const { rows } = await db.query(
      `SELECT r.*, p.name as product_name
       FROM reviews r
       LEFT JOIN products p ON p.shopify_id = r.shopify_product_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/:id/approve
 * Approve the AI response and simulate publishing.
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID' });
    }
    const review = await service.approveResponse(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found or not in pending state' });
    }
    return res.json({ success: true, data: review, message: 'Response approved and published' });
  } catch (err) {
    console.error('[Reviews] approve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/:id/reject
 * Reject an AI response with optional feedback.
 * Body: { feedback }
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID' });
    }
    const { feedback } = req.body;
    const review = await service.rejectResponse(reviewId, feedback);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found or not in pending state' });
    }
    return res.json({ success: true, data: review, message: 'Response rejected' });
  } catch (err) {
    console.error('[Reviews] reject error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/:id/regenerate
 * Regenerate the AI response (optionally with feedback).
 * Body: { feedback }
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId)) {
      return res.status(400).json({ success: false, error: 'Invalid review ID' });
    }
    const { feedback } = req.body;
    const result = await service.regenerateResponse(reviewId, feedback);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }
    return res.json({ success: true, data: result, message: 'Response regenerated and set to pending' });
  } catch (err) {
    console.error('[Reviews] regenerate error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
