const { getClient } = require('../../lib/ai');
const db = require('../../db');

const openai = getClient();

const COST_INPUT_PER_1K = parseFloat(process.env.OPENAI_INPUT_COST_PER_1K || '0.00015');
const COST_OUTPUT_PER_1K = parseFloat(process.env.OPENAI_OUTPUT_COST_PER_1K || '0.0006');

const VALID_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Beauty',
  'Sports',
  'Food & Beverage',
  'Books',
  'Toys',
  'Automotive',
  'Other',
];

function calcCost(inputTokens, outputTokens) {
  return (inputTokens / 1000) * COST_INPUT_PER_1K + (outputTokens / 1000) * COST_OUTPUT_PER_1K;
}

/**
 * Categorize a single product using GPT-4o-mini.
 */
async function categorizeProduct(product) {
  const attrsText = product.attributes
    ? typeof product.attributes === 'string'
      ? product.attributes
      : Object.entries(
          typeof product.attributes === 'object' ? product.attributes : {},
        )
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(', ')
    : '';

  const prompt = `You are an expert e-commerce product classifier with deep knowledge of retail categories.

Classify the following product into the most appropriate category and subcategory.

Product Name: ${product.name}
Description: ${product.description || ''}
Attributes: ${attrsText || '(none provided)'}

Available top-level categories:
${VALID_CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return a JSON object with EXACTLY these fields:
{
  "category": "<exact category name from the list above>",
  "subcategory": "<specific subcategory, 2-4 words, e.g. 'Gaming Peripherals', 'Women\\'s Activewear', 'Kitchen Appliances'>",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "confidence": <float 0.0-1.0>,
  "reasoning": "<one sentence explaining why this category was chosen>"
}

Rules:
- category MUST be exactly one of the provided categories
- subcategory should be specific and descriptive (not just repeat the category)
- tags: 3-6 relevant search/filter tags (lowercase, specific)
- confidence: 0.95+ if very clear, 0.7-0.95 if reasonable, below 0.7 if uncertain
- If truly ambiguous, use 'Other' with low confidence

Respond with ONLY the JSON object.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a product classification expert. Always respond with valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2, // Low temperature for consistent classification
    max_tokens: 300,
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
    throw new Error('OpenAI returned invalid JSON for categorization');
  }

  // Validate category
  if (!VALID_CATEGORIES.includes(parsed.category)) {
    parsed.category = 'Other';
    parsed.confidence = Math.min(parsed.confidence || 0.5, 0.5);
  }

  // Update product in DB if it has an ID
  if (product.shopify_id || product.id) {
    await db.query(
      `UPDATE products
       SET category = $1, subcategory = $2, tags = $3, updated_at = NOW()
       WHERE ${product.shopify_id ? 'shopify_id = $4' : 'id = $4'}`,
      [
        parsed.category,
        parsed.subcategory,
        parsed.tags || [],
        product.shopify_id || product.id,
      ],
    );
  }

  return {
    ...parsed,
    tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    cost: parseFloat(cost.toFixed(6)),
  };
}

/**
 * Batch categorize products with parallel processing.
 */
async function batchCategorize(products, jobId) {
  const BATCH_SIZE = 15; // Categorization prompts are smaller, can parallelize more
  const results = [];
  let processed = 0;
  let errors = 0;
  const errorLog = [];

  await db.query(
    `UPDATE batch_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [jobId],
  );

  let totalTokens = 0;
  let totalCost = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (product, idx) => {
      try {
        const result = await categorizeProduct(product);
        processed++;
        totalTokens += result.tokens.total;
        totalCost += result.cost;
        return {
          index: i + idx,
          product: product.name,
          success: true,
          data: result,
        };
      } catch (err) {
        errors++;
        errorLog.push({ product: product.name, error: err.message });
        return {
          index: i + idx,
          product: product.name,
          success: false,
          error: err.message,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    await db.query(
      `UPDATE batch_jobs SET processed = $1, errors = $2, error_log = $3 WHERE id = $4`,
      [processed, errors, JSON.stringify(errorLog), jobId],
    );

    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const finalStatus = errors === products.length ? 'failed' : errors > 0 ? 'partial' : 'completed';
  await db.query(
    `UPDATE batch_jobs SET status = $1, completed_at = NOW(), error_log = $2 WHERE id = $3`,
    [finalStatus, JSON.stringify(errorLog), jobId],
  );

  // Update metrics
  await updateCategorizationMetrics(totalTokens, totalCost, processed);

  return results;
}

/**
 * Create a batch categorization job.
 */
async function createBatchJob(products) {
  const { rows } = await db.query(
    `INSERT INTO batch_jobs (type, status, total, processed, errors, metadata)
     VALUES ('categorization', 'pending', $1, 0, 0, $2)
     RETURNING id`,
    [products.length, JSON.stringify({ product_count: products.length })],
  );
  const jobId = rows[0].id;

  batchCategorize(products, jobId).catch((err) => {
    console.error(`[Categorization Job ${jobId}] Fatal error:`, err.message);
    db.query(
      `UPDATE batch_jobs SET status = 'failed', completed_at = NOW() WHERE id = $1`,
      [jobId],
    );
  });

  return { jobId };
}

/**
 * Get batch job status.
 */
async function getBatchJobStatus(jobId) {
  const { rows } = await db.query('SELECT * FROM batch_jobs WHERE id = $1', [jobId]);
  if (!rows.length) return null;
  const job = rows[0];
  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  return { ...job, progress };
}

async function updateCategorizationMetrics(totalTokens, cost, count) {
  try {
    const timeSaved = Math.floor((count / 20) * 29); // ~29 min per 20-product batch
    await db.query(
      `INSERT INTO metrics (date, categories_processed, tokens_used, estimated_cost, time_saved_minutes)
       VALUES (CURRENT_DATE, $1, $2, $3, $4)
       ON CONFLICT (date) DO UPDATE SET
         categories_processed = metrics.categories_processed + $1,
         tokens_used          = metrics.tokens_used + $2,
         estimated_cost       = metrics.estimated_cost + $3,
         time_saved_minutes   = metrics.time_saved_minutes + $4,
         updated_at           = NOW()`,
      [count, totalTokens, cost, timeSaved],
    );
  } catch (err) {
    console.error('[Metrics] Failed to update categorization metrics:', err.message);
  }
}

module.exports = { categorizeProduct, batchCategorize, createBatchJob, getBatchJobStatus, VALID_CATEGORIES };
