const express = require('express');
const service = require('./service');
const { verifyShopifyWebhook } = require('../../webhooks/shopify');

const router = express.Router();

/**
 * POST /api/alerts/check
 * Manual stock check with an array of products.
 * Body: { products: [{ name, shopify_product_id, current_stock, threshold?, category? }] }
 */
router.post('/check', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'products array is required' });
    }
    const result = await service.checkStockLevels(products);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Alerts] check error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/alerts/webhook/shopify
 * Shopify inventory_levels/update webhook endpoint.
 * Uses raw body for HMAC verification.
 */
router.post('/webhook/shopify', verifyShopifyWebhook, async (req, res) => {
  try {
    // After verifyShopifyWebhook middleware, body is parsed JSON
    const webhookData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const topic = req.headers['x-shopify-topic'] || '';

    // Respond 200 immediately to Shopify (within 5 second window)
    res.status(200).json({ success: true, data: { received: true } });

    // Process async after response
    if (topic === 'inventory_levels/update') {
      service.processWebhookAlert(webhookData).catch((err) => {
        console.error('[Alerts] Webhook processing error:', err.message);
      });
    } else {
      console.log(`[Alerts] Unhandled webhook topic: ${topic}`);
    }
  } catch (err) {
    console.error('[Alerts] webhook error:', err.message);
    return res.status(200).json({ success: true, data: { received: true, warning: err.message } });
  }
});

/**
 * GET /api/alerts/history
 * Recent alert history.
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const alerts = await service.getAlertHistory(limit);
    return res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    console.error('[Alerts] history error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/alerts/active
 * Currently active (unresolved) stock alerts.
 */
router.get('/active', async (req, res) => {
  try {
    const alerts = await service.getActiveAlerts();
    return res.json({ success: true, data: alerts, count: alerts.length });
  } catch (err) {
    console.error('[Alerts] active error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/alerts/:id/resolve
 * Manually resolve (deactivate) an alert.
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId)) {
      return res.status(400).json({ success: false, error: 'Invalid alert ID' });
    }
    const alert = await service.resolveAlert(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    return res.json({ success: true, data: alert, message: 'Alert resolved' });
  } catch (err) {
    console.error('[Alerts] resolve error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
