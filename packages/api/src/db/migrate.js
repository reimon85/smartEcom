require('dotenv').config();
const db = require('./index');

const migrations = [
  {
    name: '001_create_products',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id                       SERIAL PRIMARY KEY,
        shopify_id               VARCHAR(64) UNIQUE,
        name                     VARCHAR(512) NOT NULL,
        attributes               JSONB DEFAULT '{}',
        description              TEXT,
        description_generated_at TIMESTAMPTZ,
        category                 VARCHAR(128),
        subcategory              VARCHAR(128),
        tags                     TEXT[],
        status                   VARCHAR(32) DEFAULT 'active',
        created_at               TIMESTAMPTZ DEFAULT NOW(),
        updated_at               TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id);
      CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_status     ON products(status);
    `,
  },
  {
    name: '002_create_reviews',
    sql: `
      CREATE TABLE IF NOT EXISTS reviews (
        id                  SERIAL PRIMARY KEY,
        shopify_product_id  VARCHAR(64),
        reviewer_name       VARCHAR(256),
        rating              INT CHECK (rating >= 1 AND rating <= 5),
        content             TEXT NOT NULL,
        sentiment           VARCHAR(16),
        sentiment_score     DECIMAL(4,2),
        ai_response         TEXT,
        rejection_feedback  TEXT,
        status              VARCHAR(32) DEFAULT 'pending',
        approved_at         TIMESTAMPTZ,
        published_at        TIMESTAMPTZ,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_status             ON reviews(status);
      CREATE INDEX IF NOT EXISTS idx_reviews_shopify_product_id ON reviews(shopify_product_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_sentiment          ON reviews(sentiment);
      CREATE INDEX IF NOT EXISTS idx_reviews_created_at         ON reviews(created_at);
    `,
  },
  {
    name: '003_create_stock_alerts',
    sql: `
      CREATE TABLE IF NOT EXISTS stock_alerts (
        id                  SERIAL PRIMARY KEY,
        shopify_product_id  VARCHAR(64),
        product_name        VARCHAR(512) NOT NULL,
        current_stock       INT NOT NULL,
        threshold           INT NOT NULL DEFAULT 10,
        alert_type          VARCHAR(32) DEFAULT 'low_stock',
        ai_copy             JSONB DEFAULT '{}',
        is_active           BOOLEAN DEFAULT TRUE,
        sent_at             TIMESTAMPTZ,
        created_at          TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_stock_alerts_active     ON stock_alerts(is_active);
      CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON stock_alerts(shopify_product_id);
      CREATE INDEX IF NOT EXISTS idx_stock_alerts_created_at ON stock_alerts(created_at);
    `,
  },
  {
    name: '004_create_batch_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS batch_jobs (
        id           SERIAL PRIMARY KEY,
        type         VARCHAR(64) NOT NULL,
        status       VARCHAR(32) DEFAULT 'pending',
        total        INT DEFAULT 0,
        processed    INT DEFAULT 0,
        errors       INT DEFAULT 0,
        started_at   TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        metadata     JSONB DEFAULT '{}',
        error_log    JSONB DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_batch_jobs_type   ON batch_jobs(type);
    `,
  },
  {
    name: '005_create_metrics',
    sql: `
      CREATE TABLE IF NOT EXISTS metrics (
        id                    SERIAL PRIMARY KEY,
        date                  DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
        descriptions_generated INT DEFAULT 0,
        reviews_processed      INT DEFAULT 0,
        alerts_sent            INT DEFAULT 0,
        categories_processed   INT DEFAULT 0,
        tokens_used            INT DEFAULT 0,
        estimated_cost         DECIMAL(10,6) DEFAULT 0,
        time_saved_minutes     INT DEFAULT 0,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        updated_at             TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(date);
    `,
  },
  {
    name: '006_create_schema_migrations',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(256) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations() {
  console.log('Running database migrations...\n');

  // Ensure migrations table exists first
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(256) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await db.query('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.map((r) => r.name));

  let count = 0;
  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      console.log(`  ✓ ${migration.name} (already applied)`);
      continue;
    }
    try {
      await db.query(migration.sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
      console.log(`  ✅ ${migration.name}`);
      count++;
    } catch (err) {
      console.error(`  ❌ ${migration.name}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete. ${count} new migration(s) applied.\n`);
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
