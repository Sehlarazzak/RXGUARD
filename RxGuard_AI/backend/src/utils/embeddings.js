// Local embedding service for semantic medicine search.
// Uses the Xenova/all-MiniLM-L6-v2 ONNX model (384 dimensions) via
// @xenova/transformers. The model is downloaded automatically on first use
// from Hugging Face and cached locally, so no external API key is required.
const { q } = require('../db');
const { usesForProduct } = require('./medicalUses');

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_VERSION = 'Xenova/all-MiniLM-L6-v2:uses-v2';
const EMBEDDING_DIM = 384;

let extractor = null;

async function getExtractor() {
  if (!extractor) {
    // Dynamic import avoids the CommonJS -> ESM warning from @xenova/transformers.
    const { pipeline } = await import('@xenova/transformers');
    extractor = await pipeline('feature-extraction', MODEL_NAME);
  }
  return extractor;
}

async function generateEmbedding(text) {
  const ext = await getExtractor();
  const output = await ext(String(text || '').trim(), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function productEmbeddingText(p) {
  const ingredients = (p.ingredients || []).map((i) => i.name).join(', ');
  const uses = usesForProduct(p).join(', ');
  let text = `${p.brand_name || ''} ${p.dosage_form || ''}. Contains ${ingredients || 'unknown ingredients'}.`;
  if (uses) text += ` Used for: ${uses}.`;
  if (p.source_text) text += ` ${p.source_text}`;
  return text.trim();
}

async function ensureProductEmbeddings(batchSize = 8) {
  const rows = await q(
    'SELECT p.product_id, p.brand_name, p.normalized_name, p.dosage_form, p.source_text, ' +
    "COALESCE((SELECT json_agg(json_build_object('ingredient_id', i.ingredient_id, 'name', i.name, " +
    "'strength_value', pi.strength_value, 'strength_unit', pi.strength_unit, " +
    "'composition_text', pi.composition_text) ORDER BY i.name) " +
    'FROM mediverify.product_ingredients pi ' +
    'JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id ' +
    'WHERE pi.product_id = p.product_id), \'[]\'::json) AS ingredients ' +
    'FROM mediverify.products p ' +
    'WHERE p.embedding IS NULL OR p.embedding_model IS NULL OR p.embedding_model <> $1',
    [EMBEDDING_VERSION]
  );
  if (!rows.length) {
    console.log('Product embeddings are up to date.');
    return;
  }

  console.log(`Generating embeddings for ${rows.length} medicine(s) using ${MODEL_NAME}...`);
  console.log('This may take a minute the first time while the model downloads.');
  await getExtractor();

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    for (const p of batch) {
      const text = productEmbeddingText(p);
      const vec = await generateEmbedding(text);
      await q(
        'UPDATE mediverify.products SET embedding = $1::jsonb, embedding_model = $2 WHERE product_id = $3',
        [JSON.stringify(vec), EMBEDDING_VERSION, p.product_id]
      );
    }
  }
  console.log('Product embeddings generated successfully.');
}

function getSemanticCandidates(queryEmbedding, products, threshold) {
  const scored = [];
  for (const p of products) {
    if (!p.embedding || p.embedding.length !== EMBEDDING_DIM) continue;
    const sim = cosineSimilarity(queryEmbedding, p.embedding);
    if (sim >= threshold) {
      scored.push({ product: p, score: sim });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

module.exports = {
  MODEL_NAME,
  EMBEDDING_DIM,
  generateEmbedding,
  cosineSimilarity,
  ensureProductEmbeddings,
  getSemanticCandidates,
  productEmbeddingText,
};
