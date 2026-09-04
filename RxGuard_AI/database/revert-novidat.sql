-- Revert the E2E test reclassification: NOVIDAT is genuinely a spurious product
-- in the DRAP registry (alert SFF-2023/024) and must be classified as such.
UPDATE mediverify.products
SET safety_status = 'spurious'
WHERE brand_name ILIKE 'NOVIDAT%' AND safety_status::text <> 'spurious';
