// AI-powered alternative medicine recommendation pipeline.
//
// Architecture:
//   1. Retrieve safe candidate alternatives from the database using a
//      composite of semantic similarity, ingredient overlap and therapeutic
//      use overlap.
//   2. Send the candidates to Google Gemini (when available) for genuine
//      AI reasoning about which is the best therapeutic alternative.
//   3. Validate the AI response against the database — the recommended ID
//      must exist, must have been in the candidate set, and must be safe.
//   4. If Gemini is unavailable, fall back to the algorithmic ranking.
//
// The AI reasons and ranks. The database provides and verifies all facts.

const { q, one } = require('../db');
const { getSemanticCandidates } = require('./embeddings');
const { usesForProduct } = require('./medicalUses');

const SAFE_STATUSES = ['active'];
const MAX_CANDIDATES = 8;
const MIN_COMPOSITE_SCORE = 0.08;

// ---------------------------------------------------------------------------
// 1. Candidate retrieval
// ---------------------------------------------------------------------------

function useTokenSet(product) {
  const uses = usesForProduct(product);
  const tokens = new Set();
  for (const u of uses) {
    for (const t of u.toLowerCase().split(/[\s,]+/).filter(Boolean)) tokens.add(t);
  }
  return tokens;
}

function useOverlapScore(baseUses, candidateUses) {
  if (!baseUses.size) return 0;
  let shared = 0;
  for (const t of baseUses) if (candidateUses.has(t)) shared++;
  return shared / baseUses.size;
}

function ingredientJaccard(baseIngredients, candidateIngredients) {
  const baseSet = new Set(baseIngredients);
  const union = new Set([...baseSet, ...candidateIngredients]);
  if (!union.size) return 0;
  let shared = 0;
  for (const n of candidateIngredients) if (baseSet.has(n)) shared++;
  return shared / union.size;
}

// Retrieve candidate safe alternatives ranked by composite score.
// Weights: ingredient 50 %, semantic 25 %, therapeutic-use overlap 25 %.
function retrieveCandidates(unsafeProduct, allProducts) {
  const baseIngredients = unsafeProduct.ingredient_names || [];
  const baseUses = useTokenSet(unsafeProduct);

  let semanticMap = new Map();
  if (unsafeProduct.embedding && unsafeProduct.embedding.length === 384) {
    const sem = getSemanticCandidates(unsafeProduct.embedding, allProducts, 0.1);
    for (const { product, score } of sem) {
      semanticMap.set(product.product_id, score);
    }
  }

  const scored = [];
  for (const cand of allProducts) {
    if (cand.product_id === unsafeProduct.product_id) continue;
    if (!SAFE_STATUSES.includes(cand.safety_status)) continue;

    const ingScore = ingredientJaccard(baseIngredients, cand.ingredient_names || []);
    const semScore = semanticMap.get(cand.product_id) || 0;
    const candUses = useTokenSet(cand);
    const useScore = useOverlapScore(baseUses, candUses);

    const composite = ingScore * 0.50 + semScore * 0.25 + useScore * 0.25;
    if (composite < MIN_COMPOSITE_SCORE) continue;

    const shared = (cand.ingredient_names || []).filter((n) => baseIngredients.includes(n));

    scored.push({
      product_id: cand.product_id,
      brand_name: cand.brand_name,
      normalized_name: cand.normalized_name,
      dosage_form: cand.dosage_form,
      registration_number: cand.registration_number,
      manufacturer_name: cand.manufacturer_name,
      generic_name: (cand.ingredient_names || []).join(', '),
      similar_ingredients: shared,
      ingredient_match_count: shared.length,
      similarity_score: Math.round(composite * 100),
      same_dosage_form: !!(unsafeProduct.dosage_form && cand.dosage_form === unsafeProduct.dosage_form),
      _uses: usesForProduct(cand),
      _composite: composite,
    });
  }

  scored.sort((a, b) => b._composite - a._composite || b.ingredient_match_count - a.ingredient_match_count);
  return scored.slice(0, MAX_CANDIDATES);
}

