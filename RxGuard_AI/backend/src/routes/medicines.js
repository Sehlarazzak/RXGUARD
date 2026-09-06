// Medicine search, details, alternatives and retailers.
const express = require('express');
const { q, one } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadProducts, findAlternatives, normalize, bigramSimilarity } = require('../utils/analysis');
const { generateEmbedding, getSemanticCandidates } = require('../utils/embeddings');
const { usesForProduct } = require('../utils/medicalUses');

const SEMANTIC_CANDIDATE_THRESHOLD = parseFloat(process.env.SEMANTIC_THRESHOLD || '0.15');
const SAFE_STATUSES = ['active'];

const QUERY_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'in', 'on', 'of', 'with', 'from', 'by', 'as', 'at',
  'i', 'me', 'my', 'you', 'your', 'we', 'us', 'our', 'can', 'could', 'should', 'would', 'will',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those',
  'it', 'its', 'medicine', 'medicines', 'drug', 'drugs', 'tablet', 'tablets', 'capsule', 'capsules',
  'syrup', 'injection', 'gel', 'cream', 'take', 'something', 'some', 'any', 'get', 'use', 'using',
  'used', 'help', 'helps', 'relieve', 'relief', 'treatment', 'treat', 'cure', 'good', 'best',
]);

function meaningfulQueryTokens(term) {
  return normalize(term)
    .split(' ')
    .filter((t) => t.length > 2 && !QUERY_STOPWORDS.has(t));
}

// Build a token set from a product's typical medical uses and brand name.
// These tokens are used to ground the embedding model: if the user query
// mentions a symptom or disease, we only trust semantic similarity when the
// product is actually indicated for that condition.
function productTokenSet(product) {
  const useTokens = new Set(
    usesForProduct(product)
      .flatMap((u) => normalize(u).split(' '))
      .filter((t) => t.length > 2)
  );
  const nameTokens = new Set(product.normalized_name.split(' ').filter((t) => t.length > 2));
  return new Set([...useTokens, ...nameTokens]);
}

// Score how well the user's query tokens match the product's indications.
// 1.0 means every meaningful query token matches a known use or brand token.
function computeUseScore(queryTokens, product) {
  if (!queryTokens.length) return 0;
  const tokenSet = productTokenSet(product);
  let matches = 0;
  for (const qt of queryTokens) {
    if (tokenSet.has(qt)) matches += 1;
  }
  return matches / queryTokens.length;
}

const router = express.Router();

async function logSearch(userId, query) {
  if (!query) return;
  await q('INSERT INTO rxguard.search_history (user_id, query) VALUES ($1, $2)', [userId, String(query).slice(0, 500)]);
}

// GET /api/medicines/suggest?q=... - dropdown suggestions for the search bar
router.get('/suggest', requireAuth, async (req, res) => {
  try {
    const term = normalize(req.query.q || '');
    if (term.length < 2) return res.json({ suggestions: [] });

    const products = await loadProducts();
    const scored = [];
    for (const p of products) {
      const pn = p.normalized_name;
      const brand = p.brand_name.toLowerCase();
      let score = 0;
      if (pn.startsWith(term) || brand.startsWith(term)) score = 1;
      else if (pn.includes(term) || brand.includes(term)) score = 0.85;
      else {
        const hasToken = pn.split(' ').some((t) => t.startsWith(term));
        if (hasToken) score = 0.75;
        else score = bigramSimilarity(new Set(term.match(/../g) || []), p.bigrams) * 0.6;
      }
      if (score > 0.28) scored.push({ p, score });
    }
    scored.sort((a, b) => b.score - a.score || a.p.brand_name.localeCompare(b.p.brand_name));
    res.json({
      suggestions: scored.slice(0, 10).map(({ p, score }) => ({
        product_id: p.product_id,
        brand_name: p.brand_name,
        dosage_form: p.dosage_form,
        safety_status: p.safety_status,
        manufacturer_name: p.manufacturer_name,
        score: Math.round(score * 100) / 100,
      })),
    });
  } catch (err) {
    console.error('suggest error', err);
    res.status(500).json({ error: 'Could not load suggestions.' });
  }
});

