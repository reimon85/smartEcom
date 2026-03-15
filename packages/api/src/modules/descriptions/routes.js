const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const service = require('./service');

const router = express.Router();

// Multer config: store uploads to disk temporarily
const upload = multer({
  dest: path.join(__dirname, '../../../../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

/**
 * POST /api/descriptions/generate
 * Generate a single SEO product description.
 * Body: { name, category, attributes }
 */
router.post('/generate', async (req, res) => {
  try {
    const { name, category, attributes, shopify_id } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }
    const result = await service.generateDescription({ name, category, attributes, shopify_id });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Descriptions] generate error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/descriptions/batch
 * Batch-generate descriptions for an array of products.
 * Body: { products: [{ name, category, attributes }] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'products array is required' });
    }
    if (products.length > 500) {
      return res.status(400).json({ success: false, error: 'Maximum 500 products per batch' });
    }

    const { jobId } = await service.createBatchJob(products);
    return res.status(202).json({
      success: true,
      data: {
        jobId,
        message: `Batch job started for ${products.length} products`,
        statusUrl: `/api/descriptions/batch/${jobId}`,
        estimatedTime: `${Math.ceil(products.length / 10) * 12} seconds`,
      },
    });
  } catch (err) {
    console.error('[Descriptions] batch error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/descriptions/batch/:jobId
 * Poll batch job status.
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
    console.error('[Descriptions] batch status error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/descriptions/upload
 * Upload a CSV file and batch-process all products in it.
 * Expected CSV columns: name, category, [any attribute columns...]
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

    // Map CSV rows to product objects
    const products = records.map((row) => {
      const { name, category, shopify_id, ...rest } = row;
      return {
        name: name || row.Name || row.product_name,
        category: category || row.Category,
        shopify_id: shopify_id || row.id,
        attributes: rest,
      };
    }).filter((p) => p.name);

    if (products.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid products found in CSV (name column required)' });
    }

    const { jobId } = await service.createBatchJob(products);
    return res.status(202).json({
      success: true,
      data: {
        jobId,
        message: `CSV uploaded and batch job started for ${products.length} products`,
        rowsFound: records.length,
        validProducts: products.length,
        statusUrl: `/api/descriptions/batch/${jobId}`,
      },
    });
  } catch (err) {
    console.error('[Descriptions] upload error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => {}); // cleanup temp file
    }
  }
});

module.exports = router;
