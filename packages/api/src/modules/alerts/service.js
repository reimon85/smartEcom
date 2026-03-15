const { getClient } = require('../../lib/ai');
const db = require('../../db');

const openai = getClient();

const COST_INPUT_PER_1K = parseFloat(process.env.OPENAI_INPUT_COST_PER_1K || '0.00015');
const COST_OUTPUT_PER_1K = parseFloat(process.env.OPENAI_OUTPUT_COST_PER_1K || '0.0006');

const DEFAULT_THRESHOLD = 10;

function calcCost(inputTokens, outputTokens) {
  return (inputTokens / 1000) * COST_INPUT_PER_1K + (outputTokens / 1000) * COST_OUTPUT_PER_1K;
}

function classifyAlertType(stock, threshold) {
  if (stock === 0) return 'out_of_stock';
  if (stock <= Math.floor(threshold * 0.3)) return 'critical_low';
  return 'low_stock';
}

/**
 * Generate multi-channel urgency marketing copy for a low-stock product.
 */
async function generateAlertCopy(product) {
  const alertType = classifyAlertType(product.current_stock, product.threshold || DEFAULT_THRESHOLD);
  const urgencyLevel = alertType === 'out_of_stock' ? 'SOLD OUT' : alertType === 'critical_low' ? 'CRITICAL' : 'LOW';

  const prompt = `You are an expert e-commerce marketing copywriter specializing in urgency-driven content.

Generate multi-channel alert copy for a ${urgencyLevel} stock situation:

Product: ${product.name}
Current Stock: ${product.current_stock} units
Alert Type: ${alertType}
Category: ${product.category || 'General'}

Return a JSON object with EXACTLY these fields:
{
  "email_subject": "<compelling email subject line, max 60 chars, use urgency/scarcity>",
  "email_body": "<2-3 sentence email body for customers. Create urgency. Include stock count if not 0. Professional tone.>",
  "email_preheader": "<email preheader text, max 80 chars>",
  "sms": "<SMS text, max 160 chars. Start with brand alert indicator. Be direct.>",
  "push_notification": "<push notification, max 100 chars. Emoji optional. Urgent.>",
  "internal_alert": "<Internal Slack/team alert message. Include product name, stock count, recommended action.>",
  "urgency_level": "${urgencyLevel}",
  "recommended_action": "<Brief recommendation: reorder now / run promotion / pause ads / etc.>"
}

Tone guidelines:
- Customer-facing (email, SMS, push): Exciting, urgent but not panic-inducing. FOMO-driven.
- Internal alert: Direct, factual, actionable.
- For out_of_stock: Focus on "back in stock notification" sign-ups
- For critical_low (1-3 items): Maximum urgency, last chance messaging
- For low_stock: Moderate urgency, act soon messaging

Respond with ONLY the JSON object.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a marketing copywriter. Always respond with valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.8,
    max_tokens: 600,
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
    throw new Error('OpenAI returned invalid JSON for alert copy generation');
  }

  return {
    ...parsed,
    alert_type: alertType,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost: parseFloat(cost.toFixed(6)),
  };
}

/**
 * Check an array of products for stock alerts.
 * @param {Array} products - [{ shopify_product_id, name, current_stock, threshold }]
 * @returns {{ alerts: Array, checked: number }}
 */
async function checkStockLevels(products) {
  const alerts = [];

  for (const product of products) {
    const threshold = product.threshold || DEFAULT_THRESHOLD;
    const stock = parseInt(product.current_stock, 10);

    if (isNaN(stock)) continue;
    if (stock > threshold) continue; // Above threshold, no alert needed

    try {
      const copy = await generateAlertCopy({
        name: product.name,
        current_stock: stock,
        threshold,
        category: product.category,
      });

      // Save alert to database
      const { rows } = await db.query(
        `INSERT INTO stock_alerts
           (shopify_product_id, product_name, current_stock, threshold, alert_type, ai_copy, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING *`,
        [
          product.shopify_product_id || null,
          product.name,
          stock,
          threshold,
          copy.alert_type,
          JSON.stringify(copy),
        ],
      );

      alerts.push({ ...rows[0], copy });

      // Update metrics
      await updateAlertMetrics(copy.tokens.total, copy.cost);
    } catch (err) {
      console.error(`[Alerts] Failed to generate copy for ${product.name}:`, err.message);
    }
  }

  return { alerts, checked: products.length, triggered: alerts.length };
}

/**
 * Process a Shopify inventory_levels/update webhook.
 */
async function processWebhookAlert(webhookData) {
  // Shopify sends: { inventory_item_id, location_id, available, updated_at }
  const stock = parseInt(webhookData.available, 10);
  const inventoryItemId = String(webhookData.inventory_item_id);

  // Look up product in our DB by shopify_id (best effort)
  const { rows: products } = await db.query(
    `SELECT * FROM products WHERE shopify_id = $1 LIMIT 1`,
    [inventoryItemId],
  );

  const product = products[0] || {
    name: `Product #${inventoryItemId}`,
    shopify_id: inventoryItemId,
    category: 'General',
  };

  const threshold = DEFAULT_THRESHOLD;

  if (isNaN(stock) || stock > threshold) {
    // Resolve any existing active alerts if stock is back above threshold
    if (!isNaN(stock) && stock > threshold) {
      await db.query(
        `UPDATE stock_alerts SET is_active = FALSE WHERE shopify_product_id = $1 AND is_active = TRUE`,
        [inventoryItemId],
      );
    }
    return { triggered: false, stock, threshold, message: 'Stock level is acceptable' };
  }

  const copy = await generateAlertCopy({
    name: product.name,
    current_stock: stock,
    threshold,
    category: product.category,
  });

  const { rows } = await db.query(
    `INSERT INTO stock_alerts
       (shopify_product_id, product_name, current_stock, threshold, alert_type, ai_copy, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING *`,
    [
      inventoryItemId,
      product.name,
      stock,
      threshold,
      copy.alert_type,
      JSON.stringify(copy),
    ],
  );

  await updateAlertMetrics(copy.tokens.total, copy.cost);

  return { triggered: true, alert: rows[0], copy };
}

