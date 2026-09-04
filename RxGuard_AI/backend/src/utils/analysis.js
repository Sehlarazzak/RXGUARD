// RxGuard AI analysis engine.
// Parses free-text prescriptions, fuzzy-matches medicine names against the
// mediverify drug database, classifies safety status and computes safe
// alternatives scored by ingredient overlap, name similarity and dosage-form
// match. This is real data-driven analysis on top of the DRAP dataset.

const { q } = require('../db');

const SAFE_STATUSES = ['active'];

let productsCache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30000; // 30s keeps the sidebar snappy but always fresh

async function loadProducts(force = false) {
  const now = Date.now();
  if (!force && productsCache && now - cacheTime < CACHE_TTL_MS) return productsCache;

  const products = await q(
    "SELECT p.product_id, p.brand_name, p.normalized_name, p.dosage_form, " +
    "p.registration_number, p.registration_date, p.safety_status, " +
    "p.source_category, p.source_text, " +
    "m.manufacturer_id, m.legal_name AS manufacturer_name, m.country AS manufacturer_country, " +
    "COALESCE((SELECT json_agg(json_build_object('ingredient_id', i.ingredient_id, 'name', i.name, " +
    "'strength_value', pi.strength_value, 'strength_unit', pi.strength_unit, " +
    "'composition_text', pi.composition_text) ORDER BY i.name) " +
    "FROM mediverify.product_ingredients pi " +
    "JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id " +
    "WHERE pi.product_id = p.product_id), '[]'::json) AS ingredients " +
    "FROM mediverify.products p " +
    "LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id"
  );

  for (const p of products) {
    p.ingredient_names = (p.ingredients || []).map((i) => i.name);
    p.bigrams = bigrams(p.normalized_name);
    p.tokens = new Set(p.normalized_name.split(' '));
  }

  productsCache = products;
  cacheTime = now;
  return products;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(text) {
  const t = text.replace(/\s+/g, ' ');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

// Cosine similarity over character bigrams (0..1)
function bigramSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return shared / Math.sqrt(a.size * b.size);
}

// Full matcher: exact / prefix / token-subset / fuzzy bigram similarity.
function matchScore(queryNorm, product) {
  const pn = product.normalized_name;
  if (queryNorm === pn) return 1;
  if (pn.startsWith(queryNorm + ' ') || queryNorm.startsWith(pn + ' ')) return 0.92;

  const qTokens = queryNorm.split(' ').filter(Boolean);
  const pTokens = [...product.tokens];
  const qSet = new Set(qTokens);
  let matched = 0;
  for (const t of pTokens) if (qSet.has(t)) matched++;
  const tokenOverlap = pTokens.length ? matched / pTokens.length : 0;
  const containment = qTokens.length ? matched / qTokens.length : 0;

  const fuzzy = bigramSimilarity(bigrams(queryNorm), product.bigrams);
  return Math.max(tokenOverlap * 0.75, containment * 0.85, fuzzy);
}

// Words that indicate dosage instructions rather than medicine names.
const SIG_WORDS = new Set([
  'sig', 'rx', 'tds', 'bd', 'od', 'qid', 'prn', 'po', 'sos', 'ac', 'pc',
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules',
  'syp', 'syrup', 'inj', 'injection', 'infusion', 'gel', 'cream', 'drops',
  'mg', 'mcg', 'g', 'ml', 'cc', 'daily', 'night', 'morning', 'evening', 'week',
  'days', 'day', 'before', 'after', 'meals', 'food', 'water', 'take', 'drink',
  'and', 'with', 'for', 'the', 'a', 'of', 'x', 'no', 'note', 'advice', 'follow',
  'up', 'review', 'next', 'visit', 'patient', 'name', 'age', 'sex', 'date',
  'complaint', 'diagnosis', 'history', 'dr', 'doctor', 'clinic', 'hospital',
  'address', 'phone', 'signature', 'stamp'
]);

function looksLikeMedicineLine(line) {
  const tokens = normalize(line).split(' ').filter(Boolean);
  if (!tokens.length) return false;
  const alphaTokens = tokens.filter((t) => /[a-z]/.test(t));
  if (alphaTokens.length === 0) return false;
  // Lines that are mostly sig/instruction words are not medicine entries.
  const meaningful = alphaTokens.filter((t) => !SIG_WORDS.has(t.replace(/\./g, '')));
  return meaningful.length > 0;
}

// ---------------------------------------------------------------------------
// Prescription text -> ordered list of detected medicines with statuses.
// ---------------------------------------------------------------------------
async function analyzePrescription(text) {
  const products = await loadProducts();
  const lines = String(text || '').split(/\r?\n/);

  const results = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!looksLikeMedicineLine(line)) continue;

    // Strip common prefixes: numbering, Rx:, dosage-form prefixes
    let candidate = line
      .replace(/^\s*(?:\(?\d+[.)]|[ivx]+[.)])\s*/i, '')
      .replace(/^\s*rx[:.\s]*/i, '')
      .replace(/^\s*(?:tab|cap|syp|inj|inf)\.?\s+/i, '')
      .trim();
    if (!candidate) continue;

    const norm = normalize(candidate);
    if (!norm) continue;

    let best = null;
    for (const product of products) {
      const score = matchScore(norm, product);
      if (score >= 0.42 && (!best || score > best.score)) {
        best = { product, score };
      }
    }

    if (best && best.score >= 0.42) {
      const p = best.product;
      const safe = SAFE_STATUSES.includes(p.safety_status);
      results.push({
        line: line,
        matched_name: p.brand_name,
        product_id: p.product_id,
        confidence: Math.round(best.score * 100) / 100,
        safety_status: p.safety_status,
        safe: safe,
        match: 'recognized'
      });
    } else {
      results.push({
        line: line,
        matched_name: null,
        product_id: null,
        confidence: 0,
        safety_status: 'unknown',
        safe: false,
        match: 'not_found'
      });
    }
  }

  const allSafe = results.length > 0 && results.every((r) => r.safe);
  return { items: results, all_safe: allSafe, total: results.length };
}