// ---------------------------------------------------------------------------
// 2. Gemini AI reasoning
// ---------------------------------------------------------------------------

let geminiModel = null;
let geminiInitAttempted = false;

// Model names in preference order. Google deprecates older models over time,
// so we try each one until we find a model that accepts requests.
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3-flash-preview'];

async function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (geminiInitAttempted) return geminiModel;
  geminiInitAttempted = true;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    // Try each model in order; pick the first one that responds.
    for (const name of GEMINI_MODELS) {
      try {
        const candidate = genAI.getGenerativeModel({ model: name });
        await candidate.generateContent('ping');
        geminiModel = candidate;
        console.log(`Gemini AI model "${name}" initialised for alternative recommendations.`);
        return geminiModel;
      } catch {
        // Model not available, try next.
      }
    }
    console.warn('No Gemini model was available. AI alternatives will use algorithmic fallback.');
    return null;
  } catch (err) {
    console.warn('Could not initialise Gemini AI:', err.message);
    return null;
  }
}

function buildGeminiPrompt(unsafeProduct, candidates) {
  const ingredients = (unsafeProduct.ingredient_names || []).join(', ') || 'unknown';
  const uses = usesForProduct(unsafeProduct).join(', ') || 'unknown';

  let candidateText = '';
  for (const c of candidates) {
    candidateText += `- ID: ${c.product_id}\n`;
    candidateText += `  Name: ${c.brand_name}\n`;
    candidateText += `  Ingredients: ${c.generic_name || 'unknown'}\n`;
    candidateText += `  Uses: ${(c._uses || []).join(', ') || 'unknown'}\n`;
    candidateText += `  Dosage form: ${c.dosage_form || 'unknown'}\n`;
    candidateText += `  Manufacturer: ${c.manufacturer_name || 'unknown'}\n\n`;
  }

  return `You are a pharmaceutical AI assistant for RxGuard, a medicine safety system.

An unsafe medicine has been identified in a prescription. Your task is to recommend
the most appropriate safe alternative from the provided candidate list.

UNSAFE MEDICINE:
- Name: ${unsafeProduct.brand_name}
- Status: ${unsafeProduct.safety_status}
- Active ingredients: ${ingredients}
- Therapeutic uses: ${uses}
- Dosage form: ${unsafeProduct.dosage_form || 'unknown'}

SAFE CANDIDATE MEDICINES (from the RxGuard verified database):
${candidateText}
INSTRUCTIONS:
1. Analyze why the original medicine is unsuitable.
2. Compare the candidates based on therapeutic purpose, ingredient similarity, and clinical appropriateness as an alternative.
3. Select the BEST candidate and rank all candidates.
4. You MUST only select from the provided candidate IDs above. Do not invent or suggest any medicine not listed.

Return ONLY valid JSON in this exact format, no markdown:
{"recommended_medicine_id":"<uuid>","ranked_candidate_ids":["<uuid1>","<uuid2>"],"reason":"<short explanation, max 2 sentences>"}`;
}

