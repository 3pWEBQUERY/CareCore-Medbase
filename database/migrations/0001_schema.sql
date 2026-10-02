-- CareCore Medbase: Arzneimittel der Schweiz.
-- Ein Arzneimittel (Produkt) entspricht einer Dosisstärke einer Swissmedic-Zulassung; es hat Wirkstoffe, Packungen
-- (je eine GTIN) und Bilder. Die Suche läuft über ein normalisiertes Suchdokument mit Trigramm-Index.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Kleinschreibung ohne Akzente und Umlaute (ä → a, ß → ss), damit „Lösung“, „Losung“ und „LÖSUNG“ gleich gefunden werden.
CREATE OR REPLACE FUNCTION medbase_normalize(value TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT replace(
    translate(
      lower(coalesce(value, '')),
      'äàáâãåöòóôõøüùúûïìíîëèéêçñÿ',
      'aaaaaaoooooouuuuiiiieeeecny'
    ),
    'ß', 'ss'
  )
$$;

CREATE TABLE medbase_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX medbase_users_username_key ON medbase_users (lower(username));

CREATE TABLE medbase_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES medbase_users (id) ON DELETE CASCADE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX medbase_sessions_user_idx ON medbase_sessions (user_id);

-- Darreichungsformen mit der Art der Abbildung (Faltschachtel, Tropfflasche, Tube …) für die Packungsabbildung.
CREATE TABLE medbase_dosage_forms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  form_group TEXT NOT NULL CHECK (
    form_group IN ('fest', 'fluessig', 'halbfest', 'parenteral', 'inhalativ', 'transdermal', 'andere')
  ),
  illustration TEXT NOT NULL DEFAULT 'box' CHECK (
    illustration IN ('box', 'dropper', 'bottle', 'tube', 'spray', 'vial', 'sachet', 'inhaler', 'patch')
  ),
  -- Begriffe, an denen der Import die Darreichungsform in der Bezeichnung erkennt (Kleinschreibung).
  keywords TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medbase_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX medbase_companies_name_key ON medbase_companies (medbase_normalize(name));

CREATE TABLE medbase_substances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- Lateinische Bezeichnung wie in der Swissmedic-Liste („paracetamolum“).
  latin_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX medbase_substances_name_key ON medbase_substances (medbase_normalize(name));
CREATE UNIQUE INDEX medbase_substances_latin_key ON medbase_substances (medbase_normalize(latin_name))
  WHERE latin_name IS NOT NULL;

-- ATC-Klassifikation (WHO); Stufe aus der Länge des Codes (1, 3, 4, 5, 7 Zeichen).
CREATE TABLE medbase_atc (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z]([0-9]{2}([A-Z]([A-Z]([0-9]{2})?)?)?)?$'),
  name TEXT NOT NULL,
  level SMALLINT GENERATED ALWAYS AS (
    CASE length(code) WHEN 1 THEN 1 WHEN 3 THEN 2 WHEN 4 THEN 3 WHEN 5 THEN 4 ELSE 5 END
  ) STORED
);

CREATE TABLE medbase_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  -- Stärke und Form wie auf der Packung, z. B. „500 mg, Filmtabletten“.
  description_line TEXT,
  authorization_number TEXT CHECK (authorization_number ~ '^[0-9]{5}$'),
  dosage_number TEXT,
  company_id UUID REFERENCES medbase_companies (id) ON DELETE SET NULL,
  dosage_form_id INTEGER REFERENCES medbase_dosage_forms (id) ON DELETE SET NULL,
  atc_code TEXT,
  dispensing_category CHAR(1) CHECK (dispensing_category IN ('A', 'B', 'C', 'D', 'E')),
  -- Verzeichnis der Betäubungsmittelverzeichnisverordnung (a, b, c, d); leer, wenn nicht betäubungsmittelhaltig.
  narcotic_list CHAR(1) CHECK (narcotic_list IN ('a', 'b', 'c', 'd')),
  sl_listed BOOLEAN NOT NULL DEFAULT FALSE,
  product_type TEXT CHECK (product_type IN ('original', 'generikum', 'biosimilar', 'komplementaer', 'andere')),
  -- Heilmittelcode der Swissmedic (Synthetika, Biotechnologika, Phytoarzneimittel …).
  remedy_code TEXT,
  composition TEXT,
  indication TEXT,
  notes TEXT,
  first_authorized_on DATE,
  authorization_valid_until DATE,
  status TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'ausser_handel', 'entwurf')),
  source TEXT NOT NULL DEFAULT 'manuell' CHECK (source IN ('beispiel', 'swissmedic', 'manuell')),
  search_document TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES medbase_users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX medbase_products_authorization_key ON medbase_products (authorization_number, dosage_number)
  WHERE authorization_number IS NOT NULL AND dosage_number IS NOT NULL;
