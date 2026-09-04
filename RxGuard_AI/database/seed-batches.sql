-- Seed production batch records for the safe (active) DRAP-registered medicines
-- so patients can view batch details (manufacturing/expiry) on the medicine page.
-- These are benign production batches, NOT recalls: notice_id is NULL and the
-- classification marks them as standard verified batches.

INSERT INTO mediverify.recall_batches (batch_id, notice_id, product_id, batch_number, manufacturing_date, expiry_date, classification, manufacturer_text, remarks)
SELECT
  gen_random_uuid(),
  NULL,
  p.product_id,
  'PB-' || upper(substr(replace(p.product_id::text, '-', ''), 1, 6)) || '-A',
  CURRENT_DATE - INTERVAL '8 months',
  CURRENT_DATE + INTERVAL '28 months',
  'Standard production batch',
  m.legal_name,
  'Regular production batch, quality-verified. Not subject to any DRAP notice.'
FROM mediverify.products p
LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id
WHERE p.product_id::text LIKE '33333333-%'
  AND NOT EXISTS (
    SELECT 1 FROM mediverify.recall_batches rb WHERE rb.product_id = p.product_id
  );

INSERT INTO mediverify.recall_batches (batch_id, notice_id, product_id, batch_number, manufacturing_date, expiry_date, classification, manufacturer_text, remarks)
SELECT
  gen_random_uuid(),
  NULL,
  p.product_id,
  'PB-' || upper(substr(replace(p.product_id::text, '-', ''), 1, 6)) || '-B',
  CURRENT_DATE - INTERVAL '2 months',
  CURRENT_DATE + INTERVAL '34 months',
  'Standard production batch',
  m.legal_name,
  'Latest production batch, quality-verified. Not subject to any DRAP notice.'
FROM mediverify.products p
LEFT JOIN mediverify.manufacturers m ON m.manufacturer_id = p.manufacturer_id
WHERE p.product_id::text LIKE '33333333-%'
  AND (SELECT count(*) FROM mediverify.recall_batches rb WHERE rb.product_id = p.product_id) < 2;