async function reasonWithGemini(unsafeProduct, candidates) {
  const model = await getGeminiModel();
  if (!model) return null;

  try {
    const prompt = buildGeminiPrompt(unsafeProduct, candidates);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.recommended_medicine_id || typeof parsed.recommended_medicine_id !== 'string') {
      console.warn('Gemini response missing recommended_medicine_id.');
      return null;
    }
    if (!Array.isArray(parsed.ranked_candidate_ids)) {
      parsed.ranked_candidate_ids = [parsed.recommended_medicine_id];
    }
    if (typeof parsed.reason !== 'string') {
      parsed.reason = '';
    }
    return parsed;
  } catch (err) {
    console.warn('Gemini AI reasoning failed (will use algorithmic fallback):', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Backend validation — hallucination prevention
// ---------------------------------------------------------------------------

async function validateRecommendation(aiResponse, candidateIds) {
  const recId = aiResponse.recommended_medicine_id;
  const candidateSet = new Set(candidateIds);

  // Layer 5 — Was this ID in the candidate set we gave to the AI?
  if (!candidateSet.has(recId)) {
    console.warn(`AI recommended ID ${recId} which was NOT in the candidate set. Rejecting.`);
    return null;
  }

  // Layers 4 & 6 — Does this ID exist in the database, and is it safe?
  const row = await one(
    'SELECT product_id, safety_status FROM mediverify.products WHERE product_id = $1',
    [recId]
  );
  if (!row) {
    console.warn(`AI recommended ID ${recId} which does not exist. Rejecting.`);
    return null;
  }
  if (!SAFE_STATUSES.includes(row.safety_status)) {
    console.warn(`AI recommended ID ${recId} but status is "${row.safety_status}". Rejecting.`);
    return null;
  }

  return recId;
}

// ---------------------------------------------------------------------------
// 4. Main orchestrator
// ---------------------------------------------------------------------------

async function fetchFullRecord(productId) {
  const rows = await q(
    "SELECT p.product_id, p.brand_name, p.normalized_name, p.dosage_form, " +
    "p.registration_number, p.safety_status, p.source_text, " +
    "m.legal_name AS manufacturer_name " +
    "FROM mediverify.products p " +
    "LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id " +
    "WHERE p.product_id = $1",
    [productId]
  );
  if (!rows.length) return null;
  const p = rows[0];

  const ingredients = await q(
    "SELECT i.name FROM mediverify.product_ingredients pi " +
    "JOIN mediverify.ingredients i ON i.ingredient_id = pi.ingredient_id " +
    "WHERE pi.product_id = $1 ORDER BY i.name",
    [productId]
  );

  return {
    product_id: p.product_id,
    brand_name: p.brand_name,
    normalized_name: p.normalized_name,
    dosage_form: p.dosage_form,
    registration_number: p.registration_number,
    manufacturer_name: p.manufacturer_name || 'Unknown',
    generic_name: ingredients.map((i) => i.name).join(', '),
    similar_ingredients: [],
    ingredient_match_count: 0,
    similarity_score: 0,
    same_dosage_form: false,
  };
}

function cleanCandidate(c) {
  const { _uses, _composite, ...rest } = c;
  return rest;
}

async function getAiAlternative(unsafeProduct, allProducts) {
  const candidates = retrieveCandidates(unsafeProduct, allProducts);
  if (candidates.length === 0) {
    return { alternatives: [], ai_powered: false, ai_reason: null, no_alternative: true };
  }

  const candidateIds = candidates.map((c) => c.product_id);
  const aiResponse = await reasonWithGemini(unsafeProduct, candidates);

  if (aiResponse) {
    const validatedId = await validateRecommendation(aiResponse, candidateIds);

    if (validatedId) {
      const fullRecord = await fetchFullRecord(validatedId);
      if (fullRecord) {
        const candidateMeta = candidates.find((c) => c.product_id === validatedId);
        if (candidateMeta) {
          fullRecord.similar_ingredients = candidateMeta.similar_ingredients;
          fullRecord.ingredient_match_count = candidateMeta.ingredient_match_count;
          fullRecord.similarity_score = candidateMeta.similarity_score;
          fullRecord.same_dosage_form = candidateMeta.same_dosage_form;
        }

        const rankedIds = aiResponse.ranked_candidate_ids.filter(
          (id) => candidateIds.includes(id) && id !== validatedId
        );
        const restAlts = rankedIds
          .map((id) => candidates.find((c) => c.product_id === id))
          .filter(Boolean)
          .map(cleanCandidate);

        return {
          alternatives: [
            { ...fullRecord, reason: aiResponse.reason },
            ...restAlts,
          ],
          ai_powered: true,
          ai_reason: aiResponse.reason,
          no_alternative: false,
        };
      }
    }
  }

  // Fallback: algorithmic ranking.
  return {
    alternatives: candidates.map(cleanCandidate),
    ai_powered: false,
    ai_reason: null,
    no_alternative: false,
  };
}

module.exports = { getAiAlternative };
