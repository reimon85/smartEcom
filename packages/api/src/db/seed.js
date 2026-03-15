require('dotenv').config();
const db = require('./index');

const sampleProducts = [
  {
    shopify_id: 'shopify_8001',
    name: 'Ultra-Slim Wireless Ergonomic Keyboard',
    category: 'Electronics',
    subcategory: 'Computer Accessories',
    attributes: {
      brand: 'KeyMaster',
      color: 'Space Gray',
      connectivity: 'Bluetooth 5.0',
      battery_life: '12 months',
      layout: 'US QWERTY',
      weight: '680g',
      compatibility: 'Windows, macOS, iOS, Android',
    },
  },
  {
    shopify_id: 'shopify_8002',
    name: 'Men\'s Merino Wool Running Hoodie',
    category: 'Clothing',
    subcategory: 'Men\'s Activewear',
    attributes: {
      material: '100% Merino Wool',
      sizes: 'XS-3XL',
      colors: 'Navy, Charcoal, Forest Green',
      feature: 'Moisture-wicking, odor-resistant',
      care: 'Machine washable',
    },
  },
  {
    shopify_id: 'shopify_8003',
    name: 'Bamboo Cutting Board Set (3-Pack)',
    category: 'Home & Garden',
    subcategory: 'Kitchen',
    attributes: {
      material: 'Organic Bamboo',
      sizes: 'S/M/L',
      features: 'Juice groove, non-slip feet',
      eco_certified: true,
      dishwasher_safe: false,
    },
  },
  {
    shopify_id: 'shopify_8004',
    name: 'Vitamin C + Hyaluronic Acid Serum 30ml',
    category: 'Beauty',
    subcategory: 'Skincare',
    attributes: {
      key_ingredients: 'Vitamin C 20%, Hyaluronic Acid, Niacinamide',
      skin_type: 'All skin types',
      cruelty_free: true,
      fragrance_free: true,
      spf: false,
      volume: '30ml',
    },
  },
  {
    shopify_id: 'shopify_8005',
    name: 'Adjustable Resistance Band Set (5 Levels)',
    category: 'Sports',
    subcategory: 'Fitness Equipment',
    attributes: {
      resistance_levels: ['Extra Light', 'Light', 'Medium', 'Heavy', 'Extra Heavy'],
      material: 'Natural latex',
      max_resistance: '150 lbs',
      includes: 'Carry bag, door anchor, handles',
    },
  },
  {
    shopify_id: 'shopify_8006',
    name: 'Cold Brew Coffee Maker 1L Glass',
    category: 'Food & Beverage',
    subcategory: 'Coffee & Tea',
    attributes: {
      capacity: '1 Liter',
      material: 'Borosilicate glass, stainless steel filter',
      brew_time: '12-24 hours',
      dishwasher_safe: true,
      bpa_free: true,
    },
  },
  {
    shopify_id: 'shopify_8007',
    name: 'RGB Mechanical Gaming Keyboard TKL',
    category: 'Electronics',
    subcategory: 'Gaming Peripherals',
    attributes: {
      switch_type: 'Cherry MX Red',
      form_factor: 'Tenkeyless (TKL)',
      backlight: 'Per-key RGB',
      polling_rate: '1000Hz',
      cable: 'Detachable USB-C',
      os: 'Windows, macOS',
    },
  },
  {
    shopify_id: 'shopify_8008',
    name: 'Women\'s Yoga Leggings High-Waist 7/8',
    category: 'Clothing',
    subcategory: 'Women\'s Activewear',
    attributes: {
      material: '78% Nylon, 22% Spandex',
      waistband: 'High-waist compression',
      sizes: 'XS-XL',
      pockets: '2 side + 1 waistband',
      feature: '4-way stretch, squat-proof',
    },
  },
  {
    shopify_id: 'shopify_8009',
    name: 'Smart Indoor Plant Watering System',
    category: 'Home & Garden',
    subcategory: 'Gardening',
    attributes: {
      capacity: '2L reservoir',
      runtime: 'Up to 30 days',
      connectivity: 'Bluetooth app control',
      compatible_plants: 'All indoor plants',
      power: 'USB-C rechargeable',
    },
  },
  {
    shopify_id: 'shopify_8010',
    name: 'Retinol Anti-Aging Night Cream 50ml',
    category: 'Beauty',
    subcategory: 'Skincare',
    attributes: {
      retinol_concentration: '0.3%',
      additional_ingredients: 'Peptides, Ceramides, Squalane',
      skin_type: 'Normal to Dry',
      usage: 'PM only',
      paraben_free: true,
      volume: '50ml',
    },
  },
  {
    shopify_id: 'shopify_8011',
    name: 'Foam Roller Pro 36" High Density',
    category: 'Sports',
    subcategory: 'Recovery',
    attributes: {
      length: '36 inches',
      density: 'High density EPP',
      texture: 'Grid pattern',
      weight_capacity: '300 lbs',
      use_case: 'Muscle recovery, myofascial release',
    },
  },
  {
    shopify_id: 'shopify_8012',
    name: 'Organic Matcha Green Tea Powder 100g',
    category: 'Food & Beverage',
    subcategory: 'Tea',
    attributes: {
      grade: 'Ceremonial grade',
      origin: 'Uji, Japan',
      organic_certified: true,
      weight: '100g',
      caffeine: '35mg per serving',
    },
  },
  {
    shopify_id: 'shopify_8013',
    name: '4K Webcam with Ring Light and Noise-Cancelling Mic',
    category: 'Electronics',
    subcategory: 'Video Conferencing',
    attributes: {
      resolution: '4K 30fps / 1080p 60fps',
      fov: '90° wide angle',
      autofocus: 'AI-powered',
      ring_light: '10 brightness levels',
      mic: 'Dual stereo noise-cancelling',
      os: 'Plug-and-play Windows/macOS',
    },
  },
  {
    shopify_id: 'shopify_8014',
    name: 'Leather Crossbody Bag - Minimalist Design',
    category: 'Clothing',
    subcategory: 'Bags & Accessories',
    attributes: {
      material: 'Full-grain leather',
      dimensions: '25 x 18 x 8 cm',
      strap: 'Adjustable 50-140cm',
      colors: 'Tan, Black, Burgundy',
      pockets: '3 compartments',
    },
  },
  {
    shopify_id: 'shopify_8015',
    name: 'Weighted Blanket 15lbs 60"x80"',
    category: 'Home & Garden',
    subcategory: 'Bedding',
    attributes: {
      weight: '15 lbs',
      dimensions: '60" x 80"',
      filling: 'Glass beads',
      cover: 'Removable minky cover',
      suitable_for: 'Adults 130-180 lbs',
      machine_washable: true,
    },
  },
  {
    shopify_id: 'shopify_8016',
    name: 'Natural Hair Mask with Argan Oil 300ml',
    category: 'Beauty',
    subcategory: 'Hair Care',
    attributes: {
      key_ingredients: 'Argan Oil, Keratin, Biotin',
      hair_type: 'Dry, damaged, color-treated',
      treatment_time: '5-10 minutes',
      sulfate_free: true,
      volume: '300ml',
    },
  },
  {
    shopify_id: 'shopify_8017',
    name: 'Adjustable Dumbbell Set 5-52.5 lbs',
    category: 'Sports',
    subcategory: 'Weight Training',
    attributes: {
      weight_range: '5 to 52.5 lbs per dumbbell',
      increment: '2.5 lb increments',
      adjustment_time: '< 5 seconds',
      material: 'Steel plates, ergonomic grip',
      storage: 'Includes tray',
    },
  },
  {
    shopify_id: 'shopify_8018',
    name: 'Bluetooth Noise-Cancelling Headphones ANC Pro',
    category: 'Electronics',
    subcategory: 'Audio',
    attributes: {
      anc: 'Hybrid Active Noise Cancelling',
      battery_life: '40 hours with ANC',
      driver: '40mm custom',
      codec: 'LDAC, aptX, AAC',
      weight: '250g',
      foldable: true,
    },
  },
  {
    shopify_id: 'shopify_8019',
    name: 'Stainless Steel Insulated Water Bottle 32oz',
    category: 'Sports',
    subcategory: 'Hydration',
    attributes: {
      capacity: '32oz / 946ml',
      insulation: 'Triple-wall vacuum',
      cold: '48 hours',
      hot: '24 hours',
      lid: 'Leak-proof flip lid',
      bpa_free: true,
      dishwasher_safe: true,
    },
  },
  {
    shopify_id: 'shopify_8020',
    name: 'Smart Air Purifier HEPA H13 for Large Rooms',
    category: 'Home & Garden',
    subcategory: 'Air Quality',
    attributes: {
      filter: 'True HEPA H13 + Activated Carbon',
      coverage: '600 sq ft',
      noise_level: '22dB on silent mode',
      cadr: '300 m³/h',
      smart_features: 'WiFi, air quality sensor, auto mode',
      filter_life: '12 months',
    },
  },
];

