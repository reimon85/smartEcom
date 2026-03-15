const express = require('express');
const service = require('./service');

const router = express.Router();

/**
 * GET /api/metrics/dashboard
 * Main dashboard KPI data.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await service.getDashboardMetrics();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Metrics] dashboard error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/metrics/roi
 * ROI calculation data.
 */
router.get('/roi', async (req, res) => {
  try {
    const data = await service.getROICalculation();
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Metrics] roi error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/metrics/history
 * Historical metrics for charts.
 * Query: ?days=30
 */
router.get('/history', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);
    const data = await service.getMetricsHistory(days);
    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error('[Metrics] history error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/metrics/update
 * Manually push metric increments (used by batch jobs internally).
 */
router.post('/update', async (req, res) => {
  try {
    const updated = await service.updateDailyMetrics(req.body);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Metrics] update error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
