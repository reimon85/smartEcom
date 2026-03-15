require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Shopify-Hmac-Sha256'],
  credentials: true,
}));

// Raw body needed for Shopify HMAC verification on webhook routes
app.use('/api/alerts/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ── Routes ──────────────────────────────────────────────────────────────────
const descriptionsRouter = require('./modules/descriptions/routes');
const reviewsRouter = require('./modules/reviews/routes');
const alertsRouter = require('./modules/alerts/routes');
const categorizationRouter = require('./modules/categorization/routes');
const metricsRouter = require('./modules/metrics/routes');

app.use('/api/descriptions', descriptionsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/categorization', categorizationRouter);
app.use('/api/metrics', metricsRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const db = require('./db');
  try {
    await db.query('SELECT 1');
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        version: '1.0.0',
      },
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      data: { status: 'unhealthy', database: 'disconnected' },
      error: err.message,
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'SmartEcom AI Pipeline API',
      version: '1.0.0',
      endpoints: [
        '/api/descriptions',
        '/api/reviews',
        '/api/alerts',
        '/api/categorization',
        '/api/metrics',
        '/health',
      ],
    },
  });
});

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Scheduled jobs ──────────────────────────────────────────────────────────
// Update daily metrics at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Resetting daily metrics snapshot...');
  try {
    const metricsService = require('./modules/metrics/service');
    await metricsService.snapshotDailyMetrics();
    console.log('[CRON] Daily metrics snapshot done.');
  } catch (err) {
    console.error('[CRON] Error snapshotting metrics:', err.message);
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 SmartEcom API running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB URL      : ${(process.env.DATABASE_URL || '').replace(/:[^:@]*@/, ':***@')}`);
  console.log(`   CORS origin : ${process.env.CORS_ORIGIN || 'http://localhost:3001'}\n`);
});

module.exports = app;