// GET /api/medicines/search?q=... - universal search across name, ingredient,
// registration number, manufacturer and batch
router.get('/search', requireAuth, async (req, res) => {
  try {
    const term = String(req.query.q || '').trim();
    if (!term) return res.json({ results: [], query: '' });

    const rows = await q(
      "SELECT DISTINCT p.product_id, p.brand_name, p.normalized_name, p.dosage_form, " +
      "p.registration_number, p.safety_status, p.source_category, " +
      "m.legal_name AS manufacturer_name " +
      "FROM mediverify.products p " +
      "LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id " +
      "LEFT JOIN mediverify.product_ingredients pi ON pi.product_id = p.product_id " +
      "LEFT JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id " +
      "LEFT JOIN mediverify.product_identifiers pid ON pid.product_id = p.product_id " +
      "LEFT JOIN mediverify.recall_batches rb ON rb.product_id = p.product_id " +
      "WHERE p.brand_name ILIKE $1 OR p.normalized_name ILIKE $1 " +
      "OR i.name ILIKE $1 OR p.registration_number ILIKE $1 " +
      "OR m.legal_name ILIKE $1 OR pid.identifier_value ILIKE $1 " +
      "OR rb.batch_number ILIKE $1 " +
      "ORDER BY p.brand_name LIMIT 50",
      ["%" + term + "%"]
    );

    let results = rows;
    if (results.length === 0) {
      const products = await loadProducts();
      const termNorm = normalize(term);
      const fuzzy = products
        .map((p) => ({ p: p, score: bigramSimilarity(new Set(termNorm.match(/../g) || []), p.bigrams) }))
        .filter((x) => x.score > 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((x) => ({
          product_id: x.p.product_id,
          brand_name: x.p.brand_name,
          normalized_name: x.p.normalized_name,
          dosage_form: x.p.dosage_form,
          registration_number: x.p.registration_number,
          safety_status: x.p.safety_status,
          source_category: x.p.source_category,
          manufacturer_name: x.p.manufacturer_name,
        }));
      results = fuzzy;
    }

    await logSearch(req.user.id, term);
    res.json({ results: results, query: term });
  } catch (err) {
    console.error('search error', err);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// Keyword-only search helper shared by the hybrid smart search.
// Returns products that match the term by exact/contains/fuzzy name search.
async function keywordSearch(term, allowFuzzy = true) {
  const rows = await q(
    "SELECT DISTINCT p.product_id, p.brand_name, p.normalized_name, p.dosage_form, " +
    "p.registration_number, p.safety_status, p.source_category, " +
    "m.legal_name AS manufacturer_name " +
    "FROM mediverify.products p " +
    "LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id " +
    "LEFT JOIN mediverify.product_ingredients pi ON pi.product_id = p.product_id " +
    "LEFT JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id " +
    "LEFT JOIN mediverify.product_identifiers pid ON pid.product_id = p.product_id " +
    "LEFT JOIN mediverify.recall_batches rb ON rb.product_id = p.product_id " +
    "WHERE p.brand_name ILIKE $1 OR p.normalized_name ILIKE $1 " +
    "OR i.name ILIKE $1 OR p.registration_number ILIKE $1 " +
    "OR m.legal_name ILIKE $1 OR pid.identifier_value ILIKE $1 " +
    "OR rb.batch_number ILIKE $1 " +
    "ORDER BY p.brand_name LIMIT 50",
    ["%" + term + "%"]
  );

  if (rows.length) return rows;
  if (!allowFuzzy) return [];

  const products = await loadProducts();
  const termNorm = normalize(term);
  return products
    .map((p) => ({ p, score: bigramSimilarity(new Set(termNorm.match(/../g) || []), p.bigrams) }))
    .filter((x) => x.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => ({
      product_id: x.p.product_id,
      brand_name: x.p.brand_name,
      normalized_name: x.p.normalized_name,
      dosage_form: x.p.dosage_form,
      registration_number: x.p.registration_number,
      safety_status: x.p.safety_status,
      source_category: x.p.source_category,
      manufacturer_name: x.p.manufacturer_name,
    }));
}

// GET /api/medicines/search/smart?q=...
// Hybrid search: combines exact/keyword matching with embedding-based semantic
// similarity and a verified medical-use signal. Results always come from the
// actual database; the AI is only used to rank and interpret intent.
router.get('/search/smart', requireAuth, async (req, res) => {
  try {
    const term = String(req.query.q || '').trim();
    if (!term) return res.json({ results: [], query: term, message: '', semantic_available: false });

    // Smart search uses strict keyword matching. Fuzzy fallback is disabled
    // because short symptom queries like "diabetes" can accidentally match
    // unrelated brand names by character bigrams (e.g. Iressa).
    const keywordResults = await keywordSearch(term, false);
    const products = await loadProducts();
    const hasEmbeddings = products.some((p) => Array.isArray(p.embedding) && p.embedding.length > 0);
    const queryTokens = meaningfulQueryTokens(term);

    let semanticResults = [];
    if (hasEmbeddings) {
      try {
        const queryVec = await generateEmbedding(term);
        // Use a low semantic threshold because the final ranking also depends
        // on verified medical-use overlap. This keeps genuine matches such as
        // Glucophage for "diabetes" while the use-score filter removes random
        // embedding coincidences like Iressa.
        semanticResults = getSemanticCandidates(queryVec, products, SEMANTIC_CANDIDATE_THRESHOLD);
      } catch (embErr) {
        console.error('smart search embedding error:', embErr.message);
      }
    }

    const resultMap = new Map();

    keywordResults.forEach((r, idx) => {
      const useScore = computeUseScore(queryTokens, r);
      resultMap.set(r.product_id, {
        ...r,
        keyword_rank: idx + 1,
        semantic_rank: null,
        semantic_score: null,
        use_score: Math.round(useScore * 1000) / 1000,
        match_source: 'keyword',
      });
    });

    semanticResults.forEach((s, idx) => {
      if (!SAFE_STATUSES.includes(s.product.safety_status)) return;
      const existing = resultMap.get(s.product.product_id);
      const useScore = computeUseScore(queryTokens, s.product);
      const roundedSem = Math.round(s.score * 1000) / 1000;
      const roundedUse = Math.round(useScore * 1000) / 1000;
      if (existing) {
        existing.semantic_rank = idx + 1;
        existing.semantic_score = roundedSem;
        existing.use_score = Math.max(existing.use_score || 0, roundedUse);
        existing.match_source = 'hybrid';
      } else {
        resultMap.set(s.product.product_id, {
          product_id: s.product.product_id,
          brand_name: s.product.brand_name,
          normalized_name: s.product.normalized_name,
          dosage_form: s.product.dosage_form,
          registration_number: s.product.registration_number,
          safety_status: s.product.safety_status,
          source_category: s.product.source_category,
          manufacturer_name: s.product.manufacturer_name,
          keyword_rank: null,
          semantic_rank: idx + 1,
          semantic_score: roundedSem,
          use_score: roundedUse,
          match_source: 'semantic',
        });
      }
    });

    // Final score balances embedding similarity, verified medical-use overlap,
    // and exact keyword rank. Verified use overlap is weighted highest so that
    // symptom/disease queries cannot return medicines with no known indication.
    const SEMANTIC_WEIGHT = 0.3;
    const USE_WEIGHT = 0.45;
    const KEYWORD_WEIGHT = 0.25;
    const INCLUDE_THRESHOLD = 0.3;

    const ranked = Array.from(resultMap.values())
      .map((r) => {
        const keywordScore = r.keyword_rank ? 1 / r.keyword_rank : 0;
        const semanticScore = r.semantic_score ?? 0;
        const useScore = r.use_score ?? 0;
        const finalScore = SEMANTIC_WEIGHT * semanticScore + USE_WEIGHT * useScore + KEYWORD_WEIGHT * keywordScore;
        return { ...r, final_score: Math.round(finalScore * 1000) / 1000 };
      })
      .filter((r) => r.keyword_rank || r.final_score >= INCLUDE_THRESHOLD)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, 20);

    await logSearch(req.user.id, term);

    res.json({
      results: ranked,
      query: term,
      semantic_available: hasEmbeddings,
      message: ranked.length
        ? ''
        : 'No suitable medicine was found in our database for this search.',
    });
  } catch (err) {
    console.error('smart search error', err);
    res.status(500).json({ error: 'Smart search failed. Please try again.' });
  }
});

// GET /api/medicines/retailers/nearby - medicine retailers list
router.get('/retailers/nearby', requireAuth, async (req, res) => {
  try {
    const city = req.query.city ? String(req.query.city) : null;
    const rows = city
      ? await q('SELECT * FROM rxguard.retailers WHERE city ILIKE $1 ORDER BY name', ["%" + city + "%"])
      : await q('SELECT * FROM rxguard.retailers ORDER BY city, name');
    res.json({ retailers: rows });
  } catch (err) {
    console.error('retailers error', err);
    res.status(500).json({ error: 'Could not load nearby retailers.' });
  }
});

// GET /api/medicines/:id - full detail with relations
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const product = await one(
      "SELECT p.*, m.legal_name AS manufacturer_name, m.country AS manufacturer_country, " +
      "m.address AS manufacturer_address, m.manufacturer_id, " +
      "h.legal_name AS holder_name, h.country AS holder_country " +
      "FROM mediverify.products p " +
      "LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id " +
      "LEFT JOIN mediverify.market_authorization_holders h ON h.holder_id = p.holder_id " +
      "WHERE p.product_id = $1",
      [id]
    );
    if (!product) return res.status(404).json({ error: 'Medicine not found.' });

    const ingredients = await q(
      "SELECT i.ingredient_id, i.name, pi.strength_value, pi.strength_unit, pi.composition_text " +
      "FROM mediverify.product_ingredients pi " +
      "JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id " +
      "WHERE pi.product_id = $1 ORDER BY i.name",
      [id]
    );

    const batches = await q(
      "SELECT b.batch_id, b.batch_number, b.manufacturing_date, b.expiry_date, " +
      "b.classification, b.manufacturer_text, b.remarks, b.notice_id " +
      "FROM mediverify.recall_batches b WHERE b.product_id = $1 ORDER BY b.batch_number",
      [id]
    );

    const notices = await q(
      "SELECT n.notice_id, n.notice_identifier, n.title, n.notice_type, n.severity, " +
      "n.action_date, n.problem_statement, n.risk_statement, n.action_initiated, " +
      "np.disposition, sd.title AS document_title, sd.canonical_url, sd.publication_date, " +
      "s.source_name, s.is_official " +
      "FROM mediverify.notice_products np " +
      "JOIN mediverify.safety_notices n ON n.notice_id = np.notice_id " +
      "LEFT JOIN mediverify.source_documents sd ON sd.document_id = n.source_document_id " +
      "LEFT JOIN mediverify.sources s ON s.source_id = sd.source_id " +
      "WHERE np.product_id = $1 ORDER BY n.action_date DESC NULLS LAST",
      [id]
    );

    const sources = await q(
      "SELECT sd.title, sd.canonical_url, sd.document_url, sd.publication_date, " +
      "ps.source_role, s.source_name, s.source_type, s.is_official " +
      "FROM mediverify.product_sources ps " +
      "JOIN mediverify.source_documents sd ON sd.document_id = ps.source_document_id " +
      "JOIN mediverify.sources s ON s.source_id = sd.source_id " +
      "WHERE ps.product_id = $1",
      [id]
    );

    const history = await q(
      "SELECT h.old_status, h.new_status, h.reason, h.effective_date, h.created_at " +
      "FROM mediverify.product_status_history h " +
      "WHERE h.product_id = $1 ORDER BY h.created_at DESC",
      [id]
    );

    const identifiers = await q(
      "SELECT identifier_type, identifier_value FROM mediverify.product_identifiers " +
      "WHERE product_id = $1 ORDER BY identifier_type",
      [id]
    );

    const isSafe = ['active'].includes(product.safety_status);
    const fullProduct = {
      ...product,
      ingredients: ingredients,
      batches: batches,
      notices: notices,
      sources: sources,
      status_history: history,
      identifiers: identifiers,
      is_safe: isSafe,
    };

    if (!isSafe) {
      const products = await loadProducts();
      const cached = products.find((p) => p.product_id === id);
      fullProduct.alternatives = cached ? await findAlternatives(cached) : [];
    }

    res.json({ product: fullProduct });
  } catch (err) {
    console.error('medicine detail error', err);
    res.status(500).json({ error: 'Could not load medicine details.' });
  }
});

// GET /api/medicines/:id/alternatives - safe alternatives with AI similarity
router.get('/:id/alternatives', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const products = await loadProducts();
    const product = products.find((p) => p.product_id === id);
    if (!product) return res.status(404).json({ error: 'Medicine not found.' });
    res.json({ alternatives: await findAlternatives(product) });
  } catch (err) {
    console.error('alternatives error', err);
    res.status(500).json({ error: 'Could not load alternatives.' });
  }
});

module.exports = router;
