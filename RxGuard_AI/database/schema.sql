-- =====================================================================
-- RxGuard AI - Full Application Schema & Seed Data
-- Database: "RxGuard AI" (PostgreSQL)
--
-- Idempotent: safe to run multiple times on an empty or already-populated
-- database. Base mediverify tables are created first, then app-specific
-- extensions, then the rxguard application schema and seed data.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Core mediverify schema
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS mediverify;

CREATE TABLE IF NOT EXISTS mediverify.roles (
  role_id integer PRIMARY KEY,
  role_name text NOT NULL UNIQUE
);

INSERT INTO mediverify.roles (role_id, role_name) VALUES
  (1, 'patient'),
  (2, 'doctor'),
  (3, 'pharmacist'),
  (4, 'admin')
ON CONFLICT (role_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mediverify.users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- App-specific extensions (idempotent on an existing mediverify.users table)
ALTER TABLE mediverify.users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS cnic text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS clinic_name text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON mediverify.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_cnic ON mediverify.users (cnic) WHERE cnic IS NOT NULL;

CREATE TABLE IF NOT EXISTS mediverify.user_roles (
  user_id uuid NOT NULL REFERENCES mediverify.users(user_id) ON DELETE CASCADE,
  role_id integer NOT NULL REFERENCES mediverify.roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS mediverify.manufacturers (
  manufacturer_id uuid PRIMARY KEY,
  legal_name text NOT NULL,
  country text,
  address text
);

CREATE TABLE IF NOT EXISTS mediverify.market_authorization_holders (
  holder_id uuid PRIMARY KEY,
  legal_name text NOT NULL,
  country text
);

CREATE TABLE IF NOT EXISTS mediverify.products (
  product_id uuid PRIMARY KEY,
  brand_name text NOT NULL,
  normalized_name text,
  dosage_form text,
  registration_number text,
  registration_date date,
  manufacturer_id uuid REFERENCES mediverify.manufacturers(manufacturer_id) ON DELETE SET NULL,
  holder_id uuid REFERENCES mediverify.market_authorization_holders(holder_id) ON DELETE SET NULL,
  source_category text,
  safety_status text,
  source_text text
);

CREATE INDEX IF NOT EXISTS idx_products_name ON mediverify.products (brand_name);
CREATE INDEX IF NOT EXISTS idx_products_normalized ON mediverify.products (normalized_name);
CREATE INDEX IF NOT EXISTS idx_products_status ON mediverify.products (safety_status);

CREATE TABLE IF NOT EXISTS mediverify.ingredients (
  ingredient_id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS mediverify.product_ingredients (
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES mediverify.ingredients(ingredient_id) ON DELETE CASCADE,
  strength_value numeric,
  strength_unit text,
  composition_text text,
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS mediverify.product_identifiers (
  identifier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  UNIQUE (product_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_value ON mediverify.product_identifiers (identifier_value);

CREATE TABLE IF NOT EXISTS mediverify.sources (
  source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_type text,
  is_official boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS mediverify.source_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES mediverify.sources(source_id) ON DELETE CASCADE,
  title text,
  canonical_url text,
  document_url text,
  publication_date date
);

CREATE TABLE IF NOT EXISTS mediverify.safety_notices (
  notice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_identifier text,
  title text,
  notice_type text,
  severity text,
  action_date date,
  problem_statement text,
  risk_statement text,
  action_initiated text,
  source_document_id uuid REFERENCES mediverify.source_documents(document_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_notices_identifier ON mediverify.safety_notices (notice_identifier);

CREATE TABLE IF NOT EXISTS mediverify.recall_batches (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid REFERENCES mediverify.safety_notices(notice_id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  manufacturing_date date,
  expiry_date date,
  classification text,
  manufacturer_text text,
  remarks text
);

CREATE INDEX IF NOT EXISTS idx_recall_batches_product ON mediverify.recall_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_recall_batches_batch ON mediverify.recall_batches (batch_number);

CREATE TABLE IF NOT EXISTS mediverify.notice_products (
  notice_id uuid NOT NULL REFERENCES mediverify.safety_notices(notice_id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  disposition text,
  PRIMARY KEY (notice_id, product_id)
);

CREATE TABLE IF NOT EXISTS mediverify.product_sources (
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES mediverify.source_documents(document_id) ON DELETE CASCADE,
  source_role text,
  PRIMARY KEY (product_id, source_document_id)
);

CREATE TABLE IF NOT EXISTS mediverify.product_status_history (
  history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  old_status text,
  new_status text,
  reason text,
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_status_history_product ON mediverify.product_status_history (product_id);

CREATE TABLE IF NOT EXISTS mediverify.product_alternatives (
  alternative_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  alternative_product_id uuid NOT NULL REFERENCES mediverify.products(product_id) ON DELETE CASCADE,
  relationship_type text,
  ingredient_match integer,
  similarity_score numeric,
  ai_generated boolean DEFAULT false,
  rationale text,
  UNIQUE (original_product_id, alternative_product_id)
);

CREATE TABLE IF NOT EXISTS mediverify.admin_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES mediverify.users(user_id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_name text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_events_entity ON mediverify.admin_events (entity_id);

-- ---------------------------------------------------------------------
-- 2. rxguard application schema
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS rxguard;

-- Patient prescription records (typed details + uploaded/generated image)
CREATE TABLE IF NOT EXISTS rxguard.prescriptions (
  prescription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES mediverify.users(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  details text,
  file_name text,
  file_path text,
  mime_type text,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON rxguard.prescriptions (user_id, created_at DESC);

-- Doctor patient files (folders categorised by patient name)
CREATE TABLE IF NOT EXISTS rxguard.patient_files (
  file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES mediverify.users(user_id) ON DELETE CASCADE,
  patient_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_doctor_patient UNIQUE (doctor_id, patient_name)
);

-- Doctor prescriptions written on the notepad
CREATE TABLE IF NOT EXISTS rxguard.doctor_prescriptions (
  dp_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES rxguard.patient_files(file_id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES mediverify.users(user_id) ON DELETE CASCADE,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dp_doctor ON rxguard.doctor_prescriptions (doctor_id, updated_at DESC);

-- Search history for every role
CREATE TABLE IF NOT EXISTS rxguard.search_history (
  search_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES mediverify.users(user_id) ON DELETE CASCADE,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_user ON rxguard.search_history (user_id, created_at DESC);

-- System backup log
CREATE TABLE IF NOT EXISTS rxguard.backups (
  backup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint,
  status text NOT NULL DEFAULT 'success',
  triggered_by uuid REFERENCES mediverify.users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nearby medicine retailers
CREATE TABLE IF NOT EXISTS rxguard.retailers (
  retailer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chain text,
  city text NOT NULL,
  area text,
  address text,
  phone text,
  lat double precision,
  lng double precision,
  hours text
);

-- ---------------------------------------------------------------------
-- 3. Safe (active) registered medicines + supporting data
--    source: DRAP Registered Products (registry)
-- ---------------------------------------------------------------------
INSERT INTO mediverify.manufacturers (manufacturer_id, legal_name, country, address) VALUES
  ('11111111-1111-4111-8111-111111111101', 'GlaxoSmithKline Pakistan Ltd', 'Pakistan', '37th KM, Ferozepur Road, Lahore'),
  ('11111111-1111-4111-8111-111111111102', 'Abbott Laboratories (Pakistan) Ltd', 'Pakistan', 'Room 403, 4th Floor, Toyota Plaza, Karachi'),
  ('11111111-1111-4111-8111-111111111103', 'Sanofi-Aventis (Pakistan) Ltd', 'Pakistan', '37-A, Business Recorder Road, Karachi'),
  ('11111111-1111-4111-8111-111111111104', 'Bayer Pakistan (Pvt) Ltd', 'Pakistan', 'KIJB 13-14, Korangi, Karachi'),
  ('11111111-1111-4111-8111-111111111105', 'Pfizer Pakistan Ltd', 'Pakistan', 'Plot 13-A, Main Korangi Road, Karachi'),
  ('11111111-1111-4111-8111-111111111106', 'Roche Pakistan Ltd', 'Pakistan', '9-B, Korangi Industrial Area, Karachi'),
  ('11111111-1111-4111-8111-111111111107', 'Getz Pharma (Private) Ltd', 'Pakistan', 'Plot 27 & 28, Korangi Industrial Area, Karachi'),
  ('11111111-1111-4111-8111-111111111108', 'Hilton Pharmaceuticals (Pvt) Ltd', 'Pakistan', 'S.I.T.E. Area, Karachi'),
  ('11111111-1111-4111-8111-111111111109', 'Merck Sharp & Dohme (Pakistan) Ltd', 'Pakistan', '7th Floor, Fredy Towers, Karachi'),
  ('11111111-1111-4111-8111-111111111110', 'Eisai Co., Ltd.', 'Japan', '4-6-10 Koishikawa, Bunkyo-ku, Tokyo'),
  ('11111111-1111-4111-8111-111111111111', 'AstraZeneca Pakistan (Pvt) Ltd', 'Pakistan', 'Plot 24, Khayaban-e-Iqbal, Karachi'),
  ('11111111-1111-4111-8111-111111111112', 'Novartis Pharma AG', 'Switzerland', 'Lichtstrasse 35, Basel'),
  ('11111111-1111-4111-8111-111111111113', 'Sami Pharmaceuticals (Pvt.) Ltd.', 'Pakistan', '38-A, Sector 23, Korangi, Karachi'),
  ('11111111-1111-4111-8111-111111111114', 'Janssen-Cilag Pharmaceuticals', 'Belgium', 'Turnhoutseweg 30, Beerse'),
  ('11111111-1111-4111-8111-111111111115', 'Otsuka Pharmaceutical Factory, Inc.', 'Japan', '2-9 Kanda Tsukasamachi, Tokyo'),
  ('11111111-1111-4111-8111-111111111116', 'Reckitt Benckiser Pakistan Ltd', 'Pakistan', 'Plot 47, Sector 28, Korangi, Karachi')
ON CONFLICT (manufacturer_id) DO NOTHING;

-- New ingredients for safe medicines (existing mediverify ingredients are reused by name)
INSERT INTO mediverify.ingredients (ingredient_id, name) VALUES
  ('22222222-2222-4222-8222-222222222201', 'Ibuprofen'),
  ('22222222-2222-4222-8222-222222222202', 'Amoxicillin'),
  ('22222222-2222-4222-8222-222222222203', 'Clavulanic Acid'),
  ('22222222-2222-4222-8222-222222222204', 'Metformin Hydrochloride'),
  ('22222222-2222-4222-8222-222222222205', 'Atorvastatin Calcium'),
  ('22222222-2222-4222-8222-222222222206', 'Bisoprolol Fumarate'),
  ('22222222-2222-4222-8222-222222222207', 'Aspirin'),
  ('22222222-2222-4222-8222-222222222208', 'Cetirizine Dihydrochloride'),
  ('22222222-2222-4222-8222-222222222209', 'Esomeprazole Magnesium'),
  ('22222222-2222-4222-8222-222222222210', 'Salbutamol')
ON CONFLICT (ingredient_id) DO NOTHING;

-- Safe products. safety_status 'active' = safe to prescribe.
INSERT INTO mediverify.products (product_id, brand_name, normalized_name, dosage_form, registration_number, registration_date, manufacturer_id, source_category, safety_status, source_text) VALUES
  ('33333333-3333-4333-8333-333333333301', 'Panadol 500mg Tablet', 'panadol 500mg tablet', 'Tablet', '011706', '2010-04-12', '11111111-1111-4111-8111-111111111101', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Paracetamol 500 mg tablet for pain and fever.'),
  ('33333333-3333-4333-8333-333333333302', 'Flagyl 400mg Tablet', 'flagyl 400mg tablet', 'Tablet', '023101', '1996-08-20', '11111111-1111-4111-8111-111111111103', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Metronidazole 400 mg tablet.'),
  ('33333333-3333-4333-8333-333333333303', 'Ciproxin 500mg Tablet', 'ciproxin 500mg tablet', 'Tablet', '033617', '2004-02-11', '11111111-1111-4111-8111-111111111104', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Ciprofloxacin 500 mg tablet.'),
  ('33333333-3333-4333-8333-333333333304', 'Methycobal 500mcg Injection', 'methycobal 500mcg injection', 'Injection/Infusion', '044210', '2012-06-05', '11111111-1111-4111-8111-111111111110', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Mecobalamin 500 mcg injection.'),
  ('33333333-3333-4333-8333-333333333305', 'Feldene 20mg Tablet', 'feldene 20mg tablet', 'Tablet', '021045', '1994-11-02', '11111111-1111-4111-8111-111111111105', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Piroxicam 20 mg tablet.'),
  ('33333333-3333-4333-8333-333333333306', 'Toradol 30mg Injection', 'toradol 30mg injection', 'Injection/Infusion', '037992', '2007-03-19', '11111111-1111-4111-8111-111111111106', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Ketorolac Tromethamine 30 mg/ml injection.'),
  ('33333333-3333-4333-8333-333333333307', 'Decadron 4mg Injection', 'decadron 4mg injection', 'Injection/Infusion', '018462', '1992-01-15', '11111111-1111-4111-8111-111111111109', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Dexamethasone Sodium Phosphate 4 mg/ml injection.'),
  ('33333333-3333-4333-8333-333333333308', 'Iressa 250mg Tablet', 'iressa 250mg tablet', 'Tablet', '041377', '2009-09-28', '11111111-1111-4111-8111-111111111111', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Gefitinib 250 mg tablet.'),
  ('33333333-3333-4333-8333-333333333309', 'Endoxan 50mg Tablet', 'endoxan 50mg tablet', 'Tablet', '009214', '1988-07-07', '11111111-1111-4111-8111-111111111112', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Cyclophosphamide 50 mg tablet.'),
  ('33333333-3333-4333-8333-333333333310', 'Serta 10mg Tablet', 'serta 10mg tablet', 'Tablet', '029843', '2001-05-23', '11111111-1111-4111-8111-111111111113', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Serratiopeptidase 10 mg tablet.'),
  ('33333333-3333-4333-8333-333333333311', 'Xylocaine 2% Gel', 'xylocaine 2 gel', 'Gel', '013990', '1990-03-30', '11111111-1111-4111-8111-111111111111', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Lignocaine Hydrochloride 20 mg/g gel.'),
  ('33333333-3333-4333-8333-333333333312', 'Aquapure Sterile Water 5ml Injection', 'aquapure sterile water 5ml injection', 'Injection/Infusion', '050118', '2015-12-01', '11111111-1111-4111-8111-111111111115', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Sterile water for injection 5 ml ampoule.'),
  ('33333333-3333-4333-8333-333333333313', 'Tramacet 37.5/325mg Tablet', 'tramacet 37 5 325mg tablet', 'Tablet', '045880', '2013-10-14', '11111111-1111-4111-8111-111111111114', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Tramadol HCl 37.5 mg + Paracetamol 325 mg tablet.'),
  ('33333333-3333-4333-8333-333333333314', 'Anatrop 1mg Tablet', 'anatrop 1mg tablet', 'Tablet', '046210', '2014-04-08', '11111111-1111-4111-8111-111111111107', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Anastrozole 1 mg tablet.'),
  ('33333333-3333-4333-8333-333333333315', 'Brufen 400mg Tablet', 'brufen 400mg tablet', 'Tablet', '015076', '1991-02-26', '11111111-1111-4111-8111-111111111102', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Ibuprofen 400 mg tablet.'),
  ('33333333-3333-4333-8333-333333333316', 'Augmentin 625mg Tablet', 'augmentin 625mg tablet', 'Tablet', '007235', '1986-06-17', '11111111-1111-4111-8111-111111111101', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Amoxicillin 500 mg + Clavulanic Acid 125 mg tablet.'),
  ('33333333-3333-4333-8333-333333333317', 'Amoxil 500mg Capsule', 'amoxil 500mg capsule', 'Capsule', '005469', '1984-09-09', '11111111-1111-4111-8111-111111111101', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Amoxicillin 500 mg capsule.'),
  ('33333333-3333-4333-8333-333333333318', 'Glucophage 500mg Tablet', 'glucophage 500mg tablet', 'Tablet', '010193', '1989-12-12', '11111111-1111-4111-8111-111111111109', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Metformin Hydrochloride 500 mg tablet.'),
  ('33333333-3333-4333-8333-333333333319', 'Lipitor 10mg Tablet', 'lipitor 10mg tablet', 'Tablet', '016399', '1993-05-05', '11111111-1111-4111-8111-111111111105', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Atorvastatin Calcium 10 mg tablet.'),
  ('33333333-3333-4333-8333-333333333320', 'Concor 5mg Tablet', 'concor 5mg tablet', 'Tablet', '031615', '2002-10-30', '11111111-1111-4111-8111-111111111109', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Bisoprolol Fumarate 5 mg tablet.'),
  ('33333333-3333-4333-8333-333333333321', 'Loprin 75mg Tablet', 'loprin 75mg tablet', 'Tablet', '025726', '1999-01-19', '11111111-1111-4111-8111-111111111108', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Aspirin 75 mg tablet.'),
  ('33333333-3333-4333-8333-333333333322', 'Zyrtec 10mg Tablet', 'zyrtec 10mg tablet', 'Tablet', '034417', '2005-08-16', '11111111-1111-4111-8111-111111111101', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Cetirizine Dihydrochloride 10 mg tablet.'),
  ('33333333-3333-4333-8333-333333333323', 'Nexum 20mg Capsule', 'nexum 20mg capsule', 'Capsule', '038911', '2008-04-03', '11111111-1111-4111-8111-111111111107', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Esomeprazole Magnesium 20 mg capsule.'),
  ('33333333-3333-4333-8333-333333333324', 'Ventolin 100mcg Inhaler', 'ventolin 100mcg inhaler', 'Inhaler', '002647', '1982-11-08', '11111111-1111-4111-8111-111111111101', 'DRAP_REGISTRY', 'active', 'Registered with DRAP. Salbutamol 100 mcg per actuation inhaler.')
ON CONFLICT (product_id) DO NOTHING;

-- Link safe products to their ingredients (reuses existing mediverify ingredients by name)
INSERT INTO mediverify.product_ingredients (product_id, ingredient_id, strength_value, strength_unit, composition_text)
SELECT p.product_id, i.ingredient_id, v.strength_value, v.strength_unit, v.composition
FROM (VALUES
  ('33333333-3333-4333-8333-333333333301', 'Paracetamol', 500, 'mg', 'Paracetamol 500 mg'),
  ('33333333-3333-4333-8333-333333333302', 'Metronidazole', 400, 'mg', 'Metronidazole 400 mg'),
  ('33333333-3333-4333-8333-333333333303', 'Ciprofloxacin', 500, 'mg', 'Ciprofloxacin 500 mg'),
  ('33333333-3333-4333-8333-333333333304', 'Mecobalamin', 500, 'mcg', 'Mecobalamin 500 mcg'),
  ('33333333-3333-4333-8333-333333333305', 'Piroxicam', 20, 'mg', 'Piroxicam 20 mg'),
  ('33333333-3333-4333-8333-333333333306', 'Ketorolac Tromethamine', 30, 'mg', 'Ketorolac Tromethamine 30 mg'),
  ('33333333-3333-4333-8333-333333333307', 'Dexamethasone Sodium Phosphate', 4, 'mg', 'Dexamethasone Sodium Phosphate 4 mg'),
  ('33333333-3333-4333-8333-333333333308', 'Gefitinib', 250, 'mg', 'Gefitinib 250 mg'),
  ('33333333-3333-4333-8333-333333333309', 'Cyclophosphamide', 50, 'mg', 'Cyclophosphamide 50 mg'),
  ('33333333-3333-4333-8333-333333333310', 'Serratiopeptidase', 10, 'mg', 'Serratiopeptidase 10 mg'),
  ('33333333-3333-4333-8333-333333333311', 'Lignocaine Hydrochloride', 20, 'mg/g', 'Lignocaine Hydrochloride 20 mg/g'),
  ('33333333-3333-4333-8333-333333333312', 'Sterile water for injection', NULL, NULL, 'Sterile water for injection 5 ml'),
  ('33333333-3333-4333-8333-333333333313', 'Tramadol HCl + Paracetamol', NULL, NULL, 'Tramadol HCl 37.5 mg + Paracetamol 325 mg'),
  ('33333333-3333-4333-8333-333333333314', 'Anastrozole', 1, 'mg', 'Anastrozole 1 mg'),
  ('33333333-3333-4333-8333-333333333315', 'Ibuprofen', 400, 'mg', 'Ibuprofen 400 mg'),
  ('33333333-3333-4333-8333-333333333316', 'Amoxicillin', 500, 'mg', 'Amoxicillin 500 mg'),
  ('33333333-3333-4333-8333-333333333316', 'Clavulanic Acid', 125, 'mg', 'Clavulanic Acid 125 mg'),
  ('33333333-3333-4333-8333-333333333317', 'Amoxicillin', 500, 'mg', 'Amoxicillin 500 mg'),
  ('33333333-3333-4333-8333-333333333318', 'Metformin Hydrochloride', 500, 'mg', 'Metformin Hydrochloride 500 mg'),
  ('33333333-3333-4333-8333-333333333319', 'Atorvastatin Calcium', 10, 'mg', 'Atorvastatin Calcium 10 mg'),
  ('33333333-3333-4333-8333-333333333320', 'Bisoprolol Fumarate', 5, 'mg', 'Bisoprolol Fumarate 5 mg'),
  ('33333333-3333-4333-8333-333333333321', 'Aspirin', 75, 'mg', 'Aspirin 75 mg'),
  ('33333333-3333-4333-8333-333333333322', 'Cetirizine Dihydrochloride', 10, 'mg', 'Cetirizine Dihydrochloride 10 mg'),
  ('33333333-3333-4333-8333-333333333323', 'Esomeprazole Magnesium', 20, 'mg', 'Esomeprazole Magnesium 20 mg'),
  ('33333333-3333-4333-8333-333333333324', 'Salbutamol', 100, 'mcg', 'Salbutamol 100 mcg')
) AS v(product_id, ingredient_name, strength_value, strength_unit, composition)
JOIN mediverify.products p ON p.product_id = v.product_id::uuid
JOIN mediverify.ingredients i ON i.name = v.ingredient_name
ON CONFLICT DO NOTHING;

-- Registration + batch identifiers for safe products
INSERT INTO mediverify.product_identifiers (identifier_id, product_id, identifier_type, identifier_value)
SELECT gen_random_uuid(), p.product_id, 'drap_registration_number', p.registration_number
FROM mediverify.products p
WHERE p.source_category = 'DRAP_REGISTRY' AND p.registration_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mediverify.product_identifiers pi
    WHERE pi.product_id = p.product_id AND pi.identifier_type = 'drap_registration_number'
  );

INSERT INTO mediverify.product_identifiers (identifier_id, product_id, identifier_type, identifier_value)
SELECT gen_random_uuid(), p.product_id, 'batch_number', v.batch
FROM (VALUES
  ('Panadol 500mg Tablet', 'PN-24A-1101'),
  ('Flagyl 400mg Tablet', 'FL-24B-0230'),
  ('Ciproxin 500mg Tablet', 'CX-24C-0445'),
  ('Methycobal 500mcg Injection', 'MB-24A-0092'),
  ('Feldene 20mg Tablet', 'FE-23D-1180'),
  ('Toradol 30mg Injection', 'TR-24A-0207'),
  ('Decadron 4mg Injection', 'DC-24B-0331'),
  ('Iressa 250mg Tablet', 'IR-24A-0012'),
  ('Endoxan 50mg Tablet', 'EX-23F-0754'),
  ('Serta 10mg Tablet', 'ST-24B-0663'),
  ('Xylocaine 2% Gel', 'XL-24A-0058'),
  ('Aquapure Sterile Water 5ml Injection', 'AQ-24C-1289'),
  ('Tramacet 37.5/325mg Tablet', 'TC-24A-0417'),
  ('Anatrop 1mg Tablet', 'AN-24B-0155'),
  ('Brufen 400mg Tablet', 'BF-24A-2204'),
  ('Augmentin 625mg Tablet', 'AG-24C-0980'),
  ('Amoxil 500mg Capsule', 'AM-23G-1023'),
  ('Glucophage 500mg Tablet', 'GP-24B-2011'),
  ('Lipitor 10mg Tablet', 'LP-24A-0307'),
  ('Concor 5mg Tablet', 'CN-24B-0876'),
  ('Loprin 75mg Tablet', 'LR-24A-1509'),
  ('Zyrtec 10mg Tablet', 'ZT-24C-0044'),
  ('Nexum 20mg Capsule', 'NX-24A-1902'),
  ('Ventolin 100mcg Inhaler', 'VT-24B-0035')
) AS v(brand_name, batch)
JOIN mediverify.products p ON p.brand_name = v.brand_name
WHERE NOT EXISTS (
  SELECT 1 FROM mediverify.product_identifiers pi
  WHERE pi.product_id = p.product_id AND pi.identifier_type = 'batch_number' AND pi.identifier_value = v.batch
);

-- ---------------------------------------------------------------------
-- 4. Seed retailers (nearby medicine retailers for patients)
-- ---------------------------------------------------------------------
INSERT INTO rxguard.retailers (name, chain, city, area, address, phone, lat, lng, hours) VALUES
  ('Servaid Pharmacy DHA', 'Servaid', 'Lahore', 'DHA Phase 5', 'Main Boulevard, DHA Phase 5, Lahore', '042-111-743-743', 31.4697, 74.4103, '24 hours'),
  ('Servaid Pharmacy Gulberg', 'Servaid', 'Lahore', 'Gulberg III', 'MM Alam Road, Gulberg III, Lahore', '042-111-743-743', 31.5204, 74.3587, '24 hours'),
  ('D. Watson Pharmacy Clifton', 'D. Watson', 'Karachi', 'Clifton Block 2', 'Khayaban-e-Iqbal, Clifton Block 2, Karachi', '021-3583-4521', 24.8138, 67.0299, '24 hours'),
  ('D. Watson Pharmacy DHA', 'D. Watson', 'Karachi', 'DHA Phase 6', 'Khayaban-e-Shaheen, DHA Phase 6, Karachi', '021-3534-4477', 24.8339, 67.0623, '09:00 - 23:00'),
  ('Wellpix Pharmacy F-7', 'Wellpix', 'Islamabad', 'F-7 Markaz', 'Jinnah Super Market, F-7, Islamabad', '051-261-1234', 33.7182, 73.0577, '24 hours'),
  ('Ideal Pharmacy Model Town', 'Ideal', 'Lahore', 'Model Town', 'Link Road, Model Town, Lahore', '042-3591-7788', 31.4805, 74.3239, '09:00 - 22:00'),
  ('The Lahore Pharmacy', 'Independent', 'Lahore', 'Johar Town', 'Pia Main Boulevard, Johar Town, Lahore', '042-3522-0091', 31.4697, 74.2728, '24 hours'),
  ('Shaheen Chemist Saddar', 'Independent', 'Karachi', 'Saddar', 'Abdullah Haroon Road, Saddar, Karachi', '021-3568-2230', 24.8565, 67.0311, '09:00 - 21:00'),
  ('Al-Fazal Pharmacy Blue Area', 'Independent', 'Islamabad', 'Blue Area', 'Jinnah Avenue, Blue Area, Islamabad', '051-280-3344', 33.7078, 73.0488, '24 hours'),
  ('Hayat Pharmacy Satellite Town', 'Independent', 'Rawalpindi', 'Satellite Town', 'Bank Road, Satellite Town, Rawalpindi', '051-457-2121', 33.6198, 73.0679, '09:00 - 23:00'),
  ('Rehman Medical Store Faisalabad', 'Independent', 'Faisalabad', 'Peoples Colony', 'Susan Road, Peoples Colony No.1, Faisalabad', '041-872-4455', 31.4187, 73.0791, '09:00 - 22:00'),
  ('City Pharmacy University Road', 'Independent', 'Peshawar', 'University Town', 'University Road, Peshawar', '091-584-6677', 33.9940, 71.4762, '09:00 - 21:00')
ON CONFLICT DO NOTHING;