CREATE INDEX medbase_products_search_idx ON medbase_products USING gin (search_document gin_trgm_ops);
CREATE INDEX medbase_products_name_idx ON medbase_products (medbase_normalize(name), description_line);
CREATE INDEX medbase_products_atc_idx ON medbase_products (atc_code text_pattern_ops);
CREATE INDEX medbase_products_company_idx ON medbase_products (company_id);
CREATE INDEX medbase_products_form_idx ON medbase_products (dosage_form_id);
CREATE INDEX medbase_products_updated_idx ON medbase_products (updated_at DESC);

CREATE TABLE medbase_product_substances (
  product_id UUID NOT NULL REFERENCES medbase_products (id) ON DELETE CASCADE,
  substance_id UUID NOT NULL REFERENCES medbase_substances (id) ON DELETE RESTRICT,
  amount NUMERIC(14, 4),
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, substance_id)
);
CREATE INDEX medbase_product_substances_substance_idx ON medbase_product_substances (substance_id);

CREATE TABLE medbase_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES medbase_products (id) ON DELETE CASCADE,
  package_code TEXT CHECK (package_code ~ '^[0-9]{3}$'),
  gtin TEXT CHECK (gtin ~ '^[0-9]{13}$'),
  pharmacode TEXT,
  quantity NUMERIC(12, 3),
  unit TEXT,
  dispensing_category CHAR(1) CHECK (dispensing_category IN ('A', 'B', 'C', 'D', 'E')),
  ex_factory_price NUMERIC(10, 2) CHECK (ex_factory_price >= 0),
  public_price NUMERIC(10, 2) CHECK (public_price >= 0),
  sl_listed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'ausser_handel')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX medbase_packages_gtin_key ON medbase_packages (gtin) WHERE gtin IS NOT NULL;
CREATE UNIQUE INDEX medbase_packages_code_key ON medbase_packages (product_id, package_code)
  WHERE package_code IS NOT NULL;
CREATE INDEX medbase_packages_product_idx ON medbase_packages (product_id, sort_order);

-- Bilder liegen im Bucket (storage_key, thumb_key); ohne Bucket (lokal) in der Datenbank (data, thumb_data).
CREATE TABLE medbase_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES medbase_products (id) ON DELETE SET NULL,
  storage_key TEXT,
  thumb_key TEXT,
  data BYTEA,
  thumb_data BYTEA,
  content_type TEXT NOT NULL,
  thumb_content_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  byte_size INTEGER NOT NULL,
  original_filename TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'upload' CHECK (origin IN ('upload', 'generiert')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES medbase_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (storage_key IS NOT NULL OR data IS NOT NULL)
);
CREATE INDEX medbase_images_product_idx ON medbase_images (product_id, is_primary DESC, sort_order);
CREATE UNIQUE INDEX medbase_images_primary_key ON medbase_images (product_id) WHERE is_primary AND product_id IS NOT NULL;
CREATE INDEX medbase_images_created_idx ON medbase_images (created_at DESC);

CREATE TABLE medbase_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'laeuft' CHECK (status IN ('laeuft', 'abgeschlossen', 'fehler')),
  stats JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  started_by UUID REFERENCES medbase_users (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX medbase_import_runs_started_idx ON medbase_import_runs (started_at DESC);

CREATE TABLE medbase_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES medbase_users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX medbase_audit_log_created_idx ON medbase_audit_log (created_at DESC);
CREATE INDEX medbase_audit_log_entity_idx ON medbase_audit_log (entity, entity_id);

-- Suchdokument eines Arzneimittels neu aufbauen: Name, Zeile, Wirkstoffe, Firma, Form, ATC (Code und Name),
-- Zulassungsnummer, GTIN und Pharmacode der Packungen.
CREATE OR REPLACE FUNCTION medbase_refresh_search(ids UUID[]) RETURNS VOID
LANGUAGE sql AS $$
  UPDATE medbase_products p
  SET search_document = medbase_normalize(concat_ws(' ',
    p.name, p.description_line, p.authorization_number, p.atc_code,
    (SELECT name FROM medbase_atc WHERE code = p.atc_code),
    (SELECT name FROM medbase_companies WHERE id = p.company_id),
    (SELECT name FROM medbase_dosage_forms WHERE id = p.dosage_form_id),
    (SELECT string_agg(concat_ws(' ', s.name, s.latin_name), ' ')
       FROM medbase_product_substances ps JOIN medbase_substances s ON s.id = ps.substance_id
      WHERE ps.product_id = p.id),
    (SELECT string_agg(concat_ws(' ', pk.gtin, pk.pharmacode), ' ') FROM medbase_packages pk WHERE pk.product_id = p.id)
  ))
  WHERE p.id = ANY(ids)
$$;
