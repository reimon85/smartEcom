# SmartEcom — Pipeline de Automatización con IA para E-commerce

Sistema que automatiza las tareas más repetitivas de tu tienda online: generación de descripciones SEO, gestión de reseñas con aprobación humana, alertas de stock y categorización masiva de productos.

---

## ¿Qué hace este sistema?

| Módulo | Entrada | Salida | Ahorro de tiempo |
|--------|---------|--------|-----------------|
| **Descripciones de producto** | Nombre + atributos | Descripción SEO + bullets + meta description | 15 min → 30 seg |
| **Respuestas a reseñas** | Texto de la reseña | Sentimiento + respuesta lista para aprobar | 20 min → 2 min |
| **Alertas de stock bajo** | Webhook de Shopify | Copy para email / SMS / push automático | Inmediato |
| **Categorización por CSV** | Fichero CSV de productos | Categoría + subcategoría + score de confianza | 30 min → 1 min |
| **Dashboard de métricas** | — | KPIs en vivo + calculadora de ROI | Actualización cada 30 seg |

---

## Puesta en marcha

### Requisitos previos
- Node.js 18+
- Docker y Docker Compose
- Clave de API de OpenAI
- Tienda Shopify (para los webhooks, opcional en desarrollo)

### Opción A — Docker (stack completo, recomendado)

```bash
# 1. Copiar variables de entorno y rellenar tus claves
cp .env.example .env

# 2. Levantar todo (PostgreSQL + API + Dashboard + n8n)
docker compose up -d
```

### Opción B — Desarrollo local

```bash
# 1. Variables de entorno
cp .env.example .env

# 2. Instalar dependencias
npm install

# 3. Crear tablas y datos de prueba
npm run migrate
npm run seed

# 4. Arrancar en modo desarrollo
npm run dev
```

| Servicio | URL |
|----------|-----|
| API REST | http://localhost:3000 |
| Dashboard | http://localhost:3001 |
| n8n | http://localhost:5678 |

---

## Endpoints de la API

### Descripciones
```
POST /api/descriptions/generate          → descripción individual
POST /api/descriptions/batch             → hasta 100 productos en paralelo
GET  /api/descriptions/batch/:jobId      → estado del trabajo en curso
POST /api/descriptions/upload            → subir CSV y procesar en batch
```

### Reseñas
```
POST /api/reviews/analyze                → analizar + generar respuesta
GET  /api/reviews/pending                → cola de aprobación humana
POST /api/reviews/:id/approve            → aprobar y publicar
POST /api/reviews/:id/reject             → rechazar
POST /api/reviews/:id/regenerate         → regenerar respuesta con contexto
GET  /api/reviews/stats                  → estadísticas de sentimiento
```

### Alertas de stock
```
POST /api/alerts/check                   → revisión manual de stock
POST /api/alerts/webhook/shopify         → webhook de inventario de Shopify
GET  /api/alerts/history                 → historial de alertas
GET  /api/alerts/active                  → alertas activas en este momento
```

### Categorización
```
POST /api/categorization/categorize      → producto individual
POST /api/categorization/batch           → array de productos
POST /api/categorization/upload          → subir CSV
GET  /api/categorization/batch/:jobId    → progreso del trabajo
```

### Métricas
```
GET /api/metrics/dashboard               → KPIs del dashboard
GET /api/metrics/roi                     → cálculo de ROI
GET /api/metrics/history                 → datos históricos
```

---

## ROI estimado

| Tarea | Tiempo manual | Tiempo con IA | Ahorro |
|-------|--------------|---------------|--------|
| Descripción de producto | 15 min | 30 seg | 14,5 min |
| Respuesta a reseña | 20 min | 2 min | 18 min |
| Categorización (batch) | 30 min | 1 min | 29 min |

Asumiendo un coste laboral de **15 €/hora**:

- **100 descripciones/día** → ahorro de ~36 €/día en tiempo
- **50 reseñas/día** → ahorro de ~22 €/día en tiempo
- **5 batches de categorización/día** → ahorro de ~36 €/día en tiempo

Coste de IA (gpt-4o-mini): **~0,04 € por cada 100 descripciones**.

---

## Flujos de trabajo n8n (instalables por el cliente)

Importa los workflows desde la carpeta `/workflows/` directamente en tu instancia de n8n:

1. `shopify-product-to-description.json` — Producto creado en Shopify → descripción generada automáticamente
2. `review-processor.json` — Reseña recibida → análisis → cola de aprobación → publicación
3. `stock-alert-workflow.json` — Inventario bajo → copy generado → email + Slack

---

## Arquitectura del proyecto

```
smartEcom/
├── packages/
│   ├── api/                  ← Backend Express.js (puerto 3000)
│   │   └── src/
│   │       ├── modules/      ← Un directorio por módulo
│   │       ├── db/           ← PostgreSQL (pool + migraciones + seed)
│   │       └── webhooks/     ← Verificación HMAC de Shopify
│   └── dashboard/            ← Frontend Next.js 14 (puerto 3001)
│       └── src/
│           ├── app/          ← Páginas (App Router)
│           ├── components/   ← Componentes reutilizables
│           └── lib/          ← Cliente API tipado
└── workflows/                ← JSONs exportables para n8n
```

---

## Costes de IA (gpt-4o-mini)

| Concepto | Precio |
|----------|--------|
| Tokens de entrada | $0,00015 / 1K tokens |
| Tokens de salida | $0,0006 / 1K tokens |
| Coste por descripción | ~$0,0004 |
| 100 descripciones/día | ~$0,04/día |
