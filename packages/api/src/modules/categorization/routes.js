const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const service = require('./service');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../../../../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

/**
 * POST /api/categorization/categorize
 * Categorize a single product.
 * Body: { name, description?, attributes? }
 */
router.post('/categorize', async (req, res) => {
  try {
    const { name, description, attributes, shopify_id } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }
    const result = await service.categorizeProduct({ name, description, attributes, shopify_id });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Categorization] categorize error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/categorization/batch
 * Batch categorize multiple products.
 * Body: { products: [{ name, description?, attributes? }] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'products array is required' });
    }
    if (products.length > 1000) {
      return res.status(400).json({ success: false, error: 'Maximum 1000 products per batch' });
    }

    const { jobId } = await service.createBatchJob(products);
    return res.status(202).json({
      success: true,
      data: {
        jobId,
        message: `Categorization batch job started for ${products.length} products`,
        statusUrl: `/api/categorization/batch/${jobId}`,
        estimatedTime: `${Math.ceil(products.length / 15) * 8} seconds`,
      },
    });
  } catch (err) {
    console.error('[Categorization] batch error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/categorization/upload
 * Upload CSV for batch categorization.
 * Expected CSV columns: name, [description], [any other columns treated as attributes]
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required' });
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'CSV file is empty' });
    }

    const products = records.map((row) => {
      const { name, description, shopify_id, id, category, ...attrs } = row;
      return {
        name: name || row.Name || row.product_name,
        description: description || row.Description,
        shopify_id: shopify_id || id,
        attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
      };
    }).filter((p) => p.name);

    if (products.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid products in CSV (name column required)' });
    }

    const { jobId } = await service.createBatchJob(products);
    return res.status(202).json({
      success: true,
      data: {
        jobId,
        message: `CSV uploaded, categorization batch started for ${products.length} products`,
        rowsFound: records.length,
        validProducts: products.length,
        statusUrl: `/api/categorization/batch/${jobId}`,
      },
    });
  } catch (err) {
    console.error('[Categorization] upload error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
});

/**
 * GET /api/categorization/batch/:jobId
 * Get categorization batch job progress.
 */
router.get('/batch/:jobId', async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      return res.status(400).json({ success: false, error: 'Invalid jobId' });
    }
    const job = await service.getBatchJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Batch job not found' });
    }
    return res.json({ success: true, data: job });
  } catch (err) {
    console.error('[Categorization] batch status error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/categorization/categories
 * List available categories.
 */
router.get('/categories', (req, res) => {
  return res.json({ success: true, data: service.VALID_CATEGORIES });
});

module.exports = router;
