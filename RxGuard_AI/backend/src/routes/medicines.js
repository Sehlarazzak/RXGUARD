// Medicine search, details, alternatives and retailers.
const express = require('express');
const { q, one } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loadProducts, findAlternatives, normalize, bigramSimilarity } = require('../utils/analysis');

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