/**
 * Get recent alert history.
 */
async function getAlertHistory(limit = 50) {
  const { rows } = await db.query(
    `SELECT * FROM stock_alerts ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

/**
 * Get currently active (unresolved) alerts.
 */
async function getActiveAlerts() {
  const { rows } = await db.query(
    `SELECT sa.*, p.attributes
     FROM stock_alerts sa
     LEFT JOIN products p ON p.shopify_id = sa.shopify_product_id
     WHERE sa.is_active = TRUE
     ORDER BY sa.current_stock ASC, sa.created_at DESC`,
  );
  return rows;
}

/**
 * Resolve (deactivate) an alert.
 */
async function resolveAlert(alertId) {
  const { rows } = await db.query(
    `UPDATE stock_alerts SET is_active = FALSE WHERE id = $1 RETURNING *`,
    [alertId],
  );
  return rows[0] || null;
}

async function updateAlertMetrics(totalTokens, cost) {
  try {
    await db.query(
      `INSERT INTO metrics (date, alerts_sent, tokens_used, estimated_cost)
       VALUES (CURRENT_DATE, 1, $1, $2)
       ON CONFLICT (date) DO UPDATE SET
         alerts_sent    = metrics.alerts_sent + 1,
         tokens_used    = metrics.tokens_used + $1,
         estimated_cost = metrics.estimated_cost + $2,
         updated_at     = NOW()`,
      [totalTokens, cost],
    );
  } catch (err) {
    console.error('[Metrics] Failed to update alert metrics:', err.message);
  }
}

module.exports = {
  generateAlertCopy,
  checkStockLevels,
  processWebhookAlert,
  getAlertHistory,
  getActiveAlerts,
  resolveAlert,
};
