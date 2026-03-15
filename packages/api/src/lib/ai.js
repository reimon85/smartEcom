/**
 * AI wrapper — uses real OpenAI when OPENAI_API_KEY is set,
 * falls back to realistic mock data otherwise.
 */

const MOCK_MODE = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock';

// ── Mock response generators ──────────────────────────────────────────────────

function mockDescription(prompt) {
  const nameMatch = prompt.match(/Product Name:\s*(.+)/);
  const name = nameMatch ? nameMatch[1].trim() : 'Product';
  const categoryMatch = prompt.match(/Category:\s*(.+)/);
  const category = categoryMatch ? categoryMatch[1].trim() : 'General';

  return {
    title: `${name} — Best ${category} Choice for 2024 | Free Shipping`,
    meta_description: `Buy ${name}. Premium quality, fast delivery. Shop now and save up to 20% on your first order. ✓ Secure checkout.`,
    full_description: `Discover the ${name}, designed for those who demand the best. Whether you're a seasoned professional or just getting started, this ${category.toLowerCase()} product delivers outstanding performance that exceeds expectations.\n\nBuilt with precision and care, every detail of the ${name} has been crafted to enhance your experience. Our customers consistently report improved results within days of use, making this one of our most recommended products.\n\nJoin thousands of satisfied customers who have made ${name} their go-to choice. With our satisfaction guarantee, there's no reason to wait — experience the difference today.`,
    bullet_points: [
      `Premium quality materials ensure long-lasting durability and reliability`,
      `Designed for ease of use — ready to perform from day one`,
      `Compatible with a wide range of setups and use cases`,
      `Backed by our 30-day satisfaction guarantee and dedicated support`,
      `Trusted by thousands of customers with consistently 5-star reviews`,
    ],
    keywords: [
      name.toLowerCase(),
      `buy ${name.toLowerCase()}`,
      `best ${category.toLowerCase()}`,
      `${category.toLowerCase()} shop`,
      `${name.toLowerCase()} review`,
      `premium ${category.toLowerCase()} products`,
    ],
  };
}

function mockReviewAnalysis(prompt) {
  const contentMatch = prompt.match(/Review Content:\s*"([^"]+)"/i) ||
                       prompt.match(/Review:\s*"([^"]+)"/i) ||
                       prompt.match(/review text[^:]*:\s*"([^"]+)"/i);
  const content = contentMatch ? contentMatch[1].toLowerCase() : '';

  const positiveWords = ['love', 'great', 'excellent', 'amazing', 'perfect', 'fantastic', 'awesome', 'best'];
  const negativeWords = ['terrible', 'awful', 'broken', 'refund', 'rash', 'disappointed', 'horrible', 'worst', 'bad'];

  const posScore = positiveWords.filter((w) => content.includes(w)).length;
  const negScore = negativeWords.filter((w) => content.includes(w)).length;

  let sentiment, score, response;

  if (negScore > posScore) {
    sentiment = 'negative';
    score = 2.0 + Math.random() * 2;
    response = `We're truly sorry to hear about your experience. This is not the standard we hold ourselves to, and we want to make it right. Please reach out to our customer support team directly and we'll resolve this for you as quickly as possible — your satisfaction is our top priority.`;
  } else if (posScore > negScore) {
    sentiment = 'positive';
    score = 8.0 + Math.random() * 2;
    response = `Thank you so much for your wonderful review! We're thrilled to hear you're enjoying your purchase. Reviews like yours mean the world to us and motivate our team to keep delivering the best products and service possible. See you again soon!`;
  } else {
    sentiment = 'neutral';
    score = 5.0 + Math.random() * 2;
    response = `Thank you for taking the time to share your feedback — we genuinely appreciate it. We're glad parts of your experience were positive, and we'd love to learn more about how we can make your next experience even better. Feel free to reach out to our team anytime.`;
  }

  return { sentiment, sentiment_score: parseFloat(score.toFixed(1)), response };
}