// ---------------------------------------------------------------------------
// Alternatives: safe products ranked by ingredient overlap, name similarity
// and dosage-form equivalence. Score is a 0-100 AI similarity score.
// ---------------------------------------------------------------------------
async function findAlternatives(product) {
  const products = await loadProducts();
  const baseIngredients = new Set(product.ingredient_names);

  const scored = [];
  for (const cand of products) {
    if (cand.product_id === product.product_id) continue;
    if (!SAFE_STATUSES.includes(cand.safety_status)) continue;

    const shared = cand.ingredient_names.filter((n) => baseIngredients.has(n));
    const union = new Set([...baseIngredients, ...cand.ingredient_names]);
    const jaccard = union.size ? shared.length / union.size : 0;
    const nameSim = bigramSimilarity(bigrams(product.normalized_name), cand.bigrams);
    const formMatch = product.dosage_form && cand.dosage_form === product.dosage_form ? 1 : 0;

    // Weighted composite: ingredient match dominates, name and form refine.
    const score = jaccard * 0.7 + nameSim * 0.2 + formMatch * 0.1;
    if (score <= 0.05) continue;

    scored.push({
      product_id: cand.product_id,
      brand_name: cand.brand_name,
      normalized_name: cand.normalized_name,
      dosage_form: cand.dosage_form,
      registration_number: cand.registration_number,
      manufacturer_name: cand.manufacturer_name,
      generic_name: cand.ingredient_names.join(', '),
      similar_ingredients: shared,
      ingredient_match_count: shared.length,
      similarity_score: Math.round(score * 100),
      same_dosage_form: formMatch === 1
    });
  }

  scored.sort((a, b) => b.similarity_score - a.similarity_score || b.ingredient_match_count - a.ingredient_match_count);
  return scored.slice(0, 6);
}

function invalidateCache() {
  productsCache = null;
  cacheTime = 0;
}

module.exports = {
  loadProducts: loadProducts,
  analyzePrescription: analyzePrescription,
  findAlternatives: findAlternatives,
  normalize: normalize,
  bigramSimilarity: bigramSimilarity,
  invalidateCache: invalidateCache
};