const sampleReviews = [
  {
    shopify_product_id: 'shopify_8001',
    reviewer_name: 'Sarah M.',
    rating: 5,
    content: 'Absolutely love this keyboard! The slim profile is perfect for my desk setup and the battery lasts forever. Typing feels amazing.',
    sentiment: 'positive',
    sentiment_score: 9.2,
    ai_response: 'Thank you so much, Sarah! We\'re thrilled to hear you\'re enjoying the Ultra-Slim Keyboard. The 12-month battery life is definitely one of our favorite features too!',
    status: 'approved',
  },
  {
    shopify_product_id: 'shopify_8003',
    reviewer_name: 'James K.',
    rating: 3,
    content: 'The cutting boards look great but the smallest one warped after a few uses. The large one is perfect though.',
    sentiment: 'neutral',
    sentiment_score: 5.5,
    ai_response: 'Hi James, thank you for your honest feedback. We\'re sorry to hear about the warping on the small board. Please contact our support team for a replacement — bamboo boards need occasional oiling to maintain shape, and we\'d love to share those care tips with you.',
    status: 'pending',
  },
  {
    shopify_product_id: 'shopify_8004',
    reviewer_name: 'Emily R.',
    rating: 1,
    content: 'Terrible product. Caused a rash on my face. I have sensitive skin and this is supposed to be gentle. Very disappointed and want a refund.',
    sentiment: 'negative',
    sentiment_score: 1.5,
    ai_response: 'We\'re sincerely sorry to hear about your experience, Emily. Your skin health is our top priority and we take this very seriously. Please stop using the product immediately. Our customer care team will reach out within 24 hours to arrange a full refund and to learn more about your experience.',
    status: 'pending',
  },
];