function mockAlertCopy(prompt) {
  const productMatch = prompt.match(/Product:\s*(.+)/i) || prompt.match(/product name[^:]*:\s*(.+)/i);
  const stockMatch = prompt.match(/Current Stock:\s*(\d+)/i);
  const product = productMatch ? productMatch[1].trim() : 'this product';
  const stock = stockMatch ? stockMatch[1] : '5';

  return {
    email_subject: `⚠️ Últimas ${stock} unidades: ${product}`,
    email_body: `Solo quedan ${stock} unidades de ${product} en stock. No dejes que tus clientes se queden sin él — repón inventario antes de agotar existencias y perder ventas.`,
    sms: `ALERTA: ${product} casi agotado (${stock} uds). Actúa ahora: [enlace]`,
    push_notification: `🔥 Stock crítico: ${product} — solo ${stock} unidades disponibles`,
    internal_note: `Considerar reorden urgente. Producto con alta demanda reciente.`,
  };
}

function mockCategorization(prompt) {
  const nameMatch = prompt.match(/Product[^:]*:\s*(.+)/i);
  const name = nameMatch ? nameMatch[1].toLowerCase() : '';

  const rules = [
    { keywords: ['laptop', 'phone', 'keyboard', 'webcam', 'headphone', 'speaker', 'cable', 'charger', 'monitor', 'gaming'], category: 'Electronics', subcategory: 'Consumer Electronics' },
    { keywords: ['shirt', 'hoodie', 'legging', 'dress', 'jacket', 'bag', 'shoe', 'boot', 'pants', 'jeans', 'wool'], category: 'Clothing', subcategory: "Men's & Women's Apparel" },
    { keywords: ['cutting board', 'blender', 'air purifier', 'blanket', 'pillow', 'towel', 'plant', 'candle'], category: 'Home & Garden', subcategory: 'Home Essentials' },
    { keywords: ['serum', 'cream', 'moisturizer', 'shampoo', 'conditioner', 'mask', 'lipstick', 'foundation'], category: 'Beauty', subcategory: 'Skincare & Cosmetics' },
    { keywords: ['dumbbell', 'yoga', 'resistance band', 'foam roller', 'water bottle', 'protein', 'running'], category: 'Sports', subcategory: 'Fitness & Outdoor' },
    { keywords: ['coffee', 'tea', 'matcha', 'supplement', 'vitamin', 'snack', 'organic'], category: 'Food & Beverage', subcategory: 'Health & Nutrition' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => name.includes(kw))) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        tags: rule.keywords.filter((kw) => name.includes(kw)).slice(0, 3),
        confidence: parseFloat((0.82 + Math.random() * 0.15).toFixed(2)),
      };
    }
  }

  return {
    category: 'Other',
    subcategory: 'General',
    tags: [],
    confidence: 0.55,
  };
}

function generateMockContent(messages) {
  const allText = messages.map((m) => m.content).join('\n');

  if (allText.includes('bullet_points') || allText.includes('meta_description')) {
    return mockDescription(allText);
  }
  if (allText.includes('sentiment') && allText.includes('response')) {
    return mockReviewAnalysis(allText);
  }
  if (allText.includes('email_subject') || allText.includes('push_notification')) {
    return mockAlertCopy(allText);
  }
  if (allText.includes('category') && allText.includes('subcategory')) {
    return mockCategorization(allText);
  }
  return { result: 'mock response', mock: true };
}

// ── Mock OpenAI class (same interface as the real SDK) ────────────────────────

class MockOpenAI {
  constructor() {
    this.chat = {
      completions: {
        create: async (options) => {
          // Simulate ~300ms latency
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
          const content = generateMockContent(options.messages || []);
          return {
            choices: [{ message: { content: JSON.stringify(content) } }],
            usage: { prompt_tokens: 380, completion_tokens: 460, total_tokens: 840 },
          };
        },
      },
    };
  }
}

// ── Export real or mock OpenAI ────────────────────────────────────────────────

let _client;

function getClient() {
  if (_client) return _client;

  if (MOCK_MODE) {
    console.log('[AI] Mock mode active — no real OpenAI calls will be made.');
    _client = new MockOpenAI();
  } else {
    const OpenAI = require('openai');
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return _client;
}

module.exports = { getClient, MOCK_MODE };
