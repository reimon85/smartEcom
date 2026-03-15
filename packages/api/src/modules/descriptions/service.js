const { getClient } = require('../../lib/ai');
const db = require('../../db');

const openai = getClient();

// gpt-4o-mini pricing (per 1K tokens)
const COST_INPUT_PER_1K = parseFloat(process.env.OPENAI_INPUT_COST_PER_1K || '0.00015');
const COST_OUTPUT_PER_1K = parseFloat(process.env.OPENAI_OUTPUT_COST_PER_1K || '0.0006');

function calcCost(inputTokens, outputTokens) {
  return (inputTokens / 1000) * COST_INPUT_PER_1K + (outputTokens / 1000) * COST_OUTPUT_PER_1K;
}

/**
 * Build an SEO-optimized prompt for a single product.
 */
function buildDescriptionPrompt(product) {
  const attrsText = product.attributes
    ? Object.entries(
        typeof product.attributes === 'string'
          ? JSON.parse(product.attributes)
          : product.attributes,
      )
        .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')
    : '  (no attributes provided)';

  return `You are an expert e-commerce copywriter specializing in SEO-optimized product descriptions.

Generate a complete, compelling product listing for the following item:

Product Name: ${product.name}
Category: ${product.category || 'General'}
Attributes:
${attrsText}

Return a JSON object with EXACTLY these fields:
{
  "title": "SEO-optimized product title (60-70 chars, includes main keyword)",
  "meta_description": "SEO meta description under 160 characters with a CTA",
  "full_description": "2-3 paragraph engaging product description (200-300 words). Include primary and secondary keywords naturally. Highlight benefits over features. Create emotional connection.",
  "bullet_points": ["benefit-focused bullet 1", "benefit-focused bullet 2", "benefit-focused bullet 3", "benefit-focused bullet 4", "benefit-focused bullet 5"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"]
}

Rules:
- Title: Include the main keyword, avoid keyword stuffing
- Meta: Under 160 chars, include action word (Buy, Shop, Get, Discover)
- Description: Benefits first, then features. Conversational yet professional tone.
- Bullets: Start each with a strong verb or key benefit. Be specific.
- Keywords: Mix of head terms and long-tail phrases relevant to the product.
- NO placeholder text. Every field must be fully written.

Respond with ONLY the JSON object, no markdown, no explanation.`;
}

/**
 * Generate a single product description using GPT-4o-mini.
 * @param {object} product - { name, category, attributes, shopify_id? }
 * @returns {object} { title, meta_description, full_description, bullet_points, keywords, tokens, cost }
 */
async function generateDescription(product) {
  const prompt = buildDescriptionPrompt(product);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert e-commerce SEO copywriter. Always return valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 800,
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
    throw new Error('OpenAI returned invalid JSON for description generation');
  }

  // Persist to DB if we have a product ID
  if (product.shopify_id || product.id) {
    const descText = [
      parsed.title,
      parsed.full_description,
      (parsed.bullet_points || []).join('\n'),
    ].join('\n\n');

    await db.query(
      `UPDATE products
       SET description = $1,
           description_generated_at = NOW(),
           updated_at = NOW()
       WHERE shopify_id = $2`,
      [descText, product.shopify_id || ''],
    );
  }

  // Update daily metrics
  await updateMetricsForDescription(inputTokens + outputTokens, cost);

  return {
    ...parsed,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost: parseFloat(cost.toFixed(6)),
  };
}

/**
 * Batch-generate descriptions for multiple products in parallel batches of 10.
 * @param {Array} products
 * @param {number} jobId
 * @returns {Array} results
 */
async function batchGenerate(products, jobId) {
  const BATCH_SIZE = 10;
  const results = [];
  let processed = 0;
  let errors = 0;
  const errorLog = [];

  // Update job status to running
  await db.query(
    `UPDATE batch_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [jobId],
  );

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (product, idx) => {
      try {
        const result = await generateDescription(product);
        processed++;
        return { index: i + idx, product: product.name, success: true, data: result };
      } catch (err) {
        errors++;
        errorLog.push({ product: product.name, error: err.message });
        return { index: i + idx, product: product.name, success: false, error: err.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Update job progress after each batch
    await db.query(
      `UPDATE batch_jobs
       SET processed = $1, errors = $2, error_log = $3
       WHERE id = $4`,
      [processed, errors, JSON.stringify(errorLog), jobId],
    );

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // Mark job complete
  await db.query(
    `UPDATE batch_jobs
     SET status = $1, completed_at = NOW(), error_log = $2
     WHERE id = $3`,
    [errors === products.length ? 'failed' : errors > 0 ? 'partial' : 'completed', JSON.stringify(errorLog), jobId],
  );

  return results;
}

/**
 * Create a new batch job record and kick off processing.
 * @param {Array} products
 * @returns {{ jobId: number }}
 */
async function createBatchJob(products) {
  const { rows } = await db.query(
    `INSERT INTO batch_jobs (type, status, total, processed, errors, metadata)
     VALUES ('description_generation', 'pending', $1, 0, 0, $2)
     RETURNING id`,
    [products.length, JSON.stringify({ product_count: products.length })],
  );
  const jobId = rows[0].id;

  // Run async (non-blocking)
  batchGenerate(products, jobId).catch((err) => {
    console.error(`[Batch Job ${jobId}] Fatal error:`, err.message);
    db.query(
      `UPDATE batch_jobs SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [jobId],
    );
  });

  return { jobId };
}

/**
 * Retrieve batch job status.
 */
async function getBatchJobStatus(jobId) {
  const { rows } = await db.query('SELECT * FROM batch_jobs WHERE id = $1', [jobId]);
  if (!rows.length) return null;
  const job = rows[0];
  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const estimatedRemainingSeconds =
    job.status === 'running' && job.processed > 0
      ? Math.round(((job.total - job.processed) / job.processed) * ((Date.now() - new Date(job.started_at).getTime()) / 1000))
      : null;
  return { ...job, progress, estimatedRemainingSeconds };
}

async function updateMetricsForDescription(totalTokens, cost) {
  try {
    await db.query(
      `INSERT INTO metrics (date, descriptions_generated, tokens_used, estimated_cost, time_saved_minutes)
       VALUES (CURRENT_DATE, 1, $1, $2, 14)
       ON CONFLICT (date) DO UPDATE SET
         descriptions_generated = metrics.descriptions_generated + 1,
         tokens_used            = metrics.tokens_used + $1,
         estimated_cost         = metrics.estimated_cost + $2,
         time_saved_minutes     = metrics.time_saved_minutes + 14,
         updated_at             = NOW()`,
      [totalTokens, cost],
    );
  } catch (err) {
    console.error('[Metrics] Failed to update description metrics:', err.message);
  }
}

module.exports = { generateDescription, batchGenerate, createBatchJob, getBatchJobStatus };