const sampleAlerts = [
  {
    shopify_product_id: 'shopify_8005',
    product_name: 'Adjustable Resistance Band Set (5 Levels)',
    current_stock: 3,
    threshold: 10,
    alert_type: 'critical_low',
    ai_copy: {
      email_subject: '⚡ LAST 3 LEFT: Resistance Bands Flying Off Shelves!',
      email_body: 'Don\'t miss out — only 3 sets remain in stock. Our resistance band sets have been our #1 bestseller this month.',
      sms: 'ALERT: Only 3 Resistance Band Sets left! Order now before they\'re gone: [link]',
      push_notification: '🔥 Almost sold out! Grab your Resistance Bands now — only 3 left!',
    },
    is_active: true,
  },
  {
    shopify_product_id: 'shopify_8011',
    product_name: 'Foam Roller Pro 36" High Density',
    current_stock: 7,
    threshold: 10,
    alert_type: 'low_stock',
    ai_copy: {
      email_subject: 'Low Stock Alert: Foam Roller Pro Running Low',
      email_body: 'We\'re running low on the Foam Roller Pro. Consider restocking soon to meet customer demand.',
      sms: 'Low stock: Foam Roller Pro at 7 units. Time to reorder!',
      push_notification: 'Stock alert: Foam Roller Pro is running low (7 remaining)',
    },
    is_active: true,
  },
];

