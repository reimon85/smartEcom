const crypto = require('crypto');

/**
 * Shopify webhook HMAC verification middleware.
 *
 * Shopify sends the HMAC-SHA256 signature in the X-Shopify-Hmac-Sha256 header.
 * The signature is computed over the raw request body using the webhook secret.
 *
 * This middleware must be applied AFTER express.raw() and BEFORE express.json()
 * for the webhook routes.
 */
function verifyShopifyWebhook(req, res, next) {
  const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  // In development, skip verification if secret is not set
  if (!shopifySecret) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Shopify Webhook] SHOPIFY_WEBHOOK_SECRET not set — skipping HMAC verification (dev only)');
      // Parse body if it came in as raw buffer
      if (Buffer.isBuffer(req.body)) {
        try {
          req.body = JSON.parse(req.body.toString('utf-8'));
        } catch {
          // Leave as-is
        }
      }
      return next();
    }
    return res.status(401).json({ success: false, error: 'Webhook secret not configured' });
  }

  const receivedHmac = req.headers['x-shopify-hmac-sha256'];
  if (!receivedHmac) {
    return res.status(401).json({ success: false, error: 'Missing HMAC signature' });
  }

  // Body must be raw Buffer at this point (express.raw() middleware)
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));

  const computedHmac = crypto
    .createHmac('sha256', shopifySecret)
    .update(rawBody)
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(receivedHmac, 'base64'),
    Buffer.from(computedHmac, 'base64'),
  );

  if (!isValid) {
    console.warn('[Shopify Webhook] Invalid HMAC signature — possible spoofed request');
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  // Parse the body now that it's verified
  try {
    req.body = JSON.parse(rawBody.toString('utf-8'));
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON in webhook body' });
  }

  // Extract useful Shopify metadata from headers
  req.shopify = {
    topic: req.headers['x-shopify-topic'],
    shop: req.headers['x-shopify-shop-domain'],
    apiVersion: req.headers['x-shopify-api-version'],
    webhookId: req.headers['x-shopify-webhook-id'],
  };

  console.log(`[Shopify Webhook] Verified: topic=${req.shopify.topic} shop=${req.shopify.shop}`);
  next();
}

/**
 * Helper to create a test webhook signature for development/testing.
 * Usage: generateTestHmac(secret, bodyString)
 */
function generateTestHmac(secret, body) {
  return crypto
    .createHmac('sha256', secret)
    .update(typeof body === 'string' ? body : JSON.stringify(body))
    .digest('base64');
}

module.exports = { verifyShopifyWebhook, generateTestHmac };