async function seed() {
  console.log('Seeding database with sample data...\n');

  try {
    // Seed products
    console.log('Inserting 20 sample products...');
    for (const product of sampleProducts) {
      await db.query(
        `INSERT INTO products (shopify_id, name, category, subcategory, attributes, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (shopify_id) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           subcategory = EXCLUDED.subcategory,
           attributes = EXCLUDED.attributes,
           updated_at = NOW()`,
        [
          product.shopify_id,
          product.name,
          product.category,
          product.subcategory,
          JSON.stringify(product.attributes),
        ],
      );
    }
    console.log(`  ✅ ${sampleProducts.length} products inserted/updated`);

    // Seed reviews
    console.log('Inserting sample reviews...');
    for (const review of sampleReviews) {
      await db.query(
        `INSERT INTO reviews (shopify_product_id, reviewer_name, rating, content, sentiment, sentiment_score, ai_response, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          review.shopify_product_id,
          review.reviewer_name,
          review.rating,
          review.content,
          review.sentiment,
          review.sentiment_score,
          review.ai_response,
          review.status,
        ],
      );
    }
    console.log(`  ✅ ${sampleReviews.length} reviews inserted`);

    // Seed stock alerts
    console.log('Inserting sample stock alerts...');
    for (const alert of sampleAlerts) {
      await db.query(
        `INSERT INTO stock_alerts (shopify_product_id, product_name, current_stock, threshold, alert_type, ai_copy, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          alert.shopify_product_id,
          alert.product_name,
          alert.current_stock,
          alert.threshold,
          alert.alert_type,
          JSON.stringify(alert.ai_copy),
          alert.is_active ? 1 : 0,
        ],
      );
    }
    console.log(`  ✅ ${sampleAlerts.length} stock alerts inserted`);

    // Seed metrics for the past 7 days
    console.log('Inserting sample metrics (last 7 days)...');
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const descriptions = Math.floor(Math.random() * 50) + 10;
      const reviews = Math.floor(Math.random() * 30) + 5;
      const alerts = Math.floor(Math.random() * 10) + 1;
      const categories = Math.floor(Math.random() * 100) + 20;
      const tokens = (descriptions * 500) + (reviews * 300) + (categories * 200);
      const cost = ((tokens * 0.00015) / 1000).toFixed(6);
      const timeSaved = (descriptions * 14) + (reviews * 18) + Math.floor(categories / 20) * 29;

      await db.query(
        `INSERT INTO metrics (date, descriptions_generated, reviews_processed, alerts_sent, categories_processed, tokens_used, estimated_cost, time_saved_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (date) DO UPDATE SET
           descriptions_generated = EXCLUDED.descriptions_generated,
           reviews_processed = EXCLUDED.reviews_processed,
           alerts_sent = EXCLUDED.alerts_sent,
           categories_processed = EXCLUDED.categories_processed,
           tokens_used = EXCLUDED.tokens_used,
           estimated_cost = EXCLUDED.estimated_cost,
           time_saved_minutes = EXCLUDED.time_saved_minutes,
           updated_at = NOW()`,
        [dateStr, descriptions, reviews, alerts, categories, tokens, cost, timeSaved],
      );
    }
    console.log('  ✅ 7 days of metrics inserted');

    console.log('\n✅ Database seeding complete!\n');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    process.exit(0);
  }
}

seed();
